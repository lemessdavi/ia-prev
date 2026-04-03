export type UserRole = "superadmin" | "tenant_user";
export type ConversationStatus = "EM_TRIAGEM" | "PENDENTE_HUMANO" | "EM_ATENDIMENTO_HUMANO" | "FECHADO";
export type TriageResult = "APTO" | "REVISAO_HUMANA" | "NAO_APTO" | "N_A";

export type AuthenticatedSessionDTO = {
  sessionId: string;
  userId: string;
  tenantId: string;
  role: UserRole;
  createdAt: number;
};

export type LoginResponse = {
  sessionToken: string;
  session: AuthenticatedSessionDTO;
};

export type TenantWorkspaceSummaryDTO = {
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

export type ConversationInboxItemDTO = {
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

export type ConversationThreadAttachmentDTO = {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
};

export type ConversationThreadMessageDTO = {
  id: string;
  senderId: string;
  body: string;
  createdAt: number;
  readBy: string[];
  attachment?: ConversationThreadAttachmentDTO;
};

export type HandoffEventDTO = {
  id: string;
  tenantId: string;
  conversationId: string;
  from: "assistant" | "human";
  to: "assistant" | "human";
  performedByUserId?: string;
  createdAt: number;
};

export type ConversationThreadPayloadDTO = {
  conversationId: string;
  title: string;
  conversationStatus: ConversationStatus;
  triageResult: TriageResult;
  closureReason?: string;
  participantIds: string[];
  messages: ConversationThreadMessageDTO[];
  handoffEvents: HandoffEventDTO[];
};

export type DossierDTO = {
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

export type DossierEventDTO = {
  id: string;
  tenantId: string;
  contactId: string;
  title: string;
  description: string;
  occurredAt: number;
  type: "interaction" | "status" | "note";
};

export type AttachmentDTO = {
  id: string;
  tenantId: string;
  conversationId: string;
  messageId?: string;
  fileName: string;
  contentType: string;
  url: string;
  createdAt: number;
};

export type MessageDTO = {
  id: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachmentUrl?: string;
  createdAt: number;
  readBy: string[];
};

export type DossierExportDTO = {
  formatVersion: "dossie.v1";
  tenantId: string;
  conversationId: string;
  conversationStatus: ConversationStatus;
  triageResult: TriageResult;
  contactId: string;
  generatedAtIso: string;
  dossier: DossierDTO;
  recentEvents: DossierEventDTO[];
  messages: MessageDTO[];
  attachments: AttachmentDTO[];
  handoffEvents: HandoffEventDTO[];
  closureReason?: string;
};

export type BackendApiError = {
  error: {
    code: "UNAUTHENTICATED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL";
    message: string;
    meta?: Record<string, unknown>;
  };
};
