import { v } from "convex/values";
import { mutation, query } from "./server";
import { findTenantByTenantId, requireSession, requireSuperadmin } from "./coreAuth";
import { throwBusinessError } from "./coreErrors";
import { assertId, assertTenantName } from "./coreInput";
import { tenantWabaAccountSummaryValidator } from "./coreValidators";

const resolvedTenantValidator = v.object({
  tenantId: v.string(),
  wabaAccountId: v.string(),
  displayName: v.string(),
});

function toWabaSummary(row: {
  tenantId: string;
  phoneNumberId: string;
  wabaAccountId: string;
  displayName: string;
  createdAt: number;
}) {
  return {
    id: `waba_map_${row.tenantId}`,
    tenantId: row.tenantId,
    phoneNumberId: row.phoneNumberId,
    wabaAccountId: row.wabaAccountId,
    displayName: row.displayName,
    createdAt: row.createdAt,
  };
}

export const listTenantWabaAccounts = query({
  args: {
    sessionToken: v.string(),
    tenantId: v.optional(v.string()),
  },
  returns: v.array(tenantWabaAccountSummaryValidator),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const requestedTenantId = args.tenantId ? assertId(args.tenantId, "tenantId") : undefined;
    const rows = requestedTenantId
      ? await ctx.db
          .query("wabaTenantMappings")
          .withIndex("by_tenant", (q: any) => q.eq("tenantId", requestedTenantId))
          .collect()
      : await ctx.db.query("wabaTenantMappings").withIndex("by_tenant").collect();

    return rows.filter((row) => row.isActive).map((row) => toWabaSummary(row));
  },
});

export const upsertTenantWabaAccount = mutation({
  args: {
    sessionToken: v.string(),
    tenantId: v.string(),
    phoneNumberId: v.string(),
    wabaAccountId: v.string(),
    displayName: v.string(),
  },
  returns: tenantWabaAccountSummaryValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const tenantId = assertId(args.tenantId, "tenantId");
    const phoneNumberId = assertId(args.phoneNumberId, "phoneNumberId");
    const wabaAccountId = assertId(args.wabaAccountId, "wabaAccountId");
    const displayName = assertTenantName(args.displayName, "displayName");

    const [tenant, phoneOwner, existingTenantMappings] = await Promise.all([
      findTenantByTenantId(ctx.db, tenantId),
      ctx.db
        .query("wabaTenantMappings")
        .withIndex("by_phone_number_id", (q: any) => q.eq("phoneNumberId", phoneNumberId))
        .unique(),
      ctx.db
        .query("wabaTenantMappings")
        .withIndex("by_tenant", (q: any) => q.eq("tenantId", tenantId))
        .collect(),
    ]);

    if (!tenant) {
      throwBusinessError("NOT_FOUND", "Tenant nao encontrado.", { tenantId });
    }

    if (phoneOwner && phoneOwner.tenantId !== tenantId) {
      throwBusinessError("BAD_REQUEST", "O phone_number_id ja esta mapeado para outro tenant.", {
        phoneNumberId,
        tenantId: phoneOwner.tenantId,
      });
    }

    const existing = existingTenantMappings[0];
    if (
      existing &&
      existing.phoneNumberId === phoneNumberId &&
      existing.wabaAccountId === wabaAccountId &&
      existing.displayName === displayName &&
      existing.isActive
    ) {
      return toWabaSummary(existing);
    }

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        phoneNumberId,
        wabaAccountId,
        displayName,
        isActive: true,
        updatedAt: now,
      });
      return {
        id: `waba_map_${tenantId}`,
        tenantId,
        phoneNumberId,
        wabaAccountId,
        displayName,
        createdAt: existing.createdAt,
      };
    }

    await ctx.db.insert("wabaTenantMappings", {
      tenantId,
      phoneNumberId,
      wabaAccountId,
      displayName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: `waba_map_${tenantId}`,
      tenantId,
      phoneNumberId,
      wabaAccountId,
      displayName,
      createdAt: now,
    };
  },
});

export const resolveTenantByPhoneNumberId = query({
  args: { phoneNumberId: v.string() },
  returns: resolvedTenantValidator,
  handler: async (ctx, args) => {
    const phoneNumberId = assertId(args.phoneNumberId, "phoneNumberId");
    const mapping = await ctx.db
      .query("wabaTenantMappings")
      .withIndex("by_phone_number_id", (q: any) => q.eq("phoneNumberId", phoneNumberId))
      .unique();

    if (!mapping || !mapping.isActive) {
      throwBusinessError("NOT_FOUND", "Mapeamento WABA nao encontrado para o phone_number_id.", { phoneNumberId });
    }

    return {
      tenantId: mapping.tenantId,
      wabaAccountId: mapping.wabaAccountId,
      displayName: mapping.displayName,
    };
  },
});
