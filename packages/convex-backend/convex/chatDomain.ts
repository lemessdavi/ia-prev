import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./server";
import {
  findUserByUserId,
  requireSession,
  toAttachment,
  toDossier,
  toDossierEvent,
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
  conversationDossierExportValidator,
  conversationInboxItemValidator,
  conversationListItemValidator,
  conversationStatusValidator,
  conversationThreadPayloadValidator,
  dossierEventValidator,
  dossierValidator,
  messageValidator,
  tenantWorkspaceSummaryValidator,
} from "./coreValidators";

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
    throwBusinessError("NOT_FOUND", "Conversation not found.", {
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
    throwBusinessError("FORBIDDEN", "You cannot access this conversation.", {
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
    throwBusinessError("NOT_FOUND", "Conversation not found.", {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
    });
  }

  return conversation;
}

function resolveContactId(participantIds: string[], currentUserId: string): string {
  const candidate = participantIds.find((id) => id !== currentUserId) ?? participantIds[0];
  if (!candidate) {
    throwBusinessError("BAD_REQUEST", "Conversation is missing participants.", {
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
      throwBusinessError("NOT_FOUND", "Tenant workspace is not fully configured.", {
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

    const threadMessages = messages.map((message: any) => {
      const linkedAttachment = attachmentsByMessageId.get(message.messageId);
      const inlineAttachment = toInlineAttachment(message.messageId, message.attachmentUrl);
      const attachment =
        linkedAttachment && typeof linkedAttachment.messageId === "string"
          ? {
              id: linkedAttachment.attachmentId,
              fileName: linkedAttachment.fileName,
              contentType: linkedAttachment.contentType,
              url: linkedAttachment.url,
            }
          : inlineAttachment;

      return {
        id: message.messageId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        readBy: message.readBy,
        attachment: attachment ?? undefined,
      };
    });

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
      throwBusinessError("FORBIDDEN", "You cannot send messages to this conversation.", {
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
      throwBusinessError("FORBIDDEN", "You cannot update this conversation.", {
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

    if (conversation.conversationStatus === "FECHADO") {
      throwBusinessError("BAD_REQUEST", "Conversation is already closed.", {
        tenantId: session.tenantId,
        conversationId,
      });
    }

    const contactId = resolveContactId(conversation.participantIds, session.userId);
    if (!contactId.startsWith("wa_contact_")) {
      throwBusinessError("BAD_REQUEST", "Conversation is not linked to a WhatsApp contact.", {
        tenantId: session.tenantId,
        conversationId,
        contactId,
      });
    }

    const recipientWaId = contactId.slice("wa_contact_".length);
    if (!recipientWaId) {
      throwBusinessError("BAD_REQUEST", "Conversation WhatsApp contact is invalid.", {
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
      throwBusinessError("NOT_FOUND", "No active WABA mapping found for tenant.", {
        tenantId: session.tenantId,
      });
    }

    let selectedMapping = activeMappings[0];
    if (activeMappings.length > 1) {
      const matchingMappings = activeMappings.filter((mapping: any) =>
        conversationId.includes(`_${sanitizeIdPart(mapping.phoneNumberId)}_`),
      );

      if (matchingMappings.length !== 1) {
        throwBusinessError("BAD_REQUEST", "Unable to resolve WABA mapping for conversation.", {
          tenantId: session.tenantId,
          conversationId,
          mappingCount: activeMappings.length,
        });
      }

      selectedMapping = matchingMappings[0];
    }

    const operator = await findUserByUserId(ctx.db, session.userId);
    if (!operator) {
      throwBusinessError("UNAUTHENTICATED", "Operator was not found for this session.", {
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
      throwBusinessError("BAD_REQUEST", "Conversation is already closed.", {
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

export const exportConversationDossier = mutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: conversationDossierExportValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const now = Date.now();

    const conversation = await requireTenantConversation(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
    });

    const contactId = resolveContactId(conversation.participantIds, session.userId);
    const dossierRow = await ctx.db
      .query("dossiers")
      .withIndex("by_tenant_id_and_contact_id", (q: any) => q.eq("tenantId", session.tenantId).eq("contactId", contactId))
      .unique();

    if (!dossierRow) {
      throwBusinessError("NOT_FOUND", "Dossier not found for this conversation.", {
        tenantId: session.tenantId,
        conversationId,
        contactId,
      });
    }

    await ctx.db.insert("auditLogs", {
      auditLogId: `audit_dossier_export_${conversationId}_${now}_${crypto.randomUUID()}`,
      tenantId: session.tenantId,
      actorUserId: session.userId,
      action: "dossier.exported",
      targetType: "conversation",
      targetId: conversationId,
      createdAt: now,
    });

    const [recentEventsRows, messageRows, attachmentRows, handoffRows] = await Promise.all([
      ctx.db
        .query("dossierEvents")
        .withIndex("by_tenant_id_and_contact_id_and_occurred_at", (q: any) =>
          q.eq("tenantId", session.tenantId).eq("contactId", contactId),
        )
        .order("desc")
        .take(10),
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

    return {
      tenantId: session.tenantId,
      conversationId,
      contactId,
      generatedAtIso: new Date(now).toISOString(),
      dossier: toDossier(dossierRow),
      recentEvents: recentEventsRows.map((row: any) => toDossierEvent(row)),
      messages: messageRows.map((row: any) => toMessage(row)),
      attachments: attachmentRows.map((row: any) => toAttachment(row)),
      handoffEvents: handoffRows.map((row: any) => toHandoffEvent(row)),
      closureReason: conversation.closureReason,
    };
  },
});

export const getContactDossierWithEvents = query({
  args: {
    sessionToken: v.string(),
    contactId: v.string(),
  },
  returns: v.object({
    contactId: v.string(),
    dossier: dossierValidator,
    recentEvents: v.array(dossierEventValidator),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const contactId = assertId(args.contactId, "contactId");

    const requestingUser = await findUserByUserId(ctx.db, session.userId);
    if (!requestingUser || requestingUser.tenantId !== session.tenantId) {
      throwBusinessError("NOT_FOUND", "Dossier not found for this contact.", {
        tenantId: session.tenantId,
        contactId,
      });
    }

    const dossier = await ctx.db
      .query("dossiers")
      .withIndex("by_tenant_id_and_contact_id", (q: any) => q.eq("tenantId", session.tenantId).eq("contactId", contactId))
      .unique();
    if (!dossier) {
      throwBusinessError("NOT_FOUND", "Dossier not found for this contact.", {
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
        throwBusinessError("NOT_FOUND", "Dossier not found for this contact.", {
          tenantId: session.tenantId,
          contactId,
        });
      }
    }

    const recentEvents = await ctx.db
      .query("dossierEvents")
      .withIndex("by_tenant_id_and_contact_id_and_occurred_at", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("contactId", contactId),
      )
      .order("desc")
      .take(5);

    return {
      contactId,
      dossier: toDossier(dossier),
      recentEvents: recentEvents.map((event: any) => toDossierEvent(event)),
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
    dossier: v.union(dossierValidator, v.null()),
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
      throwBusinessError("NOT_FOUND", "Tenant not found.", {
        tenantId: session.tenantId,
      });
    }

    const conversations = await listConversationsForSession(ctx.db, session);
    const firstConversation = conversations[0]?.conversation ?? null;

    let messages: ReturnType<typeof toMessage>[] = [];
    let dossier: ReturnType<typeof toDossier> | null = null;

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
        const dossierRow = await ctx.db
          .query("dossiers")
          .withIndex("by_tenant_id_and_contact_id", (q: any) => q.eq("tenantId", session.tenantId).eq("contactId", contactId))
          .unique();
        dossier = dossierRow ? toDossier(dossierRow) : null;
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
      dossier,
    };
  },
});
