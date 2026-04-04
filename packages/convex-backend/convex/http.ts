import { httpRouter, makeFunctionReference } from "convex/server";
import { parseBusinessError } from "./coreErrors";
import { httpAction } from "./server";

const http = httpRouter();
const UNKNOWN_PHONE_NUMBER_ID = "unknown_phone_number_id";

const processIncomingWebhookRef = makeFunctionReference<"mutation">("wabaWebhook:processIncomingWebhook");
const recordAuditEventRef = makeFunctionReference<"mutation">("wabaWebhook:recordAuditEvent");
const verifyWebhookVerifyTokenRef = makeFunctionReference<"action">("wabaWebhookSecurityNode:verifyWebhookVerifyToken");
const verifyWebhookSignatureRef = makeFunctionReference<"action">("wabaWebhookSecurityNode:verifyWebhookSignature");
const persistInboundFromWebhookRef = makeFunctionReference<"mutation">("whatsappBridge:persistInboundFromWebhook");
const autoReplyInboundMessageRef = makeFunctionReference<"action">("whatsappBridgeNode:autoReplyInboundMessage");
const hydrateInboundAttachmentsRef = makeFunctionReference<"action">("whatsappBridgeNode:hydrateInboundAttachments");

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

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseTimestampMs(value: unknown, fallbackNow: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 10_000_000_000 ? Math.floor(value) : Math.floor(value * 1000);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed > 10_000_000_000 ? Math.floor(parsed) : Math.floor(parsed * 1000);
    }
  }

  return fallbackNow;
}

function extractMetaInboundMessages(payload: unknown, receivedAt: number) {
  const root = asObject(payload);
  if (!root) return [];

  const entries = Array.isArray(root.entry) ? root.entry : [];
  const normalized: Array<{
    phoneNumberId: string;
    contactWaId: string;
    contactDisplayName?: string;
    externalMessageId: string;
    messageType: string;
    body?: string;
    messageTimestampMs: number;
    attachments: Array<{
      mediaType?: string;
      mediaId?: string;
      contentType?: string;
      fileName?: string;
    }>;
  }> = [];

  for (const rawEntry of entries) {
    const entry = asObject(rawEntry);
    if (!entry) continue;

    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const rawChange of changes) {
      const change = asObject(rawChange);
      if (!change) continue;

      const field = asString(change.field);
      if (field !== "messages") continue;

      const value = asObject(change.value);
      if (!value) continue;

      const metadata = asObject(value.metadata);
      const phoneNumberId = asString(metadata?.phone_number_id);
      if (!phoneNumberId) continue;

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const firstContact = asObject(contacts[0]);
      const profile = asObject(firstContact?.profile);
      const contactDisplayName = asString(profile?.name);
      const contactWaFromContact = asString(firstContact?.wa_id);

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const rawMessage of messages) {
        const message = asObject(rawMessage);
        if (!message) continue;

        const externalMessageId = asString(message.id);
        const contactWaId = asString(message.from) ?? contactWaFromContact;
        if (!externalMessageId || !contactWaId) continue;

        const messageType = asString(message.type) ?? "text";
        const textPayload = asObject(message.text);
        const buttonPayload = asObject(message.button);
        const interactivePayload = asObject(message.interactive);
        const buttonReplyPayload = asObject(interactivePayload?.button_reply);

        const body =
          asString(textPayload?.body) ??
          asString(buttonPayload?.text) ??
          asString(buttonReplyPayload?.title) ??
          undefined;

        const attachments: Array<{
          mediaType?: string;
          mediaId?: string;
          contentType?: string;
          fileName?: string;
        }> = [];

        for (const mediaType of ["image", "document", "audio", "video", "sticker"]) {
          const media = asObject(message[mediaType]);
          const mediaId = asString(media?.id);
          if (!media || !mediaId) continue;

          attachments.push({
            mediaType,
            mediaId,
            contentType: asString(media.mime_type),
            fileName: asString(media.filename),
          });
        }

        normalized.push({
          phoneNumberId,
          contactWaId,
          contactDisplayName,
          externalMessageId,
          messageType,
          body,
          messageTimestampMs: parseTimestampMs(message.timestamp, receivedAt),
          attachments,
        });
      }
    }
  }

  return normalized;
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

      // Direct pipeline: persist in chatDomain and auto-reply per inbound message.
      try {
        const payload = JSON.parse(rawBody);
        const inboundMessages = extractMetaInboundMessages(payload, receivedAt);

        for (const inboundMessage of inboundMessages) {
          try {
            const hydratedAttachments = await ctx.runAction(hydrateInboundAttachmentsRef, {
              attachments: inboundMessage.attachments,
            });
            const persistedInbound = await ctx.runMutation(persistInboundFromWebhookRef, {
              ...inboundMessage,
              attachments: hydratedAttachments,
            } as any);
            if (persistedInbound.status === "duplicate") {
              continue;
            }

            await ctx.runAction(autoReplyInboundMessageRef, {
              phoneNumberId: inboundMessage.phoneNumberId,
              contactWaId: inboundMessage.contactWaId,
              conversationId: persistedInbound.conversationId,
              inboundBody: inboundMessage.body,
              messageType: inboundMessage.messageType,
            });
          } catch {
            // Keep webhook ingestion resilient even if direct chat pipeline fails.
          }
        }
      } catch {
        // Ignore invalid JSON here; core webhook mutation already handles audit/fail-closed.
      }

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

export default http;
