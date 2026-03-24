import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");
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
  const response = await t.fetch("/webhooks/waba", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as WebhookResult;
  return { response, body };
}

describe("WABA webhook ingestion (Convex native)", () => {
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

    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: "unknown_phone_number_id" });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.eventType).toBe("missing_phone_number_id");
    expect(audits[0]?.outcome).toBe("blocked");
    expect(audits[0]?.tenantId).toBeNull();
  });

  it("fails closed and audits invalid json payload", async () => {
    const t = convexTest(schema, modules);

    const response = await t.fetch("/webhooks/waba", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{not-valid-json",
    });

    const body = (await response.json()) as WebhookResult;

    expect(response.status).toBe(404);
    expect(body).toEqual({ processed: 0, duplicates: 0, blocked: 1, ignored: 0 });

    const audits = await t.query(listAuditByPhoneNumberRef, { phoneNumberId: "unknown_phone_number_id" });
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
});
