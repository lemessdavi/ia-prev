import { NextResponse } from "next/server";
import { updateTenant } from "@repo/backend";
import { getBackendStore } from "@/server/backend-store";
import { mapBackendErrorToHttp } from "@/server/http-error";
import { readSessionCookie } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      tenantId: string;
    }>;
  },
) {
  const { tenantId } = await context.params;
  const payload = (await request.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    isActive?: boolean;
  } | null;

  try {
    const tenant = updateTenant({
      session: await readSessionCookie(),
      store: getBackendStore(),
      tenantId,
      name: payload?.name,
      slug: payload?.slug,
      isActive: payload?.isActive,
    });

    return NextResponse.json({ tenant });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
