import type { APIRequestContext, APIResponse } from "@playwright/test";

export type WabaWebhookResult = {
  processed: number;
  duplicates: number;
  blocked: number;
  ignored: number;
};

type BuildInboundPayloadInput = {
  phoneNumberId: string;
  fromWaId: string;
  externalMessageId: string;
  textBody?: string;
  wabaAccountId?: string;
  omitPhoneNumberId?: boolean;
};

export function buildInboundPayload(input: BuildInboundPayloadInput): Record<string, unknown> {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: input.wabaAccountId ?? "waba-account-e2e",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                ...(input.omitPhoneNumberId ? {} : { phone_number_id: input.phoneNumberId }),
                display_phone_number: "+55 11 90000-0000",
              },
              contacts: [
                {
                  wa_id: input.fromWaId,
                  profile: { name: "Contato E2E" },
                },
              ],
              messages: [
                {
                  from: input.fromWaId,
                  id: input.externalMessageId,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: {
                    body: input.textBody ?? "mensagem e2e",
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function buildUniqueMessageId(prefix: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${nonce}`;
}

function resolveWebhookBaseUrl(convexUrl: string): string {
  const normalized = convexUrl.trim().replace(/\/+$/, "");
  if (normalized.endsWith(".convex.cloud")) {
    return normalized.replace(/\.convex\.cloud$/, ".convex.site");
  }
  return normalized;
}

export async function postWabaWebhook(
  request: APIRequestContext,
  convexUrl: string,
  payload: Record<string, unknown>,
): Promise<{ response: APIResponse; body: WabaWebhookResult }> {
  const endpoint = `${resolveWebhookBaseUrl(convexUrl)}/webhooks/waba`;
  const response = await request.post(endpoint, {
    headers: {
      "content-type": "application/json",
    },
    data: payload,
  });

  const rawBody = await response.text();
  if (!rawBody.trim()) {
    throw new Error(
      `Webhook WABA retornou corpo vazio. status=${response.status()} endpoint=${endpoint}. ` +
        "Verifique se o endpoint HTTP action esta publicado no deployment Convex correto.",
    );
  }

  let body: WabaWebhookResult;
  try {
    body = JSON.parse(rawBody) as WabaWebhookResult;
  } catch {
    throw new Error(`Webhook WABA retornou JSON invalido. status=${response.status()} body=${rawBody.slice(0, 500)}`);
  }

  return {
    response,
    body,
  };
}
