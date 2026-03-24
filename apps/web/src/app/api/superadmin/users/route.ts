import { createTenantUser, listUsers } from "@repo/backend";
import { NextResponse } from "next/server";
import { getBackendStore } from "@/server/backend-store";
import { mapBackendErrorToHttp } from "@/server/http-error";
import { readSessionCookie } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? undefined;

    const users = listUsers({
      session: await readSessionCookie(),
      store: getBackendStore(),
      tenantId,
    });

    return NextResponse.json({ users });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    userId?: string;
    tenantId?: string;
    username?: string;
    fullName?: string;
    email?: string;
    password?: string;
    role?: "superadmin" | "tenant_user";
    isActive?: boolean;
  } | null;

  if (!payload?.tenantId || !payload.username || !payload.fullName || !payload.email || !payload.password) {
    return NextResponse.json({ error: "tenantId, username, fullName, email and password are required." }, { status: 400 });
  }

  try {
    const user = createTenantUser({
      session: await readSessionCookie(),
      store: getBackendStore(),
      userId: payload.userId,
      tenantId: payload.tenantId,
      username: payload.username,
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
      role: payload.role,
      isActive: payload.isActive,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
