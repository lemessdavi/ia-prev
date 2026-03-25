"use node";

import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { action } from "./server";
import { assertPassword } from "./coreInput";
import { hashPassword } from "./corePassword";
import { userAccountSummaryValidator } from "./coreValidators";

const createTenantUserWithHashRef = makeFunctionReference<"mutation">("users:createTenantUserWithHash");
const resetUserPasswordWithHashRef = makeFunctionReference<"mutation">("users:resetUserPasswordWithHash");

const resetResultValidator = v.object({
  userId: v.string(),
  tenantId: v.string(),
  revokedSessionCount: v.number(),
});

export const createTenantUser = action({
  args: {
    sessionToken: v.string(),
    userId: v.optional(v.string()),
    tenantId: v.string(),
    username: v.string(),
    fullName: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.optional(v.union(v.literal("superadmin"), v.literal("tenant_user"))),
    isActive: v.optional(v.boolean()),
  },
  returns: userAccountSummaryValidator,
  handler: async (ctx, args) => {
    const passwordHash = hashPassword(assertPassword(args.password, "password"));
    return await ctx.runMutation(createTenantUserWithHashRef, {
      sessionToken: args.sessionToken,
      userId: args.userId,
      tenantId: args.tenantId,
      username: args.username,
      fullName: args.fullName,
      email: args.email,
      passwordHash,
      role: args.role,
      isActive: args.isActive,
    });
  },
});

export const resetUserPassword = action({
  args: {
    sessionToken: v.string(),
    userId: v.string(),
    nextPassword: v.string(),
  },
  returns: resetResultValidator,
  handler: async (ctx, args) => {
    const passwordHash = hashPassword(assertPassword(args.nextPassword, "nextPassword"));
    return await ctx.runMutation(resetUserPasswordWithHashRef, {
      sessionToken: args.sessionToken,
      userId: args.userId,
      passwordHash,
    });
  },
});
