import {
  BackendError,
  closeConversationWithReason,
  exportConversationDossier,
  getConversationThread,
  getTenantWorkspaceSummary,
  listConversationsForInbox,
  loginWithUsernamePassword,
  markConversationAsRead,
  sendMessage,
  takeConversationHandoff,
  type Session,
} from "@repo/backend";
import { type NextRequest, NextResponse } from "next/server";
import { getBackendStore } from "@/lib/backendRuntime";

const SESSION_HEADER = "x-iap-session";

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest("GET", request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest("POST", request, context);
}

async function handleRequest(
  method: "GET" | "POST",
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const store = getBackendStore();
  const session = parseSessionFromHeaders(request);

  try {
    if (method === "POST" && path[0] === "auth" && path[1] === "login") {
      const body = await safeJson(request);
      const authSession = loginWithUsernamePassword({
        store,
        username: String(body?.username ?? ""),
        password: String(body?.password ?? ""),
      });
      return NextResponse.json({
        sessionToken: encodeSession(authSession),
        session: authSession,
      });
    }

    if (method === "POST" && path[0] === "auth" && path[1] === "logout") {
      return new NextResponse(null, { status: 204 });
    }

    if (method === "GET" && path[0] === "workspace") {
      return NextResponse.json(getTenantWorkspaceSummary({ session, store }));
    }

    if (method === "GET" && path[0] === "conversations" && path.length === 1) {
      return NextResponse.json(
        listConversationsForInbox({
          session,
          store,
          status: request.nextUrl.searchParams.get("status") ?? undefined,
          search: request.nextUrl.searchParams.get("search") ?? undefined,
        }),
      );
    }

    if (path[0] === "conversations" && path[1]) {
      const conversationId = path[1];

      if (method === "GET" && path[2] === "thread") {
        return NextResponse.json(
          getConversationThread({
            session,
            store,
            conversationId,
          }),
        );
      }

      if (method === "GET" && path[2] === "dossier" && path[3] === "export") {
        return NextResponse.json(
          exportConversationDossier({
            session,
            store,
            conversationId,
          }),
        );
      }

      if (method === "POST" && path[2] === "read") {
        return NextResponse.json(
          markConversationAsRead({
            session,
            store,
            conversationId,
          }),
        );
      }

      if (method === "POST" && path[2] === "messages") {
        const body = await safeJson(request);
        const result = sendMessage({
          session,
          store,
          conversationId,
          body: String(body?.body ?? ""),
          attachmentUrl: body?.attachmentUrl ? String(body.attachmentUrl) : undefined,
        });
        return NextResponse.json(result, { status: 201 });
      }

      if (method === "POST" && path[2] === "handoff") {
        return NextResponse.json(
          takeConversationHandoff({
            session,
            store,
            conversationId,
          }),
        );
      }

      if (method === "POST" && path[2] === "close") {
        const body = await safeJson(request);
        return NextResponse.json(
          closeConversationWithReason({
            session,
            store,
            conversationId,
            reason: String(body?.reason ?? ""),
          }),
        );
      }
    }

    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Endpoint not found.",
        },
      },
      { status: 404 },
    );
  } catch (error) {
    if (error instanceof BackendError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            meta: error.meta,
          },
        },
        { status: statusFromBackendCode(error.code) },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message: "Unexpected backend error.",
        },
      },
      { status: 500 },
    );
  }
}

async function safeJson(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseSessionFromHeaders(request: NextRequest): Session | null {
  const token = request.headers.get(SESSION_HEADER);
  if (!token) return null;

  try {
    const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Session;
    if (!payload?.sessionId || !payload.userId || !payload.tenantId || !payload.role) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function encodeSession(session: Session): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
}

function statusFromBackendCode(code: BackendError["code"]): number {
  switch (code) {
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    default:
      return 500;
  }
}
