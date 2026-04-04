import { v } from "convex/values";
import { requireSession } from "./coreAuth";
import { throwBusinessError } from "./coreErrors";
import { assertId } from "./coreInput";
import { conversationTriageValidator, triageAnswersValidator, triageFlowValidator, triageResultValidator } from "./coreValidators";
import { mutation, query } from "./server";

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

function normalizeList(values?: string[]) {
  if (!values) return [];
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
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
      await ctx.db.insert("conversationTriages", {
        triageId: `triage_${conversationId}`,
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
    triageResult: v.union(v.literal("APTO"), v.literal("REVISAO_HUMANA"), v.literal("NAO_APTO")),
    flowType: v.optional(triageFlowValidator),
    answers: v.optional(triageAnswersValidator),
    reasons: v.optional(v.array(v.string())),
    missingFields: v.optional(v.array(v.string())),
    inconsistencies: v.optional(v.array(v.string())),
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
    const evaluatedAt = Date.now();

    const conversation = await requireConversationForParticipant(ctx.db, {
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

    if (!existing && !args.flowType) {
      throwBusinessError(
        "BAD_REQUEST",
        "flowType is required when triage answers were not previously initialized.",
        {
          tenantId: session.tenantId,
          conversationId,
        },
      );
    }

    const flowType = args.flowType ?? existing?.flowType;
    if (!flowType) {
      throwBusinessError("BAD_REQUEST", "flowType is required when triage answers were not previously initialized.", {
        tenantId: session.tenantId,
        conversationId,
      });
    }
    const answers = {
      ...(existing?.answers ?? {}),
      ...(args.answers ?? {}),
    };
    const reasons = normalizeList(args.reasons);
    const missingFields = normalizeList(args.missingFields);
    const inconsistencies = normalizeList(args.inconsistencies);

    if (existing) {
      await ctx.db.patch(existing._id, {
        flowType,
        answers,
        triageResult: args.triageResult,
        reasons,
        missingFields,
        inconsistencies,
        evaluatedAt,
        updatedAt: evaluatedAt,
      });
    } else {
      await ctx.db.insert("conversationTriages", {
        triageId: `triage_${conversationId}`,
        tenantId: session.tenantId,
        conversationId,
        flowType,
        answers,
        triageResult: args.triageResult,
        reasons,
        missingFields,
        inconsistencies,
        createdAt: evaluatedAt,
        updatedAt: evaluatedAt,
        evaluatedAt,
      });
    }

    await ctx.db.patch(conversation._id, {
      triageResult: args.triageResult,
      lastActivityAt: Math.max(conversation.lastActivityAt, evaluatedAt),
    });

    return {
      conversationId,
      flowType,
      answers,
      triageResult: args.triageResult,
      reasons,
      missingFields,
      inconsistencies,
      createdAt: existing?.createdAt ?? evaluatedAt,
      updatedAt: evaluatedAt,
      evaluatedAt,
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
