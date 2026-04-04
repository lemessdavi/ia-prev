import { makeFunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./server";
import {
  findUserByUserId,
  requireSession,
  toAttachment,
  toContactProfile,
  toContactProfileEvent,
  toHandoffEvent,
  toMessage,
} from "./coreAuth";
import { throwBusinessError } from "./coreErrors";
import {
  assertAttachmentUrl,
  assertClosureReason,
  assertConversationStatusFilter,
  assertId,
  assertMessageBody,
  assertSearchTerm,
} from "./coreInput";
import {
  conversationAttachmentArchiveValidator,
  conversationInboxItemValidator,
  conversationListItemValidator,
  conversationStatusValidator,
  conversationThreadPayloadValidator,
  contactProfileEventValidator,
  contactProfileValidator,
  messageValidator,
  tenantWorkspaceSummaryValidator,
  triageResultValidator,
} from "./coreValidators";
import { conversationAttachmentExportZipFileName } from "../../utils/src/conversationAttachmentExportZipFileName";

type SessionShape = {
  tenantId: string;
  userId: string;
};

const handoffPreparationValidator = v.object({
  tenantId: v.string(),
  conversationId: v.string(),
  operatorUserId: v.string(),
  operatorName: v.string(),
  phoneNumberId: v.string(),
  recipientWaId: v.string(),
  notificationMessage: v.string(),
});

async function requireConversationForParticipant(db: any, input: { tenantId: string; conversationId: string; userId: string }) {
  const conversation = await db
    .query("conversations")
    .withIndex("by_conversation_id", (q: any) => q.eq("conversationId", input.conversationId))
    .unique();

  if (!conversation || conversation.tenantId !== input.tenantId) {
    throwBusinessError("NOT_FOUND", "Conversa nao encontrada.", {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
    });
  }

  const membership = await db
    .query("conversationMemberships")
    .withIndex("by_tenant_id_and_conversation_id_and_user_id", (q: any) =>
      q.eq("tenantId", input.tenantId).eq("conversationId", input.conversationId).eq("userId", input.userId),
    )
    .unique();

  if (!membership) {
    throwBusinessError("FORBIDDEN", "Voce nao pode acessar esta conversa.", {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
      userId: input.userId,
    });
  }

  return conversation;
}

async function requireTenantConversation(db: any, input: { tenantId: string; conversationId: string }) {
  const conversation = await db
    .query("conversations")
    .withIndex("by_conversation_id", (q: any) => q.eq("conversationId", input.conversationId))
    .unique();

  if (!conversation || conversation.tenantId !== input.tenantId) {
    throwBusinessError("NOT_FOUND", "Conversa nao encontrada.", {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
    });
  }

  return conversation;
}

function resolveContactId(participantIds: string[], currentUserId: string): string {
  const candidate = participantIds.find((id) => id !== currentUserId) ?? participantIds[0];
  if (!candidate) {
    throwBusinessError("BAD_REQUEST", "A conversa esta sem participantes.", {
      currentUserId,
    });
  }
  return candidate;
}

function buildHandoffNotificationMessage(operatorName: string): string {
  return `${operatorName} assumiu a conversa e continuará seu atendimento por aqui.`;
}

function sanitizeIdPart(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized.length === 0) {
    return "x";
  }
  return normalized.slice(0, 80);
}

function toInlineAttachment(messageId: string, attachmentUrl?: string): {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
} | null {
  if (!attachmentUrl) return null;

  const fileName = attachmentUrl.split("/").filter(Boolean).at(-1) ?? `attachment_${messageId}`;
  const lowered = fileName.toLowerCase();

  let contentType = "application/octet-stream";
  if (lowered.endsWith(".pdf")) contentType = "application/pdf";
  if (lowered.endsWith(".jpg") || lowered.endsWith(".jpeg")) contentType = "image/jpeg";
  if (lowered.endsWith(".png")) contentType = "image/png";
  if (lowered.endsWith(".ogg")) contentType = "audio/ogg";

  return {
    id: `att_inline_${messageId}`,
    fileName,
    contentType,
    url: attachmentUrl,
  };
}

async function resolveAttachmentUrl(ctx: any, row: any): Promise<string> {
  if (typeof row.storageId === "string") {
    const storageUrl = await ctx.storage.getUrl(row.storageId);
    if (storageUrl) {
      return storageUrl;
    }
  }

  if (typeof row.url === "string" && row.url.trim().length > 0) {
    return row.url.trim();
  }

  throwBusinessError("NOT_FOUND", "Attachment download URL is unavailable.", {
    attachmentId: row.attachmentId,
    storageId: row.storageId,
  });
}

async function toThreadAttachment(ctx: any, row: any) {
  return {
    id: row.attachmentId,
    fileName: row.fileName,
    contentType: row.contentType,
    url: await resolveAttachmentUrl(ctx, row),
    storageId: row.storageId,
  };
}

function normalizeAttachmentFileName(fileName: string, index: number): string {
  const normalized = fileName.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ");
  if (normalized.length > 0) {
    return normalized.slice(0, 180);
  }
  return `arquivo-${index + 1}.bin`;
}

function dedupeArchiveFileName(fileName: string, usedNames: Set<string>): string {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }

  const extensionIndex = fileName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0 && extensionIndex < fileName.length - 1;
  const base = hasExtension ? fileName.slice(0, extensionIndex) : fileName;
  const extension = hasExtension ? fileName.slice(extensionIndex) : "";

  let counter = 2;
  while (true) {
    const candidate = `${base}-${counter}${extension}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    counter += 1;
  }
}

type ArchiveZipEntry = {
  name: string;
  bytes: Uint8Array;
  modifiedAt: Date;
};

const ARCHIVE_CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let j = 0; j < 8; j += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function archiveCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc = (crc >>> 8) ^ ARCHIVE_CRC32_TABLE[(crc ^ value) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeArchiveUint16LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

function writeArchiveUint32LE(buffer: Uint8Array, offset: number, value: number): void {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function toDosDateTime(value: Date): { dosDate: number; dosTime: number } {
  const year = Math.max(1980, value.getFullYear());
  const month = value.getMonth() + 1;
  const day = value.getDate();
  const hours = value.getHours();
  const minutes = value.getMinutes();
  const seconds = Math.floor(value.getSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { dosDate, dosTime };
}

function concatArchiveBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function createAttachmentArchiveZip(entries: ArchiveZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localSections: Uint8Array[] = [];
  const centralSections: Uint8Array[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = archiveCrc32(entry.bytes);
    const { dosDate, dosTime } = toDosDateTime(entry.modifiedAt);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeArchiveUint32LE(localHeader, 0, 0x04034b50);
    writeArchiveUint16LE(localHeader, 4, 20);
    writeArchiveUint16LE(localHeader, 6, 0x0800);
    writeArchiveUint16LE(localHeader, 8, 0);
    writeArchiveUint16LE(localHeader, 10, dosTime);
    writeArchiveUint16LE(localHeader, 12, dosDate);
    writeArchiveUint32LE(localHeader, 14, crc);
    writeArchiveUint32LE(localHeader, 18, entry.bytes.length);
    writeArchiveUint32LE(localHeader, 22, entry.bytes.length);
    writeArchiveUint16LE(localHeader, 26, nameBytes.length);
    writeArchiveUint16LE(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);
    localSections.push(localHeader, entry.bytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeArchiveUint32LE(centralHeader, 0, 0x02014b50);
    writeArchiveUint16LE(centralHeader, 4, 20);
    writeArchiveUint16LE(centralHeader, 6, 20);
    writeArchiveUint16LE(centralHeader, 8, 0x0800);
    writeArchiveUint16LE(centralHeader, 10, 0);
    writeArchiveUint16LE(centralHeader, 12, dosTime);
    writeArchiveUint16LE(centralHeader, 14, dosDate);
    writeArchiveUint32LE(centralHeader, 16, crc);
    writeArchiveUint32LE(centralHeader, 20, entry.bytes.length);
    writeArchiveUint32LE(centralHeader, 24, entry.bytes.length);
    writeArchiveUint16LE(centralHeader, 28, nameBytes.length);
    writeArchiveUint16LE(centralHeader, 30, 0);
    writeArchiveUint16LE(centralHeader, 32, 0);
    writeArchiveUint16LE(centralHeader, 34, 0);
    writeArchiveUint16LE(centralHeader, 36, 0);
    writeArchiveUint32LE(centralHeader, 38, 0);
    writeArchiveUint32LE(centralHeader, 42, currentOffset);
    centralHeader.set(nameBytes, 46);
    centralSections.push(centralHeader);

    currentOffset += localHeader.length + entry.bytes.length;
  }

  const localBytes = concatArchiveBytes(localSections);
  const centralBytes = concatArchiveBytes(centralSections);

  const end = new Uint8Array(22);
  writeArchiveUint32LE(end, 0, 0x06054b50);
  writeArchiveUint16LE(end, 4, 0);
  writeArchiveUint16LE(end, 6, 0);
  writeArchiveUint16LE(end, 8, entries.length);
  writeArchiveUint16LE(end, 10, entries.length);
  writeArchiveUint32LE(end, 12, centralBytes.length);
  writeArchiveUint32LE(end, 16, localBytes.length);
  writeArchiveUint16LE(end, 20, 0);

  return concatArchiveBytes([localBytes, centralBytes, end]);
}

async function loadAttachmentBytesForArchive(ctx: any, row: any): Promise<Uint8Array | null> {
  if (typeof row.storageId === "string") {
    const blob = await ctx.storage.get(row.storageId);
    if (blob) {
      return new Uint8Array(await blob.arrayBuffer());
    }
  }

  if (typeof row.url !== "string" || row.url.trim().length === 0) {
    return null;
  }

  const response = await fetch(row.url).catch(() => null);
  if (!response || !response.ok) {
    return null;
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function listConversationsForSession(db: any, session: SessionShape) {
  const memberships = await db
    .query("conversationMemberships")
    .withIndex("by_tenant_id_and_user_id", (q: any) => q.eq("tenantId", session.tenantId).eq("userId", session.userId))
    .collect();

  const rows = (
    await Promise.all(
      memberships.map(async (membership: any) => {
        const conversation = await db
          .query("conversations")
          .withIndex("by_conversation_id", (q: any) => q.eq("conversationId", membership.conversationId))
          .unique();

        if (!conversation || conversation.tenantId !== session.tenantId) {
          return null;
        }

        const messages = await db
          .query("messages")
          .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
            q.eq("tenantId", session.tenantId).eq("conversationId", conversation.conversationId),
          )
          .collect();

        const unreadCount = messages.filter(
          (message: any) => message.senderId !== session.userId && !message.readBy.includes(session.userId),
        ).length;

        return {
          conversation,
          item: {
            conversationId: conversation.conversationId,
            title: conversation.title,
            lastMessagePreview: conversation.lastMessagePreview,
            lastMessageAt: conversation.lastMessageAt,
            lastActivityAt: conversation.lastActivityAt,
            unreadCount,
          },
        };
      }),
    )
  ).filter((value) => value !== null);

  rows.sort((a, b) => b.item.lastActivityAt - a.item.lastActivityAt);
  return rows;
}

async function listInboxRows(db: any, session: SessionShape, input: { status?: string; search?: string }) {
  const statusFilter = assertConversationStatusFilter(input.status);
  const searchFilter = assertSearchTerm(input.search);

  const conversations = await db
    .query("conversations")
    .withIndex("by_tenant_id_and_last_activity", (q: any) => q.eq("tenantId", session.tenantId))
    .order("desc")
    .collect();

  const filteredByStatus = conversations.filter((conversation: any) =>
    statusFilter === "ALL" ? true : conversation.conversationStatus === statusFilter,
  );

  const filtered = filteredByStatus.filter((conversation: any) => {
    if (!searchFilter) return true;
    const haystack = `${conversation.title} ${conversation.lastMessagePreview}`.toLowerCase();
    return haystack.includes(searchFilter);
  });

  return await Promise.all(
    filtered.map(async (conversation: any) => {
      const [messages, attachments, handoffEvents] = await Promise.all([
        db
          .query("messages")
          .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
            q.eq("tenantId", session.tenantId).eq("conversationId", conversation.conversationId),
          )
          .collect(),
        db
          .query("attachments")
          .withIndex("by_tenant_id_and_conversation_id", (q: any) =>
            q.eq("tenantId", session.tenantId).eq("conversationId", conversation.conversationId),
          )
          .collect(),
        db
          .query("handoffEvents")
          .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
            q.eq("tenantId", session.tenantId).eq("conversationId", conversation.conversationId),
          )
          .collect(),
      ]);

      const unreadCount = messages.filter(
        (message: any) => message.senderId !== session.userId && !message.readBy.includes(session.userId),
      ).length;

      const hasAttachment =
        attachments.length > 0 || messages.some((message: any) => typeof message.attachmentUrl === "string");
      const hasHumanHandoff = handoffEvents.some((event: any) => event.to === "human");

      return {
        conversationId: conversation.conversationId,
        title: conversation.title,
        conversationStatus: conversation.conversationStatus,
        triageResult: conversation.triageResult,
        closureReason: conversation.closureReason,
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageAt: conversation.lastMessageAt,
        lastActivityAt: conversation.lastActivityAt,
        unreadCount,
        hasAttachment,
        hasHumanHandoff,
      };
    }),
  );
}

export const listConversationsWithUnreadBadge = query({
  args: { sessionToken: v.string() },
  returns: v.array(conversationListItemValidator),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const rows = await listConversationsForSession(ctx.db, session);
    return rows.map((row) => row.item);
  },
});

export const getConversationMessages = query({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: v.array(messageValidator),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");

    await requireConversationForParticipant(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
      userId: session.userId,
    });

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
      )
      .collect();

    return messages.map((message) => toMessage(message));
  },
});

export const getTenantWorkspaceSummary = query({
  args: { sessionToken: v.string() },
  returns: tenantWorkspaceSummaryValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);

    const [tenant, wabaMapping, activeProfile, user] = await Promise.all([
      ctx.db
        .query("tenants")
        .withIndex("by_tenant_id", (q: any) => q.eq("tenantId", session.tenantId))
        .unique(),
      ctx.db
        .query("wabaTenantMappings")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", session.tenantId))
        .first(),
      ctx.db
        .query("aiProfiles")
        .withIndex("by_tenant_id_and_active", (q: any) => q.eq("tenantId", session.tenantId).eq("isActive", true))
        .first(),
      findUserByUserId(ctx.db, session.userId),
    ]);

    if (!tenant || !wabaMapping || !activeProfile || !user || user.tenantId !== session.tenantId) {
      throwBusinessError("NOT_FOUND", "O workspace do tenant nao esta totalmente configurado.", {
        tenantId: session.tenantId,
        userId: session.userId,
      });
    }

    return {
      tenantId: tenant.tenantId,
      tenantName: tenant.name,
      wabaLabel: wabaMapping.displayName,
      activeAiProfileName: activeProfile.name,
      operator: {
        userId: user.userId,
        fullName: user.fullName,
        username: user.username,
      },
    };
  },
});

export const listConversationsForInbox = query({
  args: {
    sessionToken: v.string(),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  returns: v.array(conversationInboxItemValidator),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    return await listInboxRows(ctx.db, session, {
      status: args.status,
      search: args.search,
    });
  },
});

export const getConversationThread = query({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: conversationThreadPayloadValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    const [attachments, messages, handoffEvents] = await Promise.all([
      ctx.db
        .query("attachments")
        .withIndex("by_tenant_id_and_conversation_id", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
        )
        .collect(),
      ctx.db
        .query("messages")
        .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
        )
        .collect(),
      ctx.db
        .query("handoffEvents")
        .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
        )
        .collect(),
    ]);

    const attachmentsByMessageId = new Map(
      attachments.filter((row: any) => typeof row.messageId === "string").map((row: any) => [row.messageId, row]),
    );

    const threadMessages = await Promise.all(
      messages.map(async (message: any) => {
        const linkedAttachment = attachmentsByMessageId.get(message.messageId);
        const inlineAttachment = toInlineAttachment(message.messageId, message.attachmentUrl);
        const attachment =
          linkedAttachment && typeof linkedAttachment.messageId === "string"
            ? await toThreadAttachment(ctx, linkedAttachment)
            : inlineAttachment;

        return {
          id: message.messageId,
          senderId: message.senderId,
          body: message.body,
          createdAt: message.createdAt,
          readBy: message.readBy,
          attachment: attachment ?? undefined,
        };
      }),
    );

    return {
      conversationId: conversation.conversationId,
      title: conversation.title,
      conversationStatus: conversation.conversationStatus,
      triageResult: conversation.triageResult,
      closureReason: conversation.closureReason,
      participantIds: conversation.participantIds,
      messages: threadMessages,
      handoffEvents: handoffEvents.map((row: any) => toHandoffEvent(row)),
    };
  },
});

export const sendMessage = mutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
    body: v.string(),
    attachmentUrl: v.optional(v.string()),
  },
  returns: messageValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const body = assertMessageBody(args.body);
    const attachmentUrl = assertAttachmentUrl(args.attachmentUrl);
    const now = Date.now();

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    if (!conversation.participantIds.includes(session.userId)) {
      throwBusinessError("FORBIDDEN", "Voce nao pode enviar mensagens para esta conversa.", {
        tenantId: session.tenantId,
        conversationId,
        userId: session.userId,
      });
    }

    const messageId = `msg_${conversationId}_${now}_${crypto.randomUUID()}`;
    await ctx.db.insert("messages", {
      messageId,
      tenantId: session.tenantId,
      conversationId,
      senderId: session.userId,
      body,
      attachmentUrl,
      createdAt: now,
      readBy: [session.userId],
    });

    await ctx.db.patch(conversation._id, {
      lastMessagePreview: body,
      lastMessageAt: now,
      lastActivityAt: now,
    });

    return {
      id: messageId,
      tenantId: session.tenantId,
      conversationId,
      senderId: session.userId,
      body,
      attachmentUrl,
      createdAt: now,
      readBy: [session.userId],
    };
  },
});

export const clearConversationChat = mutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: v.object({
    conversationId: v.string(),
    removedMessageCount: v.number(),
    removedAttachmentCount: v.number(),
    removedHandoffEventCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const now = Date.now();

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    if (!conversation.participantIds.includes(session.userId)) {
      throwBusinessError("FORBIDDEN", "You cannot clear messages in this conversation.", {
        tenantId: session.tenantId,
        conversationId,
        userId: session.userId,
      });
    }

    const [messages, attachments, handoffEvents] = await Promise.all([
      ctx.db
        .query("messages")
        .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
        )
        .collect(),
      ctx.db
        .query("attachments")
        .withIndex("by_tenant_id_and_conversation_id", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
        )
        .collect(),
      ctx.db
        .query("handoffEvents")
        .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
        )
        .collect(),
    ]);

    for (const row of attachments) {
      if (row.storageId) {
        await ctx.storage.delete(row.storageId);
      }
      await ctx.db.delete(row._id);
    }

    for (const row of messages) {
      await ctx.db.delete(row._id);
    }

    for (const row of handoffEvents) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.patch(conversation._id, {
      lastMessagePreview: "",
      lastMessageAt: conversation.createdAt,
      lastActivityAt: now,
    });

    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_chat_cleared_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "conversation.chat.cleared",
      targetType: "conversation",
      targetId: conversationId,
      details: JSON.stringify({
        removedMessageCount: messages.length,
        removedAttachmentCount: attachments.length,
        removedHandoffEventCount: handoffEvents.length,
      }),
      createdAt: now,
    });

    return {
      conversationId,
      removedMessageCount: messages.length,
      removedAttachmentCount: attachments.length,
      removedHandoffEventCount: handoffEvents.length,
    };
  },
});

export const markConversationAsRead = mutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: v.object({
    conversationId: v.string(),
    updatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    if (!conversation.participantIds.includes(session.userId)) {
      throwBusinessError("FORBIDDEN", "Voce nao pode atualizar esta conversa.", {
        tenantId: session.tenantId,
        conversationId,
        userId: session.userId,
      });
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
      )
      .collect();

    const unreadMessages = messages.filter(
      (message: any) => message.senderId !== session.userId && !message.readBy.includes(session.userId),
    );

    await Promise.all(
      unreadMessages.map((message: any) =>
        ctx.db.patch(message._id, {
          readBy: [...message.readBy, session.userId],
        }),
      ),
    );

    return {
      conversationId,
      updatedCount: unreadMessages.length,
    };
  },
});

export const prepareConversationHandoff = internalQuery({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: handoffPreparationValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    if (!conversation.participantIds.includes(session.userId)) {
      throwBusinessError("FORBIDDEN", "Voce nao pode acessar esta conversa.", {
        tenantId: session.tenantId,
        conversationId,
        userId: session.userId,
      });
    }

    if (conversation.conversationStatus === "FECHADO") {
      throwBusinessError("BAD_REQUEST", "A conversa ja esta encerrada.", {
        tenantId: session.tenantId,
        conversationId,
      });
    }

    const contactId = resolveContactId(conversation.participantIds, session.userId);
    if (!contactId.startsWith("wa_contact_")) {
      throwBusinessError("BAD_REQUEST", "A conversa nao esta vinculada a um contato do WhatsApp.", {
        tenantId: session.tenantId,
        conversationId,
        contactId,
      });
    }

    const recipientWaId = contactId.slice("wa_contact_".length);
    if (!recipientWaId) {
      throwBusinessError("BAD_REQUEST", "O contato do WhatsApp da conversa e invalido.", {
        tenantId: session.tenantId,
        conversationId,
      });
    }

    const activeMappings = (
      await ctx.db
        .query("wabaTenantMappings")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", session.tenantId))
        .collect()
    ).filter((mapping: any) => mapping.isActive);

    if (activeMappings.length === 0) {
      throwBusinessError("NOT_FOUND", "Nenhum mapeamento WABA ativo foi encontrado para o tenant.", {
        tenantId: session.tenantId,
      });
    }

    let selectedMapping = activeMappings[0];
    if (activeMappings.length > 1) {
      const matchingMappings = activeMappings.filter((mapping: any) =>
        conversationId.includes(`_${sanitizeIdPart(mapping.phoneNumberId)}_`),
      );

      if (matchingMappings.length !== 1) {
        throwBusinessError("BAD_REQUEST", "Nao foi possivel resolver o mapeamento WABA da conversa.", {
          tenantId: session.tenantId,
          conversationId,
          mappingCount: activeMappings.length,
        });
      }

      selectedMapping = matchingMappings[0];
    }

    const operator = await findUserByUserId(ctx.db, session.userId);
    if (!operator) {
      throwBusinessError("UNAUTHENTICATED", "Operador nao encontrado para esta sessao.", {
        userId: session.userId,
      });
    }

    return {
      tenantId: session.tenantId,
      conversationId,
      operatorUserId: session.userId,
      operatorName: operator.fullName,
      phoneNumberId: selectedMapping.phoneNumberId,
      recipientWaId,
      notificationMessage: buildHandoffNotificationMessage(operator.fullName),
    };
  },
});

export const completeConversationHandoff = internalMutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
    notificationMessage: v.string(),
  },
  returns: v.object({
    conversationId: v.string(),
    conversationStatus: conversationStatusValidator,
    handoffEventId: v.string(),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const notificationMessage = assertMessageBody(args.notificationMessage);
    const now = Date.now();

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    if (conversation.conversationStatus === "FECHADO") {
      throwBusinessError("BAD_REQUEST", "A conversa ja esta encerrada.", {
        tenantId: session.tenantId,
        conversationId,
      });
    }

    const participantIds = conversation.participantIds.includes(session.userId)
      ? conversation.participantIds
      : [...conversation.participantIds, session.userId];

    await ctx.db.patch(conversation._id, {
      participantIds,
      conversationStatus: "EM_ATENDIMENTO_HUMANO",
      lastMessagePreview: notificationMessage,
      lastMessageAt: now,
      lastActivityAt: now,
    });

    const handoffEventId = `hand_${conversationId}_${now}_${crypto.randomUUID()}`;
    await ctx.db.insert("handoffEvents", {
      handoffEventId,
      tenantId: session.tenantId,
      conversationId,
      from: "assistant",
      to: "human",
      performedByUserId: session.userId,
      createdAt: now,
    });

    const messageId = `msg_handoff_${conversationId}_${now}_${crypto.randomUUID()}`;
    await ctx.db.insert("messages", {
      messageId,
      tenantId: session.tenantId,
      conversationId,
      senderId: session.userId,
      body: notificationMessage,
      createdAt: now,
      readBy: [session.userId],
    });

    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_handoff_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "conversation.handoff.taken",
      targetType: "conversation",
      targetId: conversationId,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_handoff_notify_sent_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "conversation.handoff.whatsapp_notification.sent",
      targetType: "conversation",
      targetId: conversationId,
      details: `messageId=${messageId}`,
      createdAt: now,
    });

    return {
      conversationId,
      conversationStatus: "EM_ATENDIMENTO_HUMANO" as const,
      handoffEventId,
    };
  },
});

export const logConversationHandoffNotificationFailure = internalMutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const reason = args.reason.trim().slice(0, 1_000) || "unknown_error";
    const now = Date.now();

    await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_handoff_failed_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "conversation.handoff.taken.failed",
      targetType: "conversation",
      targetId: conversationId,
      details: `notification_failure:${reason}`,
      createdAt: now,
    });

    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_handoff_notify_failed_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "conversation.handoff.whatsapp_notification.failed",
      targetType: "conversation",
      targetId: conversationId,
      details: reason,
      createdAt: now,
    });

    return null;
  },
});

export const logConversationMessageWhatsAppSent = internalMutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
    messageId: v.string(),
    externalMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const messageId = assertId(args.messageId, "messageId");
    const now = Date.now();

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    if (!conversation.participantIds.includes(session.userId)) {
      throwBusinessError("FORBIDDEN", "Voce nao pode enviar mensagens para esta conversa.", {
        tenantId: session.tenantId,
        conversationId,
        userId: session.userId,
      });
    }

    const externalMessageId = args.externalMessageId?.trim();
    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_message_whatsapp_sent_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "conversation.message.whatsapp.sent",
      targetType: "conversation",
      targetId: conversationId,
      details: externalMessageId
        ? `messageId=${messageId};externalMessageId=${externalMessageId}`
        : `messageId=${messageId}`,
      createdAt: now,
    });

    return null;
  },
});

export const logConversationMessageWhatsAppFailure = internalMutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const reason = args.reason.trim().slice(0, 1_000) || "unknown_error";
    const now = Date.now();

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    if (!conversation.participantIds.includes(session.userId)) {
      throwBusinessError("FORBIDDEN", "Voce nao pode enviar mensagens para esta conversa.", {
        tenantId: session.tenantId,
        conversationId,
        userId: session.userId,
      });
    }

    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_message_whatsapp_failed_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "conversation.message.whatsapp.failed",
      targetType: "conversation",
      targetId: conversationId,
      details: reason,
      createdAt: now,
    });

    return null;
  },
});

export const closeConversationWithReason = mutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
    reason: v.string(),
  },
  returns: v.object({
    conversationId: v.string(),
    conversationStatus: conversationStatusValidator,
    closureReason: v.string(),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const reason = assertClosureReason(args.reason);
    const now = Date.now();

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    await ctx.db.patch(conversation._id, {
      conversationStatus: "FECHADO",
      closureReason: reason,
      lastActivityAt: now,
    });

    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_closed_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "conversation.closed",
      targetType: "conversation",
      targetId: conversationId,
      createdAt: now,
    });

    return {
      conversationId,
      conversationStatus: "FECHADO" as const,
      closureReason: reason,
    };
  },
});

export const setConversationTriageResult = mutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
    triageResult: triageResultValidator,
  },
  returns: v.object({
    conversationId: v.string(),
    triageResult: triageResultValidator,
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const now = Date.now();

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    await ctx.db.patch(conversation._id, {
      triageResult: args.triageResult,
      lastActivityAt: Math.max(conversation.lastActivityAt, now),
    });

    const existingTriage = await ctx.db
      .query("conversationTriages")
      .withIndex("by_tenant_id_and_conversation_id", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
      )
      .unique();

    if (existingTriage) {
      await ctx.db.patch(existingTriage._id, {
        triageResult: args.triageResult,
        updatedAt: now,
        evaluatedAt: now,
      });
    }

    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_triage_manual_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "conversation.triage.manual_set",
      targetType: "conversation",
      targetId: conversationId,
      createdAt: now,
    });

    return {
      conversationId,
      triageResult: args.triageResult,
    };
  },
});

type AttachmentArchiveSourceRow = {
  attachmentId: string;
  tenantId: string;
  conversationId: string;
  messageId?: string;
  fileName: string;
  contentType: string;
  url?: string;
  storageId?: Id<"_storage">;
  createdAt: number;
};

type AttachmentArchiveSource = {
  tenantId: string;
  userId: string;
  conversationId: string;
  attachments: AttachmentArchiveSourceRow[];
};

const getConversationAttachmentArchiveSourceRef = makeFunctionReference<"query">("chatDomain:getConversationAttachmentArchiveSource");
const recordConversationAttachmentArchiveExportRef = makeFunctionReference<"mutation">("chatDomain:recordConversationAttachmentArchiveExport");

const attachmentArchiveSourceRowValidator = v.object({
  attachmentId: v.string(),
  tenantId: v.string(),
  conversationId: v.string(),
  messageId: v.optional(v.string()),
  fileName: v.string(),
  contentType: v.string(),
  url: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
  createdAt: v.number(),
});

export const getConversationAttachmentArchiveSource = internalQuery({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: v.object({
    tenantId: v.string(),
    userId: v.string(),
    conversationId: v.string(),
    attachments: v.array(attachmentArchiveSourceRowValidator),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");

    await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_tenant_id_and_conversation_id", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
      )
      .collect();

    return {
      tenantId: session.tenantId,
      userId: session.userId,
      conversationId,
      attachments: attachments.map((row: any) => ({
        attachmentId: row.attachmentId,
        tenantId: row.tenantId,
        conversationId: row.conversationId,
        messageId: row.messageId,
        fileName: row.fileName,
        contentType: row.contentType,
        url: row.url,
        storageId: row.storageId,
        createdAt: row.createdAt,
      })),
    };
  },
});

export const recordConversationAttachmentArchiveExport = internalMutation({
  args: {
    tenantId: v.string(),
    userId: v.string(),
    conversationId: v.string(),
    createdAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_attachment_archive_export_${args.conversationId}_${args.createdAt}_${crypto.randomUUID()}`,
      tenantId: args.tenantId,
      actorUserId: args.userId,
      action: "conversation.attachments_zip_exported",
      targetType: "conversation",
      targetId: args.conversationId,
      createdAt: args.createdAt,
    });

    return null;
  },
});

export const exportConversationAttachmentArchive = action({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: conversationAttachmentArchiveValidator,
  handler: async (ctx, args) => {
    const source: AttachmentArchiveSource = await ctx.runQuery(getConversationAttachmentArchiveSourceRef, {
      sessionToken: args.sessionToken,
      conversationId: args.conversationId,
    });
    const now = Date.now();

    const usedEntryNames = new Set<string>();
    const zipEntries: ArchiveZipEntry[] = [];
    const attachments = await Promise.all(
      source.attachments.map(async (row: AttachmentArchiveSourceRow, index: number) => {
        const downloadUrl = await resolveAttachmentUrl(ctx, row);
        const bytes = await loadAttachmentBytesForArchive(ctx, row);

        if (bytes && bytes.length > 0) {
          const entryName = dedupeArchiveFileName(normalizeAttachmentFileName(row.fileName, index), usedEntryNames);
          zipEntries.push({
            name: entryName,
            bytes,
            modifiedAt: new Date(row.createdAt),
          });
        }

        return {
          id: row.attachmentId,
          tenantId: row.tenantId,
          conversationId: row.conversationId,
          messageId: row.messageId,
          fileName: row.fileName,
          contentType: row.contentType,
          url: downloadUrl,
          storageId: row.storageId,
          createdAt: row.createdAt,
        };
      }),
    );

    const zipBytes = createAttachmentArchiveZip(zipEntries);
    const zipArrayBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;
    const zipStorageId = await ctx.storage.store(new Blob([zipArrayBuffer], { type: "application/zip" }));
    const zipDownloadUrl = await ctx.storage.getUrl(zipStorageId);
    if (!zipDownloadUrl) {
      throwBusinessError("NOT_FOUND", "Unable to generate download URL for attachment archive.", {
        conversationId: source.conversationId,
      });
    }

    const zipFileName = conversationAttachmentExportZipFileName(source.conversationId);

    await ctx.runMutation(recordConversationAttachmentArchiveExportRef, {
      tenantId: source.tenantId,
      userId: source.userId,
      conversationId: source.conversationId,
      createdAt: now,
    });

    return {
      formatVersion: "conversation.attachments.zip.v1" as const,
      tenantId: source.tenantId,
      conversationId: source.conversationId,
      generatedAtIso: new Date(now).toISOString(),
      zipFileName,
      zipDownloadUrl,
      attachmentCount: attachments.length,
      attachments,
    };
  },
});

export const getContactProfileWithEvents = query({
  args: {
    sessionToken: v.string(),
    contactId: v.string(),
  },
  returns: v.object({
    contactId: v.string(),
    contactProfile: contactProfileValidator,
    recentEvents: v.array(contactProfileEventValidator),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const contactId = assertId(args.contactId, "contactId");

    const requestingUser = await findUserByUserId(ctx.db, session.userId);
    if (!requestingUser || requestingUser.tenantId !== session.tenantId) {
      throwBusinessError("NOT_FOUND", "Contact profile not found for this contact.", {
        tenantId: session.tenantId,
        contactId,
      });
    }

    const contactProfile = await ctx.db
      .query("contactProfiles")
      .withIndex("by_tenant_id_and_contact_id", (q: any) => q.eq("tenantId", session.tenantId).eq("contactId", contactId))
      .unique();
    if (!contactProfile) {
      throwBusinessError("NOT_FOUND", "Contact profile not found for this contact.", {
        tenantId: session.tenantId,
        contactId,
      });
    }

    if (session.userId !== contactId) {
      const memberships = await ctx.db
        .query("conversationMemberships")
        .withIndex("by_tenant_id_and_user_id", (q: any) => q.eq("tenantId", session.tenantId).eq("userId", session.userId))
        .collect();

      let canAccess = false;
      for (const membership of memberships) {
        const shared = await ctx.db
          .query("conversationMemberships")
          .withIndex("by_tenant_id_and_conversation_id_and_user_id", (q: any) =>
            q.eq("tenantId", session.tenantId).eq("conversationId", membership.conversationId).eq("userId", contactId),
          )
          .unique();
        if (shared) {
          canAccess = true;
          break;
        }
      }

      if (!canAccess) {
        throwBusinessError("NOT_FOUND", "Contact profile not found for this contact.", {
          tenantId: session.tenantId,
          contactId,
        });
      }
    }

    const recentEvents = await ctx.db
      .query("contactProfileEvents")
      .withIndex("by_tenant_id_and_contact_id_and_occurred_at", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("contactId", contactId),
      )
      .order("desc")
      .take(5);

    return {
      contactId,
      contactProfile: toContactProfile(contactProfile),
      recentEvents: recentEvents.map((event: any) => toContactProfileEvent(event)),
    };
  },
});

export const getWorkspaceSnapshot = query({
  args: {
    sessionToken: v.string(),
  },
  returns: v.object({
    tenant: v.object({
      tenantId: v.string(),
      tenantName: v.string(),
      wabaLabel: v.string(),
      activeAiProfileName: v.string(),
    }),
    conversations: v.array(conversationListItemValidator),
    messages: v.array(messageValidator),
    contactProfile: v.union(contactProfileValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);

    const [tenant, wabaMapping, activeProfile] = await Promise.all([
      ctx.db
        .query("tenants")
        .withIndex("by_tenant_id", (q: any) => q.eq("tenantId", session.tenantId))
        .unique(),
      ctx.db
        .query("wabaTenantMappings")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", session.tenantId))
        .first(),
      ctx.db
        .query("aiProfiles")
        .withIndex("by_tenant_id_and_active", (q: any) => q.eq("tenantId", session.tenantId).eq("isActive", true))
        .first(),
    ]);

    if (!tenant) {
      throwBusinessError("NOT_FOUND", "Tenant nao encontrado.", {
        tenantId: session.tenantId,
      });
    }

    const conversations = await listConversationsForSession(ctx.db, session);
    const firstConversation = conversations[0]?.conversation ?? null;

    let messages: ReturnType<typeof toMessage>[] = [];
    let contactProfile: ReturnType<typeof toContactProfile> | null = null;

    if (firstConversation) {
      const messageRows = await ctx.db
        .query("messages")
        .withIndex("by_tenant_id_and_conversation_id_and_created_at", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("conversationId", firstConversation.conversationId),
        )
        .collect();
      messages = messageRows.map((row: any) => toMessage(row));

      const contactId = firstConversation.participantIds.find((participantId: string) => participantId !== session.userId);
      if (contactId) {
        const profileRow = await ctx.db
          .query("contactProfiles")
          .withIndex("by_tenant_id_and_contact_id", (q: any) => q.eq("tenantId", session.tenantId).eq("contactId", contactId))
          .unique();
        contactProfile = profileRow ? toContactProfile(profileRow) : null;
      }
    }

    return {
      tenant: {
        tenantId: tenant.tenantId,
        tenantName: tenant.name,
        wabaLabel: wabaMapping?.displayName ?? "WABA nao configurado",
        activeAiProfileName: activeProfile?.name ?? "IA nao configurada",
      },
      conversations: conversations.map((row) => row.item),
      messages,
      contactProfile,
    };
  },
});
