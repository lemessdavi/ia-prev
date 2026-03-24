import { loginWithUsernamePassword } from "@repo/backend";
import { NextResponse } from "next/server";
import { runLoginFlow, type AppSession } from "@/server/auth-flow";
import { getBackendStore } from "@/server/backend-store";
import { writeSessionCookie } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;

  if (!payload?.username || !payload?.password) {
    return NextResponse.json(
      {
        error: "Username and password are required.",
      },
      { status: 400 },
    );
  }

  const store = getBackendStore();
  const result = runLoginFlow({
    username: payload.username,
    password: payload.password,
    authenticate: ({ username, password }) =>
      loginWithUsernamePassword({
        store,
        username,
        password,
      }) as AppSession,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
      },
      { status: result.status },
    );
  }

  await writeSessionCookie(result.session);

  return NextResponse.json({
    redirectTo: result.redirectTo,
    role: result.session.role,
    tenantId: result.session.tenantId,
  });
}
