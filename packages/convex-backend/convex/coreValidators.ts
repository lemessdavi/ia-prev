import { v } from "convex/values";

export const userRoleValidator = v.union(v.literal("superadmin"), v.literal("tenant_user"));

export const sessionValidator = v.object({
  sessionToken: v.string(),
  userId: v.string(),
  tenantId: v.string(),
  role: userRoleValidator,
  createdAt: v.number(),
});

export const tenantValidator = v.object({
  id: v.string(),
  slug: v.string(),
  name: v.string(),
  isActive: v.boolean(),
  createdAt: v.number(),
});

export const userAccountSummaryValidator = v.object({
  userId: v.string(),
  tenantId: v.string(),
  username: v.string(),
  fullName: v.string(),
  email: v.string(),
  role: userRoleValidator,
  isActive: v.boolean(),
});

export const tenantWabaAccountSummaryValidator = v.object({
  id: v.string(),
  tenantId: v.string(),
  phoneNumberId: v.string(),
  wabaAccountId: v.string(),
  displayName: v.string(),
  createdAt: v.number(),
});

export const aiProfileValidator = v.object({
  id: v.string(),
  tenantId: v.string(),
  name: v.string(),
  provider: v.string(),
  model: v.string(),
  credentialsRef: v.string(),
  isActive: v.boolean(),
  createdAt: v.number(),
});

export const conversationListItemValidator = v.object({
  conversationId: v.string(),
  title: v.string(),
  lastMessagePreview: v.string(),
  lastMessageAt: v.number(),
  lastActivityAt: v.number(),
  unreadCount: v.number(),
});

export const messageValidator = v.object({
  id: v.string(),
  tenantId: v.string(),
  conversationId: v.string(),
  senderId: v.string(),
  body: v.string(),
  attachmentUrl: v.optional(v.string()),
  createdAt: v.number(),
  readBy: v.array(v.string()),
});

export const dossierValidator = v.object({
  id: v.string(),
  tenantId: v.string(),
  contactId: v.string(),
  role: v.string(),
  company: v.string(),
  location: v.string(),
  summary: v.string(),
  tags: v.array(v.string()),
  updatedAt: v.number(),
});

export const dossierEventValidator = v.object({
  id: v.string(),
  tenantId: v.string(),
  contactId: v.string(),
  title: v.string(),
  description: v.string(),
  occurredAt: v.number(),
  type: v.union(v.literal("interaction"), v.literal("status"), v.literal("note")),
});
