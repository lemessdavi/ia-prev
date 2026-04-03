"use node";

import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { throwBusinessError } from "./coreErrors";
import { conversationStatusValidator } from "./coreValidators";
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

function toErrorReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown_error";
}

async function sendHandoffNotificationToWhatsApp(input: {
  accessToken: string;
  apiVersion: string;
  graphBaseUrl: string;
  prepared: PreparedHandoff;
}): Promise<void> {
  const headers = {
    Authorization: `Bearer ${input.accessToken}`,
    "content-type": "application/json",
  };

  const endpoint = `${input.graphBaseUrl}/${input.apiVersion}/${encodeURIComponent(input.prepared.phoneNumberId)}/messages`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.prepared.recipientWaId,
        type: "text",
        text: {
          body: input.prepared.notificationMessage,
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

    const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
    const apiVersion = process.env.WHATSAPP_CLOUD_API_VERSION?.trim() || "v22.0";
    const graphBaseUrl = (process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");

    try {
      if (!accessToken) {
        throw new Error("config_missing:WHATSAPP_CLOUD_ACCESS_TOKEN");
      }

      await sendHandoffNotificationToWhatsApp({
        accessToken,
        apiVersion,
        graphBaseUrl,
        prepared,
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
