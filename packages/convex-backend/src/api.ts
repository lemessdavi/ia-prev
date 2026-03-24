import { makeFunctionReference } from "convex/server";

export type SessionInfo = {
  sessionToken: string;
  userId: string;
  tenantId: string;
  role: "superadmin" | "tenant_user";
  createdAt: number;
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: number;
};

export type UserAccountSummary = {
  userId: string;
  tenantId: string;
  username: string;
  fullName: string;
  email: string;
  role: "superadmin" | "tenant_user";
  isActive: boolean;
};

export type TenantWabaAccount = {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  wabaAccountId: string;
  displayName: string;
  createdAt: number;
};

export type AiProfile = {
  id: string;
  tenantId: string;
  name: string;
  provider: string;
  model: string;
  credentialsRef: string;
  isActive: boolean;
  createdAt: number;
};

export type ConversationListItem = {
  conversationId: string;
  title: string;
  lastMessagePreview: string;
  lastMessageAt: number;
  lastActivityAt: number;
  unreadCount: number;
};

export type Message = {
  id: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachmentUrl?: string;
  createdAt: number;
  readBy: string[];
};

export type Dossier = {
  id: string;
  tenantId: string;
  contactId: string;
  role: string;
  company: string;
  location: string;
  summary: string;
  tags: string[];
  updatedAt: number;
};

export type DossierEvent = {
  id: string;
  tenantId: string;
  contactId: string;
  title: string;
  description: string;
  occurredAt: number;
  type: "interaction" | "status" | "note";
};

export const api = {
  auth: {
    getSession: makeFunctionReference<"query", { sessionToken: string }, SessionInfo | null>("auth:getSession"),
    logout: makeFunctionReference<"mutation", { sessionToken: string }, { revoked: boolean }>("auth:logout"),
    loginWithUsernamePassword: makeFunctionReference<
      "action",
      { username: string; password: string },
      SessionInfo
    >("authNode:loginWithUsernamePassword"),
  },
  seed: {
    seedDemoData: makeFunctionReference<"action", { seedKey?: string }, { seeded: boolean; tenantCount: number; userCount: number; conversationCount: number }>(
      "seedNode:seedDemoData",
    ),
  },
  tenants: {
    listTenants: makeFunctionReference<"query", { sessionToken: string }, Tenant[]>("tenants:listTenants"),
    createTenant: makeFunctionReference<
      "mutation",
      { sessionToken: string; id?: string; slug: string; name: string; isActive?: boolean },
      Tenant
    >("tenants:createTenant"),
    updateTenant: makeFunctionReference<
      "mutation",
      { sessionToken: string; tenantId: string; name?: string; slug?: string; isActive?: boolean },
      Tenant
    >("tenants:updateTenant"),
  },
  users: {
    listUsers: makeFunctionReference<"query", { sessionToken: string; tenantId?: string }, UserAccountSummary[]>("users:listUsers"),
    createTenantUser: makeFunctionReference<
      "action",
      {
        sessionToken: string;
        userId?: string;
        tenantId: string;
        username: string;
        fullName: string;
        email: string;
        password: string;
        role?: "superadmin" | "tenant_user";
        isActive?: boolean;
      },
      UserAccountSummary
    >("usersNode:createTenantUser"),
    setUserActive: makeFunctionReference<
      "mutation",
      { sessionToken: string; userId: string; isActive: boolean },
      { userId: string; tenantId: string; isActive: boolean }
    >("users:setUserActive"),
    resetUserPassword: makeFunctionReference<
      "action",
      { sessionToken: string; userId: string; nextPassword: string },
      { userId: string; tenantId: string; revokedSessionCount: number }
    >("usersNode:resetUserPassword"),
  },
  waba: {
    listTenantWabaAccounts: makeFunctionReference<
      "query",
      { sessionToken: string; tenantId?: string },
      TenantWabaAccount[]
    >("adminWaba:listTenantWabaAccounts"),
    upsertTenantWabaAccount: makeFunctionReference<
      "mutation",
      { sessionToken: string; tenantId: string; phoneNumberId: string; wabaAccountId: string; displayName: string },
      TenantWabaAccount
    >("adminWaba:upsertTenantWabaAccount"),
    resolveTenantByPhoneNumberId: makeFunctionReference<
      "query",
      { phoneNumberId: string },
      { tenantId: string; wabaAccountId: string; displayName: string }
    >("adminWaba:resolveTenantByPhoneNumberId"),
  },
  aiProfiles: {
    listAiProfiles: makeFunctionReference<"query", { sessionToken: string; tenantId: string }, AiProfile[]>(
      "aiProfiles:listAiProfiles",
    ),
    createAiProfile: makeFunctionReference<
      "mutation",
      {
        sessionToken: string;
        id?: string;
        tenantId: string;
        name: string;
        provider: string;
        model: string;
        credentialsRef: string;
        isActive?: boolean;
      },
      AiProfile
    >("aiProfiles:createAiProfile"),
    setActiveAiProfile: makeFunctionReference<
      "mutation",
      { sessionToken: string; tenantId: string; profileId: string },
      AiProfile
    >("aiProfiles:setActiveAiProfile"),
  },
  chat: {
    listConversationsWithUnreadBadge: makeFunctionReference<"query", { sessionToken: string }, ConversationListItem[]>(
      "chatDomain:listConversationsWithUnreadBadge",
    ),
    getConversationMessages: makeFunctionReference<"query", { sessionToken: string; conversationId: string }, Message[]>(
      "chatDomain:getConversationMessages",
    ),
    sendMessage: makeFunctionReference<
      "mutation",
      { sessionToken: string; conversationId: string; body: string; attachmentUrl?: string },
      Message
    >("chatDomain:sendMessage"),
    markConversationAsRead: makeFunctionReference<
      "mutation",
      { sessionToken: string; conversationId: string },
      { conversationId: string; updatedCount: number }
    >("chatDomain:markConversationAsRead"),
    getContactDossierWithEvents: makeFunctionReference<
      "query",
      { sessionToken: string; contactId: string },
      { contactId: string; dossier: Dossier; recentEvents: DossierEvent[] }
    >("chatDomain:getContactDossierWithEvents"),
    getWorkspaceSnapshot: makeFunctionReference<
      "query",
      { sessionToken: string },
      {
        tenant: { tenantId: string; tenantName: string; wabaLabel: string; activeAiProfileName: string };
        conversations: ConversationListItem[];
        messages: Message[];
        dossier: Dossier | null;
      }
    >("chatDomain:getWorkspaceSnapshot"),
  },
  webhook: {
    processIncomingWebhook: makeFunctionReference<"mutation", { rawBody: string; receivedAt: number }, { processed: number; duplicates: number; blocked: number; ignored: number }>(
      "wabaWebhook:processIncomingWebhook",
    ),
  },
} as const;
