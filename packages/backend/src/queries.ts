import { assertTenantAccess, requirePersistedSession } from "./auth";
import { BackendError, logInfo } from "./errors";
import { InMemoryBackendStore } from "./store";
import type {
  ConversationAttachmentArchiveExport,
  ConversationInboxItem,
  ConversationListItem,
  ConversationThreadMessageAttachment,
  ConversationThreadPayload,
  Session,
  TenantWorkspaceSummary,
  UserAccountSummary,
} from "./types";
import { assertConversationStatusFilter, assertId, assertSearchTerm } from "./validators";

export function listConversationsWithUnreadBadge(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
}): ConversationListItem[] {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversations = input.store.listConversationsByUser(session.userId, session.tenantId);

  const result = conversations.map((conversation) => {
    const unreadCount = input.store
      .listMessages(conversation.id, session.tenantId)
      .filter((message) => message.senderId !== session.userId && !message.readBy.includes(session.userId)).length;

    return {
      conversationId: conversation.id,
      title: conversation.title,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      lastActivityAt: conversation.lastActivityAt,
      unreadCount,
    };
  });

  logInfo("Conversations listed.", { tenantId: session.tenantId, userId: session.userId, count: result.length });
  return result;
}

export function getContactProfileWithEvents(input: {
  session?: Session | null;
  contactId: string;
  store: InMemoryBackendStore;
}) {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const contactId = assertId(input.contactId, "contactId");
  if (!input.store.findUser(session.userId, session.tenantId)) {
    throw new BackendError("Contact profile not found for this contact.", "NOT_FOUND", {
      tenantId: session.tenantId,
      contactId,
    });
  }

  const contactProfile = input.store.findContactProfile(contactId, session.tenantId);
  if (!contactProfile) {
    throw new BackendError("Contact profile not found for this contact.", "NOT_FOUND", {
      contactId,
      tenantId: session.tenantId,
    });
  }

  const canAccess =
    session.userId === contactId ||
    input.store.hasConversationWithContact(session.userId, contactId, session.tenantId);
  if (!canAccess) {
    throw new BackendError("Contact profile not found for this contact.", "NOT_FOUND", {
      contactId,
      tenantId: session.tenantId,
    });
  }

  const events = input.store.listContactProfileEvents(contactId, session.tenantId).slice(0, 5);
  logInfo("Contact profile fetched.", { tenantId: session.tenantId, userId: session.userId, contactId, events: events.length });

  return {
    contactId,
    contactProfile,
    recentEvents: events,
  };
}

export function getTenantWorkspaceSummary(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
}): TenantWorkspaceSummary {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const tenant = input.store.findTenantById(session.tenantId);
  const wabaMapping = input.store.findTenantWabaByTenantId(session.tenantId);
  const aiProfile = input.store.findActiveAIProfileByTenantId(session.tenantId);
  const user = input.store.findUser(session.userId, session.tenantId);

  if (!tenant || !wabaMapping || !aiProfile || !user) {
    throw new BackendError("Tenant workspace is not fully configured.", "NOT_FOUND", {
      tenantId: session.tenantId,
      userId: session.userId,
    });
  }

  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    wabaLabel: wabaMapping.displayName,
    activeAiProfileName: aiProfile.name,
    operator: {
      userId: user.id,
      fullName: user.fullName,
      username: user.username,
    },
  };
}

export function listConversationsForInbox(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  status?: string;
  search?: string;
}): ConversationInboxItem[] {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const statusFilter = assertConversationStatusFilter(input.status);
  const searchFilter = assertSearchTerm(input.search);

  const conversations = input.store
    .listConversationsByTenant(session.tenantId)
    .filter((conversation) => (statusFilter === "ALL" ? true : conversation.conversationStatus === statusFilter))
    .filter((conversation) => {
      if (!searchFilter) return true;
      const haystack = `${conversation.title} ${conversation.lastMessagePreview}`.toLowerCase();
      return haystack.includes(searchFilter);
    })
    .map((conversation) => {
      const messages = input.store.listMessages(conversation.id, session.tenantId);
      const unreadCount = messages.filter(
        (message) => message.senderId !== session.userId && !message.readBy.includes(session.userId),
      ).length;
      const hasAttachment =
        messages.some((message) => Boolean(message.attachmentUrl)) ||
        input.store.listAttachments(conversation.id, session.tenantId).length > 0;
      const hasHumanHandoff = input.store
        .listHandoffEvents(conversation.id, session.tenantId)
        .some((event) => event.to === "human");

      return {
        conversationId: conversation.id,
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
    });

  logInfo("Tenant inbox listed.", {
    tenantId: session.tenantId,
    userId: session.userId,
    status: statusFilter,
    search: searchFilter ?? "none",
    count: conversations.length,
  });

  return conversations;
}

export function getConversationThread(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  conversationId: string;
}): ConversationThreadPayload {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversationId = assertId(input.conversationId, "conversationId");
  const conversation = input.store.findConversation(conversationId, session.tenantId);

  if (!conversation) {
    throw new BackendError("Conversation not found.", "NOT_FOUND", {
      conversationId,
      tenantId: session.tenantId,
    });
  }

  const attachmentsByMessageId = new Map<string, ConversationThreadMessageAttachment>();
  for (const attachment of input.store.listAttachments(conversationId, session.tenantId)) {
    if (!attachment.messageId) continue;
    attachmentsByMessageId.set(attachment.messageId, {
      id: attachment.id,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      url: attachment.url,
    });
  }

  const messages = input.store.listMessages(conversationId, session.tenantId).map((message) => {
    const attachment = attachmentsByMessageId.get(message.id) ?? toInlineAttachment(message.id, message.attachmentUrl);
    return {
      id: message.id,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt,
      readBy: message.readBy,
      attachment,
    };
  });

  return {
    conversationId: conversation.id,
    title: conversation.title,
    conversationStatus: conversation.conversationStatus,
    triageResult: conversation.triageResult,
    closureReason: conversation.closureReason,
    participantIds: conversation.participantIds,
    messages,
    handoffEvents: input.store.listHandoffEvents(conversationId, session.tenantId),
  };
}

export function exportConversationAttachmentArchive(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  conversationId: string;
  now?: number;
}): ConversationAttachmentArchiveExport {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversationId = assertId(input.conversationId, "conversationId");
  const conversation = input.store.findConversation(conversationId, session.tenantId);
  if (!conversation) {
    throw new BackendError("Conversation not found.", "NOT_FOUND", {
      tenantId: session.tenantId,
      conversationId,
    });
  }

  const now = input.now ?? Date.now();
  const attachments = input.store.listAttachments(conversationId, session.tenantId);
  const zipFileName = `arquivos-conversa-${conversationId}.zip`;
  const zipDownloadUrl = `https://cdn.iaprev.com/archives/${encodeURIComponent(zipFileName)}`;

  input.store.insertAuditLog({
    id: `audit_attachment_archive_export_${conversationId}_${now}`,
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "conversation.attachments_zip_exported",
    targetType: "conversation",
    targetId: conversationId,
    createdAt: now,
  });

  return {
    formatVersion: "conversation.attachments.zip.v1",
    tenantId: session.tenantId,
    conversationId,
    generatedAtIso: new Date(now).toISOString(),
    zipFileName,
    zipDownloadUrl,
    attachmentCount: attachments.length,
    attachments,
  };
}

export function listUsers(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  tenantId?: string;
}): UserAccountSummary[] {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const requestedTenantId = input.tenantId ? assertId(input.tenantId, "tenantId") : undefined;
  const scopedTenantId =
    session.role === "superadmin"
      ? requestedTenantId
      : assertTenantAccess(session, requestedTenantId ?? session.tenantId);

  const users = input.store
    .listUserAccounts(scopedTenantId)
    .map((account) => {
      const user = input.store.findUserById(account.userId);
      if (!user) {
        throw new BackendError("User account is linked to an unknown user.", "NOT_FOUND", {
          userId: account.userId,
        });
      }

      return {
        userId: user.id,
        tenantId: user.tenantId,
        username: account.username,
        fullName: user.fullName,
        email: user.email,
        role: account.role,
        isActive: account.isActive,
      };
    })
    .sort((a, b) => {
      const tenantCompare = a.tenantId.localeCompare(b.tenantId);
      return tenantCompare !== 0 ? tenantCompare : a.username.localeCompare(b.username);
    });

  logInfo("Users listed.", {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    requestedTenantId: requestedTenantId ?? "all",
    count: users.length,
  });

  return users;
}

export function resolveTenantByPhoneNumberId(input: {
  phoneNumberId: string;
  store: InMemoryBackendStore;
}) {
  const phoneNumberId = assertId(input.phoneNumberId, "phoneNumberId");
  const mapping = input.store.findTenantWabaByPhoneNumberId(phoneNumberId);
  if (!mapping) {
    throw new BackendError("WABA mapping not found for phone_number_id.", "NOT_FOUND", { phoneNumberId });
  }

  logInfo("Tenant resolved from phone_number_id.", {
    phoneNumberId,
    tenantId: mapping.tenantId,
    wabaAccountId: mapping.wabaAccountId,
  });

  return {
    tenantId: mapping.tenantId,
    wabaAccountId: mapping.wabaAccountId,
    displayName: mapping.displayName,
  };
}

function resolveContactId(participantIds: string[], currentUserId: string): string {
  const candidate = participantIds.find((id) => id !== currentUserId) ?? participantIds[0];
  if (!candidate) {
    throw new BackendError("Conversation is missing participants.", "BAD_REQUEST");
  }
  return candidate;
}

function toInlineAttachment(messageId: string, attachmentUrl?: string): ConversationThreadMessageAttachment | undefined {
  if (!attachmentUrl) return undefined;

  const fileName = attachmentUrl.split("/").filter(Boolean).at(-1) ?? `attachment_${messageId}`;
  return {
    id: `att_inline_${messageId}`,
    fileName,
    contentType: inferContentTypeFromUrl(fileName),
    url: attachmentUrl,
  };
}

function inferContentTypeFromUrl(fileName: string): string {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith(".pdf")) return "application/pdf";
  if (normalized.endsWith(".ogg") || normalized.endsWith(".mp3") || normalized.endsWith(".wav")) return "audio/ogg";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg") || normalized.endsWith(".png")) return "image/jpeg";
  return "application/octet-stream";
}
