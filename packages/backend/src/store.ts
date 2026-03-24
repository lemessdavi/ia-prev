import type {
  Attachment,
  AuditLog,
  Conversation,
  Database,
  DossierEvent,
  Message,
  StoredSession,
  TenantId,
  User,
  UserAccount,
} from "./types";
import { createPrototypeAlignedFixtures } from "./fixtures";

export class InMemoryBackendStore {
  private state: Database;

  constructor(seed?: Database) {
    this.state = seed ?? createPrototypeAlignedFixtures();
  }

  snapshot(): Database {
    return JSON.parse(JSON.stringify(this.state)) as Database;
  }

  findUserById(userId: string): User | undefined {
    return this.state.users.find((user) => user.id === userId);
  }

  findUserAccountByUsername(username: string): UserAccount | undefined {
    return this.state.userAccounts.find((account) => account.username === username);
  }

  findUserAccountByUserId(userId: string): UserAccount | undefined {
    return this.state.userAccounts.find((account) => account.userId === userId);
  }

  findSessionById(sessionId: string): StoredSession | undefined {
    return this.state.sessions.find((session) => session.id === sessionId);
  }

  listUserAccounts(tenantId?: TenantId): UserAccount[] {
    return this.state.userAccounts
      .filter((account) => {
        if (!tenantId) return true;
        const user = this.findUserById(account.userId);
        return user?.tenantId === tenantId;
      })
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  upsertUserAccount(account: UserAccount): void {
    const existingIndex = this.state.userAccounts.findIndex((item) => item.userId === account.userId);
    if (existingIndex === -1) {
      this.state.userAccounts.push(account);
      return;
    }

    this.state.userAccounts[existingIndex] = account;
  }

  createSession(session: StoredSession): void {
    this.state.sessions.push(session);
  }

  revokeSessionsByUserId(userId: string): number {
    const before = this.state.sessions.length;
    this.state.sessions = this.state.sessions.filter((session) => session.userId !== userId);
    return before - this.state.sessions.length;
  }

  findTenantWabaByPhoneNumberId(phoneNumberId: string) {
    return this.state.tenantWabaAccounts.find((mapping) => mapping.phoneNumberId === phoneNumberId);
  }

  findConversation(conversationId: string, tenantId: TenantId): Conversation | undefined {
    return this.state.conversations.find((item) => item.id === conversationId && item.tenantId === tenantId);
  }

  findConversationByParticipant(participantId: string, tenantId: TenantId): Conversation | undefined {
    return this.state.conversations.find(
      (conversation) => conversation.tenantId === tenantId && conversation.participantIds.includes(participantId),
    );
  }

  listMessages(conversationId: string, tenantId: TenantId): Message[] {
    return this.state.messages
      .filter((message) => message.conversationId === conversationId && message.tenantId === tenantId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  findMessage(messageId: string, tenantId: TenantId): Message | undefined {
    return this.state.messages.find((message) => message.id === messageId && message.tenantId === tenantId);
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

  insertConversation(conversation: Conversation): void {
    this.state.conversations.push(conversation);
  }

  insertAttachment(attachment: Attachment): void {
    this.state.attachments.push(attachment);
  }

  insertAuditLog(auditLog: AuditLog): void {
    this.state.auditLogs.push(auditLog);
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
    const user = this.findUserById(userId);
    return user?.tenantId === tenantId ? user : undefined;
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
