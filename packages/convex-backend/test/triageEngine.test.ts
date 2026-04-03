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

describe("triageEngine eligibility evaluation", () => {
  it("marks AUXILIO_ACIDENTE as APTO when required answers are complete and consistent", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "AUXILIO_ACIDENTE",
      answers: {
        teveAcidente: true,
        possuiSequelaConsolidada: true,
        reducaoCapacidadeLaboral: true,
        possuiQualidadeSegurado: true,
        anoAcidente: 2020,
      },
    });

    const evaluation = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });

    expect(evaluation.triageResult).toBe("APTO");

    const thread = await t.query(getConversationThreadRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });
    expect(thread.triageResult).toBe("APTO");
  }, 15_000);

  it("marks AUXILIO_ACIDENTE as NAO_APTO when minimum criteria are explicitly not met (RN-03)", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "AUXILIO_ACIDENTE",
      answers: {
        teveAcidente: true,
        possuiSequelaConsolidada: false,
        reducaoCapacidadeLaboral: true,
        possuiQualidadeSegurado: true,
        anoAcidente: 2018,
      },
    });

    const evaluation = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });

    expect(evaluation.triageResult).toBe("NAO_APTO");
    expect(evaluation.reasons).toContain("AUXILIO_ACIDENTE: possuiSequelaConsolidada deve ser true.");
  });

  it("marks AUXILIO_ACIDENTE as REVISAO_HUMANA when critical gaps exist (RN-04)", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "AUXILIO_ACIDENTE",
      answers: {
        teveAcidente: true,
        possuiSequelaConsolidada: true,
        reducaoCapacidadeLaboral: true,
        possuiQualidadeSegurado: true,
      },
    });

    const evaluation = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });

    expect(evaluation.triageResult).toBe("REVISAO_HUMANA");
    expect(evaluation.missingFields).toContain("anoAcidente");
  });

  it("marks APOSENTADORIA_ANTECIPADA as APTO when required answers are complete and consistent", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "APOSENTADORIA_ANTECIPADA",
      answers: {
        idade: 58,
        tempoContribuicaoAnos: 32,
        possuiCarenciaMinima: true,
        possuiTempoEspecialComprovado: true,
      },
    });

    const evaluation = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });

    expect(evaluation.triageResult).toBe("APTO");
  });

  it("marks APOSENTADORIA_ANTECIPADA as NAO_APTO when minimum criteria are explicitly not met (RN-03)", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "APOSENTADORIA_ANTECIPADA",
      answers: {
        idade: 45,
        tempoContribuicaoAnos: 20,
        possuiCarenciaMinima: true,
        possuiTempoEspecialComprovado: true,
      },
    });

    const evaluation = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });

    expect(evaluation.triageResult).toBe("NAO_APTO");
    expect(evaluation.reasons).toContain("APOSENTADORIA_ANTECIPADA: idade minima de 50 anos nao atendida.");
  });

  it("marks APOSENTADORIA_ANTECIPADA as REVISAO_HUMANA when there is critical inconsistency (RN-04)", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "APOSENTADORIA_ANTECIPADA",
      answers: {
        idade: 45,
        tempoContribuicaoAnos: 40,
        possuiCarenciaMinima: true,
        possuiTempoEspecialComprovado: true,
      },
    });

    const evaluation = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });

    expect(evaluation.triageResult).toBe("REVISAO_HUMANA");
    expect(evaluation.inconsistencies).toContain("tempoContribuicaoAnos nao pode exceder idade - 14.");
  });

  it("supports re-evaluation after triage answers update", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "APOSENTADORIA_ANTECIPADA",
      answers: {
        idade: 45,
        tempoContribuicaoAnos: 20,
        possuiCarenciaMinima: true,
        possuiTempoEspecialComprovado: true,
      },
    });

    const first = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });
    expect(first.triageResult).toBe("NAO_APTO");

    await t.mutation(upsertTriageAnswersRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
      flowType: "APOSENTADORIA_ANTECIPADA",
      answers: {
        idade: 58,
        tempoContribuicaoAnos: 33,
        possuiCarenciaMinima: true,
        possuiTempoEspecialComprovado: true,
      },
    });

    const second = await t.mutation(evaluateConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });

    expect(second.triageResult).toBe("APTO");

    const triage = await t.query(getConversationTriageRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_marina",
    });

    expect(triage.flowType).toBe("APOSENTADORIA_ANTECIPADA");
    expect(triage.triageResult).toBe("APTO");
  });

  it("blocks triage update across tenants", async () => {
    const t = await createSeededTestContext();
    const clinicSession = await loginAs(t, "bruna.alves", "Bruna@123456");

    await expectBusinessError(
      t.mutation(upsertTriageAnswersRef, {
        sessionToken: clinicSession.sessionToken,
        conversationId: "conv_ana_marina",
        flowType: "AUXILIO_ACIDENTE",
        answers: {
          teveAcidente: true,
          possuiSequelaConsolidada: true,
          reducaoCapacidadeLaboral: true,
          possuiQualidadeSegurado: true,
          anoAcidente: 2019,
        },
      }),
      "NOT_FOUND",
    );
  });
});
