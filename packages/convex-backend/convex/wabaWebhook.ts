import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./server";

const UNKNOWN_PHONE_NUMBER_ID = "unknown_phone_number_id";
const IDEMPOTENCY_NAMESPACE = "waba_inbound_v1";

const attachmentValidator = v.object({
  mediaType: v.string(),
  mediaId: v.string(),
  mimeType: v.optional(v.string()),
  sha256: v.optional(v.string()),
  caption: v.optional(v.string()),
  fileName: v.optional(v.string()),
});

const normalizedInboundMessageValidator = v.object({
  phoneNumberId: v.string(),
  wabaAccountId: v.optional(v.string()),
  contactWaId: v.string(),
  contactDisplayName: v.optional(v.string()),
  externalMessageId: v.string(),
  fromWaId: v.string(),
  messageType: v.string(),
  body: v.optional(v.string()),
  attachments: v.array(attachmentValidator),
  messageTimestampMs: v.number(),
  rawPayload: v.string(),
});

const mappingValidator = v.object({
  tenantId: v.string(),
  phoneNumberId: v.string(),
  wabaAccountId: v.string(),
  displayName: v.string(),
});

const processResultValidator = v.object({
  processed: v.number(),
  duplicates: v.number(),
  blocked: v.number(),
  ignored: v.number(),
});

const persistResultValidator = v.object({
  status: v.union(v.literal("processed"), v.literal("duplicate")),
  conversationId: v.id("wabaConversations"),
  messageId: v.union(v.id("wabaMessages"), v.null()),
  idempotencyKey: v.string(),
});

type NormalizedAttachment = {
  mediaType: string;
  mediaId: string;
  mimeType?: string;
  sha256?: string;
  caption?: string;
  fileName?: string;
};

type NormalizedInboundMessage = {
  phoneNumberId: string;
  wabaAccountId?: string;
  contactWaId: string;
  contactDisplayName?: string;
  externalMessageId: string;
  fromWaId: string;
  messageType: string;
  body?: string;
  attachments: NormalizedAttachment[];
  messageTimestampMs: number;
  rawPayload: string;
};

type MissingPhoneNumberRoute = {
  externalMessageId?: string;
};

type NormalizationResult = {
  messages: NormalizedInboundMessage[];
  missingPhoneNumberRoutes: MissingPhoneNumberRoute[];
};

function businessError(code: string, message: string, details?: Record<string, unknown>) {
  return new ConvexError({
    code,
    message,
    details: details ? JSON.stringify(details) : undefined,
  });
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseMessageTimestampMs(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 10_000_000_000 ? Math.floor(value) : Math.floor(value * 1000);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed > 10_000_000_000 ? Math.floor(parsed) : Math.floor(parsed * 1000);
    }
  }

  return fallback;
}

function buildIdempotencyKey(tenantId: string, phoneNumberId: string, externalMessageId: string): string {
  return JSON.stringify([IDEMPOTENCY_NAMESPACE, tenantId, phoneNumberId, externalMessageId]);
}

function extractAttachments(rawMessage: Record<string, unknown>): NormalizedAttachment[] {
  const attachments: NormalizedAttachment[] = [];
  const mediaTypes = ["image", "document", "audio", "video", "sticker"];

  for (const mediaType of mediaTypes) {
    const rawMedia = asObject(rawMessage[mediaType]);
    if (!rawMedia) {
      continue;
    }

    const mediaId = asNonEmptyString(rawMedia.id);
    if (!mediaId) {
      continue;
    }

    attachments.push({
      mediaType,
      mediaId,
      mimeType: asNonEmptyString(rawMedia.mime_type) ?? undefined,
      sha256: asNonEmptyString(rawMedia.sha256) ?? undefined,
      caption: asNonEmptyString(rawMedia.caption) ?? undefined,
      fileName: asNonEmptyString(rawMedia.filename) ?? undefined,
    });
  }

  return attachments;
}

function normalizeInboundMessages(payload: unknown, receivedAt: number): NormalizationResult {
  const messages: NormalizedInboundMessage[] = [];
  const missingPhoneNumberRoutes: MissingPhoneNumberRoute[] = [];
  const root = asObject(payload);
  if (!root) {
    return { messages, missingPhoneNumberRoutes };
  }

  const entries = Array.isArray(root.entry) ? root.entry : [];

  for (const rawEntry of entries) {
    const entry = asObject(rawEntry);
    if (!entry) {
      continue;
    }
    const entryWabaAccountId = asNonEmptyString(entry.id) ?? undefined;

    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const rawChange of changes) {
      const change = asObject(rawChange);
      if (!change) {
        continue;
      }

      const field = asNonEmptyString(change.field);
      if (field !== "messages") {
        continue;
      }

      const value = asObject(change.value);
      if (!value) {
        continue;
      }

      const metadata = asObject(value.metadata);
      const phoneNumberId = asNonEmptyString(metadata?.phone_number_id);

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const firstContact = asObject(contacts[0]);
      const contactProfile = asObject(firstContact?.profile);
      const contactDisplayName = asNonEmptyString(contactProfile?.name) ?? undefined;
      const contactWaIdFromContacts = asNonEmptyString(firstContact?.wa_id);

      const rawMessages = Array.isArray(value.messages) ? value.messages : [];

      if (!phoneNumberId) {
        if (rawMessages.length === 0) {
          missingPhoneNumberRoutes.push({});
          continue;
        }

        for (const rawMessageValue of rawMessages) {
          const rawMessage = asObject(rawMessageValue);
          const externalMessageId = asNonEmptyString(rawMessage?.id) ?? undefined;
          missingPhoneNumberRoutes.push({
            externalMessageId,
          });
        }
        continue;
      }

      for (const rawMessageValue of rawMessages) {
        const rawMessage = asObject(rawMessageValue);
        if (!rawMessage) {
          continue;
        }

        const externalMessageId = asNonEmptyString(rawMessage.id);
        const fromWaId = asNonEmptyString(rawMessage.from) ?? contactWaIdFromContacts;
        if (!externalMessageId || !fromWaId) {
          continue;
        }

        const messageType = asNonEmptyString(rawMessage.type) ?? "unknown";
        const textPayload = asObject(rawMessage.text);
        const body = asNonEmptyString(textPayload?.body) ?? undefined;
        const messageTimestampMs = parseMessageTimestampMs(rawMessage.timestamp, receivedAt);

        messages.push({
          phoneNumberId,
          wabaAccountId: entryWabaAccountId,
          contactWaId: fromWaId,
          contactDisplayName,
          externalMessageId,
          fromWaId,
          messageType,
          body,
          attachments: extractAttachments(rawMessage),
          messageTimestampMs,
          rawPayload: JSON.stringify(rawMessage),
        });
      }
    }
  }

  return {
    messages,
    missingPhoneNumberRoutes,
  };
}

async function findActiveMappingByPhoneNumber(ctx: any, phoneNumberId: string) {
  const mapping = await ctx.db
    .query("wabaTenantMappings")
    .withIndex("by_phone_number_id", (q: any) => q.eq("phoneNumberId", phoneNumberId))
    .unique();

  if (!mapping || !mapping.isActive) {
    return null;
  }

  return mapping;
}

async function insertAuditLog(
  ctx: any,
  input: {
    tenantId: string | null;
    phoneNumberId: string;
    eventType: string;
    outcome: "processed" | "duplicate" | "blocked" | "error";
    externalMessageId?: string;
    idempotencyKey?: string;
    details?: string;
    occurredAt: number;
  },
) {
  await ctx.db.insert("wabaAuditLogs", {
    tenantId: input.tenantId,
    phoneNumberId: input.phoneNumberId,
    eventType: input.eventType,
    outcome: input.outcome,
    externalMessageId: input.externalMessageId,
    idempotencyKey: input.idempotencyKey,
    details: input.details,
    occurredAt: input.occurredAt,
  });
}

async function persistInboundMessageInTransaction(
  ctx: any,
  args: {
    tenantId: string;
    receivedAt: number;
    message: NormalizedInboundMessage;
  },
) {
  const idempotencyKey = buildIdempotencyKey(args.tenantId, args.message.phoneNumberId, args.message.externalMessageId);

  const existingDelivery = await ctx.db
    .query("wabaWebhookDeliveries")
    .withIndex("by_idempotency_key", (q: any) => q.eq("idempotencyKey", idempotencyKey))
    .unique();

  if (existingDelivery) {
    await insertAuditLog(ctx, {
      tenantId: args.tenantId,
      phoneNumberId: args.message.phoneNumberId,
      eventType: "message_duplicate_ignored",
      outcome: "duplicate",
      externalMessageId: args.message.externalMessageId,
      idempotencyKey,
      details: "Duplicate webhook payload ignored.",
      occurredAt: args.receivedAt,
    });

    return {
      status: "duplicate" as const,
      conversationId: existingDelivery.conversationId,
      messageId: null,
      idempotencyKey,
    };
  }

  const existingConversation = await ctx.db
    .query("wabaConversations")
    .withIndex("by_tenant_contact_phone", (q: any) =>
      q.eq("tenantId", args.tenantId).eq("contactWaId", args.message.contactWaId).eq("phoneNumberId", args.message.phoneNumberId),
    )
    .unique();

  const preview = args.message.body ?? `[${args.message.messageType}]`;

  let conversationId = existingConversation?._id;
  if (!conversationId) {
    conversationId = await ctx.db.insert("wabaConversations", {
      tenantId: args.tenantId,
      phoneNumberId: args.message.phoneNumberId,
      contactWaId: args.message.contactWaId,
      contactDisplayName: args.message.contactDisplayName,
      lastMessagePreview: preview,
      lastMessageAt: args.message.messageTimestampMs,
      createdAt: args.receivedAt,
      updatedAt: args.receivedAt,
    });
  } else {
    const shouldAdvance = args.message.messageTimestampMs >= existingConversation.lastMessageAt;
    await ctx.db.patch(conversationId, {
      contactDisplayName: args.message.contactDisplayName ?? existingConversation.contactDisplayName,
      lastMessagePreview: shouldAdvance ? preview : existingConversation.lastMessagePreview,
      lastMessageAt: shouldAdvance ? args.message.messageTimestampMs : existingConversation.lastMessageAt,
      updatedAt: args.receivedAt,
    });
  }

  const messageId = await ctx.db.insert("wabaMessages", {
    tenantId: args.tenantId,
    conversationId,
    phoneNumberId: args.message.phoneNumberId,
    externalMessageId: args.message.externalMessageId,
    idempotencyKey,
    fromWaId: args.message.fromWaId,
    messageType: args.message.messageType,
    body: args.message.body,
    rawPayload: args.message.rawPayload,
    createdAt: args.message.messageTimestampMs,
    receivedAt: args.receivedAt,
  });

  await ctx.db.insert("wabaWebhookDeliveries", {
    tenantId: args.tenantId,
    phoneNumberId: args.message.phoneNumberId,
    externalMessageId: args.message.externalMessageId,
    idempotencyKey,
    conversationId,
    messageId,
    receivedAt: args.receivedAt,
    createdAt: args.receivedAt,
  });

  for (const attachment of args.message.attachments) {
    await ctx.db.insert("wabaAttachments", {
      tenantId: args.tenantId,
      conversationId,
      messageId,
      mediaType: attachment.mediaType,
      mediaId: attachment.mediaId,
      mimeType: attachment.mimeType,
      sha256: attachment.sha256,
      caption: attachment.caption,
      fileName: attachment.fileName,
      createdAt: args.receivedAt,
    });
  }

  await insertAuditLog(ctx, {
    tenantId: args.tenantId,
    phoneNumberId: args.message.phoneNumberId,
    eventType: "message_ingested",
    outcome: "processed",
    externalMessageId: args.message.externalMessageId,
    idempotencyKey,
    details: "Inbound message stored successfully.",
    occurredAt: args.receivedAt,
  });

  return {
    status: "processed" as const,
    conversationId,
    messageId,
    idempotencyKey,
  };
}

export const upsertTenantWabaMapping = internalMutation({
  args: {
    tenantId: v.string(),
    phoneNumberId: v.string(),
    wabaAccountId: v.string(),
    displayName: v.string(),
    isActive: v.optional(v.boolean()),
    now: v.optional(v.number()),
  },
  returns: mappingValidator,
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();

    const ownerByPhone = await ctx.db
      .query("wabaTenantMappings")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .unique();

    if (ownerByPhone && ownerByPhone.tenantId !== args.tenantId) {
      throw businessError("PHONE_NUMBER_ALREADY_MAPPED", "O phone_number_id ja esta mapeado para outro tenant.", {
        phoneNumberId: args.phoneNumberId,
        ownerTenantId: ownerByPhone.tenantId,
      });
    }

    const mappingsByTenant = await ctx.db
      .query("wabaTenantMappings")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const existing = ownerByPhone ?? mappingsByTenant[0] ?? null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        phoneNumberId: args.phoneNumberId,
        wabaAccountId: args.wabaAccountId,
        displayName: args.displayName,
        isActive: args.isActive ?? true,
        updatedAt: now,
      });

      return {
        tenantId: args.tenantId,
        phoneNumberId: args.phoneNumberId,
        wabaAccountId: args.wabaAccountId,
        displayName: args.displayName,
      };
    }

    await ctx.db.insert("wabaTenantMappings", {
      tenantId: args.tenantId,
      phoneNumberId: args.phoneNumberId,
      wabaAccountId: args.wabaAccountId,
      displayName: args.displayName,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      tenantId: args.tenantId,
      phoneNumberId: args.phoneNumberId,
      wabaAccountId: args.wabaAccountId,
      displayName: args.displayName,
    };
  },
});

export const processIncomingWebhook = internalMutation({
  args: {
    rawBody: v.string(),
    receivedAt: v.number(),
  },
  returns: processResultValidator,
  handler: async (ctx, args) => {
    let payload: unknown;

    try {
      payload = JSON.parse(args.rawBody);
    } catch {
      await insertAuditLog(ctx, {
        tenantId: null,
        phoneNumberId: UNKNOWN_PHONE_NUMBER_ID,
        eventType: "invalid_json",
        outcome: "blocked",
        details: "Webhook body is not valid JSON.",
        occurredAt: args.receivedAt,
      });

      return {
        processed: 0,
        duplicates: 0,
        blocked: 1,
        ignored: 0,
      };
    }

    const normalization = normalizeInboundMessages(payload, args.receivedAt);

    let blocked = 0;
    for (const missingPhoneRoute of normalization.missingPhoneNumberRoutes) {
      blocked += 1;
      await insertAuditLog(ctx, {
        tenantId: null,
        phoneNumberId: UNKNOWN_PHONE_NUMBER_ID,
        eventType: "missing_phone_number_id",
        outcome: "blocked",
        externalMessageId: missingPhoneRoute.externalMessageId,
        details: "Webhook blocked because metadata.phone_number_id is missing.",
        occurredAt: args.receivedAt,
      });
    }

    if (normalization.messages.length === 0) {
      if (blocked > 0) {
        return {
          processed: 0,
          duplicates: 0,
          blocked,
          ignored: 0,
        };
      }

      return {
        processed: 0,
        duplicates: 0,
        blocked,
        ignored: 1,
      };
    }

    let processed = 0;
    let duplicates = 0;

    for (const message of normalization.messages) {
      const mapping = await findActiveMappingByPhoneNumber(ctx, message.phoneNumberId);

      if (!mapping) {
        blocked += 1;
        await insertAuditLog(ctx, {
          tenantId: null,
          phoneNumberId: message.phoneNumberId,
          eventType: "unknown_phone_number_id",
          outcome: "blocked",
          externalMessageId: message.externalMessageId,
          details: "Webhook blocked because phone_number_id has no active tenant mapping.",
          occurredAt: args.receivedAt,
        });
        continue;
      }

      const result = await persistInboundMessageInTransaction(ctx, {
        tenantId: mapping.tenantId,
        receivedAt: args.receivedAt,
        message,
      });

      if (result.status === "duplicate") {
        duplicates += 1;
      } else {
        processed += 1;
      }
    }

    return {
      processed,
      duplicates,
      blocked,
      ignored: 0,
    };
  },
});

export const resolveTenantByPhoneNumberId = internalQuery({
  args: {
    phoneNumberId: v.string(),
  },
  returns: v.union(mappingValidator, v.null()),
  handler: async (ctx, args) => {
    const mapping = await findActiveMappingByPhoneNumber(ctx, args.phoneNumberId);

    if (!mapping) {
      return null;
    }

    return {
      tenantId: mapping.tenantId,
      phoneNumberId: mapping.phoneNumberId,
      wabaAccountId: mapping.wabaAccountId,
      displayName: mapping.displayName,
    };
  },
});

export const recordAuditEvent = internalMutation({
  args: {
    tenantId: v.union(v.string(), v.null()),
    phoneNumberId: v.string(),
    eventType: v.string(),
    outcome: v.union(v.literal("processed"), v.literal("duplicate"), v.literal("blocked"), v.literal("error")),
    externalMessageId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    details: v.optional(v.string()),
    occurredAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("wabaAuditLogs", {
      tenantId: args.tenantId,
      phoneNumberId: args.phoneNumberId,
      eventType: args.eventType,
      outcome: args.outcome,
      externalMessageId: args.externalMessageId,
      idempotencyKey: args.idempotencyKey,
      details: args.details,
      occurredAt: args.occurredAt,
    });

    return null;
  },
});

export const persistInboundMessage = internalMutation({
  args: {
    tenantId: v.string(),
    receivedAt: v.number(),
    message: normalizedInboundMessageValidator,
  },
  returns: persistResultValidator,
  handler: async (ctx, args) => {
    return await persistInboundMessageInTransaction(ctx, args);
  },
});
