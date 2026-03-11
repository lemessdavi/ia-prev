export type Id = string;
export type TenantId = string;

export interface Session {
  userId: Id;
  tenantId: TenantId;
}

export interface User {
  id: Id;
  tenantId: TenantId;
  fullName: string;
  email: string;
  avatarUrl: string;
  createdAt: number;
}

export interface Conversation {
  id: Id;
  tenantId: TenantId;
  participantIds: Id[];
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
  users: User[];
  conversations: Conversation[];
  messages: Message[];
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
