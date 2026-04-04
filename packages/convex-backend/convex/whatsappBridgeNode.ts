"use node";

import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalAction } from "./server";

const autoReplyResultValidator = v.object({
  ai: v.object({
    provider: v.union(v.literal("openai"), v.literal("mock")),
    model: v.string(),
    reply: v.string(),
  }),
  whatsapp: v.object({
    sent: v.boolean(),
    statusCode: v.number(),
    externalMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  outboundPersist: v.object({
    status: v.union(v.literal("stored"), v.literal("duplicate")),
    messageId: v.string(),
  }),
});

const inboundAttachmentValidator = v.object({
  url: v.optional(v.string()),
  contentType: v.optional(v.string()),
  fileName: v.optional(v.string()),
  mediaType: v.optional(v.string()),
  mediaId: v.optional(v.string()),
});

const hydratedAttachmentValidator = v.object({
  url: v.optional(v.string()),
  contentType: v.optional(v.string()),
  fileName: v.optional(v.string()),
  mediaType: v.optional(v.string()),
  mediaId: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
});

const persistOutboundMessageRef = makeFunctionReference<"mutation">("whatsappBridge:persistOutboundMessage");

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeInboundText(body: string | undefined, messageType: string | undefined): string {
  const normalizedBody = asNonEmptyString(body);
  if (normalizedBody) {
    return normalizedBody;
  }

  return `[${asNonEmptyString(messageType) ?? "text"}]`;
}

function inferAttachmentContentType(input: { contentType?: string; mediaType?: string }): string {
  const normalized = asNonEmptyString(input.contentType);
  if (normalized) {
    return normalized;
  }

  switch (input.mediaType) {
    case "image":
      return "image/jpeg";
    case "audio":
      return "audio/ogg";
    case "video":
      return "video/mp4";
    case "document":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function inferAttachmentFileName(input: { fileName?: string; mediaType?: string; mediaId?: string; contentType?: string }): string {
  const provided = asNonEmptyString(input.fileName);
  if (provided) {
    return provided;
  }

  const contentType = inferAttachmentContentType(input);
  const extension = contentType.includes("/") ? contentType.split("/")[1] : "bin";
  const suffix = asNonEmptyString(input.mediaId) ?? String(Date.now());
  return `${input.mediaType ?? "arquivo"}_${suffix}.${extension}`;
}

function getMediaAuthConfig():
  | {
      accessToken: string;
      graphVersion: string;
      graphBaseUrl: string;
    }
  | null {
  const accessToken = asNonEmptyString(process.env.WHATSAPP_CLOUD_ACCESS_TOKEN);
  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    graphVersion: asNonEmptyString(process.env.WHATSAPP_GRAPH_VERSION) ?? "v22.0",
    graphBaseUrl: (asNonEmptyString(process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL) ?? "https://graph.facebook.com").replace(/\/+$/, ""),
  };
}

async function fetchMetaMediaDownloadUrl(input: { accessToken: string; graphVersion: string; graphBaseUrl: string; mediaId: string }) {
  const endpoint = `${input.graphBaseUrl}/${input.graphVersion}/${encodeURIComponent(input.mediaId)}`;
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
  });
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => ({}))) as { url?: unknown; mime_type?: unknown; filename?: unknown };
  return {
    url: asNonEmptyString(typeof payload.url === "string" ? payload.url : undefined),
    mimeType: asNonEmptyString(typeof payload.mime_type === "string" ? payload.mime_type : undefined),
    fileName: asNonEmptyString(typeof payload.filename === "string" ? payload.filename : undefined),
  };
}

async function fetchMediaBlob(input: { accessToken: string; url: string }) {
  const response = await fetch(input.url, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
  });
  if (!response.ok) {
    return null;
  }
  return await response.blob();
}

async function hydrateInboundAttachment(ctx: any, attachment: {
  url?: string;
  contentType?: string;
  fileName?: string;
  mediaType?: string;
  mediaId?: string;
}) {
  const mediaConfig = getMediaAuthConfig();
  const fallbackUrl = asNonEmptyString(attachment.url);
  let downloadUrl = fallbackUrl;
  let contentType = asNonEmptyString(attachment.contentType);
  let fileName = asNonEmptyString(attachment.fileName);

  if (mediaConfig && attachment.mediaId) {
    const metadata = await fetchMetaMediaDownloadUrl({
      ...mediaConfig,
      mediaId: attachment.mediaId,
    }).catch(() => null);

    if (metadata?.url) {
      downloadUrl = metadata.url;
    } else if (!downloadUrl) {
      downloadUrl = `${mediaConfig.graphBaseUrl}/${mediaConfig.graphVersion}/${encodeURIComponent(attachment.mediaId)}`;
    }

    if (metadata?.mimeType && !contentType) {
      contentType = metadata.mimeType;
    }
    if (metadata?.fileName && !fileName) {
      fileName = metadata.fileName;
    }

    if (downloadUrl) {
      const blob = await fetchMediaBlob({
        accessToken: mediaConfig.accessToken,
        url: downloadUrl,
      }).catch(() => null);

      if (blob) {
        const safeContentType = contentType ?? inferAttachmentContentType({ contentType, mediaType: attachment.mediaType });
        const safeFileName = fileName ?? inferAttachmentFileName({ ...attachment, contentType: safeContentType });
        const storageId = await ctx.storage.store(blob);

        return {
          url: downloadUrl,
          contentType: safeContentType,
          fileName: safeFileName,
          mediaType: attachment.mediaType,
          mediaId: attachment.mediaId,
          storageId,
        };
      }
    }
  }

  return {
    url: downloadUrl,
    contentType: contentType ?? inferAttachmentContentType({ contentType, mediaType: attachment.mediaType }),
    fileName: fileName ?? inferAttachmentFileName({ ...attachment, contentType }),
    mediaType: attachment.mediaType,
    mediaId: attachment.mediaId,
  };
}

function mockReplyForInbound(inboundText: string): string {
  const compact = inboundText.replace(/\s+/g, " ").trim().slice(0, 140);
  return `Recebi sua mensagem: "${compact}". Para continuar a triagem, me confirme seu nome completo e data de nascimento.`;
}

function extractOpenAiText(payload: any): string | undefined {
  const topLevel = asNonEmptyString(payload?.output_text);
  if (topLevel) {
    return topLevel;
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      const text = asNonEmptyString(contentItem?.text);
      if (text) {
        parts.push(text);
      }
    }
  }

  if (parts.length > 0) {
    return parts.join("\n").trim();
  }

  const chatCompletionsFallback = asNonEmptyString(payload?.choices?.[0]?.message?.content);
  if (chatCompletionsFallback) {
    return chatCompletionsFallback;
  }

  return undefined;
}

async function generateAssistantReply(input: { inboundBody?: string; messageType?: string }) {
  const inboundText = normalizeInboundText(input.inboundBody, input.messageType);
  const openAiApiKey = asNonEmptyString(process.env.OPENAI_API_KEY);
  if (!openAiApiKey) {
    return {
      provider: "mock" as const,
      model: "mock-deterministic-v1",
      reply: mockReplyForInbound(inboundText),
    };
  }

  const model = asNonEmptyString(process.env.OPENAI_MODEL) ?? "gpt-4.1-mini";
  const systemPrompt =
    asNonEmptyString(process.env.OPENAI_SYSTEM_PROMPT) ??
    "Voce e um assistente de WhatsApp para triagem inicial. Responda em portugues do Brasil em no maximo 3 frases e, quando faltar contexto, solicite o proximo dado objetivo.";

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_output_tokens: 220,
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: inboundText,
          },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`A requisicao para a OpenAI falhou com status ${response.status}.`);
    }

    const reply = extractOpenAiText(data);
    if (!reply) {
      throw new Error("A resposta da OpenAI nao trouxe texto de saida.");
    }

    return {
      provider: "openai" as const,
      model,
      reply,
    };
  } catch {
    return {
      provider: "mock" as const,
      model: "mock-deterministic-v1",
      reply: mockReplyForInbound(inboundText),
    };
  }
}

async function sendWhatsAppText(input: { phoneNumberId: string; recipientWaId: string; body: string }) {
  const accessToken = asNonEmptyString(process.env.WHATSAPP_CLOUD_ACCESS_TOKEN);
  if (!accessToken) {
    return {
      sent: false,
      statusCode: 503,
      error: "WHATSAPP_CLOUD_ACCESS_TOKEN nao esta configurado.",
      externalMessageId: undefined,
    };
  }

  const graphVersion = asNonEmptyString(process.env.WHATSAPP_GRAPH_VERSION) ?? "v22.0";
  const url = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(input.phoneNumberId)}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.recipientWaId,
        type: "text",
        text: {
          body: input.body,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    const externalMessageId = asNonEmptyString(data?.messages?.[0]?.id);

    if (!response.ok) {
      return {
        sent: false,
        statusCode: response.status,
        error: asNonEmptyString(data?.error?.message) ?? "A API do WhatsApp Cloud retornou um erro.",
        externalMessageId,
      };
    }

    return {
      sent: true,
      statusCode: response.status,
      error: undefined,
      externalMessageId,
    };
  } catch {
    return {
      sent: false,
      statusCode: 500,
      error: "A requisicao para o WhatsApp Cloud falhou.",
      externalMessageId: undefined,
    };
  }
}

export const autoReplyInboundMessage = internalAction({
  args: {
    phoneNumberId: v.string(),
    contactWaId: v.string(),
    conversationId: v.string(),
    inboundBody: v.optional(v.string()),
    messageType: v.optional(v.string()),
  },
  returns: autoReplyResultValidator,
  handler: async (ctx, args) => {
    const ai = await generateAssistantReply({
      inboundBody: args.inboundBody,
      messageType: args.messageType,
    });

    const whatsapp = await sendWhatsAppText({
      phoneNumberId: args.phoneNumberId,
      recipientWaId: args.contactWaId,
      body: ai.reply,
    });

    const externalMessageId =
      whatsapp.externalMessageId ?? `convex_auto_reply_${Date.now()}_${crypto.randomUUID()}`;

    const persistedOutbound = await ctx.runMutation(persistOutboundMessageRef, {
      phoneNumberId: args.phoneNumberId,
      conversationId: args.conversationId,
      body: ai.reply,
      externalMessageId,
      senderId: "assistant_whatsapp",
      messageTimestampMs: Date.now(),
    });

    return {
      ai,
      whatsapp,
      outboundPersist: {
        status: persistedOutbound.status,
        messageId: persistedOutbound.messageId,
      },
    };
  },
});

export const hydrateInboundAttachments = internalAction({
  args: {
    attachments: v.array(inboundAttachmentValidator),
  },
  returns: v.array(hydratedAttachmentValidator),
  handler: async (ctx, args) => {
    const hydrated = [];
    for (const attachment of args.attachments) {
      hydrated.push(await hydrateInboundAttachment(ctx, attachment));
    }
    return hydrated;
  },
});
