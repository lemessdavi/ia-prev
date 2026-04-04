import { v } from "convex/values";
import { internalMutation, mutation, query } from "./server";
import {
  assertTenantAccess,
  findTenantByTenantId,
  findUserAccountByUserId,
  findUserByUserId,
  requireSession,
  requireSuperadmin,
  revokeSessionsByUserId,
  toUserAccountSummary,
} from "./coreAuth";
import { throwBusinessError } from "./coreErrors";
import { assertEmail, assertId, assertTenantName, assertUsername } from "./coreInput";
import { userAccountSummaryValidator, userRoleValidator } from "./coreValidators";

const resetResultValidator = v.object({
  userId: v.string(),
  tenantId: v.string(),
  revokedSessionCount: v.number(),
});

export const listUsers = query({
  args: {
    sessionToken: v.string(),
    tenantId: v.optional(v.string()),
  },
  returns: v.array(userAccountSummaryValidator),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    const requestedTenantId = args.tenantId ? assertId(args.tenantId, "tenantId") : undefined;
    const scopedTenantId =
      session.role === "superadmin"
        ? requestedTenantId
        : assertTenantAccess(session, requestedTenantId ?? session.tenantId);

    const users = scopedTenantId
      ? await ctx.db
          .query("users")
          .withIndex("by_tenant_id", (q: any) => q.eq("tenantId", scopedTenantId))
          .collect()
      : await ctx.db.query("users").withIndex("by_tenant_id").collect();

    const rows = await Promise.all(
      users.map(async (user) => {
        const account = await ctx.db
          .query("userAccounts")
          .withIndex("by_user_id", (q: any) => q.eq("userId", user.userId))
          .unique();
        if (!account) {
          throwBusinessError("NOT_FOUND", "A conta esta vinculada a um usuario desconhecido.", {
            userId: user.userId,
          });
        }

        return toUserAccountSummary({
          userId: user.userId,
          tenantId: user.tenantId,
          username: account.username,
          fullName: user.fullName,
          email: user.email,
          role: account.role,
          isActive: account.isActive,
        });
      }),
    );

    return rows.sort((a, b) => {
      const tenantCompare = a.tenantId.localeCompare(b.tenantId);
      if (tenantCompare !== 0) return tenantCompare;
      return a.username.localeCompare(b.username);
    });
  },
});

export const createTenantUserWithHash = internalMutation({
  args: {
    sessionToken: v.string(),
    userId: v.optional(v.string()),
    tenantId: v.string(),
    username: v.string(),
    fullName: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    role: v.optional(userRoleValidator),
    isActive: v.optional(v.boolean()),
  },
  returns: userAccountSummaryValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const tenantId = assertId(args.tenantId, "tenantId");
    const userId = args.userId ? assertId(args.userId, "userId") : `usr_${crypto.randomUUID()}`;
    const username = assertUsername(args.username);
    const fullName = assertTenantName(args.fullName, "fullName");
    const email = assertEmail(args.email);
    const role = args.role ?? "tenant_user";
    const isActive = args.isActive ?? true;
    const now = Date.now();

    const [tenant, existingUser, existingUsername, existingEmail] = await Promise.all([
      findTenantByTenantId(ctx.db, tenantId),
      findUserByUserId(ctx.db, userId),
      ctx.db
        .query("userAccounts")
        .withIndex("by_username", (q: any) => q.eq("username", username))
        .unique(),
      ctx.db
        .query("users")
        .withIndex("by_tenant_id_and_email", (q: any) => q.eq("tenantId", tenantId).eq("email", email))
        .unique(),
    ]);

    if (!tenant) {
      throwBusinessError("NOT_FOUND", "Tenant nao encontrado.", { tenantId });
    }
    if (existingUser) {
      throwBusinessError("BAD_REQUEST", "O ID de usuario ja existe.", { userId });
    }
    if (existingUsername) {
      throwBusinessError("BAD_REQUEST", "O nome de usuario ja existe.", { username });
    }
    if (existingEmail) {
      throwBusinessError("BAD_REQUEST", "O e-mail ja existe para este tenant.", { tenantId, email });
    }

    await ctx.db.insert("users", {
      userId,
      tenantId,
      username,
      fullName,
      email,
      avatarUrl: "https://cdn.iaprev.com/avatar/default.png",
      createdAt: now,
    });

    await ctx.db.insert("userAccounts", {
      userId,
      username,
      role,
      isActive,
      passwordHash: args.passwordHash,
      passwordUpdatedAt: now,
    });

    return {
      userId,
      tenantId,
      username,
      fullName,
      email,
      role,
      isActive,
    };
  },
});

export const setUserActive = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.string(),
    isActive: v.boolean(),
  },
  returns: v.object({
    userId: v.string(),
    tenantId: v.string(),
    isActive: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const userId = assertId(args.userId, "userId");
    const [user, account] = await Promise.all([findUserByUserId(ctx.db, userId), findUserAccountByUserId(ctx.db, userId)]);
    if (!user || !account) {
      throwBusinessError("NOT_FOUND", "Usuario nao encontrado.", { userId });
    }

    await ctx.db.patch(account._id, {
      isActive: args.isActive,
    });

    if (!args.isActive) {
      await revokeSessionsByUserId(ctx.db, userId);
    }

    return {
      userId,
      tenantId: user.tenantId,
      isActive: args.isActive,
    };
  },
});

export const resetUserPasswordWithHash = internalMutation({
  args: {
    sessionToken: v.string(),
    userId: v.string(),
    passwordHash: v.string(),
  },
  returns: resetResultValidator,
  handler: async (ctx, args) => {
    const session = await requireSession(ctx.db, args.sessionToken);
    requireSuperadmin(session);

    const userId = assertId(args.userId, "userId");
    const [user, account] = await Promise.all([findUserByUserId(ctx.db, userId), findUserAccountByUserId(ctx.db, userId)]);
    if (!user || !account) {
      throwBusinessError("NOT_FOUND", "Usuario nao encontrado.", { userId });
    }

    await ctx.db.patch(account._id, {
      passwordHash: args.passwordHash,
      passwordUpdatedAt: Date.now(),
    });

    const revokedSessionCount = await revokeSessionsByUserId(ctx.db, userId);
    return {
      userId: user.userId,
      tenantId: user.tenantId,
      revokedSessionCount,
    };
  },
});
