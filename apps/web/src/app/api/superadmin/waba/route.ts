import { NextResponse } from "next/server";
import { listTenantWabaAccounts, upsertTenantWabaAccount } from "@repo/backend";
import { getBackendStore } from "@/server/backend-store";
import { mapBackendErrorToHttp } from "@/server/http-error";
import { readSessionCookie } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") ?? undefined;

    const mappings = listTenantWabaAccounts({
      session: await readSessionCookie(),
      store: getBackendStore(),
      tenantId,
    });

    return NextResponse.json({ mappings });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PUT(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    tenantId?: string;
    phoneNumberId?: string;
    wabaAccountId?: string;
    displayName?: string;
  } | null;

  if (!payload?.tenantId || !payload.phoneNumberId || !payload.wabaAccountId || !payload.displayName) {
    return NextResponse.json(
      {
        error: "tenantId, phoneNumberId, wabaAccountId and displayName are required.",
      },
      { status: 400 },
    );
  }

  try {
    const mapping = upsertTenantWabaAccount({
      session: await readSessionCookie(),
      store: getBackendStore(),
      tenantId: payload.tenantId,
      phoneNumberId: payload.phoneNumberId,
      wabaAccountId: payload.wabaAccountId,
      displayName: payload.displayName,
    });

    return NextResponse.json({ mapping });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
