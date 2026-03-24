import { requirePersistedSession } from "@repo/backend";
import { cookies } from "next/headers";
import type { AppSession } from "./auth-flow";
import { getBackendStore } from "./backend-store";

export const SESSION_COOKIE_NAME = "iap_session";
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

function serializeSession(session: AppSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function parseSessionCookie(value?: string): AppSession | null {
  if (!value) return null;

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as Partial<AppSession>;
    if (
      !payload ||
      typeof payload.userId !== "string" ||
      typeof payload.tenantId !== "string" ||
      (payload.role !== "superadmin" && payload.role !== "tenant_user") ||
      typeof payload.sessionId !== "string" ||
      typeof payload.createdAt !== "number"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
      sessionId: payload.sessionId,
      createdAt: payload.createdAt,
    };
  } catch {
    return null;
  }
}

export async function readSessionCookie(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  return parseSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function readValidatedSession(): Promise<AppSession | null> {
  const session = await readSessionCookie();
  if (!session) return null;

  try {
    return requirePersistedSession({
      session,
      store: getBackendStore(),
    }) as AppSession;
  } catch {
    return null;
  }
}

export async function writeSessionCookie(session: AppSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, serializeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
