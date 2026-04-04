import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");
const seedDemoDataRef = makeFunctionReference<"action">("seedNode:seedDemoData");
const loginRef = makeFunctionReference<"action">("authNode:loginWithUsernamePassword");
const listConversationsForInboxRef = makeFunctionReference<"query">("chatDomain:listConversationsForInbox");
const getConversationThreadRef = makeFunctionReference<"query">("chatDomain:getConversationThread");
const exportConversationAttachmentArchiveRef = makeFunctionReference<"action">("chatDomain:exportConversationAttachmentArchive");
const upsertTenantWabaMappingRef = makeFunctionReference<"mutation">("wabaWebhook:upsertTenantWabaMapping");
const listAuditByPhoneNumberRef = makeFunctionReference<"query">("testing:listAuditByPhoneNumber");
const listTenantAttachmentsRef = makeFunctionReference<"query">("testing:listTenantAttachments");
const listTenantDeliveriesRef = makeFunctionReference<"query">("testing:listTenantDeliveries");
const listTenantMessagesRef = makeFunctionReference<"query">("testing:listTenantMessages");

type WebhookResult = {
  processed: number;
  duplicates: number;
  blocked: number;
  ignored: number;
};

const DEFAULT_VERIFY_TOKEN = "waba_verify_token_test";
const DEFAULT_APP_SECRET = "waba_app_secret_test";
const UNKNOWN_PHONE_NUMBER_ID = "unknown_phone_number_id";

function buildInboundPayload(input: {
  wabaAccountId?: string;
  phoneNumberId: string;
  fromWaId: string;
  externalMessageId: string;
  textBody?: string;
  timestamp?: string;
  withImage?: boolean;
  omitPhoneNumberId?: boolean;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: input.wabaAccountId ?? "waba-account-default",
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
                  profile: {
                    name: "Contato de Teste",
                  },
                },
              ],
              messages: [
                {
                  from: input.fromWaId,
                  id: input.externalMessageId,
                  timestamp: input.timestamp ?? "1710000000",
                  type: "text",
                  text: {
                    body: input.textBody ?? "mensagem de teste",
                  },
                  ...(input.withImage
                    ? {
                        image: {
                          id: `media-${input.externalMessageId}`,
                          mime_type: "image/jpeg",
                          sha256: `sha-${input.externalMessageId}`,
                          caption: "anexo de teste",
                        },
                      }
                    : {}),
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function postWebhook(t: any, payload: unknown) {
  return await postWebhookWithSignature(t, payload, { signatureMode: "valid" });
}

function buildMetaSignature(rawBody: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `sha256=${signature}`;
}

async function postWebhookWithSignature(
  t: any,
  payload: unknown,
  options: {
    signatureMode: "valid" | "invalid" | "missing";
  },
) {
  const rawBody = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (options.signatureMode !== "missing") {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) {
      throw new Error("WHATSAPP_APP_SECRET must be configured during tests.");
    }

    const signatureSecret = options.signatureMode === "invalid" ? `${appSecret}_invalid` : appSecret;
    headers["x-hub-signature-256"] = buildMetaSignature(rawBody, signatureSecret);
  }

  const response = await t.fetch("/webhooks/waba", {
    method: "POST",
    headers,
    body: rawBody,
  });

  const body = (await response.json()) as any;
  return { response, body };
}

async function withDirectAutoReplyEnv(run: () => Promise<void>) {
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  const previousWhatsappToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
  const previousModel = process.env.OPENAI_MODEL;

  process.env.OPENAI_API_KEY = "openai_test_key";
  process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = "wa_test_token";
  process.env.OPENAI_MODEL = "gpt-4.1-mini";

  try {
    await run();
  } finally {
    if (typeof previousOpenAiKey === "string") {
      process.env.OPENAI_API_KEY = previousOpenAiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }

    if (typeof previousWhatsappToken === "string") {
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = previousWhatsappToken;
    } else {
      delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    }

    if (typeof previousModel === "string") {
      process.env.OPENAI_MODEL = previousModel;
    } else {
      delete process.env.OPENAI_MODEL;
    }
  }
}

describe("WABA webhook ingestion (Convex native)", () => {
  let previousVerifyToken: string | undefined;
  let previousAppSecret: string | undefined;

  beforeEach(() => {
    previousVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    previousAppSecret = process.env.WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = DEFAULT_VERIFY_TOKEN;
    process.env.WHATSAPP_APP_SECRET = DEFAULT_APP_SECRET;
  });

  afterEach(() => {
    if (typeof previousVerifyToken === "string") {
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = previousVerifyToken;
    } else {
      delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    }

    if (typeof previousAppSecret === "string") {
      process.env.WHATSAPP_APP_SECRET = previousAppSecret;
    } else {
      delete process.env.WHATSAPP_APP_SECRET;
    }
  });

  it("returns verification challenge when verify token is valid", async () => {
    const t = convexTest(schema, modules);
    const challenge = "challenge-token-123";

    const response = await t.fetch(
      `/webhooks/waba?hub.mode=subscribe&hub.verify_token=${DEFAULT_VERIFY_TOKEN}&hub.challenge=${challenge}`,
      {
        method: "GET",
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(challenge);
  });

  it("blocks verification challenge when verify token is invalid and writes audit trail", async () => {
    const t = convexTest(schema, modules);

    const response = await t.fetch(
      "/webhooks/waba?hub.mode=subscribe&hub.verify_token=invalid-token&hub.challenge=challenge-token-123",
      {
        method: "GET",
      },
    );

    expect(response.status).toBe(403);

    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: UNKNOWN_PHONE_NUMBER_ID });
    expect(audits.some((item: { eventType: string; outcome: string }) => item.eventType === "verify_token_invalid" && item.outcome === "blocked")).toBe(true);
  });

  it("rejects payload with missing signature and writes audit trail", async () => {
    const t = convexTest(schema, modules);

    const result = await postWebhookWithSignature(
      t,
      buildInboundPayload({
        phoneNumberId: "phone_missing_sig",
        fromWaId: "5511990000001",
        externalMessageId: "wamid-missing-signature-1",
      }),
      { signatureMode: "missing" },
    );

    expect(result.response.status).toBe(401);
    expect(result.body).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });

    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: UNKNOWN_PHONE_NUMBER_ID });
    expect(audits.some((item: { eventType: string; outcome: string }) => item.eventType === "missing_signature" && item.outcome === "blocked")).toBe(true);
  });

  it("rejects payload with invalid signature and writes audit trail", async () => {
    const t = convexTest(schema, modules);

    const result = await postWebhookWithSignature(
      t,
      buildInboundPayload({
        phoneNumberId: "phone_invalid_sig",
        fromWaId: "5511990000002",
        externalMessageId: "wamid-invalid-signature-1",
      }),
      { signatureMode: "invalid" },
    );

    expect(result.response.status).toBe(401);
    expect(result.body).toMatchObject({
      ok: false,
      code: "UNAUTHENTICATED",
    });

    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: UNKNOWN_PHONE_NUMBER_ID });
    expect(audits.some((item: { eventType: string; outcome: string }) => item.eventType === "invalid_signature" && item.outcome === "blocked")).toBe(true);
  });

  it("fails closed and audits error when WHATSAPP_APP_SECRET is not configured", async () => {
    const t = convexTest(schema, modules);
    delete process.env.WHATSAPP_APP_SECRET;

    const payload = buildInboundPayload({
      phoneNumberId: "phone_secret_missing",
      fromWaId: "5511990000003",
      externalMessageId: "wamid-secret-missing-1",
    });
    const rawBody = JSON.stringify(payload);
    const signature = buildMetaSignature(rawBody, "fallback-secret");

    const response = await t.fetch("/webhooks/waba", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: rawBody,
    });

    expect(response.status).toBe(503);

    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: UNKNOWN_PHONE_NUMBER_ID });
    expect(audits.some((item: { eventType: string; outcome: string }) => item.eventType === "signature_secret_not_configured" && item.outcome === "error")).toBe(true);
  });

  it("isolates tenant A/B and persists attachments in the correct tenant", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(upsertTenantWabaMappingRef, {
      tenantId: "tenant_A",
      phoneNumberId: "phone_A",
      wabaAccountId: "waba_A",
      displayName: "Tenant A WABA",
    });

    await t.mutation(upsertTenantWabaMappingRef, {
      tenantId: "tenant_B",
      phoneNumberId: "phone_B",
      wabaAccountId: "waba_B",
      displayName: "Tenant B WABA",
    });

    const first = await postWebhook(
      t,
      buildInboundPayload({
        phoneNumberId: "phone_A",
        fromWaId: "5511991111111",
        externalMessageId: "wamid-A-1",
        textBody: "mensagem A",
        withImage: true,
      }),
    );

    const second = await postWebhook(
      t,
      buildInboundPayload({
        phoneNumberId: "phone_B",
        fromWaId: "5511992222222",
        externalMessageId: "wamid-B-1",
        textBody: "mensagem B",
      }),
    );

    expect(first.response.status).toBe(200);
    expect(first.body).toEqual({ processed: 1, duplicates: 0, blocked: 0, ignored: 0 });
    expect(second.response.status).toBe(200);
    expect(second.body).toEqual({ processed: 1, duplicates: 0, blocked: 0, ignored: 0 });

    const tenantAMessages = await t.query(listTenantMessagesRef, { tenantId: "tenant_A" });
    const tenantBMessages = await t.query(listTenantMessagesRef, { tenantId: "tenant_B" });

    expect(tenantAMessages).toHaveLength(1);
    expect(tenantAMessages[0]?.phoneNumberId).toBe("phone_A");
    expect(tenantAMessages[0]?.externalMessageId).toBe("wamid-A-1");

    expect(tenantBMessages).toHaveLength(1);
    expect(tenantBMessages[0]?.phoneNumberId).toBe("phone_B");
    expect(tenantBMessages[0]?.externalMessageId).toBe("wamid-B-1");

    const tenantAAttachments = await t.query(listTenantAttachmentsRef, { tenantId: "tenant_A" });
    const tenantBAttachments = await t.query(listTenantAttachmentsRef, { tenantId: "tenant_B" });

    expect(tenantAAttachments).toHaveLength(1);
    expect(tenantAAttachments[0]?.mediaType).toBe("image");
    expect(tenantBAttachments).toHaveLength(0);
  });

  it("stores inbound media in storage and serves attachment download urls from storage", async () => {
    const previousWhatsappToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    const previousWhatsappApiVersion = process.env.WHATSAPP_CLOUD_API_VERSION;
    const previousWhatsappGraphVersion = process.env.WHATSAPP_GRAPH_VERSION;
    const previousWhatsappGraphBaseUrl = process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL;
    const originalFetch = globalThis.fetch;

    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = "wa_media_storage_token";
    process.env.WHATSAPP_CLOUD_API_VERSION = "v22.0";
    process.env.WHATSAPP_GRAPH_VERSION = "v22.0";
    process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL = "https://graph.facebook.com";

    globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/v22.0/media-wamid-storage-1")) {
        return new Response(
          JSON.stringify({
            url: "https://graph.facebook.com/media-download/wamid-storage-1",
            mime_type: "image/jpeg",
            filename: "foto-storage.jpg",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      if (url === "https://graph.facebook.com/media-download/wamid-storage-1") {
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: {
            "content-type": "image/jpeg",
          },
        });
      }

      if (url.includes("graph.facebook.com") && url.includes("/messages")) {
        return new Response(
          JSON.stringify({
            messages: [{ id: "wamid.media.storage.reply.1" }],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      return await originalFetch(input as any, init);
    }) as typeof fetch;

    try {
      const t = convexTest(schema, modules);
      await t.action(seedDemoDataRef, {});

      const result = await postWebhook(
        t,
        buildInboundPayload({
          phoneNumberId: "waba_phone_legal_1",
          fromWaId: "5511999090909",
          externalMessageId: "wamid-storage-1",
          textBody: "segue imagem em anexo",
          withImage: true,
        }),
      );

      expect(result.response.status).toBe(200);
      expect(result.body).toEqual({ processed: 1, duplicates: 0, blocked: 0, ignored: 0 });

      const session = await t.action(loginRef, {
        username: "ana.lima",
        password: "Ana@123456",
      });

      const inbox = await t.query(listConversationsForInboxRef, {
        sessionToken: session.sessionToken,
        search: "contato de teste",
      });
      expect(inbox[0]?.conversationId).toBeTruthy();

      const conversationId = inbox[0]!.conversationId;
      const thread = await t.query(getConversationThreadRef, {
        sessionToken: session.sessionToken,
        conversationId,
      });

      const attachmentMessage = thread.messages.find(
        (message: { attachment?: { fileName?: string } }) => message.attachment?.fileName === "foto-storage.jpg",
      );
      expect(attachmentMessage?.attachment?.storageId).toBeTruthy();
      expect((attachmentMessage?.attachment?.url ?? "").length).toBeGreaterThan(0);

      const archive = await t.action(exportConversationAttachmentArchiveRef, {
        sessionToken: session.sessionToken,
        conversationId,
      });

      expect(archive.attachmentCount).toBeGreaterThanOrEqual(1);
      expect(archive.attachments.some((attachment: { storageId?: string }) => Boolean(attachment.storageId))).toBe(true);
      expect(archive.zipDownloadUrl.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;

      if (typeof previousWhatsappToken === "string") {
        process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = previousWhatsappToken;
      } else {
        delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
      }

      if (typeof previousWhatsappApiVersion === "string") {
        process.env.WHATSAPP_CLOUD_API_VERSION = previousWhatsappApiVersion;
      } else {
        delete process.env.WHATSAPP_CLOUD_API_VERSION;
      }

      if (typeof previousWhatsappGraphVersion === "string") {
        process.env.WHATSAPP_GRAPH_VERSION = previousWhatsappGraphVersion;
      } else {
        delete process.env.WHATSAPP_GRAPH_VERSION;
      }

      if (typeof previousWhatsappGraphBaseUrl === "string") {
        process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL = previousWhatsappGraphBaseUrl;
      } else {
        delete process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL;
      }
    }
  });

  it("fails closed when phone_number_id is unknown and writes an audit trail", async () => {
    const t = convexTest(schema, modules);

    const result = await postWebhook(
      t,
      buildInboundPayload({
        phoneNumberId: "phone_unknown",
        fromWaId: "5511993333333",
        externalMessageId: "wamid-unknown-1",
      }),
    );

    expect(result.response.status).toBe(404);
    expect(result.body).toEqual({ processed: 0, duplicates: 0, blocked: 1, ignored: 0 });

    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: "phone_unknown" });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.eventType).toBe("unknown_phone_number_id");
    expect(audits[0]?.outcome).toBe("blocked");
    expect(audits[0]?.tenantId).toBeNull();
  });

  it("fails closed and audits payloads without phone_number_id", async () => {
    const t = convexTest(schema, modules);

    const result = await postWebhook(
      t,
      buildInboundPayload({
        phoneNumberId: "unused",
        omitPhoneNumberId: true,
        fromWaId: "5511991010101",
        externalMessageId: "wamid-missing-phone-id-1",
      }),
    );

    expect(result.response.status).toBe(404);
    expect(result.body).toEqual({ processed: 0, duplicates: 0, blocked: 1, ignored: 0 });

    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: UNKNOWN_PHONE_NUMBER_ID });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.eventType).toBe("missing_phone_number_id");
    expect(audits[0]?.outcome).toBe("blocked");
    expect(audits[0]?.tenantId).toBeNull();
  });

  it("fails closed and audits invalid json payload", async () => {
    const t = convexTest(schema, modules);
    const rawBody = "{not-valid-json";
    const signature = buildMetaSignature(rawBody, DEFAULT_APP_SECRET);

    const response = await t.fetch("/webhooks/waba", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hub-signature-256": signature,
      },
      body: rawBody,
    });

    const body = (await response.json()) as WebhookResult;

    expect(response.status).toBe(404);
    expect(body).toEqual({ processed: 0, duplicates: 0, blocked: 1, ignored: 0 });

    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: UNKNOWN_PHONE_NUMBER_ID });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.eventType).toBe("invalid_json");
    expect(audits[0]?.outcome).toBe("blocked");
    expect(audits[0]?.tenantId).toBeNull();
  });

  it("ignores exact duplicate payloads idempotently", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(upsertTenantWabaMappingRef, {
      tenantId: "tenant_dup",
      phoneNumberId: "phone_dup",
      wabaAccountId: "waba_dup",
      displayName: "Tenant Dup",
    });

    const payload = buildInboundPayload({
      phoneNumberId: "phone_dup",
      fromWaId: "5511994444444",
      externalMessageId: "wamid-dup-1",
      textBody: "mensagem única",
    });

    const first = await postWebhook(t, payload);
    const second = await postWebhook(t, payload);

    expect(first.response.status).toBe(200);
    expect(first.body).toEqual({ processed: 1, duplicates: 0, blocked: 0, ignored: 0 });

    expect(second.response.status).toBe(200);
    expect(second.body).toEqual({ processed: 0, duplicates: 1, blocked: 0, ignored: 0 });

    const messages = await t.query(listTenantMessagesRef, { tenantId: "tenant_dup" });
    const deliveries = await t.query(listTenantDeliveriesRef, { tenantId: "tenant_dup" });
    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: "phone_dup" });

    expect(messages).toHaveLength(1);
    expect(deliveries).toHaveLength(1);
    expect(audits.some((item: { outcome: string }) => item.outcome === "processed")).toBe(true);
    expect(audits.some((item: { outcome: string }) => item.outcome === "duplicate")).toBe(true);
  });

  it("does not collide idempotency keys when ids contain special characters", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(upsertTenantWabaMappingRef, {
      tenantId: "tenant:a",
      phoneNumberId: "phone",
      wabaAccountId: "waba-special-a",
      displayName: "Tenant A",
    });

    await t.mutation(upsertTenantWabaMappingRef, {
      tenantId: "tenant",
      phoneNumberId: "a:phone",
      wabaAccountId: "waba-special-b",
      displayName: "Tenant B",
    });

    const first = await postWebhook(
      t,
      buildInboundPayload({
        phoneNumberId: "phone",
        fromWaId: "5511995555555",
        externalMessageId: "m",
      }),
    );

    const second = await postWebhook(
      t,
      buildInboundPayload({
        phoneNumberId: "a:phone",
        fromWaId: "5511996666666",
        externalMessageId: "m",
      }),
    );

    expect(first.response.status).toBe(200);
    expect(first.body).toEqual({ processed: 1, duplicates: 0, blocked: 0, ignored: 0 });
    expect(second.response.status).toBe(200);
    expect(second.body).toEqual({ processed: 1, duplicates: 0, blocked: 0, ignored: 0 });

    const tenantASpecial = await t.query(listTenantMessagesRef, { tenantId: "tenant:a" });
    const tenantBSpecial = await t.query(listTenantMessagesRef, { tenantId: "tenant" });

    expect(tenantASpecial).toHaveLength(1);
    expect(tenantBSpecial).toHaveLength(1);
    expect(tenantASpecial[0]?.idempotencyKey).not.toBe(tenantBSpecial[0]?.idempotencyKey);
  });

  it("processes Meta webhook directly to chatDomain and auto replies without external orchestrator", async () => {
    await withDirectAutoReplyEnv(async () => {
      const originalFetch = globalThis.fetch;
      const openAiCalls: string[] = [];
      const whatsappCalls: string[] = [];

      globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

        if (url === "https://api.openai.com/v1/responses") {
          openAiCalls.push(url);
          return new Response(
            JSON.stringify({
              output_text: "Sou o assistente especialista. Pode me enviar CPF e data de nascimento para iniciar a analise.",
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        if (url.includes("graph.facebook.com")) {
          whatsappCalls.push(url);
          return new Response(
            JSON.stringify({
              messages: [{ id: "wamid.direct.convex.1" }],
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        return await originalFetch(input as any, init);
      }) as typeof fetch;

      try {
        const t = convexTest(schema, modules);
        await t.action(seedDemoDataRef, {});

        const result = await postWebhook(
          t,
          buildInboundPayload({
            phoneNumberId: "waba_phone_legal_1",
            fromWaId: "5511997777777",
            externalMessageId: "wamid-direct-convex-1",
            textBody: "Quero orientacao previdenciaria",
          }),
        );

        expect(result.response.status).toBe(200);
        expect(result.body).toEqual({ processed: 1, duplicates: 0, blocked: 0, ignored: 0 });
        expect(openAiCalls).toHaveLength(1);
        expect(whatsappCalls).toHaveLength(1);

        const session = await t.action(loginRef, {
          username: "ana.lima",
          password: "Ana@123456",
        });

        const inbox = await t.query(listConversationsForInboxRef, {
          sessionToken: session.sessionToken,
          search: "contato de teste",
        });

        const createdConversation = inbox[0];
        expect(createdConversation).toBeTruthy();

        const thread = await t.query(getConversationThreadRef, {
          sessionToken: session.sessionToken,
          conversationId: createdConversation!.conversationId,
        });

        expect(thread.messages.map((message: { body: string }) => message.body)).toEqual(
          expect.arrayContaining([
            "Quero orientacao previdenciaria",
            "Sou o assistente especialista. Pode me enviar CPF e data de nascimento para iniciar a analise.",
          ]),
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
