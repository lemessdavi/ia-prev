import { httpRouter, makeFunctionReference } from "convex/server";
import { parseBusinessError } from "./coreErrors";
import { httpAction } from "./server";

const http = httpRouter();
const UNKNOWN_PHONE_NUMBER_ID = "unknown_phone_number_id";

const processIncomingWebhookRef = makeFunctionReference<"mutation">("wabaWebhook:processIncomingWebhook");
const recordAuditEventRef = makeFunctionReference<"mutation">("wabaWebhook:recordAuditEvent");
const verifyWebhookVerifyTokenRef = makeFunctionReference<"action">("wabaWebhookSecurityNode:verifyWebhookVerifyToken");
const verifyWebhookSignatureRef = makeFunctionReference<"action">("wabaWebhookSecurityNode:verifyWebhookSignature");

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

async function recordWabaAuditEvent(
  ctx: any,
  input: {
    eventType: string;
    outcome: "processed" | "duplicate" | "blocked" | "error";
    details: string;
    occurredAt: number;
  },
) {
  try {
    await ctx.runMutation(recordAuditEventRef, {
      tenantId: null,
      phoneNumberId: UNKNOWN_PHONE_NUMBER_ID,
      eventType: input.eventType,
      outcome: input.outcome,
      details: input.details,
      occurredAt: input.occurredAt,
    });
  } catch (error) {
    // Secondary pipeline errors must be visible for observability.
    console.error("Failed to record WABA audit event.", {
      eventType: input.eventType,
      outcome: input.outcome,
      error,
    });
  }
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
  handler: httpAction(async (ctx, request) => {
    const occurredAt = Date.now();
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = url.searchParams.get("hub.verify_token") ?? undefined;

    if (mode !== "subscribe" || !challenge) {
      return Response.json(
        {
          ok: false,
          error: "Invalid webhook verification request.",
          code: "BAD_REQUEST",
        },
        { status: 400 },
      );
    }

    const verification = await ctx.runAction(verifyWebhookVerifyTokenRef, {
      providedToken: verifyToken,
    });

    if (!verification.configured) {
      await recordWabaAuditEvent(ctx, {
        eventType: "verify_token_not_configured",
        outcome: "error",
        details: "WHATSAPP_WEBHOOK_VERIFY_TOKEN is not configured.",
        occurredAt,
      });

      return Response.json(
        {
          ok: false,
          error: "Webhook verification is unavailable. Configure WHATSAPP_WEBHOOK_VERIFY_TOKEN.",
          code: "SERVICE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    if (!verification.valid) {
      await recordWabaAuditEvent(ctx, {
        eventType: "verify_token_invalid",
        outcome: "blocked",
        details: "Webhook verification blocked due to invalid verify token.",
        occurredAt,
      });

      return Response.json(
        {
          ok: false,
          error: "Invalid webhook verify token.",
          code: "FORBIDDEN",
        },
        { status: 403 },
      );
    }

    return new Response(challenge, { status: 200 });
  }),
});

http.route({
  path: "/webhooks/waba",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const receivedAt = Date.now();
    const signatureHeader = request.headers.get("x-hub-signature-256") ?? undefined;

    const signatureValidation = await ctx.runAction(verifyWebhookSignatureRef, {
      rawBody,
      signatureHeader,
    });

    if (!signatureValidation.configured) {
      await recordWabaAuditEvent(ctx, {
        eventType: "signature_secret_not_configured",
        outcome: "error",
        details: "WHATSAPP_APP_SECRET is not configured.",
        occurredAt: receivedAt,
      });

      return Response.json(
        {
          ok: false,
          error: "Webhook signature verification is unavailable. Configure WHATSAPP_APP_SECRET.",
          code: "SERVICE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    if (!signatureValidation.valid) {
      const eventType = signatureValidation.missingSignature ? "missing_signature" : "invalid_signature";

      await recordWabaAuditEvent(ctx, {
        eventType,
        outcome: "blocked",
        details: "Webhook blocked due to missing or invalid X-Hub-Signature-256.",
        occurredAt: receivedAt,
      });

      return Response.json(
        {
          ok: false,
          error: "Invalid webhook signature.",
          code: "UNAUTHENTICATED",
        },
        { status: 401 },
      );
    }

    try {
      const result = await ctx.runMutation(processIncomingWebhookRef, {
        rawBody,
        receivedAt,
      });

      const shouldFailClosed = result.blocked > 0 && result.processed === 0 && result.duplicates === 0;
      return Response.json(result, {
        status: shouldFailClosed ? 404 : 200,
      });
    } catch (error) {
      const parsed = parseBusinessError(error);
      const details = parsed.message ?? "Unhandled webhook processing failure.";

      await recordWabaAuditEvent(ctx, {
        eventType: "webhook_processing_error",
        outcome: "error",
        details,
        occurredAt: receivedAt,
      });

      console.error("Unhandled error while processing /webhooks/waba.", error);
      return Response.json(
        {
          ok: false,
          error: "Webhook processing failed.",
          code: "INTERNAL_ERROR",
        },
        { status: 500 },
      );
    }
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
