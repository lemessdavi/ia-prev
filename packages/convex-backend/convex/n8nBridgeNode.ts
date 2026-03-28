"use node";

import { v } from "convex/values";
import { internalAction } from "./server";

const secretCheckValidator = v.object({
  configured: v.boolean(),
  authorized: v.boolean(),
});

export const verifyN8nIntegrationSecret = internalAction({
  args: {
    providedSecret: v.optional(v.string()),
  },
  returns: secretCheckValidator,
  handler: async (_ctx, args) => {
    const expectedSecret = process.env.N8N_INTEGRATION_SECRET?.trim();

    if (!expectedSecret) {
      return {
        configured: false,
        authorized: false,
      };
    }

    return {
      configured: true,
      authorized: (args.providedSecret?.trim() ?? "") === expectedSecret,
    };
  },
});
