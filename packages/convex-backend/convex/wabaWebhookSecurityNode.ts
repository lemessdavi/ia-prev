"use node";

import { createHmac, timingSafeEqual } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "./server";

const verifyTokenResultValidator = v.object({
  configured: v.boolean(),
  valid: v.boolean(),
});

const verifySignatureResultValidator = v.object({
  configured: v.boolean(),
  valid: v.boolean(),
  missingSignature: v.boolean(),
});

export const verifyWebhookVerifyToken = internalAction({
  args: {
    providedToken: v.optional(v.string()),
  },
  returns: verifyTokenResultValidator,
  handler: async (_ctx, args) => {
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
    if (!expectedToken) {
      return {
        configured: false,
        valid: false,
      };
    }

    return {
      configured: true,
      valid: (args.providedToken?.trim() ?? "") === expectedToken,
    };
  },
});

export const verifyWebhookSignature = internalAction({
  args: {
    rawBody: v.string(),
    signatureHeader: v.optional(v.string()),
  },
  returns: verifySignatureResultValidator,
  handler: async (_ctx, args) => {
    const expectedSecret = process.env.WHATSAPP_APP_SECRET?.trim();
    if (!expectedSecret) {
      return {
        configured: false,
        valid: false,
        missingSignature: false,
      };
    }

    const signatureHeader = args.signatureHeader?.trim();
    if (!signatureHeader) {
      return {
        configured: true,
        valid: false,
        missingSignature: true,
      };
    }

    const expectedPrefix = "sha256=";
    if (!signatureHeader.toLowerCase().startsWith(expectedPrefix)) {
      return {
        configured: true,
        valid: false,
        missingSignature: false,
      };
    }

    const providedHex = signatureHeader.slice(expectedPrefix.length).trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(providedHex)) {
      return {
        configured: true,
        valid: false,
        missingSignature: false,
      };
    }

    const expectedHex = createHmac("sha256", expectedSecret).update(args.rawBody, "utf8").digest("hex");
    const valid = timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(providedHex, "hex"));

    return {
      configured: true,
      valid,
      missingSignature: false,
    };
  },
});
