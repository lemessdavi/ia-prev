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

async function sendHandoffNotificationToWebhook(input: {
  webhookUrl: string;
  integrationSecret?: string;
  prepared: PreparedHandoff;
}): Promise<void> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (input.integrationSecret) {
    headers["x-n8n-integration-secret"] = input.integrationSecret;
  }

  let response: Response;
  try {
    response = await fetch(input.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        conversationId: input.prepared.conversationId,
        tenantId: input.prepared.tenantId,
        operatorUserId: input.prepared.operatorUserId,
        operatorName: input.prepared.operatorName,
        message: input.prepared.notificationMessage,
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

    const webhookUrl = process.env.N8N_HANDOFF_NOTIFY_WEBHOOK_URL?.trim();
    const integrationSecret = process.env.N8N_INTEGRATION_SECRET?.trim();

    try {
      if (!webhookUrl) {
        throw new Error("config_missing:N8N_HANDOFF_NOTIFY_WEBHOOK_URL");
      }

      await sendHandoffNotificationToWebhook({
        webhookUrl,
        integrationSecret,
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
