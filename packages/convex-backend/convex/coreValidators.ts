import { v } from "convex/values";

export const userRoleValidator = v.union(v.literal("superadmin"), v.literal("tenant_user"));
export const conversationStatusValidator = v.union(
  v.literal("EM_TRIAGEM"),
  v.literal("PENDENTE_HUMANO"),
  v.literal("EM_ATENDIMENTO_HUMANO"),
  v.literal("FECHADO"),
);
export const triageResultValidator = v.union(
  v.literal("APTO"),
  v.literal("REVISAO_HUMANA"),
  v.literal("NAO_APTO"),
  v.literal("N_A"),
);

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

export const tenantWorkspaceSummaryValidator = v.object({
  tenantId: v.string(),
  tenantName: v.string(),
  wabaLabel: v.string(),
  activeAiProfileName: v.string(),
  operator: v.object({
    userId: v.string(),
    fullName: v.string(),
    username: v.string(),
  }),
});

export const conversationInboxItemValidator = v.object({
  conversationId: v.string(),
  title: v.string(),
  conversationStatus: conversationStatusValidator,
  triageResult: triageResultValidator,
  closureReason: v.optional(v.string()),
  lastMessagePreview: v.string(),
  lastMessageAt: v.number(),
  lastActivityAt: v.number(),
  unreadCount: v.number(),
  hasAttachment: v.boolean(),
  hasHumanHandoff: v.boolean(),
});

export const conversationThreadAttachmentValidator = v.object({
  id: v.string(),
  fileName: v.string(),
  contentType: v.string(),
  url: v.string(),
});

export const handoffEventValidator = v.object({
  id: v.string(),
  tenantId: v.string(),
  conversationId: v.string(),
  from: v.union(v.literal("assistant"), v.literal("human")),
  to: v.union(v.literal("assistant"), v.literal("human")),
  performedByUserId: v.optional(v.string()),
  createdAt: v.number(),
});

export const conversationThreadMessageValidator = v.object({
  id: v.string(),
  senderId: v.string(),
  body: v.string(),
  createdAt: v.number(),
  readBy: v.array(v.string()),
  attachment: v.optional(conversationThreadAttachmentValidator),
});

export const conversationThreadPayloadValidator = v.object({
  conversationId: v.string(),
  title: v.string(),
  conversationStatus: conversationStatusValidator,
  triageResult: triageResultValidator,
  closureReason: v.optional(v.string()),
  participantIds: v.array(v.string()),
  messages: v.array(conversationThreadMessageValidator),
  handoffEvents: v.array(handoffEventValidator),
});

export const attachmentValidator = v.object({
  id: v.string(),
  tenantId: v.string(),
  conversationId: v.string(),
  messageId: v.optional(v.string()),
  fileName: v.string(),
  contentType: v.string(),
  url: v.string(),
  createdAt: v.number(),
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

export const conversationDossierExportValidator = v.object({
  tenantId: v.string(),
  conversationId: v.string(),
  contactId: v.string(),
  generatedAtIso: v.string(),
  dossier: dossierValidator,
  recentEvents: v.array(dossierEventValidator),
  messages: v.array(messageValidator),
  attachments: v.array(attachmentValidator),
  handoffEvents: v.array(handoffEventValidator),
  closureReason: v.optional(v.string()),
});
