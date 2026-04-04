"use node";

import { randomUUID } from "node:crypto";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { action } from "./server";
import { throwBusinessError } from "./coreErrors";
import { assertPassword, assertUsername } from "./coreInput";
import { verifyPassword } from "./corePassword";
import { sessionValidator } from "./coreValidators";

const getLoginAccountRef = makeFunctionReference<"query">("auth:getLoginAccount");
const createSessionRef = makeFunctionReference<"mutation">("auth:createSessionInternal");

export const loginWithUsernamePassword = action({
  args: {
    username: v.string(),
    password: v.string(),
  },
  returns: sessionValidator,
  handler: async (ctx, args) => {
    const username = assertUsername(args.username);
    const password = assertPassword(args.password);

    const loginAccount = await ctx.runQuery(getLoginAccountRef, { username });
    if (!loginAccount || !verifyPassword(password, loginAccount.passwordHash)) {
      throwBusinessError("UNAUTHENTICATED", "Usuario ou senha invalidos.", { username });
    }

    if (!loginAccount.isActive) {
      throwBusinessError("FORBIDDEN", "Este usuario esta desativado.", {
        username,
        userId: loginAccount.userId,
      });
    }

    const createdAt = Date.now();
    return await ctx.runMutation(createSessionRef, {
      sessionToken: `sess_${randomUUID()}`,
      userId: loginAccount.userId,
      tenantId: loginAccount.tenantId,
      role: loginAccount.role,
      createdAt,
    });
  },
});
