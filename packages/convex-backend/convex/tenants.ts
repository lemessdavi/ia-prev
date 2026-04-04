import { v } from "convex/values";
import { mutation, query } from "./server";
import { findTenantByTenantId, requireSession, requireSuperadmin, toTenant } from "./coreAuth";
import { throwBusinessError } from "./coreErrors";
import { assertId, assertSlug, assertTenantName } from "./coreInput";
import { tenantValidator } from "./coreValidators";

export const listTenants = query({
  args: { sessionToken: v.string() },
  returns: v.array(tenantValidator),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const rows = await ctx.db.query("tenants").withIndex("by_slug").collect();
    return rows.map((tenant) => toTenant(tenant));
  },
});

export const createTenant = mutation({
  args: {
    sessionToken: v.string(),
    id: v.optional(v.string()),
    slug: v.string(),
    name: v.string(),
    isActive: v.optional(v.boolean()),
  },
  returns: tenantValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const tenantId = args.id ? assertId(args.id, "id") : `tenant_${crypto.randomUUID()}`;
    const slug = assertSlug(args.slug, "slug");
    const name = assertTenantName(args.name, "name");
    const isActive = args.isActive ?? true;
    const createdAt = Date.now();

    const [tenantById, tenantBySlug] = await Promise.all([
      findTenantByTenantId(ctx.db, tenantId),
      ctx.db
        .query("tenants")
        .withIndex("by_slug", (q: any) => q.eq("slug", slug))
        .unique(),
    ]);

    if (tenantById) {
      throwBusinessError("BAD_REQUEST", "O ID do tenant ja existe.", { tenantId });
    }

    if (tenantBySlug) {
      throwBusinessError("BAD_REQUEST", "O slug do tenant ja existe.", { slug });
    }

    await ctx.db.insert("tenants", {
      tenantId,
      slug,
      name,
      isActive,
      createdAt,
    });

    return {
      id: tenantId,
      slug,
      name,
      isActive,
      createdAt,
    };
  },
});

export const updateTenant = mutation({
  args: {
    sessionToken: v.string(),
    tenantId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  returns: tenantValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const tenantId = assertId(args.tenantId, "tenantId");
    const existing = await findTenantByTenantId(ctx.db, tenantId);
    if (!existing) {
      throwBusinessError("NOT_FOUND", "Tenant nao encontrado.", { tenantId });
    }

    const name = args.name !== undefined ? assertTenantName(args.name, "name") : existing.name;
    const slug = args.slug !== undefined ? assertSlug(args.slug, "slug") : existing.slug;
    const isActive = args.isActive ?? existing.isActive;

    const tenantWithSlug = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .unique();
    if (tenantWithSlug && tenantWithSlug.tenantId !== tenantId) {
      throwBusinessError("BAD_REQUEST", "O slug do tenant ja existe.", { slug });
    }

    await ctx.db.patch(existing._id, { name, slug, isActive });
    return {
      id: tenantId,
      slug,
      name,
      isActive,
      createdAt: existing.createdAt,
    };
  },
});
