import { v } from "convex/values";
import { requireSession } from "./coreAuth";
import { throwBusinessError } from "./coreErrors";
import { assertId } from "./coreInput";
import {
  conversationTriageValidator,
  triageAnswersValidator,
  triageFlowValidator,
  triageResultValidator,
} from "./coreValidators";
import { mutation, query } from "./server";

type FlowType = "AUXILIO_ACIDENTE" | "APOSENTADORIA_ANTECIPADA";

type TriageAnswers = {
  teveAcidente?: boolean;
  possuiSequelaConsolidada?: boolean;
  reducaoCapacidadeLaboral?: boolean;
  possuiQualidadeSegurado?: boolean;
  anoAcidente?: number;
  idade?: number;
  tempoContribuicaoAnos?: number;
  possuiCarenciaMinima?: boolean;
  possuiTempoEspecialComprovado?: boolean;
};

type EvaluatedTriage = {
  triageResult: "APTO" | "REVISAO_HUMANA" | "NAO_APTO";
  reasons: string[];
  missingFields: string[];
  inconsistencies: string[];
  evaluatedAt: number;
};

async function requireTenantConversation(db: any, input: { tenantId: string; conversationId: string }) {
  const conversation = await db
    .query("conversations")
    .withIndex("by_conversation_id", (q: any) => q.eq("conversationId", input.conversationId))
    .unique();

  if (!conversation || conversation.tenantId !== input.tenantId) {
    throwBusinessError("NOT_FOUND", "Conversation not found.", {
      conversationId: input.conversationId,
      tenantId: input.tenantId,
    });
  }

  return conversation;
}

async function requireConversationForParticipant(db: any, input: { tenantId: string; conversationId: string; userId: string }) {
  const conversation = await requireTenantConversation(db, {
    tenantId: input.tenantId,
    conversationId: input.conversationId,
  });

  const membership = await db
    .query("conversationMemberships")
    .withIndex("by_tenant_id_and_conversation_id_and_user_id", (q: any) =>
      q.eq("tenantId", input.tenantId).eq("conversationId", input.conversationId).eq("userId", input.userId),
    )
    .unique();

  if (!membership) {
    throwBusinessError("FORBIDDEN", "You cannot update triage for this conversation.", {
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      userId: input.userId,
    });
  }

  return conversation;
}

function missingAuxilioFields(answers: TriageAnswers) {
  const requiredBooleans: Array<keyof TriageAnswers> = [
    "teveAcidente",
    "possuiSequelaConsolidada",
    "reducaoCapacidadeLaboral",
    "possuiQualidadeSegurado",
  ];

  const missing = requiredBooleans
    .filter((field) => typeof answers[field] !== "boolean")
    .map((field) => String(field));

  if (typeof answers.anoAcidente !== "number") {
    missing.push("anoAcidente");
  }

  return missing;
}

function missingAposentadoriaFields(answers: TriageAnswers) {
  const missing: string[] = [];

  if (typeof answers.idade !== "number") missing.push("idade");
  if (typeof answers.tempoContribuicaoAnos !== "number") missing.push("tempoContribuicaoAnos");
  if (typeof answers.possuiCarenciaMinima !== "boolean") missing.push("possuiCarenciaMinima");
  if (typeof answers.possuiTempoEspecialComprovado !== "boolean") missing.push("possuiTempoEspecialComprovado");

  return missing;
}

function evaluateAuxilioAcidente(answers: TriageAnswers): Omit<EvaluatedTriage, "evaluatedAt"> {
  const missingFields = missingAuxilioFields(answers);
  const inconsistencies: string[] = [];
  const reasons: string[] = [];

  const currentYear = new Date().getFullYear();
  if (typeof answers.anoAcidente === "number") {
    if (!Number.isInteger(answers.anoAcidente) || answers.anoAcidente < 1900 || answers.anoAcidente > currentYear) {
      inconsistencies.push("anoAcidente fora do intervalo valido.");
    }
  }

  if (missingFields.length > 0 || inconsistencies.length > 0) {
    return {
      triageResult: "REVISAO_HUMANA",
      reasons: ["AUXILIO_ACIDENTE: dados incompletos ou inconsistentes para decisao automatica."],
      missingFields,
      inconsistencies,
    };
  }

  if (answers.teveAcidente === false) {
    reasons.push("AUXILIO_ACIDENTE: teveAcidente deve ser true.");
  }
  if (answers.possuiSequelaConsolidada === false) {
    reasons.push("AUXILIO_ACIDENTE: possuiSequelaConsolidada deve ser true.");
  }
  if (answers.reducaoCapacidadeLaboral === false) {
    reasons.push("AUXILIO_ACIDENTE: reducaoCapacidadeLaboral deve ser true.");
  }
  if (answers.possuiQualidadeSegurado === false) {
    reasons.push("AUXILIO_ACIDENTE: possuiQualidadeSegurado deve ser true.");
  }

  if (reasons.length > 0) {
    return {
      triageResult: "NAO_APTO",
      reasons,
      missingFields,
      inconsistencies,
    };
  }

  return {
    triageResult: "APTO",
    reasons: ["AUXILIO_ACIDENTE: criterios minimos atendidos."],
    missingFields,
    inconsistencies,
  };
}

function evaluateAposentadoriaAntecipada(answers: TriageAnswers): Omit<EvaluatedTriage, "evaluatedAt"> {
  const missingFields = missingAposentadoriaFields(answers);
  const inconsistencies: string[] = [];
  const reasons: string[] = [];

  if (typeof answers.idade === "number") {
    if (!Number.isFinite(answers.idade) || answers.idade < 14 || answers.idade > 100) {
      inconsistencies.push("idade fora do intervalo valido.");
    }
  }

  if (typeof answers.tempoContribuicaoAnos === "number") {
    if (!Number.isFinite(answers.tempoContribuicaoAnos) || answers.tempoContribuicaoAnos < 0 || answers.tempoContribuicaoAnos > 60) {
      inconsistencies.push("tempoContribuicaoAnos fora do intervalo valido.");
    }
  }

  if (
    typeof answers.idade === "number" &&
    typeof answers.tempoContribuicaoAnos === "number" &&
    answers.tempoContribuicaoAnos > answers.idade - 14
  ) {
    inconsistencies.push("tempoContribuicaoAnos nao pode exceder idade - 14.");
  }

  if (missingFields.length > 0 || inconsistencies.length > 0) {
    return {
      triageResult: "REVISAO_HUMANA",
      reasons: ["APOSENTADORIA_ANTECIPADA: dados incompletos ou inconsistentes para decisao automatica."],
      missingFields,
      inconsistencies,
    };
  }

  if (typeof answers.idade === "number" && answers.idade < 50) {
    reasons.push("APOSENTADORIA_ANTECIPADA: idade minima de 50 anos nao atendida.");
  }
  if (typeof answers.tempoContribuicaoAnos === "number" && answers.tempoContribuicaoAnos < 25) {
    reasons.push("APOSENTADORIA_ANTECIPADA: tempo minimo de contribuicao de 25 anos nao atendido.");
  }
  if (answers.possuiCarenciaMinima === false) {
    reasons.push("APOSENTADORIA_ANTECIPADA: possuiCarenciaMinima deve ser true.");
  }
  if (answers.possuiTempoEspecialComprovado === false) {
    reasons.push("APOSENTADORIA_ANTECIPADA: possuiTempoEspecialComprovado deve ser true.");
  }

  if (reasons.length > 0) {
    return {
      triageResult: "NAO_APTO",
      reasons,
      missingFields,
      inconsistencies,
    };
  }

  return {
    triageResult: "APTO",
    reasons: ["APOSENTADORIA_ANTECIPADA: criterios minimos atendidos."],
    missingFields,
    inconsistencies,
  };
}

function evaluateByFlow(flowType: FlowType, answers: TriageAnswers): EvaluatedTriage {
  const base =
    flowType === "AUXILIO_ACIDENTE" ? evaluateAuxilioAcidente(answers) : evaluateAposentadoriaAntecipada(answers);

  return {
    ...base,
    evaluatedAt: Date.now(),
  };
}

function toConversationTriagePayload(row: any) {
  return {
    conversationId: row.conversationId,
    flowType: row.flowType,
    answers: row.answers,
    triageResult: row.triageResult,
    reasons: row.reasons,
    missingFields: row.missingFields,
    inconsistencies: row.inconsistencies,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    evaluatedAt: row.evaluatedAt,
  };
}

export const upsertTriageAnswers = mutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
    flowType: triageFlowValidator,
    answers: triageAnswersValidator,
  },
  returns: conversationTriageValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");
    const now = Date.now();

    await requireConversationForParticipant(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
      userId: session.userId,
    });

    const existing = await ctx.db
      .query("conversationTriages")
      .withIndex("by_tenant_id_and_conversation_id", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
      )
      .unique();

    const baseAnswers = existing && existing.flowType === args.flowType ? existing.answers : {};
    const mergedAnswers = {
      ...baseAnswers,
      ...args.answers,
    };

    if (!existing) {
      const triageId = `triage_${conversationId}`;
      await ctx.db.insert("conversationTriages", {
        triageId,
        tenantId: session.tenantId,
        conversationId,
        flowType: args.flowType,
        answers: mergedAnswers,
        triageResult: "N_A",
        reasons: [],
        missingFields: [],
        inconsistencies: [],
        createdAt: now,
        updatedAt: now,
      });

      return {
        conversationId,
        flowType: args.flowType,
        answers: mergedAnswers,
        triageResult: "N_A" as const,
        reasons: [],
        missingFields: [],
        inconsistencies: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    await ctx.db.patch(existing._id, {
      flowType: args.flowType,
      answers: mergedAnswers,
      triageResult: "N_A",
      reasons: [],
      missingFields: [],
      inconsistencies: [],
      updatedAt: now,
      evaluatedAt: undefined,
    });

    return {
      conversationId,
      flowType: args.flowType,
      answers: mergedAnswers,
      triageResult: "N_A" as const,
      reasons: [],
      missingFields: [],
      inconsistencies: [],
      createdAt: existing.createdAt,
      updatedAt: now,
      evaluatedAt: undefined,
    };
  },
});

export const evaluateConversationTriage = mutation({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: v.object({
    conversationId: v.string(),
    flowType: triageFlowValidator,
    answers: triageAnswersValidator,
    triageResult: triageResultValidator,
    reasons: v.array(v.string()),
    missingFields: v.array(v.string()),
    inconsistencies: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    evaluatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");

    const conversation = await requireConversationForParticipant(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
      userId: session.userId,
    });

    const triage = await ctx.db
      .query("conversationTriages")
      .withIndex("by_tenant_id_and_conversation_id", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
      )
      .unique();

    if (!triage) {
      throwBusinessError("BAD_REQUEST", "Triage answers were not provided for this conversation.", {
        tenantId: session.tenantId,
        conversationId,
      });
    }

    const evaluated = evaluateByFlow(triage.flowType, triage.answers);

    await ctx.db.patch(triage._id, {
      triageResult: evaluated.triageResult,
      reasons: evaluated.reasons,
      missingFields: evaluated.missingFields,
      inconsistencies: evaluated.inconsistencies,
      evaluatedAt: evaluated.evaluatedAt,
      updatedAt: evaluated.evaluatedAt,
    });

    await ctx.db.patch(conversation._id, {
      triageResult: evaluated.triageResult,
      lastActivityAt: Math.max(conversation.lastActivityAt, evaluated.evaluatedAt),
    });

    return {
      conversationId,
      flowType: triage.flowType,
      answers: triage.answers,
      triageResult: evaluated.triageResult,
      reasons: evaluated.reasons,
      missingFields: evaluated.missingFields,
      inconsistencies: evaluated.inconsistencies,
      createdAt: triage.createdAt,
      updatedAt: evaluated.evaluatedAt,
      evaluatedAt: evaluated.evaluatedAt,
    };
  },
});

export const getConversationTriage = query({
  args: {
    sessionToken: v.string(),
    conversationId: v.string(),
  },
  returns: v.union(conversationTriageValidator, v.null()),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const conversationId = assertId(args.conversationId, "conversationId");

    await requireConversationForParticipant(ctx.db, {
      tenantId: session.tenantId,
      conversationId,
      userId: session.userId,
    });

    const triage = await ctx.db
      .query("conversationTriages")
      .withIndex("by_tenant_id_and_conversation_id", (q: any) =>
        q.eq("tenantId", session.tenantId).eq("conversationId", conversationId),
      )
      .unique();

    if (!triage) {
      return null;
    }

    return toConversationTriagePayload(triage);
  },
});
