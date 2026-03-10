import type { Conversation, Database, DossierEvent, Message } from "./types";
import { createPrototypeAlignedFixtures } from "./fixtures";

export class InMemoryBackendStore {
  private state: Database;

  constructor(seed?: Database) {
    this.state = seed ?? createPrototypeAlignedFixtures();
  }

  snapshot(): Database {
    return JSON.parse(JSON.stringify(this.state)) as Database;
  }

  findConversation(conversationId: string): Conversation | undefined {
    return this.state.conversations.find((item) => item.id === conversationId);
  }

  listMessages(conversationId: string): Message[] {
    return this.state.messages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  listConversationsByUser(userId: string): Conversation[] {
    return this.state.conversations
      .filter((conversation) => conversation.participantIds.includes(userId))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }

  listDossierEvents(contactId: string): DossierEvent[] {
    return this.state.dossierEvents
      .filter((event) => event.contactId === contactId)
      .sort((a, b) => b.occurredAt - a.occurredAt);
  }

  insertMessage(message: Message): void {
    this.state.messages.push(message);
  }

  updateConversation(conversationId: string, patch: Partial<Conversation>): void {
    this.state.conversations = this.state.conversations.map((conversation) =>
      conversation.id === conversationId ? { ...conversation, ...patch } : conversation,
    );
  }

  markConversationRead(conversationId: string, userId: string): number {
    let updates = 0;
    this.state.messages = this.state.messages.map((message) => {
      if (message.conversationId !== conversationId) return message;
      if (message.senderId === userId || message.readBy.includes(userId)) return message;
      updates += 1;
      return { ...message, readBy: [...message.readBy, userId] };
    });
    return updates;
  }

  findDossier(contactId: string) {
    return this.state.dossiers.find((dossier) => dossier.contactId === contactId);
  }
}
