import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

const seedDemoDataRef = makeFunctionReference<"action">("seedNode:seedDemoData");
const loginRef = makeFunctionReference<"action">("authNode:loginWithUsernamePassword");
const listConversationsForInboxRef = makeFunctionReference<"query">("chatDomain:listConversationsForInbox");
const getConversationThreadRef = makeFunctionReference<"query">("chatDomain:getConversationThread");

type BridgeResponse = {
  ok: boolean;
  tenantId: string;
  conversationId: string;
  messageId: string;
  status: "stored" | "duplicate";
};

async function postBridge(
  t: any,
  path: "/integrations/n8n/whatsapp/inbound" | "/integrations/n8n/whatsapp/outbound",
  payload: Record<string, unknown>,
  secret = "bridge_test_secret",
) {
  const response = await t.fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-n8n-integration-secret": secret,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as BridgeResponse;
  return { response, body };
}

async function withIntegrationSecret(secret: string | undefined, run: () => Promise<void>) {
  const previous = process.env.N8N_INTEGRATION_SECRET;
  if (typeof secret === "string") {
    process.env.N8N_INTEGRATION_SECRET = secret;
  } else {
    delete process.env.N8N_INTEGRATION_SECRET;
  }

  try {
    await run();
  } finally {
    if (typeof previous === "string") {
      process.env.N8N_INTEGRATION_SECRET = previous;
    } else {
      delete process.env.N8N_INTEGRATION_SECRET;
    }
  }
}

describe("n8n WhatsApp bridge flow", () => {
  it("persists inbound and outbound messages in chatDomain tables for UI consumption", async () => {
    await withIntegrationSecret("bridge_test_secret", async () => {
      const t = convexTest(schema, modules);
      await t.action(seedDemoDataRef, {});

      const inboundPayload = {
        phoneNumberId: "waba_phone_legal_1",
        contactWaId: "5548991313199",
        contactDisplayName: "Contato n8n",
        externalMessageId: "wamid-real-in-1",
        messageType: "text",
        body: "Oi, preciso de orientacao sobre aposentadoria.",
      };

      const inbound = await postBridge(t, "/integrations/n8n/whatsapp/inbound", inboundPayload);
      expect(inbound.response.status).toBe(200);
      expect(inbound.body.ok).toBe(true);
      expect(inbound.body.status).toBe("stored");

      const duplicateInbound = await postBridge(t, "/integrations/n8n/whatsapp/inbound", inboundPayload);
      expect(duplicateInbound.response.status).toBe(200);
      expect(duplicateInbound.body.status).toBe("duplicate");

      const session = await t.action(loginRef, {
        username: "ana.lima",
        password: "Ana@123456",
      });

      const inboxRows = await t.query(listConversationsForInboxRef, {
        sessionToken: session.sessionToken,
        search: "contato n8n",
      });
      expect(inboxRows.some((row: { conversationId: string }) => row.conversationId === inbound.body.conversationId)).toBe(true);

      const outbound = await postBridge(t, "/integrations/n8n/whatsapp/outbound", {
        phoneNumberId: "waba_phone_legal_1",
        conversationId: inbound.body.conversationId,
        externalMessageId: "wamid-real-out-1",
        body: "Claro. Vou te pedir alguns dados para iniciar a triagem.",
      });

      expect(outbound.response.status).toBe(200);
      expect(outbound.body.ok).toBe(true);
      expect(outbound.body.status).toBe("stored");

      const thread = await t.query(getConversationThreadRef, {
        sessionToken: session.sessionToken,
        conversationId: inbound.body.conversationId,
      });

      expect(thread.messages.map((message: { body: string }) => message.body)).toEqual(
        expect.arrayContaining([
          "Oi, preciso de orientacao sobre aposentadoria.",
          "Claro. Vou te pedir alguns dados para iniciar a triagem.",
        ]),
      );
    });
  });

  it("fails closed when N8N_INTEGRATION_SECRET is not configured", async () => {
    await withIntegrationSecret(undefined, async () => {
      const t = convexTest(schema, modules);
      await t.action(seedDemoDataRef, {});

      const response = await t.fetch("/integrations/n8n/whatsapp/inbound", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-n8n-integration-secret": "any-value",
        },
        body: JSON.stringify({
          phoneNumberId: "waba_phone_legal_1",
          contactWaId: "5548991313199",
          externalMessageId: "wamid-real-in-disabled",
          body: "teste",
        }),
      });

      expect(response.status).toBe(503);
    });
  });
});
