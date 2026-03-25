import { throwBusinessError } from "./coreErrors";

export type SessionContext = {
  sessionToken: string;
  userId: string;
  tenantId: string;
  role: "superadmin" | "tenant_user";
  createdAt: number;
};

type DbLike = {
  query: (table: string) => any;
  delete?: (id: any) => Promise<void>;
};

export async function findTenantByTenantId(db: DbLike, tenantId: string) {
  return await db
    .query("tenants")
    .withIndex("by_tenant_id", (q: any) => q.eq("tenantId", tenantId))
    .unique();
}

export async function findUserByUserId(db: DbLike, userId: string) {
  return await db
    .query("users")
    .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
    .unique();
}

export async function findUserAccountByUserId(db: DbLike, userId: string) {
  return await db
    .query("userAccounts")
    .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
    .unique();
}

export async function findUserAccountByUsername(db: DbLike, username: string) {
  return await db
    .query("userAccounts")
    .withIndex("by_username", (q: any) => q.eq("username", username))
    .unique();
}

export async function findSessionByToken(db: DbLike, sessionToken: string) {
  return await db
    .query("sessions")
    .withIndex("by_session_token", (q: any) => q.eq("sessionToken", sessionToken))
    .unique();
}

export async function requireSession(db: DbLike, sessionToken: string): Promise<SessionContext> {
  const storedSession = await findSessionByToken(db, sessionToken);
  if (!storedSession) {
    throwBusinessError("UNAUTHENTICATED", "Your session is invalid or has expired.", {
      sessionToken,
    });
  }

  const [user, account] = await Promise.all([
    findUserByUserId(db, storedSession.userId),
    findUserAccountByUserId(db, storedSession.userId),
  ]);

  if (!user || !account) {
    throwBusinessError("UNAUTHENTICATED", "Your session is invalid or has expired.", {
      sessionToken,
      userId: storedSession.userId,
    });
  }

  if (
    user.tenantId !== storedSession.tenantId ||
    account.role !== storedSession.role ||
    account.userId !== storedSession.userId
  ) {
    throwBusinessError("UNAUTHENTICATED", "Your session is invalid or has expired.", {
      sessionToken,
      userId: storedSession.userId,
      tenantId: storedSession.tenantId,
      role: storedSession.role,
    });
  }

  if (!account.isActive) {
    throwBusinessError("FORBIDDEN", "This user is disabled.", {
      userId: user.userId,
      username: account.username,
    });
  }

  return {
    sessionToken: storedSession.sessionToken,
    userId: storedSession.userId,
    tenantId: storedSession.tenantId,
    role: storedSession.role,
    createdAt: storedSession.createdAt,
  };
}

export function requireSuperadmin(session: SessionContext): SessionContext {
  if (session.role !== "superadmin") {
    throwBusinessError("FORBIDDEN", "You do not have permission to access this resource.", {
      role: session.role,
      tenantId: session.tenantId,
    });
  }
  return session;
}

export function assertTenantAccess(session: SessionContext, tenantId: string): string {
  if (session.role === "superadmin" || session.tenantId === tenantId) {
    return tenantId;
  }

  throwBusinessError("FORBIDDEN", "You do not have permission to access this tenant.", {
    sessionTenantId: session.tenantId,
    requestedTenantId: tenantId,
    role: session.role,
  });
}

export async function revokeSessionsByUserId(db: DbLike, userId: string): Promise<number> {
  if (!db.delete) {
    throwBusinessError("BAD_REQUEST", "Session revocation requires write access to the database.");
  }

  const sessions = await db
    .query("sessions")
    .withIndex("by_user_id", (q: any) => q.eq("userId", userId))
    .collect();
  await Promise.all(sessions.map((session: any) => db.delete!(session._id)));
  return sessions.length;
}

export function toTenant(row: {
  tenantId: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: number;
}) {
  return {
    id: row.tenantId,
    slug: row.slug,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export function toUserAccountSummary(row: {
  userId: string;
  tenantId: string;
  username: string;
  fullName: string;
  email: string;
  role: "superadmin" | "tenant_user";
  isActive: boolean;
}) {
  return row;
}

export function toTenantWabaAccount(row: {
  mappingId: string;
  tenantId: string;
  phoneNumberId: string;
  wabaAccountId: string;
  displayName: string;
  createdAt: number;
}) {
  return {
    id: row.mappingId,
    tenantId: row.tenantId,
    phoneNumberId: row.phoneNumberId,
    wabaAccountId: row.wabaAccountId,
    displayName: row.displayName,
    createdAt: row.createdAt,
  };
}

export function toAiProfile(row: {
  profileId: string;
  tenantId: string;
  name: string;
  provider: string;
  model: string;
  credentialsRef: string;
  isActive: boolean;
  createdAt: number;
}) {
  return {
    id: row.profileId,
    tenantId: row.tenantId,
    name: row.name,
    provider: row.provider,
    model: row.model,
    credentialsRef: row.credentialsRef,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export function toMessage(row: {
  messageId: string;
  tenantId: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachmentUrl?: string;
  createdAt: number;
  readBy: string[];
}) {
  return {
    id: row.messageId,
    tenantId: row.tenantId,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: row.body,
    attachmentUrl: row.attachmentUrl,
    createdAt: row.createdAt,
    readBy: row.readBy,
  };
}

export function toDossier(row: {
  dossierId: string;
  tenantId: string;
  contactId: string;
  role: string;
  company: string;
  location: string;
  summary: string;
  tags: string[];
  updatedAt: number;
}) {
  return {
    id: row.dossierId,
    tenantId: row.tenantId,
    contactId: row.contactId,
    role: row.role,
    company: row.company,
    location: row.location,
    summary: row.summary,
    tags: row.tags,
    updatedAt: row.updatedAt,
  };
}

export function toDossierEvent(row: {
  eventId: string;
  tenantId: string;
  contactId: string;
  title: string;
  description: string;
  occurredAt: number;
  type: "interaction" | "status" | "note";
}) {
  return {
    id: row.eventId,
    tenantId: row.tenantId,
    contactId: row.contactId,
    title: row.title,
    description: row.description,
    occurredAt: row.occurredAt,
    type: row.type,
  };
}

export function toAttachment(row: {
  attachmentId: string;
  tenantId: string;
  conversationId: string;
  messageId?: string;
  fileName: string;
  contentType: string;
  url: string;
  createdAt: number;
}) {
  return {
    id: row.attachmentId,
    tenantId: row.tenantId,
    conversationId: row.conversationId,
    messageId: row.messageId,
    fileName: row.fileName,
    contentType: row.contentType,
    url: row.url,
    createdAt: row.createdAt,
  };
}

export function toHandoffEvent(row: {
  handoffEventId: string;
  tenantId: string;
  conversationId: string;
  from: "assistant" | "human";
  to: "assistant" | "human";
  performedByUserId?: string;
  createdAt: number;
}) {
  return {
    id: row.handoffEventId,
    tenantId: row.tenantId,
    conversationId: row.conversationId,
    from: row.from,
    to: row.to,
    performedByUserId: row.performedByUserId,
    createdAt: row.createdAt,
  };
}
