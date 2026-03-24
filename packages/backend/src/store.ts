import type {
  AIProfile,
  Conversation,
  Database,
  DossierEvent,
  Message,
  StoredSession,
  Tenant,
  TenantWabaAccount,
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

  listTenants(): Tenant[] {
    return [...this.state.tenants].sort((a, b) => a.slug.localeCompare(b.slug));
  }

  findTenantById(tenantId: string): Tenant | undefined {
    return this.state.tenants.find((tenant) => tenant.id === tenantId);
  }

  findTenantBySlug(slug: string): Tenant | undefined {
    return this.state.tenants.find((tenant) => tenant.slug === slug);
  }

  insertTenant(tenant: Tenant): void {
    this.state.tenants.push(tenant);
  }

  updateTenant(tenantId: string, patch: Partial<Tenant>): Tenant | undefined {
    const existing = this.findTenantById(tenantId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.state.tenants = this.state.tenants.map((tenant) => (tenant.id === tenantId ? updated : tenant));
    return updated;
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

  insertUser(user: User): void {
    this.state.users.push(user);
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

  findTenantWabaByTenantId(tenantId: TenantId): TenantWabaAccount | undefined {
    return this.state.tenantWabaAccounts.find((mapping) => mapping.tenantId === tenantId);
  }

  listTenantWabaAccounts(tenantId?: TenantId): TenantWabaAccount[] {
    return this.state.tenantWabaAccounts
      .filter((mapping) => (tenantId ? mapping.tenantId === tenantId : true))
      .sort((a, b) => a.tenantId.localeCompare(b.tenantId));
  }

  upsertTenantWabaAccount(mapping: TenantWabaAccount): void {
    const existingIndex = this.state.tenantWabaAccounts.findIndex((item) => item.id === mapping.id || item.tenantId === mapping.tenantId);
    if (existingIndex === -1) {
      this.state.tenantWabaAccounts.push(mapping);
      return;
    }

    this.state.tenantWabaAccounts[existingIndex] = mapping;
  }

  listAiProfiles(tenantId?: TenantId): AIProfile[] {
    return this.state.aiProfiles
      .filter((profile) => (tenantId ? profile.tenantId === tenantId : true))
      .sort((a, b) => {
        const tenantCompare = a.tenantId.localeCompare(b.tenantId);
        if (tenantCompare !== 0) return tenantCompare;
        return a.name.localeCompare(b.name);
      });
  }

  findAiProfile(profileId: string): AIProfile | undefined {
    return this.state.aiProfiles.find((profile) => profile.id === profileId);
  }

  upsertAiProfile(profile: AIProfile): void {
    const existingIndex = this.state.aiProfiles.findIndex((item) => item.id === profile.id);
    if (existingIndex === -1) {
      this.state.aiProfiles.push(profile);
      return;
    }

    this.state.aiProfiles[existingIndex] = profile;
  }

  setAiProfileActive(tenantId: TenantId, activeProfileId: string): AIProfile | undefined {
    let activeProfile: AIProfile | undefined;
    this.state.aiProfiles = this.state.aiProfiles.map((profile) => {
      if (profile.tenantId !== tenantId) return profile;

      if (profile.id === activeProfileId) {
        activeProfile = { ...profile, isActive: true };
        return activeProfile;
      }

      if (profile.isActive) {
        return { ...profile, isActive: false };
      }

      return profile;
    });

    return activeProfile;
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
