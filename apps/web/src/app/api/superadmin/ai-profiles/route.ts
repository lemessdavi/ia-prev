import { createAiProfile, listAiProfiles } from "@repo/backend";
import { NextResponse } from "next/server";
import { getBackendStore } from "@/server/backend-store";
import { mapBackendErrorToHttp } from "@/server/http-error";
import { readSessionCookie } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId") ?? undefined;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required." }, { status: 400 });
  }

  try {
    const profiles = listAiProfiles({
      session: await readSessionCookie(),
      store: getBackendStore(),
      tenantId,
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    id?: string;
    tenantId?: string;
    name?: string;
    provider?: string;
    model?: string;
    credentialsRef?: string;
    isActive?: boolean;
  } | null;

  if (!payload?.tenantId || !payload.name || !payload.provider || !payload.model || !payload.credentialsRef) {
    return NextResponse.json(
      {
        error: "tenantId, name, provider, model and credentialsRef are required.",
      },
      { status: 400 },
    );
  }

  try {
    const profile = createAiProfile({
      session: await readSessionCookie(),
      store: getBackendStore(),
      id: payload.id,
      tenantId: payload.tenantId,
      name: payload.name,
      provider: payload.provider,
      model: payload.model,
      credentialsRef: payload.credentialsRef,
      isActive: payload.isActive,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
