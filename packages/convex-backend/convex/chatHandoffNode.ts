"use node";

import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { throwBusinessError } from "./coreErrors";
import { conversationStatusValidator, messageValidator } from "./coreValidators";
import { action } from "./server";

type PreparedHandoff = {
  tenantId: string;
  conversationId: string;
  operatorUserId: string;
  operatorName: string;
  phoneNumberId: string;
  recipientWaId: string;
  notificationMessage: string;
};

const prepareConversationHandoffRef = makeFunctionReference<
  "query",
  { sessionToken: string; conversationId: string },
  PreparedHandoff
>("chatDomain:prepareConversationHandoff");

const completeConversationHandoffRef = makeFunctionReference<
  "mutation",
  { sessionToken: string; conversationId: string; notificationMessage: string },
  { conversationId: string; conversationStatus: "EM_TRIAGEM" | "PENDENTE_HUMANO" | "EM_ATENDIMENTO_HUMANO" | "FECHADO"; handoffEventId: string }
>("chatDomain:completeConversationHandoff");

const logConversationHandoffNotificationFailureRef = makeFunctionReference<
  "mutation",
  { sessionToken: string; conversationId: string; reason: string },
  null
>("chatDomain:logConversationHandoffNotificationFailure");

const persistConversationMessageRef = makeFunctionReference<
  "mutation",
  { sessionToken: string; conversationId: string; body: string; attachmentUrl?: string },
  {
    id: string;
    tenantId: string;
    conversationId: string;
    senderId: string;
    body: string;
    attachmentUrl?: string;
    createdAt: number;
    readBy: string[];
  }
>("chatDomain:sendMessage");

const logConversationMessageWhatsAppSentRef = makeFunctionReference<
  "mutation",
  {
    sessionToken: string;
    conversationId: string;
    messageId: string;
    externalMessageId?: string;
  },
  null
>("chatDomain:logConversationMessageWhatsAppSent");

const logConversationMessageWhatsAppFailureRef = makeFunctionReference<
  "mutation",
  { sessionToken: string; conversationId: string; reason: string },
  null
>("chatDomain:logConversationMessageWhatsAppFailure");

function toErrorReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown_error";
}

function getWhatsAppCloudConfig() {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  const apiVersion = process.env.WHATSAPP_CLOUD_API_VERSION?.trim() || process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v22.0";
  const graphBaseUrl = (process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");

  if (!accessToken) {
    throw new Error("config_missing:WHATSAPP_CLOUD_ACCESS_TOKEN");
  }

  return {
    accessToken,
    apiVersion,
    graphBaseUrl,
  };
}

async function sendWhatsAppText(input: {
  accessToken: string;
  apiVersion: string;
  graphBaseUrl: string;
  phoneNumberId: string;
  recipientWaId: string;
  body: string;
}): Promise<{ externalMessageId?: string }> {
  const headers = {
    Authorization: `Bearer ${input.accessToken}`,
    "content-type": "application/json",
  };

  const endpoint = `${input.graphBaseUrl}/${input.apiVersion}/${encodeURIComponent(input.phoneNumberId)}/messages`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.recipientWaId,
        type: "text",
        text: {
          body: input.body,
        },
      }),
    });
  } catch (error) {
    throw new Error(`request_failed:${toErrorReason(error)}`);
  }

  if (!response.ok) {
    const responseBody = (await response.text().catch(() => "")).trim().slice(0, 300);
    throw new Error(`http_${response.status}:${responseBody || "empty_response"}`);
  }

  let parsedBody: unknown = null;
  try {
    parsedBody = await response.json();
  } catch {
    parsedBody = null;
  }

  const externalMessageId =
    typeof (parsedBody as { messages?: Array<{ id?: unknown }> } | null)?.messages?.[0]?.id === "string"
      ? (parsedBody as { messages: Array<{ id: string }> }).messages[0].id
      : undefined;

  return {
    externalMessageId,
  };
}

export const takeConversationHandoff = action({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: v.object({
    conversationId: v.string(),
    conversationStatus: conversationStatusValidator,
    handoffEventId: v.string(),
  }),
  handler: async (ctx, args) => {
    const prepared = await ctx.runQuery(prepareConversationHandoffRef, {
      sessionToken: args.sessionToken,
      conversationId: args.conversationId,
    });

    try {
      const cloud = getWhatsAppCloudConfig();

      await sendWhatsAppText({
        accessToken: cloud.accessToken,
        apiVersion: cloud.apiVersion,
        graphBaseUrl: cloud.graphBaseUrl,
        phoneNumberId: prepared.phoneNumberId,
        recipientWaId: prepared.recipientWaId,
        body: prepared.notificationMessage,
      });
    } catch (error) {
      const reason = toErrorReason(error);
      await ctx.runMutation(logConversationHandoffNotificationFailureRef, {
        sessionToken: args.sessionToken,
        conversationId: prepared.conversationId,
        reason,
      });

      throwBusinessError("BAD_REQUEST", "Failed to send handoff notification to WhatsApp.", {
        conversationId: prepared.conversationId,
        reason,
      });
    }

    return await ctx.runMutation(completeConversationHandoffRef, {
      sessionToken: args.sessionToken,
      conversationId: prepared.conversationId,
      notificationMessage: prepared.notificationMessage,
    });
  },
});

export const sendConversationMessage = action({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
    body: v.string(),
    attachmentUrl: v.optional(v.string()),
  },
  returns: messageValidator,
  handler: async (ctx, args) => {
    const prepared = await ctx.runQuery(prepareConversationHandoffRef, {
      sessionToken: args.sessionToken,
      conversationId: args.conversationId,
    });

    const normalizedBody = args.body.trim();
    if (!normalizedBody) {
      throwBusinessError("BAD_REQUEST", "Message body must not be empty.");
    }

    let externalMessageId: string | undefined;
    try {
      const cloud = getWhatsAppCloudConfig();
      const whatsapp = await sendWhatsAppText({
        accessToken: cloud.accessToken,
        apiVersion: cloud.apiVersion,
        graphBaseUrl: cloud.graphBaseUrl,
        phoneNumberId: prepared.phoneNumberId,
        recipientWaId: prepared.recipientWaId,
        body: normalizedBody,
      });
      externalMessageId = whatsapp.externalMessageId;
    } catch (error) {
      const reason = toErrorReason(error);
      await ctx.runMutation(logConversationMessageWhatsAppFailureRef, {
        sessionToken: args.sessionToken,
        conversationId: prepared.conversationId,
        reason,
      });

      throwBusinessError("BAD_REQUEST", "Failed to send message to WhatsApp.", {
        conversationId: prepared.conversationId,
        reason,
      });
    }

    const message = await ctx.runMutation(persistConversationMessageRef, {
      sessionToken: args.sessionToken,
      conversationId: prepared.conversationId,
      body: normalizedBody,
      attachmentUrl: args.attachmentUrl,
    });

    await ctx.runMutation(logConversationMessageWhatsAppSentRef, {
      sessionToken: args.sessionToken,
      conversationId: prepared.conversationId,
      messageId: message.id,
      externalMessageId,
    });

    return message;
  },
});
