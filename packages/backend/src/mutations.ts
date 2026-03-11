import { requireSession } from "./auth";
import { BackendError, logInfo } from "./errors";
import { InMemoryBackendStore } from "./store";
import type { Session } from "./types";
import { assertAttachmentUrl, assertId, assertMessageBody } from "./validators";

export function sendMessage(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
  conversationId: string;
  body: string;
  attachmentUrl?: string;
  now?: number;
}) {
  const session = requireSession(input.session);
  const conversationId = assertId(input.conversationId, "conversationId");
  const body = assertMessageBody(input.body);
  const attachmentUrl = assertAttachmentUrl(input.attachmentUrl);
  const now = input.now ?? Date.now();

  const conversation = input.store.findConversation(conversationId, session.tenantId);
  if (!conversation) {
    throw new BackendError("Conversation not found.", "NOT_FOUND", { conversationId, tenantId: session.tenantId });
  }

  if (!conversation.participantIds.includes(session.userId)) {
    throw new BackendError("You cannot send messages to this conversation.", "FORBIDDEN", {
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
  const session = requireSession(input.session);
  const conversationId = assertId(input.conversationId, "conversationId");

  const conversation = input.store.findConversation(conversationId, session.tenantId);
  if (!conversation) {
    throw new BackendError("Conversation not found.", "NOT_FOUND", { conversationId, tenantId: session.tenantId });
  }
  if (!conversation.participantIds.includes(session.userId)) {
    throw new BackendError("You cannot update this conversation.", "FORBIDDEN", {
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
