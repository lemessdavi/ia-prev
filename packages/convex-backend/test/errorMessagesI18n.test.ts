import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CONVEX_FILES = [
  "convex/coreAuth.ts",
  "convex/coreInput.ts",
  "convex/authNode.ts",
  "convex/chatDomain.ts",
  "convex/triageEngine.ts",
  "convex/chatHandoffNode.ts",
  "convex/tenants.ts",
  "convex/users.ts",
  "convex/aiProfiles.ts",
  "convex/adminWaba.ts",
  "convex/whatsappBridge.ts",
  "convex/wabaWebhook.ts",
  "convex/http.ts",
  "convex/whatsappBridgeNode.ts",
] as const;

const ENGLISH_LITERALS = [
  "Invalid username or password.",
  "Your session is invalid or has expired.",
  "This user is disabled.",
  "You do not have permission to access this resource.",
  "You do not have permission to access this tenant.",
  "Conversation not found.",
  "You cannot access this conversation.",
  "Conversation is missing participants.",
  "You cannot send messages to this conversation.",
  "You cannot update this conversation.",
  "Conversation is already closed.",
  "Conversation is not linked to a WhatsApp contact.",
  "Conversation WhatsApp contact is invalid.",
  "No active WABA mapping found for tenant.",
  "Unable to resolve WABA mapping for conversation.",
  "Operator was not found for this session.",
  "Dossier not found for this conversation.",
  "Dossier not found for this contact.",
  "Tenant not found.",
  "WABA mapping not found for phone_number_id.",
  "Conversation does not belong to mapped tenant.",
  "phoneNumberId and contactWaId are required.",
  "phoneNumberId, conversationId and body are required.",
  "User account is linked to an unknown user.",
  "User id already exists.",
  "Username already exists.",
  "Email already exists for this tenant.",
  "User not found.",
  "AI profile not found for this tenant.",
  "AI profile id already exists.",
  "AI profile not found.",
  "Tenant id already exists.",
  "Tenant slug already exists.",
  "Session revocation requires write access to the database.",
  "Invalid seed key.",
  "Failed to send handoff notification to WhatsApp.",
  "Message body must not be empty.",
  "Failed to send message to WhatsApp.",
  "email is invalid.",
  "Message must be between 1 and 1500 chars.",
  "Attachment URL must use https.",
  "status filter is invalid.",
  "search filter is too long.",
  "Closure reason must be between 5 and 500 chars.",
  "flowType is required when triage answers were not previously initialized.",
  "phone_number_id already mapped to another tenant.",
  "WHATSAPP_CLOUD_ACCESS_TOKEN is not configured.",
  "WhatsApp Cloud request failed.",
  "OpenAI response did not contain output text.",
  "OpenAI request failed with status ",
  "WhatsApp Cloud API returned an error.",
  "must be between 8 and 128 chars.",
  "must be between 2 and 120 chars.",
  "must have 3 to 64 chars and use only lowercase letters, numbers and dash.",
  "Username must have 3 to 64 chars and use only letters, numbers, dot, dash or underscore.",
  "Invalid ${field}.",
  "Invalid webhook verification request.",
  "Webhook verification is unavailable. Configure WHATSAPP_WEBHOOK_VERIFY_TOKEN.",
  "Invalid webhook verify token.",
  "Webhook signature verification is unavailable. Configure WHATSAPP_APP_SECRET.",
  "Invalid webhook signature.",
  "Webhook processing failed.",
] as const;

describe("i18n de mensagens de erro no backend Convex", () => {
  it("remove literais de erro em ingles dos pontos expostos", () => {
    for (const filePath of CONVEX_FILES) {
      const absolutePath = resolve(__dirname, "..", filePath);
      const source = readFileSync(absolutePath, "utf8");

      for (const literal of ENGLISH_LITERALS) {
        expect(
          source.includes(literal),
          `Literal em ingles encontrado em ${filePath}: "${literal}"`,
        ).toBe(false);
      }
    }
  });
});
