import type { Conversation, Database, DossierEvent, Message, TenantId, User } from "./types";
import { createPrototypeAlignedFixtures } from "./fixtures";

export class InMemoryBackendStore {
  private state: Database;

  constructor(seed?: Database) {
    this.state = seed ?? createPrototypeAlignedFixtures();
  }

  snapshot(): Database {
    return JSON.parse(JSON.stringify(this.state)) as Database;
  }

  findConversation(conversationId: string, tenantId: TenantId): Conversation | undefined {
    return this.state.conversations.find((item) => item.id === conversationId && item.tenantId === tenantId);
  }

  listMessages(conversationId: string, tenantId: TenantId): Message[] {
    return this.state.messages
      .filter((message) => message.conversationId === conversationId && message.tenantId === tenantId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  listConversationsByUser(userId: string, tenantId: TenantId): Conversation[] {
    return this.state.conversations
      .filter((conversation) => conversation.tenantId === tenantId && conversation.participantIds.includes(userId))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }

  listDossierEvents(contactId: string, tenantId: TenantId): DossierEvent[] {
    return this.state.dossierEvents
      .filter((event) => event.contactId === contactId && event.tenantId === tenantId)
      .sort((a, b) => b.occurredAt - a.occurredAt);
  }

  insertMessage(message: Message): void {
    this.state.messages.push(message);
  }

  updateConversation(conversationId: string, tenantId: TenantId, patch: Partial<Conversation>): void {
    this.state.conversations = this.state.conversations.map((conversation) =>
      conversation.id === conversationId && conversation.tenantId === tenantId ? { ...conversation, ...patch } : conversation,
    );
  }

  markConversationRead(conversationId: string, tenantId: TenantId, userId: string): number {
    let updates = 0;
    this.state.messages = this.state.messages.map((message) => {
      if (message.conversationId !== conversationId || message.tenantId !== tenantId) return message;
      if (message.senderId === userId || message.readBy.includes(userId)) return message;
      updates += 1;
      return { ...message, readBy: [...message.readBy, userId] };
    });
    return updates;
  }

  findDossier(contactId: string, tenantId: TenantId) {
    return this.state.dossiers.find((dossier) => dossier.contactId === contactId && dossier.tenantId === tenantId);
  }

  findUser(userId: string, tenantId: TenantId): User | undefined {
    return this.state.users.find((user) => user.id === userId && user.tenantId === tenantId);
  }

  hasConversationWithContact(userId: string, contactId: string, tenantId: TenantId): boolean {
    return this.state.conversations.some(
      (conversation) =>
        conversation.tenantId === tenantId &&
        conversation.participantIds.includes(userId) &&
        conversation.participantIds.includes(contactId),
    );
  }
}
