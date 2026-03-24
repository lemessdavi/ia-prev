import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tenants: defineTable({
    tenantId: v.string(),
    slug: v.string(),
    name: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_tenant_id", ["tenantId"])
    .index("by_slug", ["slug"]),

  users: defineTable({
    userId: v.string(),
    tenantId: v.string(),
    username: v.string(),
    fullName: v.string(),
    email: v.string(),
    avatarUrl: v.string(),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_tenant_id", ["tenantId"])
    .index("by_tenant_id_and_email", ["tenantId", "email"]),

  userAccounts: defineTable({
    userId: v.string(),
    username: v.string(),
    role: v.union(v.literal("superadmin"), v.literal("tenant_user")),
    isActive: v.boolean(),
    passwordHash: v.string(),
    passwordUpdatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_username", ["username"])
    .index("by_role", ["role"]),

  sessions: defineTable({
    sessionToken: v.string(),
    userId: v.string(),
    tenantId: v.string(),
    role: v.union(v.literal("superadmin"), v.literal("tenant_user")),
    createdAt: v.number(),
  })
    .index("by_session_token", ["sessionToken"])
    .index("by_user_id", ["userId"])
    .index("by_tenant_id", ["tenantId"]),

  aiProfiles: defineTable({
    profileId: v.string(),
    tenantId: v.string(),
    name: v.string(),
    provider: v.string(),
    model: v.string(),
    credentialsRef: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_profile_id", ["profileId"])
    .index("by_tenant_id", ["tenantId"])
    .index("by_tenant_id_and_active", ["tenantId", "isActive"]),

  conversations: defineTable({
    conversationId: v.string(),
    tenantId: v.string(),
    participantIds: v.array(v.string()),
    conversationStatus: v.union(
      v.literal("EM_TRIAGEM"),
      v.literal("PENDENTE_HUMANO"),
      v.literal("EM_ATENDIMENTO_HUMANO"),
      v.literal("FECHADO"),
    ),
    triageResult: v.union(v.literal("APTO"), v.literal("REVISAO_HUMANA"), v.literal("NAO_APTO"), v.literal("N_A")),
    title: v.string(),
    lastMessagePreview: v.string(),
    lastMessageAt: v.number(),
    lastActivityAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_conversation_id", ["conversationId"])
    .index("by_tenant_id_and_last_activity", ["tenantId", "lastActivityAt"]),

  conversationMemberships: defineTable({
    tenantId: v.string(),
    conversationId: v.string(),
    userId: v.string(),
  })
    .index("by_tenant_id_and_user_id", ["tenantId", "userId"])
    .index("by_tenant_id_and_conversation_id_and_user_id", ["tenantId", "conversationId", "userId"]),

  messages: defineTable({
    messageId: v.string(),
    tenantId: v.string(),
    conversationId: v.string(),
    senderId: v.string(),
    body: v.string(),
    attachmentUrl: v.optional(v.string()),
    createdAt: v.number(),
    readBy: v.array(v.string()),
  })
    .index("by_message_id", ["messageId"])
    .index("by_tenant_id_and_conversation_id_and_created_at", ["tenantId", "conversationId", "createdAt"]),

  dossiers: defineTable({
    dossierId: v.string(),
    tenantId: v.string(),
    contactId: v.string(),
    role: v.string(),
    company: v.string(),
    location: v.string(),
    summary: v.string(),
    tags: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_tenant_id_and_contact_id", ["tenantId", "contactId"]),

  dossierEvents: defineTable({
    eventId: v.string(),
    tenantId: v.string(),
    contactId: v.string(),
    title: v.string(),
    description: v.string(),
    occurredAt: v.number(),
    type: v.union(v.literal("interaction"), v.literal("status"), v.literal("note")),
  }).index("by_tenant_id_and_contact_id_and_occurred_at", ["tenantId", "contactId", "occurredAt"]),

  wabaTenantMappings: defineTable({
    tenantId: v.string(),
    phoneNumberId: v.string(),
    wabaAccountId: v.string(),
    displayName: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_phone_number_id", ["phoneNumberId"])
    .index("by_tenant", ["tenantId"]),

  wabaConversations: defineTable({
    tenantId: v.string(),
    phoneNumberId: v.string(),
    contactWaId: v.string(),
    contactDisplayName: v.optional(v.string()),
    lastMessagePreview: v.string(),
    lastMessageAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant_contact_phone", ["tenantId", "contactWaId", "phoneNumberId"])
    .index("by_tenant_last_message_at", ["tenantId", "lastMessageAt"]),

  wabaMessages: defineTable({
    tenantId: v.string(),
    conversationId: v.id("wabaConversations"),
    phoneNumberId: v.string(),
    externalMessageId: v.string(),
    idempotencyKey: v.string(),
    fromWaId: v.string(),
    messageType: v.string(),
    body: v.optional(v.string()),
    rawPayload: v.string(),
    createdAt: v.number(),
    receivedAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_tenant_external_message", ["tenantId", "externalMessageId"])
    .index("by_tenant_conversation_created_at", ["tenantId", "conversationId", "createdAt"]),

  wabaAttachments: defineTable({
    tenantId: v.string(),
    conversationId: v.id("wabaConversations"),
    messageId: v.id("wabaMessages"),
    mediaType: v.string(),
    mediaId: v.string(),
    mimeType: v.optional(v.string()),
    sha256: v.optional(v.string()),
    caption: v.optional(v.string()),
    fileName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tenant_conversation", ["tenantId", "conversationId"])
    .index("by_message", ["messageId"]),

  wabaWebhookDeliveries: defineTable({
    tenantId: v.string(),
    phoneNumberId: v.string(),
    externalMessageId: v.string(),
    idempotencyKey: v.string(),
    conversationId: v.id("wabaConversations"),
    messageId: v.id("wabaMessages"),
    receivedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_tenant_received_at", ["tenantId", "receivedAt"]),

  wabaAuditLogs: defineTable({
    tenantId: v.union(v.string(), v.null()),
    phoneNumberId: v.string(),
    eventType: v.string(),
    outcome: v.union(v.literal("processed"), v.literal("duplicate"), v.literal("blocked"), v.literal("error")),
    externalMessageId: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    details: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_tenant_occurred_at", ["tenantId", "occurredAt"])
    .index("by_phone_number_occurred_at", ["phoneNumberId", "occurredAt"]),
});
