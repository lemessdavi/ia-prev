import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

const seedDemoDataRef = makeFunctionReference<"action">("seedNode:seedDemoData");
const persistInboundFromWebhookRef = makeFunctionReference<"mutation">("whatsappBridge:persistInboundFromWebhook");
const loginRef = makeFunctionReference<"action">("authNode:loginWithUsernamePassword");
const workspaceSummaryRef = makeFunctionReference<"query">("chatDomain:getTenantWorkspaceSummary");
const listConversationsForInboxRef = makeFunctionReference<"query">("chatDomain:listConversationsForInbox");
const getConversationThreadRef = makeFunctionReference<"query">("chatDomain:getConversationThread");
const takeConversationHandoffRef = makeFunctionReference<"action">("chatHandoffNode:takeConversationHandoff");
const sendConversationMessageRef = makeFunctionReference<"action">("chatHandoffNode:sendConversationMessage");
const setConversationTriageResultRef = makeFunctionReference<"mutation">("chatDomain:setConversationTriageResult");
const closeConversationWithReasonRef = makeFunctionReference<"mutation">("chatDomain:closeConversationWithReason");
const exportConversationDossierRef = makeFunctionReference<"mutation">("chatDomain:exportConversationDossier");
const listConversationAuditLogsRef = makeFunctionReference<"query">("testing:listConversationAuditLogs");

const whatsappAccessToken = "wa_test_access_token";
let previousWhatsAppAccessToken: string | undefined;
let previousWhatsAppApiVersion: string | undefined;
let previousWhatsAppGraphBaseUrl: string | undefined;

async function createSeededTestContext() {
  const t = convexTest(schema, modules);
  await t.action(seedDemoDataRef, {});
  return t;
}

async function loginAs(
  t: Awaited<ReturnType<typeof createSeededTestContext>>,
  username: string,
  password: string,
) {
  return await t.action(loginRef, { username, password });
}

async function createWhatsAppConversation(
  t: Awaited<ReturnType<typeof createSeededTestContext>>,
  input: { externalMessageId: string; contactWaId: string; contactDisplayName: string; body: string },
) {
  return await t.mutation(persistInboundFromWebhookRef, {
    phoneNumberId: "waba_phone_legal_1",
    contactWaId: input.contactWaId,
    contactDisplayName: input.contactDisplayName,
    externalMessageId: input.externalMessageId,
    messageType: "text",
    body: input.body,
  });
}

async function expectBusinessError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error("Expected promise to reject with business error.");
  } catch (error) {
    const payload =
      typeof (error as { data?: unknown }).data === "string"
        ? JSON.parse((error as { data: string }).data)
        : (error as { data?: unknown }).data;

    expect(payload).toMatchObject({ code });
  }
}

describe("Convex tenant operator workspace flows", () => {
  beforeEach(() => {
    previousWhatsAppAccessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    previousWhatsAppApiVersion = process.env.WHATSAPP_CLOUD_API_VERSION;
    previousWhatsAppGraphBaseUrl = process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL;

    process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = whatsappAccessToken;
    process.env.WHATSAPP_CLOUD_API_VERSION = "v22.0";
    process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL = "https://graph.facebook.com";
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (typeof previousWhatsAppAccessToken === "string") {
      process.env.WHATSAPP_CLOUD_ACCESS_TOKEN = previousWhatsAppAccessToken;
    } else {
      delete process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
    }

    if (typeof previousWhatsAppApiVersion === "string") {
      process.env.WHATSAPP_CLOUD_API_VERSION = previousWhatsAppApiVersion;
    } else {
      delete process.env.WHATSAPP_CLOUD_API_VERSION;
    }

    if (typeof previousWhatsAppGraphBaseUrl === "string") {
      process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL = previousWhatsAppGraphBaseUrl;
    } else {
      delete process.env.WHATSAPP_CLOUD_GRAPH_BASE_URL;
    }
  });

  it("returns tenant workspace summary for logged tenant_user", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    const summary = await t.query(workspaceSummaryRef, {
      sessionToken: session.sessionToken,
    });

    expect(summary).toMatchObject({
      tenantId: "tenant_legal",
      tenantName: "Lemes Advocacia",
      wabaLabel: "Lemes Advocacia WABA",
      activeAiProfileName: "previdencia-triagem-v1",
      operator: {
        userId: "usr_ana",
        fullName: "Ana Lima",
        username: "ana.lima",
      },
    });
  });

  it("lists tenant inbox with status and search filters", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    const allRows = await t.query(listConversationsForInboxRef, {
      sessionToken: session.sessionToken,
    });
    expect(allRows).toHaveLength(2);

    const triageRows = await t.query(listConversationsForInboxRef, {
      sessionToken: session.sessionToken,
      status: "EM_TRIAGEM",
    });
    expect(triageRows).toHaveLength(1);
    expect(triageRows[0]?.conversationId).toBe("conv_ana_marina");

    const searchRows = await t.query(listConversationsForInboxRef, {
      sessionToken: session.sessionToken,
      search: "caio",
    });
    expect(searchRows).toHaveLength(1);
    expect(searchRows[0]?.conversationId).toBe("conv_ana_caio");
  });

  it("returns conversation thread and blocks cross-tenant access", async () => {
    const t = await createSeededTestContext();
    const legalSession = await loginAs(t, "ana.lima", "Ana@123456");

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: legalSession.sessionToken,
      conversationId: "conv_ana_caio",
    });

    expect(thread.conversationId).toBe("conv_ana_caio");
    expect(thread.messages.length).toBeGreaterThanOrEqual(3);
    expect(thread.messages.some((item: { attachment?: { fileName: string } }) => item.attachment?.fileName === "laudo-medico.pdf")).toBe(
      true,
    );

    const clinicSession = await loginAs(t, "bruna.alves", "Bruna@123456");
    await expectBusinessError(
      t.query(getConversationThreadRef, {
        sessionToken: clinicSession.sessionToken,
        conversationId: "conv_ana_caio",
      }),
      "NOT_FOUND",
    );
  });

  it("takes handoff, sends WhatsApp notification and persists audit trail", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");
    const inbound = await createWhatsAppConversation(t, {
      externalMessageId: "wamid-handoff-success",
      contactWaId: "5548991313199",
      contactDisplayName: "Contato Handoff",
      body: "Oi, preciso falar com atendente humano.",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const expectedMessage = "Ana Lima assumiu a conversa e continuará seu atendimento por aqui.";

    const result = await t.action(takeConversationHandoffRef, {
      sessionToken: session.sessionToken,
      conversationId: inbound.conversationId,
    });

    expect(result.conversationId).toBe(inbound.conversationId);
    expect(result.conversationStatus).toBe("EM_ATENDIMENTO_HUMANO");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://graph.facebook.com/v22.0/waba_phone_legal_1/messages");
    expect((init as RequestInit | undefined)?.headers).toMatchObject({
      Authorization: `Bearer ${whatsappAccessToken}`,
      "content-type": "application/json",
    });
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as Record<string, unknown>;
    expect(payload).toMatchObject({
      messaging_product: "whatsapp",
      to: "5548991313199",
      type: "text",
      text: {
        body: expectedMessage,
      },
    });

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: inbound.conversationId,
    });
    expect(thread.conversationStatus).toBe("EM_ATENDIMENTO_HUMANO");
    expect(thread.handoffEvents.some((item: { to: string; performedByUserId?: string }) => item.to === "human" && item.performedByUserId === "usr_ana")).toBe(
      true,
    );
    expect(thread.messages.some((item: { body: string }) => item.body === expectedMessage)).toBe(true);

    const audits = await t.query(listConversationAuditLogsRef, {
      tenantId: "tenant_legal",
      conversationId: inbound.conversationId,
    });
    expect(audits.some((row: { action: string }) => row.action === "conversation.handoff.taken")).toBe(true);
    expect(audits.some((row: { action: string }) => row.action === "conversation.handoff.whatsapp_notification.sent")).toBe(true);
  });

  it("fails handoff when WhatsApp notification fails and writes failure audit", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");
    const inbound = await createWhatsAppConversation(t, {
      externalMessageId: "wamid-handoff-fail",
      contactWaId: "5511998877665",
      contactDisplayName: "Contato Falha",
      body: "Preciso de ajuda com meu caso.",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("gateway offline", { status: 502 }));
    const expectedMessage = "Ana Lima assumiu a conversa e continuará seu atendimento por aqui.";

    await expectBusinessError(
      t.action(takeConversationHandoffRef, {
        sessionToken: session.sessionToken,
        conversationId: inbound.conversationId,
      }),
      "BAD_REQUEST",
    );

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: inbound.conversationId,
    });
    expect(thread.conversationStatus).toBe("EM_TRIAGEM");
    expect(thread.handoffEvents).toHaveLength(0);
    expect(thread.messages.some((item: { body: string }) => item.body === expectedMessage)).toBe(false);

    const audits = await t.query(listConversationAuditLogsRef, {
      tenantId: "tenant_legal",
      conversationId: inbound.conversationId,
    });
    expect(audits.some((row: { action: string }) => row.action === "conversation.handoff.taken")).toBe(false);
    expect(audits.some((row: { action: string }) => row.action === "conversation.handoff.taken.failed")).toBe(true);
    expect(audits.some((row: { action: string }) => row.action === "conversation.handoff.whatsapp_notification.failed")).toBe(true);
  });

  it("sends operator message to WhatsApp, persists message and writes delivery audit trail", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");
    const inbound = await createWhatsAppConversation(t, {
      externalMessageId: "wamid-send-success",
      contactWaId: "5548991313199",
      contactDisplayName: "Contato Mensagem",
      body: "Oi, estou aguardando retorno.",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid-outbound-1" }] }), { status: 200 }));

    const outgoingBody = "Recebi seus dados e vou te orientar no proximo passo.";
    await t.action(sendConversationMessageRef, {
      sessionToken: session.sessionToken,
      conversationId: inbound.conversationId,
      body: outgoingBody,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://graph.facebook.com/v22.0/waba_phone_legal_1/messages");
    expect((init as RequestInit | undefined)?.headers).toMatchObject({
      Authorization: `Bearer ${whatsappAccessToken}`,
      "content-type": "application/json",
    });
    const payload = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as Record<string, unknown>;
    expect(payload).toMatchObject({
      messaging_product: "whatsapp",
      to: "5548991313199",
      type: "text",
      text: {
        body: outgoingBody,
      },
    });

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: inbound.conversationId,
    });
    expect(thread.messages.some((item: { body: string; senderId: string }) => item.body === outgoingBody && item.senderId === "usr_ana")).toBe(true);

    const audits = await t.query(listConversationAuditLogsRef, {
      tenantId: "tenant_legal",
      conversationId: inbound.conversationId,
    });
    expect(audits.some((row: { action: string }) => row.action === "conversation.message.whatsapp.sent")).toBe(true);
  });

  it("fails operator send when WhatsApp outbound fails and writes failure audit without local persistence", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");
    const inbound = await createWhatsAppConversation(t, {
      externalMessageId: "wamid-send-fail",
      contactWaId: "5511998877665",
      contactDisplayName: "Contato Falha Envio",
      body: "Vocês podem me ajudar?",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message: "(#131030) Recipient phone number not in allowed list",
          },
        }),
        { status: 400 },
      ),
    );

    const outgoingBody = "Vou te transferir para atendimento humano.";
    await expectBusinessError(
      t.action(sendConversationMessageRef, {
        sessionToken: session.sessionToken,
        conversationId: inbound.conversationId,
        body: outgoingBody,
      }),
      "BAD_REQUEST",
    );

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: inbound.conversationId,
    });
    expect(thread.messages.some((item: { body: string }) => item.body === outgoingBody)).toBe(false);

    const audits = await t.query(listConversationAuditLogsRef, {
      tenantId: "tenant_legal",
      conversationId: inbound.conversationId,
    });
    expect(audits.some((row: { action: string }) => row.action === "conversation.message.whatsapp.sent")).toBe(false);
    expect(audits.some((row: { action: string }) => row.action === "conversation.message.whatsapp.failed")).toBe(true);
  });

  it("allows operator to manually set conversation triage result", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    const result = await t.mutation(setConversationTriageResultRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      triageResult: "REVISAO_HUMANA",
    });

    expect(result).toMatchObject({
      conversationId: "conv_ana_marina",
      triageResult: "REVISAO_HUMANA",
    });

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });
    expect(thread.triageResult).toBe("REVISAO_HUMANA");
  });

  it("allows operator to clear conversation triage result back to N_A", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(setConversationTriageResultRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      triageResult: "REVISAO_HUMANA",
    });

    const result = await t.mutation(setConversationTriageResultRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      triageResult: "N_A",
    });

    expect(result).toMatchObject({
      conversationId: "conv_ana_marina",
      triageResult: "N_A",
    });

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });
    expect(thread.triageResult).toBe("N_A");
  });

  it("closes conversation with reason and persists closure in dossier export", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    const closeResult = await t.mutation(closeConversationWithReasonRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_caio",
      reason: "Documentacao validada e caso concluido",
    });

    expect(closeResult.conversationStatus).toBe("FECHADO");
    expect(closeResult.closureReason).toBe("Documentacao validada e caso concluido");

    const exportResult = await t.mutation(exportConversationDossierRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_caio",
    });
    expect(exportResult.closureReason).toBe("Documentacao validada e caso concluido");
    expect(exportResult.attachments.length).toBeGreaterThanOrEqual(1);
    expect(exportResult.messages.length).toBeGreaterThanOrEqual(1);
    expect(exportResult.handoffEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("blocks dossier export for users from another tenant", async () => {
    const t = await createSeededTestContext();
    const clinicSession = await loginAs(t, "bruna.alves", "Bruna@123456");

    await expectBusinessError(
      t.mutation(exportConversationDossierRef, {
        sessionToken: clinicSession.sessionToken,
        conversationId: "conv_ana_caio",
      }),
      "NOT_FOUND",
    );
  });
});
