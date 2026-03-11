import { requireSession } from "./auth";
import { BackendError, logInfo } from "./errors";
import { InMemoryBackendStore } from "./store";
import type { ConversationListItem, Session } from "./types";
import { assertId } from "./validators";

export function listConversationsWithUnreadBadge(input: {
  session?: Session | null;
  store: InMemoryBackendStore;
}): ConversationListItem[] {
  const session = requireSession(input.session);
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

export function getContactDossierWithEvents(input: {
  session?: Session | null;
  contactId: string;
  store: InMemoryBackendStore;
}) {
  const session = requireSession(input.session);
  const contactId = assertId(input.contactId, "contactId");
  if (!input.store.findUser(session.userId, session.tenantId)) {
    throw new BackendError("Dossier not found for this contact.", "NOT_FOUND", {
      tenantId: session.tenantId,
      contactId,
    });
  }

  const dossier = input.store.findDossier(contactId, session.tenantId);
  if (!dossier) {
    throw new BackendError("Dossier not found for this contact.", "NOT_FOUND", {
      contactId,
      tenantId: session.tenantId,
    });
  }

  const canAccess =
    session.userId === contactId ||
    input.store.hasConversationWithContact(session.userId, contactId, session.tenantId);
  if (!canAccess) {
    throw new BackendError("Dossier not found for this contact.", "NOT_FOUND", {
      contactId,
      tenantId: session.tenantId,
    });
  }

  const events = input.store.listDossierEvents(contactId, session.tenantId).slice(0, 5);
  logInfo("Dossier fetched.", { tenantId: session.tenantId, userId: session.userId, contactId, events: events.length });

  return {
    contactId,
    dossier,
    recentEvents: events,
  };
}
