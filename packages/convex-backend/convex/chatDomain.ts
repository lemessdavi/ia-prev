import { v } from "convex/values";
import { mutation, query } from "./server";
import { findUserByUserId, requireSession, toDossier, toDossierEvent, toMessage } from "./coreAuth";
import { throwBusinessError } from "./coreErrors";
import { assertAttachmentUrl, assertId, assertMessageBody } from "./coreInput";
import {
  conversationListItemValidator,
  dossierEventValidator,
  dossierValidator,
  messageValidator,
} from "./coreValidators";

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

async function listConversationsForSession(db: any, session: { tenantId: string; userId: string }) {
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

    await requireConversationForParticipant(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
      userId: session.userId,
    });

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

    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversation_id", (q: any) => q.eq("conversationId", conversationId))
      .unique();
    if (!conversation || conversation.tenantId !== session.tenantId) {
      throwBusinessError("NOT_FOUND", "Conversation not found.", {
        conversationId,
        tenantId: session.tenantId,
      });
    }

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

    let updatedCount = 0;
    await Promise.all(
      messages.map(async (message) => {
        if (message.senderId === session.userId || message.readBy.includes(session.userId)) {
          return;
        }
        updatedCount += 1;
        await ctx.db.patch(message._id, {
          readBy: [...message.readBy, session.userId],
        });
      }),
    );

    return {
      conversationId,
      updatedCount,
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
      recentEvents: recentEvents.map((event) => toDossierEvent(event)),
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
      messages = messageRows.map((row) => toMessage(row));

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
        wabaLabel: wabaMapping?.displayName ?? "WABA não configurado",
        activeAiProfileName: activeProfile?.name ?? "IA não configurada",
      },
      conversations: conversations.map((row) => row.item),
      messages,
      dossier,
    };
  },
});
