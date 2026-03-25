import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

const seedDemoDataRef = makeFunctionReference<"action">("seedNode:seedDemoData");
const loginRef = makeFunctionReference<"action">("authNode:loginWithUsernamePassword");
const workspaceSummaryRef = makeFunctionReference<"query">("chatDomain:getTenantWorkspaceSummary");
const listConversationsForInboxRef = makeFunctionReference<"query">("chatDomain:listConversationsForInbox");
const getConversationThreadRef = makeFunctionReference<"query">("chatDomain:getConversationThread");
const takeConversationHandoffRef = makeFunctionReference<"mutation">("chatDomain:takeConversationHandoff");
const closeConversationWithReasonRef = makeFunctionReference<"mutation">("chatDomain:closeConversationWithReason");
const exportConversationDossierRef = makeFunctionReference<"mutation">("chatDomain:exportConversationDossier");

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

  it("takes handoff and updates conversation status/event history", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    const result = await t.mutation(takeConversationHandoffRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_caio",
    });

    expect(result.conversationId).toBe("conv_ana_caio");
    expect(result.conversationStatus).toBe("EM_ATENDIMENTO_HUMANO");

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_caio",
    });
    expect(thread.conversationStatus).toBe("EM_ATENDIMENTO_HUMANO");
    expect(thread.handoffEvents.some((item: { to: string; performedByUserId?: string }) => item.to === "human" && item.performedByUserId === "usr_ana")).toBe(
      true,
    );
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
