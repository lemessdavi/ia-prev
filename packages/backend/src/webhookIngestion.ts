import { BackendError, logError, logInfo } from "./errors";
import { resolveTenantByPhoneNumberId } from "./queries";
import { InMemoryBackendStore } from "./store";
import { assertAttachmentUrl, assertId, assertMessageBody } from "./validators";

const UNMAPPED_TENANT_ID = "tenant_unmapped";

type SupportedMessageType = "text" | "image" | "audio" | "document";

interface RawWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: {
          phone_number_id?: string;
        };
        messages?: RawWebhookMessage[];
      };
    }>;
  }>;
}

interface RawWebhookMessage {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: SupportedMessageType | string;
  text?: {
    body?: string;
  };
  image?: RawMediaContent;
  audio?: RawMediaContent;
  document?: RawMediaContent & {
    filename?: string;
    caption?: string;
  };
}

interface RawMediaContent {
  id?: string;
  mime_type?: string;
  url?: string;
  caption?: string;
}

interface NormalizedAttachment {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
}

interface NormalizedInboundMessage {
  externalMessageId: string;
  phoneNumberId: string;
  senderId: string;
  body: string;
  messageType: SupportedMessageType;
  occurredAt: number;
  attachment?: NormalizedAttachment;
}

export interface WhatsAppWebhookIngestionResult {
  status: "processed" | "ignored" | "blocked";
  tenantId?: string;
  conversationId?: string;
  messageId?: string;
  deduplicated?: boolean;
  reason?: "duplicate_webhook" | "unmapped_phone_number_id";
}

export function ingestWhatsAppWebhook(input: {
  payload: unknown;
  store: InMemoryBackendStore;
  now?: number;
}): WhatsAppWebhookIngestionResult {
  const now = input.now ?? Date.now();
  const normalized = normalizeInboundMessage(input.payload, now);

  let tenantId: string;
  try {
    tenantId = resolveTenantByPhoneNumberId({
      phoneNumberId: normalized.phoneNumberId,
      store: input.store,
    }).tenantId;
  } catch (error) {
    if (error instanceof BackendError && error.code === "NOT_FOUND") {
      input.store.insertAuditLog({
        id: buildAuditId("webhook_route_failed", normalized.phoneNumberId, now),
        tenantId: UNMAPPED_TENANT_ID,
        action: "webhook.routing.failed",
        targetType: "phone_number_id",
        targetId: normalized.phoneNumberId,
        createdAt: now,
      });
      logError(error);
      return {
        status: "blocked",
        reason: "unmapped_phone_number_id",
      };
    }
    throw error;
  }

  const messageId = toStoredMessageId(normalized.externalMessageId);
  const duplicate = input.store.findMessage(messageId, tenantId);
  if (duplicate) {
    input.store.insertAuditLog({
      id: buildAuditId("webhook_duplicate_ignored", messageId, now),
      tenantId,
      action: "webhook.duplicate.ignored",
      targetType: "message",
      targetId: messageId,
      createdAt: now,
    });

    logInfo("Duplicate webhook ignored.", {
      tenantId,
      messageId,
      phoneNumberId: normalized.phoneNumberId,
    });
    return {
      status: "ignored",
      tenantId,
      messageId,
      deduplicated: true,
      reason: "duplicate_webhook",
    };
  }

  const conversation = upsertConversation({
    store: input.store,
    tenantId,
    senderId: normalized.senderId,
    occurredAt: normalized.occurredAt,
    preview: normalized.body,
  });

  input.store.insertMessage({
    id: messageId,
    tenantId,
    conversationId: conversation.id,
    senderId: normalized.senderId,
    body: normalized.body,
    attachmentUrl: normalized.attachment?.url,
    createdAt: normalized.occurredAt,
    readBy: [normalized.senderId],
  });

  if (normalized.attachment) {
    input.store.insertAttachment({
      id: toStoredAttachmentId(normalized.attachment.id),
      tenantId,
      conversationId: conversation.id,
      messageId,
      fileName: normalized.attachment.fileName,
      contentType: normalized.attachment.contentType,
      url: normalized.attachment.url,
      createdAt: normalized.occurredAt,
    });
  }

  input.store.updateConversation(conversation.id, tenantId, {
    lastMessagePreview: normalized.body,
    lastMessageAt: normalized.occurredAt,
    lastActivityAt: normalized.occurredAt,
  });

  input.store.insertAuditLog({
    id: buildAuditId("webhook_ingested", messageId, now),
    tenantId,
    action: "webhook.message.ingested",
    targetType: "message",
    targetId: messageId,
    createdAt: now,
  });

  logInfo("Webhook message ingested.", {
    tenantId,
    conversationId: conversation.id,
    messageId,
    messageType: normalized.messageType,
    hasAttachment: Boolean(normalized.attachment),
  });

  return {
    status: "processed",
    tenantId,
    conversationId: conversation.id,
    messageId,
  };
}

function normalizeInboundMessage(payload: unknown, fallbackNow: number): NormalizedInboundMessage {
  const parsed = payload as RawWebhookPayload;
  const value = parsed.entry?.[0]?.changes?.[0]?.value;
  const rawMessage = value?.messages?.[0];

  if (!value || !rawMessage) {
    throw new BackendError("Webhook payload is missing metadata/messages.", "BAD_REQUEST");
  }

  const phoneNumberId = assertId(value.metadata?.phone_number_id ?? "", "phone_number_id");
  const externalMessageId = assertId(rawMessage.id ?? "", "message.id");
  const senderPhone = assertId(rawMessage.from ?? "", "message.from");
  const senderId = `wa_contact_${senderPhone}`;
  const occurredAt = parseTimestampMs(rawMessage.timestamp, fallbackNow);

  if (rawMessage.type === "text") {
    return {
      externalMessageId,
      phoneNumberId,
      senderId,
      messageType: "text",
      body: assertMessageBody(rawMessage.text?.body ?? ""),
      occurredAt,
    };
  }

  if (rawMessage.type === "image") {
    return {
      externalMessageId,
      phoneNumberId,
      senderId,
      messageType: "image",
      body: assertMessageBody(rawMessage.image?.caption?.trim() || "[imagem recebida]"),
      occurredAt,
      attachment: normalizeAttachment({
        media: rawMessage.image,
        fallbackId: externalMessageId,
        fallbackMime: "image/jpeg",
        fallbackName: `imagem_${externalMessageId}.jpg`,
      }),
    };
  }

  if (rawMessage.type === "audio") {
    return {
      externalMessageId,
      phoneNumberId,
      senderId,
      messageType: "audio",
      body: "[audio recebido]",
      occurredAt,
      attachment: normalizeAttachment({
        media: rawMessage.audio,
        fallbackId: externalMessageId,
        fallbackMime: "audio/ogg",
        fallbackName: `audio_${externalMessageId}.ogg`,
      }),
    };
  }

  if (rawMessage.type === "document") {
    const normalized = normalizeAttachment({
      media: rawMessage.document,
      fallbackId: externalMessageId,
      fallbackMime: "application/octet-stream",
      fallbackName: rawMessage.document?.filename ?? `documento_${externalMessageId}`,
    });

    return {
      externalMessageId,
      phoneNumberId,
      senderId,
      messageType: "document",
      body: assertMessageBody(rawMessage.document?.caption?.trim() || `[${normalized.fileName}]`),
      occurredAt,
      attachment: normalized,
    };
  }

  throw new BackendError("Unsupported WhatsApp message type.", "BAD_REQUEST", {
    messageType: rawMessage.type,
  });
}

function normalizeAttachment(input: {
  media?: RawMediaContent;
  fallbackId: string;
  fallbackMime: string;
  fallbackName: string;
}): NormalizedAttachment {
  const mediaId = assertId(input.media?.id ?? input.fallbackId, "media.id");
  const contentType = input.media?.mime_type?.trim() || input.fallbackMime;
  const url = assertAttachmentUrl(input.media?.url ?? `https://graph.facebook.com/v22.0/${mediaId}`) as string;
  const fileName = input.fallbackName.trim() || `arquivo_${mediaId}`;

  return {
    id: mediaId,
    contentType,
    fileName,
    url,
  };
}

function parseTimestampMs(rawTimestamp: string | undefined, fallbackNow: number): number {
  if (!rawTimestamp) return fallbackNow;
  const seconds = Number(rawTimestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return fallbackNow;
  return Math.trunc(seconds * 1000);
}

function upsertConversation(input: {
  store: InMemoryBackendStore;
  tenantId: string;
  senderId: string;
  occurredAt: number;
  preview: string;
}) {
  const existing = input.store.findConversationByParticipant(input.senderId, input.tenantId);
  if (existing) return existing;

  const conversationId = `conv_wa_${sanitizeToken(input.tenantId)}_${sanitizeToken(input.senderId)}`;
  const created = {
    id: conversationId,
    tenantId: input.tenantId,
    participantIds: [input.senderId],
    conversationStatus: "EM_TRIAGEM" as const,
    triageResult: "N_A" as const,
    title: input.senderId.replace("wa_contact_", ""),
    lastMessagePreview: input.preview,
    lastMessageAt: input.occurredAt,
    lastActivityAt: input.occurredAt,
    createdAt: input.occurredAt,
  };
  input.store.insertConversation(created);
  return created;
}

function toStoredMessageId(externalMessageId: string): string {
  return `wa_${sanitizeToken(externalMessageId)}`;
}

function toStoredAttachmentId(mediaId: string): string {
  return `att_wa_${sanitizeToken(mediaId)}`;
}

function buildAuditId(action: string, target: string, now: number): string {
  return `audit_${sanitizeToken(action)}_${sanitizeToken(target)}_${now}`;
}

function sanitizeToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}
