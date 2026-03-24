import { createTenant, listTenants } from "@repo/backend";
import { NextResponse } from "next/server";
import { getBackendStore } from "@/server/backend-store";
import { mapBackendErrorToHttp } from "@/server/http-error";
import { readSessionCookie } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tenants = listTenants({
      session: await readSessionCookie(),
      store: getBackendStore(),
    });

    return NextResponse.json({ tenants });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    id?: string;
    slug?: string;
    name?: string;
    isActive?: boolean;
  } | null;

  if (!payload?.slug || !payload?.name) {
    return NextResponse.json({ error: "slug and name are required." }, { status: 400 });
  }

  try {
    const tenant = createTenant({
      session: await readSessionCookie(),
      store: getBackendStore(),
      id: payload.id,
      slug: payload.slug,
      name: payload.name,
      isActive: payload.isActive,
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
