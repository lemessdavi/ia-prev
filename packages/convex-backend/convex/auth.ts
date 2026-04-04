import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./server";
import {
  findSessionByToken,
  findUserAccountByUserId,
  findUserByUserId,
  requireSession,
} from "./coreAuth";
import { sessionValidator, userRoleValidator } from "./coreValidators";

const loginAccountValidator = v.union(
  v.object({
    userId: v.string(),
    tenantId: v.string(),
    role: userRoleValidator,
    isActive: v.boolean(),
    passwordHash: v.string(),
    username: v.string(),
  }),
  v.null(),
);

export const getLoginAccount = internalQuery({
  args: { username: v.string() },
  returns: loginAccountValidator,
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("userAccounts")
      .withIndex("by_username", (q: any) => q.eq("username", args.username))
      .unique();
    if (!account) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q: any) => q.eq("userId", account.userId))
      .unique();
    if (!user) return null;

    return {
      userId: user.userId,
      tenantId: user.tenantId,
      role: account.role,
      isActive: account.isActive,
      passwordHash: account.passwordHash,
      username: account.username,
    };
  },
});

export const createSessionInternal = internalMutation({
  args: {
    sessionToken: v.string(),
    userId: v.string(),
    tenantId: v.string(),
    role: userRoleValidator,
    createdAt: v.number(),
  },
  returns: sessionValidator,
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", {
      sessionToken: args.sessionToken,
      userId: args.userId,
      tenantId: args.tenantId,
      role: args.role,
      createdAt: args.createdAt,
    });

    return {
      sessionToken: args.sessionToken,
      userId: args.userId,
      tenantId: args.tenantId,
      role: args.role,
      createdAt: args.createdAt,
    };
  },
});

export const getSession = query({
  args: { sessionToken: v.string() },
  returns: v.union(sessionValidator, v.null()),
  handler: async (ctx, args) => {
    try {
      return await requireSession(ctx.db, args.sessionToken);
    } catch (error) {
      const data = (error as { data?: { code?: string } }).data;
      if (data?.code === "UNAUTHENTICATED") {
        return null;
      }
      throw error;
    }
  },
});

export const logout = mutation({
  args: { sessionToken: v.string() },
  returns: v.object({
    revoked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const session = await findSessionByToken(ctx.db, args.sessionToken);
    if (!session) {
      return { revoked: false };
    }

    await ctx.db.delete(session._id);
    return { revoked: true };
  },
});

export const validateSessionInternal = internalQuery({
  args: { sessionToken: v.string() },
  returns: v.union(sessionValidator, v.null()),
  handler: async (ctx, args) => {
    const session = await findSessionByToken(ctx.db, args.sessionToken);
    if (!session) {
      return null;
    }

    const [user, account] = await Promise.all([
      findUserByUserId(ctx.db, session.userId),
      findUserAccountByUserId(ctx.db, session.userId),
    ]);

    if (!user || !account || !account.isActive) {
      return null;
    }

    if (user.tenantId !== session.tenantId || account.role !== session.role) {
      return null;
    }

    return {
      sessionToken: session.sessionToken,
      userId: session.userId,
      tenantId: session.tenantId,
      role: session.role,
      createdAt: session.createdAt,
    };
  },
});
