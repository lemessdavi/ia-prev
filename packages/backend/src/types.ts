export type Id = string;

export interface Session {
  userId: Id;
}

export interface User {
  id: Id;
  fullName: string;
  email: string;
  avatarUrl: string;
  createdAt: number;
}

export interface Conversation {
  id: Id;
  participantIds: Id[];
  title: string;
  lastMessagePreview: string;
  lastMessageAt: number;
  lastActivityAt: number;
  createdAt: number;
}

export interface Message {
  id: Id;
  conversationId: Id;
  senderId: Id;
  body: string;
  attachmentUrl?: string;
  createdAt: number;
  readBy: Id[];
}

export interface DossierEvent {
  id: Id;
  contactId: Id;
  title: string;
  description: string;
  occurredAt: number;
  type: "interaction" | "status" | "note";
}

export interface Dossier {
  id: Id;
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
