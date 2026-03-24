import { v } from "convex/values";
import { mutation, query } from "./server";
import { findTenantByTenantId, requireSession, requireSuperadmin, toAiProfile } from "./coreAuth";
import { throwBusinessError } from "./coreErrors";
import { assertId, assertTenantName } from "./coreInput";
import { aiProfileValidator } from "./coreValidators";

async function activateProfileForTenant(db: any, tenantId: string, profileId: string) {
  const profiles = await db
    .query("aiProfiles")
    .withIndex("by_tenant_id", (q: any) => q.eq("tenantId", tenantId))
    .collect();

  let activeProfile: (typeof profiles)[number] | null = null;
  await Promise.all(
    profiles.map(async (profile: any) => {
      const shouldBeActive = profile.profileId === profileId;
      if (profile.isActive === shouldBeActive) {
        if (shouldBeActive) activeProfile = profile;
        return;
      }

      await db.patch(profile._id, { isActive: shouldBeActive });
      if (shouldBeActive) {
        activeProfile = {
          ...profile,
          isActive: true,
        };
      }
    }),
  );

  if (!activeProfile) {
    throwBusinessError("NOT_FOUND", "AI profile not found for this tenant.", { tenantId, profileId });
  }

  return toAiProfile(activeProfile);
}

export const listAiProfiles = query({
  args: {
    sessionToken: v.string(),
    tenantId: v.string(),
  },
  returns: v.array(aiProfileValidator),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const tenantId = assertId(args.tenantId, "tenantId");
    const rows = await ctx.db
      .query("aiProfiles")
      .withIndex("by_tenant_id", (q: any) => q.eq("tenantId", tenantId))
      .collect();

    return rows.map((row) => toAiProfile(row)).sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createAiProfile = mutation({
  args: {
    sessionToken: v.string(),
    id: v.optional(v.string()),
    tenantId: v.string(),
    name: v.string(),
    provider: v.string(),
    model: v.string(),
    credentialsRef: v.string(),
    isActive: v.optional(v.boolean()),
  },
  returns: aiProfileValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const tenantId = assertId(args.tenantId, "tenantId");
    const profileId = args.id ? assertId(args.id, "id") : `aip_${crypto.randomUUID()}`;
    const name = assertTenantName(args.name, "name");
    const provider = assertId(args.provider, "provider");
    const model = assertId(args.model, "model");
    const credentialsRef = assertId(args.credentialsRef, "credentialsRef");
    const now = Date.now();

    const [tenant, existing] = await Promise.all([
      findTenantByTenantId(ctx.db, tenantId),
      ctx.db
        .query("aiProfiles")
        .withIndex("by_profile_id", (q: any) => q.eq("profileId", profileId))
        .unique(),
    ]);

    if (!tenant) {
      throwBusinessError("NOT_FOUND", "Tenant not found.", { tenantId });
    }
    if (existing) {
      throwBusinessError("BAD_REQUEST", "AI profile id already exists.", { id: profileId });
    }

    const insertedId = await ctx.db.insert("aiProfiles", {
      profileId,
      tenantId,
      name,
      provider,
      model,
      credentialsRef,
      isActive: false,
      createdAt: now,
    });

    if (args.isActive) {
      return await activateProfileForTenant(ctx.db, tenantId, profileId);
    }

    const hasActiveProfile = await ctx.db
      .query("aiProfiles")
      .withIndex("by_tenant_id_and_active", (q: any) => q.eq("tenantId", tenantId).eq("isActive", true))
      .first();
    if (!hasActiveProfile) {
      return await activateProfileForTenant(ctx.db, tenantId, profileId);
    }

    const inserted = await ctx.db.get(insertedId);
    if (!inserted) {
      throwBusinessError("NOT_FOUND", "AI profile not found.", { id: profileId, tenantId });
    }

    return toAiProfile(inserted);
  },
});

export const setActiveAiProfile = mutation({
  args: {
    sessionToken: v.string(),
    tenantId: v.string(),
    profileId: v.string(),
  },
  returns: aiProfileValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const tenantId = assertId(args.tenantId, "tenantId");
    const profileId = assertId(args.profileId, "profileId");
    const profile = await ctx.db
      .query("aiProfiles")
      .withIndex("by_profile_id", (q: any) => q.eq("profileId", profileId))
      .unique();

    if (!profile || profile.tenantId !== tenantId) {
      throwBusinessError("NOT_FOUND", "AI profile not found for this tenant.", {
        tenantId,
        profileId,
      });
    }

    return await activateProfileForTenant(ctx.db, tenantId, profileId);
  },
});
