import { v } from "convex/values";
import { internalQuery } from "./server";

const messageSummaryValidator = v.object({
  tenantId: v.string(),
  phoneNumberId: v.string(),
  externalMessageId: v.string(),
  fromWaId: v.string(),
  messageType: v.string(),
  body: v.optional(v.string()),
  idempotencyKey: v.string(),
});

const conversationSummaryValidator = v.object({
  tenantId: v.string(),
  phoneNumberId: v.string(),
  contactWaId: v.string(),
  contactDisplayName: v.optional(v.string()),
  lastMessagePreview: v.string(),
  lastMessageAt: v.number(),
});

const auditSummaryValidator = v.object({
  tenantId: v.union(v.string(), v.null()),
  phoneNumberId: v.string(),
  eventType: v.string(),
  outcome: v.union(v.literal("processed"), v.literal("duplicate"), v.literal("blocked"), v.literal("error")),
  externalMessageId: v.optional(v.string()),
  idempotencyKey: v.optional(v.string()),
  details: v.optional(v.string()),
});

const attachmentSummaryValidator = v.object({
  tenantId: v.string(),
  mediaType: v.string(),
  mediaId: v.string(),
  mimeType: v.optional(v.string()),
  fileName: v.optional(v.string()),
});

const deliverySummaryValidator = v.object({
  tenantId: v.string(),
  phoneNumberId: v.string(),
  externalMessageId: v.string(),
  idempotencyKey: v.string(),
});

export const listTenantMessages = internalQuery({
  args: {
    tenantId: v.string(),
  },
  returns: v.array(messageSummaryValidator),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("wabaMessages")
      .withIndex("by_tenant_external_message", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    return messages.map((message) => ({
      tenantId: message.tenantId,
      phoneNumberId: message.phoneNumberId,
      externalMessageId: message.externalMessageId,
      fromWaId: message.fromWaId,
      messageType: message.messageType,
      body: message.body,
      idempotencyKey: message.idempotencyKey,
    }));
  },
});

export const listTenantConversations = internalQuery({
  args: {
    tenantId: v.string(),
  },
  returns: v.array(conversationSummaryValidator),
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("wabaConversations")
      .withIndex("by_tenant_last_message_at", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    return conversations.map((conversation) => ({
      tenantId: conversation.tenantId,
      phoneNumberId: conversation.phoneNumberId,
      contactWaId: conversation.contactWaId,
      contactDisplayName: conversation.contactDisplayName,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
    }));
  },
});

export const listAuditByPhoneNumber = internalQuery({
  args: {
    phoneNumberId: v.string(),
  },
  returns: v.array(auditSummaryValidator),
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("wabaAuditLogs")
      .withIndex("by_phone_number_occurred_at", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .collect();

    return logs.map((log) => ({
      tenantId: log.tenantId,
      phoneNumberId: log.phoneNumberId,
      eventType: log.eventType,
      outcome: log.outcome,
      externalMessageId: log.externalMessageId,
      idempotencyKey: log.idempotencyKey,
      details: log.details,
    }));
  },
});

export const listTenantAttachments = internalQuery({
  args: {
    tenantId: v.string(),
  },
  returns: v.array(attachmentSummaryValidator),
  handler: async (ctx, args) => {
    const attachments = await ctx.db
      .query("wabaAttachments")
      .withIndex("by_tenant_conversation", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    return attachments.map((attachment) => ({
      tenantId: attachment.tenantId,
      mediaType: attachment.mediaType,
      mediaId: attachment.mediaId,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
    }));
  },
});

export const listTenantDeliveries = internalQuery({
  args: {
    tenantId: v.string(),
  },
  returns: v.array(deliverySummaryValidator),
  handler: async (ctx, args) => {
    const deliveries = await ctx.db
      .query("wabaWebhookDeliveries")
      .withIndex("by_tenant_received_at", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    return deliveries.map((delivery) => ({
      tenantId: delivery.tenantId,
      phoneNumberId: delivery.phoneNumberId,
      externalMessageId: delivery.externalMessageId,
      idempotencyKey: delivery.idempotencyKey,
    }));
  },
});
