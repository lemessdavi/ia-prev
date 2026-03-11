import test from "node:test";
import assert from "node:assert/strict";
import {
  BackendError,
  InMemoryBackendStore,
  createPrototypeAlignedFixtures,
  getContactDossierWithEvents,
  listConversationsWithUnreadBadge,
  markConversationAsRead,
  sendMessage,
} from "../src";

const sessionAna = { userId: "usr_ana", tenantId: "tenant_legal" };
const sessionMarina = { userId: "usr_marina", tenantId: "tenant_legal" };
const sessionAnaWrongTenant = { userId: "usr_ana", tenantId: "tenant_clinic" };

test("list conversations returns unread badge", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const rows = listConversationsWithUnreadBadge({ session: sessionAna, store });

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.conversationId, "conv_ana_caio");
  assert.equal(rows[0]?.unreadCount, 2);
});

test("dossier query returns recent events", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const payload = getContactDossierWithEvents({ session: sessionAna, contactId: "usr_caio", store });

  assert.equal(payload.dossier.contactId, "usr_caio");
  assert.equal(payload.recentEvents.length, 2);
  assert.equal(payload.recentEvents[0]?.id, "evt_2");
});

test("send message updates conversation activity", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));

  const message = sendMessage({
    session: sessionAna,
    store,
    conversationId: "conv_ana_caio",
    body: "Mensagem nova",
    now: 1_500_000,
  });

  const snapshot = store.snapshot();
  const conversation = snapshot.conversations.find((c) => c.id === "conv_ana_caio");

  assert.equal(message.body, "Mensagem nova");
  assert.equal(conversation?.lastActivityAt, 1_500_000);
});

test("mark conversation as read clears unread badge", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const before = listConversationsWithUnreadBadge({ session: sessionAna, store });
  assert.equal(before.find((row) => row.conversationId === "conv_ana_caio")?.unreadCount, 2);

  const result = markConversationAsRead({ session: sessionAna, store, conversationId: "conv_ana_caio" });
  assert.equal(result.updatedCount, 2);

  const after = listConversationsWithUnreadBadge({ session: sessionAna, store });
  assert.equal(after.find((row) => row.conversationId === "conv_ana_caio")?.unreadCount, 0);
});

test("auth is required", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  assert.throws(() => listConversationsWithUnreadBadge({ session: null, store }), (err: unknown) => {
    assert.ok(err instanceof BackendError);
    assert.equal(err.code, "UNAUTHENTICATED");
    return true;
  });
});

test("session requires tenant id", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  assert.throws(
    () => listConversationsWithUnreadBadge({ session: { userId: "usr_ana" } as never, store }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "UNAUTHENTICATED");
      return true;
    },
  );
});

test("forbidden mutation for non participant", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  assert.throws(
    () => sendMessage({ session: sessionMarina, store, conversationId: "conv_ana_caio", body: "oi" }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    },
  );
});

test("tenant isolation blocks conversation listing in wrong tenant", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const rows = listConversationsWithUnreadBadge({ session: sessionAnaWrongTenant, store });
  assert.equal(rows.length, 0);
});

test("tenant isolation blocks dossier access in wrong tenant", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  assert.throws(
    () => getContactDossierWithEvents({ session: sessionAnaWrongTenant, contactId: "usr_caio", store }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "NOT_FOUND");
      return true;
    },
  );
});
