import { NextResponse } from "next/server";
import { setActiveAiProfile } from "@repo/backend";
import { getBackendStore } from "@/server/backend-store";
import { mapBackendErrorToHttp } from "@/server/http-error";
import { readSessionCookie } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    tenantId?: string;
    profileId?: string;
  } | null;

  if (!payload?.tenantId || !payload.profileId) {
    return NextResponse.json({ error: "tenantId and profileId are required." }, { status: 400 });
  }

  try {
    const profile = setActiveAiProfile({
      session: await readSessionCookie(),
      store: getBackendStore(),
      tenantId: payload.tenantId,
      profileId: payload.profileId,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
