import { requirePersistedSession, requireSuperadmin } from "./auth";
import { BackendError, logInfo } from "./errors";
import { hashPassword } from "./security";
import { InMemoryBackendStore } from "./store";
import type { Session } from "./types";
import { assertAttachmentUrl, assertClosureReason, assertId, assertMessageBody, assertPassword } from "./validators";

export function sendMessage(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  conversationId: string;
  body: string;
  attachmentUrl?: string;
  now?: number;
}) {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversationId = assertId(input.conversationId, "conversationId");
  const body = assertMessageBody(input.body);
  const attachmentUrl = assertAttachmentUrl(input.attachmentUrl);
  const now = input.now ?? Date.now();

  const conversation = input.store.findConversation(conversationId, session.tenantId);
  if (!conversation) {
    throw new BackendError("Conversa nao encontrada.", "NOT_FOUND", { conversationId, tenantId: session.tenantId });
  }

  if (!conversation.participantIds.includes(session.userId)) {
    throw new BackendError("Voce nao pode enviar mensagens para esta conversa.", "FORBIDDEN", {
      conversationId,
      userId: session.userId,
      tenantId: session.tenantId,
    });
  }

  const message = {
    id: `msg_${conversationId}_${now}`,
    tenantId: session.tenantId,
    conversationId,
    senderId: session.userId,
    body,
    attachmentUrl,
    createdAt: now,
    readBy: [session.userId],
  };

  input.store.insertMessage(message);
  input.store.updateConversation(conversationId, session.tenantId, {
    lastMessagePreview: body,
    lastMessageAt: now,
    lastActivityAt: now,
  });

  logInfo("Message sent.", {
    tenantId: session.tenantId,
    conversationId,
    userId: session.userId,
    hasAttachment: Boolean(attachmentUrl),
  });
  return message;
}

export function markConversationAsRead(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  conversationId: string;
}) {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversationId = assertId(input.conversationId, "conversationId");

  const conversation = input.store.findConversation(conversationId, session.tenantId);
  if (!conversation) {
    throw new BackendError("Conversa nao encontrada.", "NOT_FOUND", { conversationId, tenantId: session.tenantId });
  }
  if (!conversation.participantIds.includes(session.userId)) {
    throw new BackendError("Voce nao pode atualizar esta conversa.", "FORBIDDEN", {
      conversationId,
      userId: session.userId,
      tenantId: session.tenantId,
    });
  }

  const updatedCount = input.store.markConversationRead(conversationId, session.tenantId, session.userId);
  logInfo("Conversation read state updated.", {
    tenantId: session.tenantId,
    conversationId,
    userId: session.userId,
    updatedCount,
  });
  return { conversationId, updatedCount };
}

export function resetUserPassword(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  userId: string;
  nextPassword: string;
  now?: number;
}) {
  const session = requireSuperadmin({ session: input.session, store: input.store });
  const userId = assertId(input.userId, "userId");
  const nextPassword = assertPassword(input.nextPassword, "nextPassword");
  const user = input.store.findUserById(userId);
  const account = input.store.findUserAccountByUserId(userId);

  if (!user || !account) {
    throw new BackendError("Usuario nao encontrado.", "NOT_FOUND", { userId });
  }

  input.store.upsertUserAccount({
    ...account,
    passwordHash: hashPassword(nextPassword),
    passwordUpdatedAt: input.now ?? Date.now(),
  });

  const revokedSessionCount = input.store.revokeSessionsByUserId(userId);
  logInfo("Password reset by superadmin.", {
    actorUserId: session.userId,
    actorTenantId: session.tenantId,
    targetUserId: userId,
    targetTenantId: user.tenantId,
    revokedSessionCount,
  });

  return {
    userId: user.id,
    tenantId: user.tenantId,
    revokedSessionCount,
  };
}

export function takeConversationHandoff(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  conversationId: string;
  now?: number;
}) {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversationId = assertId(input.conversationId, "conversationId");
  const now = input.now ?? Date.now();
  const conversation = input.store.findConversation(conversationId, session.tenantId);
  if (!conversation) {
    throw new BackendError("Conversa nao encontrada.", "NOT_FOUND", {
      conversationId,
      tenantId: session.tenantId,
    });
  }
  if (conversation.conversationStatus === "FECHADO") {
    throw new BackendError("A conversa ja esta encerrada.", "BAD_REQUEST", {
      conversationId,
      tenantId: session.tenantId,
    });
  }

  const participantIds = conversation.participantIds.includes(session.userId)
    ? conversation.participantIds
    : [...conversation.participantIds, session.userId];

  input.store.updateConversation(conversationId, session.tenantId, {
    participantIds,
    conversationStatus: "EM_ATENDIMENTO_HUMANO",
    lastActivityAt: now,
  });

  const handoffEventId = `hand_${conversationId}_${now}`;
  input.store.insertHandoffEvent({
    id: handoffEventId,
    tenantId: session.tenantId,
    conversationId,
    from: "assistant",
    to: "human",
    performedByUserId: session.userId,
    createdAt: now,
  });
  input.store.insertAuditLog({
    id: `audit_handoff_${conversationId}_${now}`,
    tenantId: session.tenantId,
    actorUserId: session.userId,
    action: "conversation.handoff.taken",
    targetType: "conversation",
    targetId: conversationId,
    createdAt: now,
  });

  return {
    conversationId,
    conversationStatus: "EM_ATENDIMENTO_HUMANO" as const,
    handoffEventId,
  };
}

export function closeConversationWithReason(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  conversationId: string;
  reason: string;
  now?: number;
}) {
  const session = requirePersistedSession({ session: input.session, store: input.store });
  const conversationId = assertId(input.conversationId, "conversationId");
  const reason = assertClosureReason(input.reason);
  const now = input.now ?? Date.now();
  const conversation = input.store.findConversation(conversationId, session.tenantId);
  if (!conversation) {
    throw new BackendError("Conversa nao encontrada.", "NOT_FOUND", {
      conversationId,
      tenantId: session.tenantId,
    });
  }

  input.store.updateConversation(conversationId, session.tenantId, {
    conversationStatus: "FECHADO",
    closureReason: reason,
    lastActivityAt: now,
  });

  input.store.insertAuditLog({
    id: `audit_closed_${conversationId}_${now}`,
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
}
