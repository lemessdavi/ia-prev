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

export type ConversationStatus = "EM_TRIAGEM" | "PENDENTE_HUMANO" | "EM_ATENDIMENTO_HUMANO" | "FECHADO";
export type TriageResult = "APTO" | "REVISAO_HUMANA" | "NAO_APTO" | "N_A";
export type TriageFlow = "AUXILIO_ACIDENTE" | "APOSENTADORIA_ANTECIPADA";
export type TriageAnswers = {
  teveAcidente?: boolean;
  possuiSequelaConsolidada?: boolean;
  reducaoCapacidadeLaboral?: boolean;
  possuiQualidadeSegurado?: boolean;
  anoAcidente?: number;
  idade?: number;
  tempoContribuicaoAnos?: number;
  possuiCarenciaMinima?: boolean;
  possuiTempoEspecialComprovado?: boolean;
};
export type ConversationTriage = {
  conversationId: string;
  flowType: TriageFlow;
  answers: TriageAnswers;
  triageResult: TriageResult;
  reasons: string[];
  missingFields: string[];
  inconsistencies: string[];
  createdAt: number;
  updatedAt: number;
  evaluatedAt?: number;
};

export type TenantWorkspaceSummary = {
  tenantId: string;
  tenantName: string;
  wabaLabel: string;
  activeAiProfileName: string;
  operator: {
    userId: string;
    fullName: string;
    username: string;
  };
};

export type ConversationInboxItem = {
  conversationId: string;
  title: string;
  conversationStatus: ConversationStatus;
  triageResult: TriageResult;
  closureReason?: string;
  lastMessagePreview: string;
  lastMessageAt: number;
  lastActivityAt: number;
  unreadCount: number;
  hasAttachment: boolean;
  hasHumanHandoff: boolean;
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

export type ConversationThreadAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
  storageId?: string;
};

export type HandoffEvent = {
  id: string;
  tenantId: string;
  conversationId: string;
  from: "assistant" | "human";
  to: "assistant" | "human";
  performedByUserId?: string;
  createdAt: number;
};

export type ConversationThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: number;
  readBy: string[];
  attachment?: ConversationThreadAttachment;
};

export type ConversationThreadPayload = {
  conversationId: string;
  title: string;
  conversationStatus: ConversationStatus;
  triageResult: TriageResult;
  closureReason?: string;
  participantIds: string[];
  messages: ConversationThreadMessage[];
  handoffEvents: HandoffEvent[];
};

export type ContactProfile = {
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

export type ContactProfileEvent = {
  id: string;
  tenantId: string;
  contactId: string;
  title: string;
  description: string;
  occurredAt: number;
  type: "interaction" | "status" | "note";
};

export type Attachment = {
  id: string;
  tenantId: string;
  conversationId: string;
  messageId?: string;
  fileName: string;
  contentType: string;
  url: string;
  storageId?: string;
  createdAt: number;
};

export type ConversationAttachmentArchiveExport = {
  formatVersion: "conversation.attachments.zip.v1";
  tenantId: string;
  conversationId: string;
  generatedAtIso: string;
  zipFileName: string;
  zipDownloadUrl: string;
  attachmentCount: number;
  attachments: Attachment[];
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
    getTenantWorkspaceSummary: makeFunctionReference<"query", { sessionToken: string }, TenantWorkspaceSummary>(
      "chatDomain:getTenantWorkspaceSummary",
    ),
    listConversationsForInbox: makeFunctionReference<
      "query",
      { sessionToken: string; status?: ConversationStatus | "ALL"; search?: string },
      ConversationInboxItem[]
    >("chatDomain:listConversationsForInbox"),
    getConversationThread: makeFunctionReference<
      "query",
      { sessionToken: string; conversationId: string },
      ConversationThreadPayload
    >("chatDomain:getConversationThread"),
    takeConversationHandoff: makeFunctionReference<
      "action",
      { sessionToken: string; conversationId: string },
      { conversationId: string; conversationStatus: ConversationStatus; handoffEventId: string }
    >("chatHandoffNode:takeConversationHandoff"),
    closeConversationWithReason: makeFunctionReference<
      "mutation",
      { sessionToken: string; conversationId: string; reason: string },
      { conversationId: string; conversationStatus: ConversationStatus; closureReason: string }
    >("chatDomain:closeConversationWithReason"),
    setConversationTriageResult: makeFunctionReference<
      "mutation",
      { sessionToken: string; conversationId: string; triageResult: TriageResult },
      { conversationId: string; triageResult: TriageResult }
    >("chatDomain:setConversationTriageResult"),
    upsertTriageAnswers: makeFunctionReference<
      "mutation",
      { sessionToken: string; conversationId: string; flowType: TriageFlow; answers: TriageAnswers },
      ConversationTriage
    >("triageEngine:upsertTriageAnswers"),
    evaluateConversationTriage: makeFunctionReference<
      "mutation",
      {
        sessionToken: string;
        conversationId: string;
        triageResult: Exclude<TriageResult, "N_A">;
        flowType?: TriageFlow;
        answers?: TriageAnswers;
        reasons?: string[];
        missingFields?: string[];
        inconsistencies?: string[];
      },
      ConversationTriage & { evaluatedAt: number }
    >("triageEngine:evaluateConversationTriage"),
    getConversationTriage: makeFunctionReference<
      "query",
      { sessionToken: string; conversationId: string },
      ConversationTriage | null
    >("triageEngine:getConversationTriage"),
    exportConversationAttachmentArchive: makeFunctionReference<
      "action",
      { sessionToken: string; conversationId: string },
      ConversationAttachmentArchiveExport
    >("chatDomain:exportConversationAttachmentArchive"),
    listConversationsWithUnreadBadge: makeFunctionReference<"query", { sessionToken: string }, ConversationListItem[]>(
      "chatDomain:listConversationsWithUnreadBadge",
    ),
    getConversationMessages: makeFunctionReference<"query", { sessionToken: string; conversationId: string }, Message[]>(
      "chatDomain:getConversationMessages",
    ),
    sendMessage: makeFunctionReference<
      "action",
      { sessionToken: string; conversationId: string; body: string; attachmentUrl?: string },
      Message
    >("chatHandoffNode:sendConversationMessage"),
    markConversationAsRead: makeFunctionReference<
      "mutation",
      { sessionToken: string; conversationId: string },
      { conversationId: string; updatedCount: number }
    >("chatDomain:markConversationAsRead"),
    getContactProfileWithEvents: makeFunctionReference<
      "query",
      { sessionToken: string; contactId: string },
      { contactId: string; contactProfile: ContactProfile; recentEvents: ContactProfileEvent[] }
    >("chatDomain:getContactProfileWithEvents"),
    getWorkspaceSnapshot: makeFunctionReference<
      "query",
      { sessionToken: string },
      {
        tenant: { tenantId: string; tenantName: string; wabaLabel: string; activeAiProfileName: string };
        conversations: ConversationListItem[];
        messages: Message[];
        contactProfile: ContactProfile | null;
      }
    >("chatDomain:getWorkspaceSnapshot"),
  },
  webhook: {
    processIncomingWebhook: makeFunctionReference<"mutation", { rawBody: string; receivedAt: number }, { processed: number; duplicates: number; blocked: number; ignored: number }>(
      "wabaWebhook:processIncomingWebhook",
    ),
  },
} as const;
