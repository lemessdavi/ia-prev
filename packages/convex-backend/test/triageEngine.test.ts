import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

const seedDemoDataRef = makeFunctionReference<"action">("seedNode:seedDemoData");
const loginRef = makeFunctionReference<"action">("authNode:loginWithUsernamePassword");
const upsertTriageAnswersRef = makeFunctionReference<"mutation">("triageEngine:upsertTriageAnswers");
const evaluateConversationTriageRef = makeFunctionReference<"mutation">("triageEngine:evaluateConversationTriage");
const getConversationTriageRef = makeFunctionReference<"query">("triageEngine:getConversationTriage");
const getConversationThreadRef = makeFunctionReference<"query">("chatDomain:getConversationThread");

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

describe("triageEngine integration contract", () => {
  it("stores triage answers and keeps status N_A until IA decision", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    const triage = await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "AUXILIO_ACIDENTE",
      answers: {
        teveAcidente: true,
        anoAcidente: 2020,
      },
    });

    expect(triage.triageResult).toBe("N_A");

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });
    expect(thread.triageResult).toBe("N_A");
  });

  it("applies IA decision and syncs conversation triageResult", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "AUXILIO_ACIDENTE",
      answers: {
        teveAcidente: true,
      },
    });

    const decision = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      triageResult: "APTO",
      reasons: ["Modelo v2: criterios atendidos."],
    });

    expect(decision.triageResult).toBe("APTO");
    expect(decision.reasons).toEqual(["Modelo v2: criterios atendidos."]);

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });
    expect(thread.triageResult).toBe("APTO");

    const triage = await t.query(getConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });
    expect(triage?.triageResult).toBe("APTO");
  });

  it("supports human-review decision payload from IA", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "APOSENTADORIA_ANTECIPADA",
      answers: {
        idade: 52,
      },
    });

    const decision = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      triageResult: "REVISAO_HUMANA",
      reasons: ["Dados conflitantes segundo classificador externo."],
      missingFields: ["tempoContribuicaoAnos"],
      inconsistencies: ["tempo declarado diverge de documento anexado"],
    });

    expect(decision.triageResult).toBe("REVISAO_HUMANA");
    expect(decision.missingFields).toEqual(["tempoContribuicaoAnos"]);
    expect(decision.inconsistencies).toEqual(["tempo declarado diverge de documento anexado"]);
  });

  it("allows IA to change previous decision", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "APOSENTADORIA_ANTECIPADA",
      answers: {
        idade: 51,
      },
    });

    await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      triageResult: "NAO_APTO",
      reasons: ["Modelo v1: nao apto."],
    });

    const updated = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      triageResult: "APTO",
      reasons: ["Modelo v2: apto apos reprocessamento."],
    });

    expect(updated.triageResult).toBe("APTO");

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });
    expect(thread.triageResult).toBe("APTO");
  });

  it("allows direct IA decision without prior answer upsert when flowType is provided", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    const decision = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "AUXILIO_ACIDENTE",
      triageResult: "REVISAO_HUMANA",
      reasons: ["Classificador sem confianca suficiente."],
    });

    expect(decision.flowType).toBe("AUXILIO_ACIDENTE");
    expect(decision.triageResult).toBe("REVISAO_HUMANA");
  });

  it("rejects decision without flowType when no triage context exists", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await expectBusinessError(
      t.mutation(evaluateConversationTriageRef, {
        sessionToken: session.sessionToken,
        conversationId: "conv_ana_marina",
        triageResult: "APTO",
      }),
      "BAD_REQUEST",
    );
  });

  it("blocks triage update across tenants", async () => {
    const t = await createSeededTestContext();
    const clinicSession = await loginAs(t, "bruna.alves", "Bruna@123456");

    await expectBusinessError(
      t.mutation(evaluateConversationTriageRef, {
        sessionToken: clinicSession.sessionToken,
        conversationId: "conv_ana_marina",
        triageResult: "APTO",
        flowType: "AUXILIO_ACIDENTE",
      }),
      "NOT_FOUND",
    );
  });
});
