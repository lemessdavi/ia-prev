import { httpRouter, makeFunctionReference } from "convex/server";
import { parseBusinessError } from "./coreErrors";
import { httpAction } from "./server";

const http = httpRouter();
const processIncomingWebhookRef = makeFunctionReference<"mutation">("wabaWebhook:processIncomingWebhook");
const persistInboundFromN8nRef = makeFunctionReference<"mutation">("n8nBridge:persistInboundFromN8n");
const persistOutboundFromN8nRef = makeFunctionReference<"mutation">("n8nBridge:persistOutboundFromN8n");
const verifyN8nIntegrationSecretRef = makeFunctionReference<"action">("n8nBridgeNode:verifyN8nIntegrationSecret");

type KnownErrorCode = "BAD_REQUEST" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";

function toHttpStatus(code?: string) {
  const normalized = code as KnownErrorCode | undefined;
  if (normalized === "BAD_REQUEST") return 400;
  if (normalized === "UNAUTHENTICATED") return 401;
  if (normalized === "FORBIDDEN") return 403;
  if (normalized === "NOT_FOUND") return 404;
  return 400;
}

function toIntegrationErrorResponse(error: unknown) {
  const parsed = parseBusinessError(error);
  const status = parsed.code ? toHttpStatus(parsed.code) : 400;
  return Response.json(
    {
      ok: false,
      error: parsed.message ?? "Integration request failed.",
      code: parsed.code ?? "BAD_REQUEST",
    },
    { status },
  );
}

async function verifyN8nRequestAuth(ctx: any, request: Request) {
  const providedSecret = request.headers.get("x-n8n-integration-secret") ?? undefined;
  const auth = await ctx.runAction(verifyN8nIntegrationSecretRef, {
    providedSecret,
  });

  if (!auth.configured) {
    return Response.json(
      {
        ok: false,
        error: "N8N integration is disabled. Configure N8N_INTEGRATION_SECRET in Convex env.",
      },
      { status: 503 },
    );
  }

  if (!auth.authorized) {
    return Response.json(
      {
        ok: false,
        error: "Unauthorized integration secret.",
      },
      { status: 401 },
    );
  }

  return null;
}

http.route({
  path: "/webhooks/waba",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return Response.json({ ok: true }, { status: 200 });
  }),
});

http.route({
  path: "/webhooks/waba",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const receivedAt = Date.now();

    const result = await ctx.runMutation(processIncomingWebhookRef, {
      rawBody,
      receivedAt,
    });

    const shouldFailClosed = result.blocked > 0 && result.processed === 0 && result.duplicates === 0;
    return Response.json(result, {
      status: shouldFailClosed ? 404 : 200,
    });
  }),
});

http.route({
  path: "/integrations/n8n/whatsapp/inbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResponse = await verifyN8nRequestAuth(ctx, request);
    if (authResponse) {
      return authResponse;
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json(
        {
          ok: false,
          error: "Request body must be valid JSON.",
        },
        { status: 400 },
      );
    }

    try {
      const result = await ctx.runMutation(persistInboundFromN8nRef, payload as any);
      return Response.json(result, { status: 200 });
    } catch (error) {
      return toIntegrationErrorResponse(error);
    }
  }),
});

http.route({
  path: "/integrations/n8n/whatsapp/outbound",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authResponse = await verifyN8nRequestAuth(ctx, request);
    if (authResponse) {
      return authResponse;
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json(
        {
          ok: false,
          error: "Request body must be valid JSON.",
        },
        { status: 400 },
      );
    }

    try {
      const result = await ctx.runMutation(persistOutboundFromN8nRef, payload as any);
      return Response.json(result, { status: 200 });
    } catch (error) {
      return toIntegrationErrorResponse(error);
    }
  }),
});

export default http;
