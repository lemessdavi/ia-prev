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
  const conversations = input.store.listConversationsByUser(session.userId);

  const result = conversations.map((conversation) => {
    const unreadCount = input.store
      .listMessages(conversation.id)
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

  logInfo("Conversations listed.", { userId: session.userId, count: result.length });
  return result;
}

export function getContactDossierWithEvents(input: {
  session?: Session | null;
  contactId: string;
  store: InMemoryBackendStore;
}) {
  const session = requireSession(input.session);
  const contactId = assertId(input.contactId, "contactId");

  const dossier = input.store.findDossier(contactId);
  if (!dossier) {
    throw new BackendError("Dossier not found for this contact.", "NOT_FOUND", { contactId });
  }

  const events = input.store.listDossierEvents(contactId).slice(0, 5);
  logInfo("Dossier fetched.", { userId: session.userId, contactId, events: events.length });

  return {
    contactId,
    dossier,
    recentEvents: events,
  };
}
