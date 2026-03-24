import { NextResponse } from "next/server";
import { resetUserPassword } from "@repo/backend";
import { getBackendStore } from "@/server/backend-store";
import { mapBackendErrorToHttp } from "@/server/http-error";
import { readSessionCookie } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      userId: string;
    }>;
  },
) {
  const { userId } = await context.params;
  const payload = (await request.json().catch(() => null)) as {
    nextPassword?: string;
  } | null;

  if (!payload?.nextPassword) {
    return NextResponse.json({ error: "nextPassword is required." }, { status: 400 });
  }

  try {
    const result = resetUserPassword({
      session: await readSessionCookie(),
      store: getBackendStore(),
      userId,
      nextPassword: payload.nextPassword,
    });

    return NextResponse.json({ result });
  } catch (error) {
    const mapped = mapBackendErrorToHttp(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
