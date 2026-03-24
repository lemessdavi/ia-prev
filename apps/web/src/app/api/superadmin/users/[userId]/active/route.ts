import { NextResponse } from "next/server";
import { setUserActive } from "@repo/backend";
import { getBackendStore } from "@/server/backend-store";
import { mapBackendErrorToHttp } from "@/server/http-error";
import { readSessionCookie } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      userId: string;
    }>;
  },
) {
  const { userId } = await context.params;
  const payload = (await request.json().catch(() => null)) as {
    isActive?: boolean;
  } | null;

  if (typeof payload?.isActive !== "boolean") {
    return NextResponse.json({ error: "isActive is required." }, { status: 400 });
  }

  try {
    const user = setUserActive({
      session: await readSessionCookie(),
      store: getBackendStore(),
      userId,
      isActive: payload.isActive,
    });

    return NextResponse.json({ user });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
