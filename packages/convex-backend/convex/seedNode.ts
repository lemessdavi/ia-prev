"use node";

import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { action } from "./server";
import { throwBusinessError } from "./coreErrors";
import { hashPassword } from "./corePassword";

const seedFixturesInternalRef = makeFunctionReference<"mutation">("seed:seedFixturesInternal");

const seedResultValidator = v.object({
  seeded: v.boolean(),
  tenantCount: v.number(),
  userCount: v.number(),
  conversationCount: v.number(),
});

export const seedDemoData = action({
  args: {
    seedKey: v.optional(v.string()),
  },
  returns: seedResultValidator,
  handler: async (ctx, args) => {
    const expectedSeedKey = process.env.DEMO_SEED_KEY;
    if (expectedSeedKey && args.seedKey !== expectedSeedKey) {
      throwBusinessError("FORBIDDEN", "Chave de seed invalida.");
    }

    return await ctx.runMutation(seedFixturesInternalRef, {
      passwordHashes: {
        ana: hashPassword("Ana@123456"),
        caio: hashPassword("Caio@123456"),
        marina: hashPassword("Marina@123456"),
        paulo: hashPassword("Paulo@123456"),
        superadmin: hashPassword("Root@123456"),
        bruna: hashPassword("Bruna@123456"),
        joao: hashPassword("Joao@123456"),
      },
    });
  },
});
