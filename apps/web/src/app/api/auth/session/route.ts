import { NextResponse } from "next/server";
import { readValidatedSession } from "@/server/session-cookie";

export const runtime = "nodejs";

export async function GET() {
  const session = await readValidatedSession();
  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    session,
  });
}
