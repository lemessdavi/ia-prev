import { v } from "convex/values";
import { throwBusinessError } from "./coreErrors";
import { internalMutation } from "./server";

const bridgeAttachmentValidator = v.object({
  url: v.optional(v.string()),
  contentType: v.optional(v.string()),
  fileName: v.optional(v.string()),
  mediaType: v.optional(v.string()),
  mediaId: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
});

const bridgePersistResultValidator = v.object({
  ok: v.literal(true),
  tenantId: v.string(),
  conversationId: v.string(),
  messageId: v.string(),
  status: v.union(v.literal("stored"), v.literal("duplicate")),
});

type BridgeAttachment = {
  url?: string;
  contentType?: string;
  fileName?: string;
  mediaType?: string;
  mediaId?: string;
  storageId?: string;
};

function asNonEmptyString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function sanitizeIdPart(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized.length === 0) {
    return "x";
  }
  return normalized.slice(0, 80);
}

function normalizeTimestamp(timestampMs: number | undefined, fallback: number): number {
  if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs) || timestampMs <= 0) {
    return fallback;
  }

  return Math.floor(timestampMs);
}

function buildContactParticipantId(contactWaId: string): string {
  return `wa_contact_${sanitizeIdPart(contactWaId)}`;
}

function buildConversationId(tenantId: string, phoneNumberId: string, contactWaId: string): string {
  return `conv_wa_${sanitizeIdPart(tenantId)}_${sanitizeIdPart(phoneNumberId)}_${sanitizeIdPart(contactWaId)}`;
}

function buildMessageId(input: {
  direction: "in" | "out";
  tenantId: string;
  phoneNumberId: string;
  externalMessageId?: string;
  now: number;
}) {
  if (!input.externalMessageId) {
    return `msg_wa_${input.direction}_${sanitizeIdPart(input.tenantId)}_${input.now}_${crypto.randomUUID()}`;
  }

  return `msg_wa_${input.direction}_${sanitizeIdPart(input.tenantId)}_${sanitizeIdPart(input.phoneNumberId)}_${sanitizeIdPart(input.externalMessageId)}`;
}

function inferContentType(attachment: BridgeAttachment): string {
  if (attachment.contentType) {
    return attachment.contentType;
  }

  switch (attachment.mediaType) {
    case "image":
      return "image/jpeg";
    case "audio":
      return "audio/ogg";
    case "video":
      return "video/mp4";
    case "document":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function inferFileName(attachment: BridgeAttachment, fallbackId: string): string {
  if (attachment.fileName) {
    return attachment.fileName;
  }

  const contentType = inferContentType(attachment);
  const extension = contentType.includes("/") ? contentType.split("/")[1] : "bin";
  return `${attachment.mediaType ?? "file"}_${fallbackId}.${extension}`;
}

function resolveAttachmentUrl(attachment: BridgeAttachment): string | null {
  if (typeof attachment.url === "string" && attachment.url.trim().length > 0) {
    return attachment.url.trim();
  }

  if (typeof attachment.mediaId === "string" && attachment.mediaId.trim().length > 0) {
    return `https://graph.facebook.com/v22.0/${encodeURIComponent(attachment.mediaId.trim())}`;
  }

  return null;
}

function normalizeMessageBody(body: string | undefined, messageType: string, attachments: BridgeAttachment[]): string {
  const normalizedBody = asNonEmptyString(body);
  if (normalizedBody) {
    return normalizedBody;
  }

  if (attachments.length > 0) {
    return `[${messageType}] anexo recebido`;
  }

  return `[${messageType}]`;
}

async function requireActiveMappingByPhoneNumberId(ctx: any, phoneNumberId: string) {
  const mapping = await ctx.db
    .query("wabaTenantMappings")
    .withIndex("by_phone_number_id", (q: any) => q.eq("phoneNumberId", phoneNumberId))
    .unique();

  if (!mapping || !mapping.isActive) {
    throwBusinessError("NOT_FOUND", "Mapeamento WABA nao encontrado para o phone_number_id.", {
      phoneNumberId,
    });
  }

  return mapping;
}

async function listTenantUserIds(ctx: any, tenantId: string): Promise<string[]> {
  const users = await ctx.db
    .query("users")
    .withIndex("by_tenant_id", (q: any) => q.eq("tenantId", tenantId))
    .collect();

  return Array.from(new Set(users.map((user: { userId: string }) => user.userId)));
}

async function ensureConversationMemberships(ctx: any, input: { tenantId: string; conversationId: string; userIds: string[] }) {
  for (const userId of input.userIds) {
    const existing = await ctx.db
      .query("conversationMemberships")
      .withIndex("by_tenant_id_and_conversation_id_and_user_id", (q: any) =>
        q.eq("tenantId", input.tenantId).eq("conversationId", input.conversationId).eq("userId", userId),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("conversationMemberships", {
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        userId,
      });
    }
  }
}

function mergeParticipantIds(contactParticipantId: string, tenantUserIds: string[], existingParticipantIds?: string[]): string[] {
  const merged = new Set<string>([contactParticipantId, ...(existingParticipantIds ?? []), ...tenantUserIds]);
  merged.delete(contactParticipantId);
  return [contactParticipantId, ...Array.from(merged)];
}

async function upsertConversation(ctx: any, input: {
  tenantId: string;
  phoneNumberId: string;
  contactWaId: string;
  contactDisplayName?: string;
  messageTimestampMs: number;
  preview: string;
  tenantUserIds: string[];
}) {
  const contactParticipantId = buildContactParticipantId(input.contactWaId);
  const conversationId = buildConversationId(input.tenantId, input.phoneNumberId, input.contactWaId);
  const title = input.contactDisplayName ?? `WhatsApp ${input.contactWaId}`;

  const existingConversation = await ctx.db
    .query("conversations")
    .withIndex("by_conversation_id", (q: any) => q.eq("conversationId", conversationId))
    .unique();

  const participantIds = mergeParticipantIds(contactParticipantId, input.tenantUserIds, existingConversation?.participantIds);

  if (!existingConversation) {
    await ctx.db.insert("conversations", {
      conversationId,
      tenantId: input.tenantId,
      participantIds,
      conversationStatus: "EM_TRIAGEM",
      triageResult: "N_A",
      title,
      lastMessagePreview: input.preview,
      lastMessageAt: input.messageTimestampMs,
      lastActivityAt: input.messageTimestampMs,
      createdAt: input.messageTimestampMs,
    });
  } else {
    if (existingConversation.tenantId !== input.tenantId) {
      throwBusinessError("FORBIDDEN", "A conversa nao pertence ao tenant mapeado.", {
        conversationId,
        tenantId: input.tenantId,
      });
    }

    const shouldAdvance = input.messageTimestampMs >= existingConversation.lastMessageAt;
    await ctx.db.patch(existingConversation._id, {
      participantIds,
      title: input.contactDisplayName ? title : existingConversation.title,
      lastMessagePreview: shouldAdvance ? input.preview : existingConversation.lastMessagePreview,
      lastMessageAt: shouldAdvance ? input.messageTimestampMs : existingConversation.lastMessageAt,
      lastActivityAt: Math.max(existingConversation.lastActivityAt, input.messageTimestampMs),
    });
  }

  await ensureConversationMemberships(ctx, {
    tenantId: input.tenantId,
    conversationId,
    userIds: input.tenantUserIds,
  });

  return {
    conversationId,
    contactParticipantId,
  };
}

async function persistAttachmentRows(ctx: any, input: {
  tenantId: string;
  conversationId: string;
  messageId: string;
  attachments: BridgeAttachment[];
  createdAt: number;
}) {
  for (let index = 0; index < input.attachments.length; index += 1) {
    const attachment = input.attachments[index]!;
    const url = resolveAttachmentUrl(attachment);
    if (!url && !attachment.storageId) {
      continue;
    }

    const fallbackId = sanitizeIdPart(attachment.mediaId ?? `${index + 1}`);
    await ctx.db.insert("attachments", {
      attachmentId: `att_${sanitizeIdPart(input.messageId)}_${fallbackId}`,
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      fileName: inferFileName(attachment, fallbackId),
      contentType: inferContentType(attachment),
      url: url ?? undefined,
      storageId: attachment.storageId,
      createdAt: input.createdAt,
    });
  }
}

async function findMessageByMessageId(ctx: any, messageId: string) {
  return await ctx.db
    .query("messages")
    .withIndex("by_message_id", (q: any) => q.eq("messageId", messageId))
    .unique();
}

export const persistInboundFromWebhook = internalMutation({
  args: {
    phoneNumberId: v.string(),
    contactWaId: v.string(),
    contactDisplayName: v.optional(v.string()),
    externalMessageId: v.optional(v.string()),
    messageType: v.optional(v.string()),
    body: v.optional(v.string()),
    messageTimestampMs: v.optional(v.number()),
    attachments: v.optional(v.array(bridgeAttachmentValidator)),
  },
  returns: bridgePersistResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const phoneNumberId = asNonEmptyString(args.phoneNumberId);
    const contactWaId = asNonEmptyString(args.contactWaId);

    if (!phoneNumberId || !contactWaId) {
      throwBusinessError("BAD_REQUEST", "phoneNumberId e contactWaId sao obrigatorios.");
    }

    const messageType = asNonEmptyString(args.messageType) ?? "text";
    const attachments = args.attachments ?? [];

    const mapping = await requireActiveMappingByPhoneNumberId(ctx, phoneNumberId);
    const tenantUserIds = await listTenantUserIds(ctx, mapping.tenantId);

    const messageTimestampMs = normalizeTimestamp(args.messageTimestampMs, now);
    const body = normalizeMessageBody(args.body, messageType, attachments);

    const { conversationId, contactParticipantId } = await upsertConversation(ctx, {
      tenantId: mapping.tenantId,
      phoneNumberId,
      contactWaId,
      contactDisplayName: asNonEmptyString(args.contactDisplayName),
      messageTimestampMs,
      preview: body,
      tenantUserIds,
    });

    const messageId = buildMessageId({
      direction: "in",
      tenantId: mapping.tenantId,
      phoneNumberId,
      externalMessageId: asNonEmptyString(args.externalMessageId),
      now: messageTimestampMs,
    });

    const existingMessage = await findMessageByMessageId(ctx, messageId);
    if (existingMessage) {
      return {
        ok: true as const,
        tenantId: mapping.tenantId,
        conversationId,
        messageId: existingMessage.messageId,
        status: "duplicate" as const,
      };
    }

    const firstAttachmentUrl = attachments.map((item) => resolveAttachmentUrl(item)).find((value) => typeof value === "string");

    await ctx.db.insert("messages", {
      messageId,
      tenantId: mapping.tenantId,
      conversationId,
      senderId: contactParticipantId,
      body,
      attachmentUrl: firstAttachmentUrl,
      createdAt: messageTimestampMs,
      readBy: [],
    });

    await persistAttachmentRows(ctx, {
      tenantId: mapping.tenantId,
      conversationId,
      messageId,
      attachments,
      createdAt: messageTimestampMs,
    });

    return {
      ok: true as const,
      tenantId: mapping.tenantId,
      conversationId,
      messageId,
      status: "stored" as const,
    };
  },
});

export const persistOutboundMessage = internalMutation({
  args: {
    phoneNumberId: v.string(),
    conversationId: v.string(),
    body: v.string(),
    externalMessageId: v.optional(v.string()),
    senderId: v.optional(v.string()),
    messageTimestampMs: v.optional(v.number()),
    attachments: v.optional(v.array(bridgeAttachmentValidator)),
  },
  returns: bridgePersistResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const phoneNumberId = asNonEmptyString(args.phoneNumberId);
    const conversationId = asNonEmptyString(args.conversationId);
    const body = asNonEmptyString(args.body);

    if (!phoneNumberId || !conversationId || !body) {
      throwBusinessError("BAD_REQUEST", "phoneNumberId, conversationId e body sao obrigatorios.");
    }

    const mapping = await requireActiveMappingByPhoneNumberId(ctx, phoneNumberId);

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q: any) => q.eq("conversationId", conversationId))
      .unique();

    if (!conversation || conversation.tenantId !== mapping.tenantId) {
      throwBusinessError("NOT_FOUND", "Conversation not found for mapped tenant.", {
        conversationId,
        tenantId: mapping.tenantId,
      });
    }

    const tenantUserIds = await listTenantUserIds(ctx, mapping.tenantId);
    await ensureConversationMemberships(ctx, {
      tenantId: mapping.tenantId,
      conversationId,
      userIds: tenantUserIds,
    });

    const messageTimestampMs = normalizeTimestamp(args.messageTimestampMs, now);
    const attachments = args.attachments ?? [];

    const messageId = buildMessageId({
      direction: "out",
      tenantId: mapping.tenantId,
      phoneNumberId,
      externalMessageId: asNonEmptyString(args.externalMessageId),
      now: messageTimestampMs,
    });

    const existingMessage = await findMessageByMessageId(ctx, messageId);
    if (existingMessage) {
      return {
        ok: true as const,
        tenantId: mapping.tenantId,
        conversationId,
        messageId: existingMessage.messageId,
        status: "duplicate" as const,
      };
    }

    const firstAttachmentUrl = attachments.map((item) => resolveAttachmentUrl(item)).find((value) => typeof value === "string");

    await ctx.db.insert("messages", {
      messageId,
      tenantId: mapping.tenantId,
      conversationId,
      senderId: asNonEmptyString(args.senderId) ?? "assistant_whatsapp",
      body,
      attachmentUrl: firstAttachmentUrl,
      createdAt: messageTimestampMs,
      readBy: tenantUserIds,
    });

    const shouldAdvanceConversation = messageTimestampMs >= conversation.lastMessageAt;
    await ctx.db.patch(conversation._id, {
      lastMessagePreview: shouldAdvanceConversation ? body : conversation.lastMessagePreview,
      lastMessageAt: shouldAdvanceConversation ? messageTimestampMs : conversation.lastMessageAt,
      lastActivityAt: Math.max(conversation.lastActivityAt, messageTimestampMs),
    });

    await persistAttachmentRows(ctx, {
      tenantId: mapping.tenantId,
      conversationId,
      messageId,
      attachments,
      createdAt: messageTimestampMs,
    });

    return {
      ok: true as const,
      tenantId: mapping.tenantId,
      conversationId,
      messageId,
      status: "stored" as const,
    };
  },
});
