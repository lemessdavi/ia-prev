export type Id = string;
export type TenantId = string;
export type UserRole = "superadmin" | "tenant_user";
export type ConversationStatus = "EM_TRIAGEM" | "PENDENTE_HUMANO" | "EM_ATENDIMENTO_HUMANO" | "FECHADO";
export type TriageResult = "APTO" | "REVISAO_HUMANA" | "NAO_APTO" | "N_A";

export interface Session {
  userId: Id;
  tenantId: TenantId;
  role: UserRole;
  sessionId?: Id;
  createdAt?: number;
}

export interface AuthenticatedSession extends Session {
  sessionId: Id;
  createdAt: number;
}

export interface StoredSession {
  id: Id;
  userId: Id;
  tenantId: TenantId;
  role: UserRole;
  createdAt: number;
}

export interface Tenant {
  id: TenantId;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: number;
}

export interface TenantWabaAccount {
  id: Id;
  tenantId: TenantId;
  phoneNumberId: string;
  wabaAccountId: string;
  displayName: string;
  createdAt: number;
}

export interface AIProfile {
  id: Id;
  tenantId: TenantId;
  name: string;
  provider: string;
  model: string;
  credentialsRef: string;
  isActive: boolean;
  createdAt: number;
}

export interface User {
  id: Id;
  tenantId: TenantId;
  username: string;
  fullName: string;
  email: string;
  avatarUrl: string;
  createdAt: number;
}

export interface UserAccount {
  userId: Id;
  username: string;
  role: UserRole;
  isActive: boolean;
  passwordHash: string;
  passwordUpdatedAt: number;
}

export interface UserAccountSummary {
  userId: Id;
  tenantId: TenantId;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface Conversation {
  id: Id;
  tenantId: TenantId;
  participantIds: Id[];
  conversationStatus: ConversationStatus;
  triageResult: TriageResult;
  title: string;
  lastMessagePreview: string;
  lastMessageAt: number;
  lastActivityAt: number;
  createdAt: number;
}

export interface Message {
  id: Id;
  tenantId: TenantId;
  conversationId: Id;
  senderId: Id;
  body: string;
  attachmentUrl?: string;
  createdAt: number;
  readBy: Id[];
}

export interface Attachment {
  id: Id;
  tenantId: TenantId;
  conversationId: Id;
  messageId?: Id;
  fileName: string;
  contentType: string;
  url: string;
  createdAt: number;
}

export interface HandoffEvent {
  id: Id;
  tenantId: TenantId;
  conversationId: Id;
  from: "assistant" | "human";
  to: "assistant" | "human";
  performedByUserId?: Id;
  createdAt: number;
}

export interface AuditLog {
  id: Id;
  tenantId: TenantId;
  actorUserId?: Id;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: number;
}

export interface DossierEvent {
  id: Id;
  tenantId: TenantId;
  contactId: Id;
  title: string;
  description: string;
  occurredAt: number;
  type: "interaction" | "status" | "note";
}

export interface Dossier {
  id: Id;
  tenantId: TenantId;
  contactId: Id;
  role: string;
  company: string;
  location: string;
  summary: string;
  tags: string[];
  updatedAt: number;
}

export interface Database {
  tenants: Tenant[];
  tenantWabaAccounts: TenantWabaAccount[];
  aiProfiles: AIProfile[];
  users: User[];
  userAccounts: UserAccount[];
  sessions: StoredSession[];
  conversations: Conversation[];
  messages: Message[];
  attachments: Attachment[];
  handoffEvents: HandoffEvent[];
  auditLogs: AuditLog[];
  dossiers: Dossier[];
  dossierEvents: DossierEvent[];
}

export interface ConversationListItem {
  conversationId: Id;
  title: string;
  lastMessagePreview: string;
  lastMessageAt: number;
  lastActivityAt: number;
  unreadCount: number;
}
