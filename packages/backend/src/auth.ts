import { randomUUID } from "node:crypto";
import { BackendError, logError, logInfo } from "./errors";
import { verifyPassword } from "./security";
import { InMemoryBackendStore } from "./store";
import type { AuthenticatedSession, Session, TenantId } from "./types";
import { assertPassword, assertUsername } from "./validators";

export function requireSession(session: Session | null | undefined): Session {
  if (!session?.userId || !session?.tenantId || !session?.role) {
    const error = new BackendError("You must be authenticated to call this function.", "UNAUTHENTICATED");
    logError(error);
    throw error;
  }
  return session;
}

export function requirePersistedSession(input: {
  session: Session | null | undefined;
  store: InMemoryBackendStore;
}): AuthenticatedSession {
  const currentSession = requireSession(input.session);
  if (!currentSession.sessionId) {
    const error = new BackendError("You must be authenticated to call this function.", "UNAUTHENTICATED");
    logError(error);
    throw error;
  }

  const storedSession = input.store.findSessionById(currentSession.sessionId);
  if (
    !storedSession ||
    storedSession.userId !== currentSession.userId ||
    storedSession.tenantId !== currentSession.tenantId ||
    storedSession.role !== currentSession.role
  ) {
    const error = new BackendError("Your session is invalid or has expired.", "UNAUTHENTICATED", {
      sessionId: currentSession.sessionId,
      userId: currentSession.userId,
      tenantId: currentSession.tenantId,
      role: currentSession.role,
    });
    logError(error);
    throw error;
  }

  return {
    sessionId: storedSession.id,
    userId: storedSession.userId,
    tenantId: storedSession.tenantId,
    role: storedSession.role,
    createdAt: storedSession.createdAt,
  };
}

export function requireSuperadmin(input: {
  session: Session | null | undefined;
  store: InMemoryBackendStore;
}): AuthenticatedSession {
  const currentSession = requirePersistedSession(input);
  if (currentSession.role !== "superadmin") {
    const error = new BackendError("You do not have permission to access this resource.", "FORBIDDEN", {
      role: currentSession.role,
      tenantId: currentSession.tenantId,
    });
    logError(error);
    throw error;
  }

  return currentSession;
}

export function assertTenantAccess(session: Session, tenantId: TenantId): TenantId {
  if (session.role === "superadmin" || session.tenantId === tenantId) {
    return tenantId;
  }

  const error = new BackendError("You do not have permission to access this tenant.", "FORBIDDEN", {
    sessionTenantId: session.tenantId,
    requestedTenantId: tenantId,
    role: session.role,
  });
  logError(error);
  throw error;
}

export function loginWithUsernamePassword(input: {
  store: InMemoryBackendStore;
  username: string;
  password: string;
  now?: number;
}): AuthenticatedSession {
  const username = assertUsername(input.username);
  const password = assertPassword(input.password);
  const account = input.store.findUserAccountByUsername(username);
  const user = account ? input.store.findUserById(account.userId) : undefined;

  if (!account || !user || !verifyPassword(password, account.passwordHash)) {
    const error = new BackendError("Invalid username or password.", "UNAUTHENTICATED", {
      username,
    });
    logError(error);
    throw error;
  }

  if (!account.isActive) {
    const error = new BackendError("This user is disabled.", "FORBIDDEN", {
      username,
      userId: account.userId,
    });
    logError(error);
    throw error;
  }

  const createdAt = input.now ?? Date.now();
  const storedSession = {
    id: `sess_${randomUUID()}`,
    userId: user.id,
    tenantId: user.tenantId,
    role: account.role,
    createdAt,
  };

  input.store.createSession(storedSession);
  logInfo("User logged in.", {
    userId: user.id,
    tenantId: user.tenantId,
    role: account.role,
    sessionId: storedSession.id,
  });

  return {
    sessionId: storedSession.id,
    userId: user.id,
    tenantId: user.tenantId,
    role: account.role,
    createdAt,
  };
}
