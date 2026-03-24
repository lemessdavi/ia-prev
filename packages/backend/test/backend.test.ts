import test from "node:test";
import assert from "node:assert/strict";
import {
  BackendError,
  InMemoryBackendStore,
  createAiProfile,
  createTenant,
  createTenantUser,
  createPrototypeAlignedFixtures,
  getContactDossierWithEvents,
  listAiProfiles,
  listUsers,
  listTenants,
  listConversationsWithUnreadBadge,
  loginWithUsernamePassword,
  markConversationAsRead,
  requireSession,
  resolveTenantByPhoneNumberId,
  resetUserPassword,
  setActiveAiProfile,
  setUserActive,
  schema,
  sendMessage,
  updateTenant,
  upsertTenantWabaAccount,
} from "../src";

function loginAsAna(store: InMemoryBackendStore) {
  return loginWithUsernamePassword({ store, username: "ana.lima", password: "Ana@123456" });
}

function loginAsMarina(store: InMemoryBackendStore) {
  return loginWithUsernamePassword({ store, username: "marina.rocha", password: "Marina@123456" });
}

function loginAsSuperadmin(store: InMemoryBackendStore) {
  return loginWithUsernamePassword({ store, username: "ops.root", password: "Root@123456" });
}

test("list conversations returns unread badge", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const rows = listConversationsWithUnreadBadge({ session: loginAsAna(store), store });

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.conversationId, "conv_ana_caio");
  assert.equal(rows[0]?.unreadCount, 2);
});

test("dossier query returns recent events", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const payload = getContactDossierWithEvents({ session: loginAsAna(store), contactId: "usr_caio", store });

  assert.equal(payload.dossier.contactId, "usr_caio");
  assert.equal(payload.recentEvents.length, 2);
  assert.equal(payload.recentEvents[0]?.id, "evt_2");
});

test("send message updates conversation activity", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsAna(store);

  const message = sendMessage({
    session,
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
  const session = loginAsAna(store);
  const before = listConversationsWithUnreadBadge({ session, store });
  assert.equal(before.find((row) => row.conversationId === "conv_ana_caio")?.unreadCount, 2);

  const result = markConversationAsRead({ session, store, conversationId: "conv_ana_caio" });
  assert.equal(result.updatedCount, 2);

  const after = listConversationsWithUnreadBadge({ session, store });
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
    () => listConversationsWithUnreadBadge({ session: { userId: "usr_ana", role: "tenant_user" } as never, store }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "UNAUTHENTICATED");
      return true;
    },
  );
});

test("session requires role", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  assert.throws(
    () => listConversationsWithUnreadBadge({ session: { userId: "usr_ana", tenantId: "tenant_legal" } as never, store }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "UNAUTHENTICATED");
      return true;
    },
  );
});

test("session rejects unknown role values", () => {
  assert.throws(
    () =>
      requireSession({
        userId: "usr_ana",
        tenantId: "tenant_legal",
        role: "tenant_admin",
      } as never),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "UNAUTHENTICATED");
      return true;
    },
  );
});

test("forbidden mutation for non participant", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsMarina(store);
  assert.throws(
    () => sendMessage({ session, store, conversationId: "conv_ana_caio", body: "oi" }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    },
  );
});

test("tampering tenantId invalidates a persisted session", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsAna(store);

  assert.throws(
    () => listConversationsWithUnreadBadge({ session: { ...session, tenantId: "tenant_clinic" }, store }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "UNAUTHENTICATED");
      return true;
    },
  );
});

test("forged session without persisted record is rejected", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  assert.throws(
    () =>
      getContactDossierWithEvents({
        session: {
          sessionId: "sess_forged",
          userId: "usr_ana",
          tenantId: "tenant_legal",
          role: "tenant_user",
        },
        contactId: "usr_caio",
        store,
      }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "UNAUTHENTICATED");
      return true;
    },
  );
});

test("login with username and password returns persisted session with tenant and role", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));

  const session = loginWithUsernamePassword({
    store,
    username: "ana.lima",
    password: "Ana@123456",
    now: 2_000_000,
  });

  assert.equal(session.userId, "usr_ana");
  assert.equal(session.tenantId, "tenant_legal");
  assert.equal(session.role, "tenant_user");
  assert.ok(session.sessionId.startsWith("sess_"));

  const snapshot = store.snapshot();
  assert.equal(snapshot.sessions.length, 1);
  assert.equal(snapshot.sessions[0]?.id, session.sessionId);
});

test("login rejects invalid password", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));

  assert.throws(
    () => loginWithUsernamePassword({ store, username: "ana.lima", password: "senha-incorreta" }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "UNAUTHENTICATED");
      return true;
    },
  );
});

test("disabled user cannot login", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));

  assert.throws(
    () => loginWithUsernamePassword({ store, username: "paulo.inativo", password: "Paulo@123456" }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    },
  );
});

test("tenant user cannot access user list outside own tenant", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsAna(store);

  assert.throws(
    () => listUsers({ session, store, tenantId: "tenant_clinic" }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    },
  );
});

test("superadmin can access global user list", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsSuperadmin(store);

  const users = listUsers({ session, store });

  assert.equal(users.length, 5);
  assert.ok(users.some((user) => user.role === "superadmin"));
  assert.ok(users.some((user) => user.tenantId === "tenant_clinic" && user.username === "bruna.alves"));
});

test("superadmin can reset password and revoke prior sessions", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const superadminSession = loginAsSuperadmin(store);
  const anaSession = loginAsAna(store);

  const result = resetUserPassword({
    session: superadminSession,
    store,
    userId: "usr_ana",
    nextPassword: "Nova@123456",
    now: 3_000_000,
  });

  assert.equal(result.userId, "usr_ana");
  assert.equal(result.revokedSessionCount, 1);
  assert.equal(result.tenantId, "tenant_legal");

  assert.throws(
    () => loginWithUsernamePassword({ store, username: "ana.lima", password: "Ana@123456" }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "UNAUTHENTICATED");
      return true;
    },
  );

  const newSession = loginWithUsernamePassword({ store, username: "ana.lima", password: "Nova@123456" });
  assert.notEqual(newSession.sessionId, anaSession.sessionId);
});

test("reset password invalidates an already issued session for queries", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const superadminSession = loginAsSuperadmin(store);
  const anaSession = loginAsAna(store);

  resetUserPassword({
    session: superadminSession,
    store,
    userId: "usr_ana",
    nextPassword: "Nova@123456",
    now: 3_000_000,
  });

  assert.throws(
    () => listConversationsWithUnreadBadge({ session: anaSession, store }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "UNAUTHENTICATED");
      return true;
    },
  );
});

test("fixtures expose separated conversation and triage statuses", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const snapshot = store.snapshot();
  const conversation = snapshot.conversations.find((item) => item.id === "conv_ana_caio");
  assert.equal(conversation?.conversationStatus, "PENDENTE_HUMANO");
  assert.equal(conversation?.triageResult, "APTO");
});

test("database contains phase-1 tenant foundations", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const snapshot = store.snapshot();

  assert.ok(snapshot.tenants.length >= 2);
  assert.ok(snapshot.tenantWabaAccounts.length >= 2);
  assert.ok(snapshot.aiProfiles.length >= 2);
  assert.ok(snapshot.attachments.length >= 1);
  assert.ok(snapshot.handoffEvents.length >= 1);
  assert.ok(snapshot.auditLogs.length >= 1);

  for (const user of snapshot.users) {
    assert.ok(user.username.length > 0);
  }
});

test("schema has tenant-aware indexes for phase-1 collections", () => {
  assert.ok(schema.tenants.indexes.includes("by_slug"));
  assert.ok(schema.tenantWabaAccounts.indexes.includes("by_phone_number_id"));
  assert.ok(schema.aiProfiles.indexes.includes("by_tenant_active"));
  assert.ok(schema.attachments.indexes.includes("by_tenant_conversation"));
  assert.ok(schema.handoffEvents.indexes.includes("by_tenant_conversation_created_at"));
  assert.ok(schema.auditLogs.indexes.includes("by_tenant_created_at"));
});

test("only one ai profile can be active per tenant in fixtures", () => {
  const snapshot = createPrototypeAlignedFixtures(1_000_000);
  const activeByTenant = snapshot.aiProfiles
    .filter((item) => item.isActive)
    .reduce<Record<string, number>>((acc, item) => {
      acc[item.tenantId] = (acc[item.tenantId] ?? 0) + 1;
      return acc;
    }, {});

  assert.equal(activeByTenant["tenant_legal"], 1);
  assert.equal(activeByTenant["tenant_clinic"], 1);
});

test("routing resolves tenant by phone_number_id", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));

  const mapping = resolveTenantByPhoneNumberId({
    phoneNumberId: "waba_phone_legal_1",
    store,
  });

  assert.equal(mapping.tenantId, "tenant_legal");
  assert.equal(mapping.wabaAccountId, "waba_account_legal");
});

test("routing fails closed when phone_number_id is unknown", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));

  assert.throws(
    () =>
      resolveTenantByPhoneNumberId({
        phoneNumberId: "waba_phone_unknown",
        store,
      }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "NOT_FOUND");
      return true;
    },
  );
});

test("superadmin can list and create tenants", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsSuperadmin(store);

  const before = listTenants({ session, store });
  assert.equal(before.length, 2);

  const created = createTenant({
    session,
    store,
    id: "tenant_novo",
    slug: "tenant-novo",
    name: "Tenant Novo",
  });

  assert.equal(created.id, "tenant_novo");
  assert.equal(created.slug, "tenant-novo");
  assert.equal(created.isActive, true);

  const after = listTenants({ session, store });
  assert.equal(after.length, 3);
});

test("superadmin can update tenant active status", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsSuperadmin(store);

  const updated = updateTenant({
    session,
    store,
    tenantId: "tenant_clinic",
    name: "Clinica Sorriso Premium",
    isActive: false,
  });

  assert.equal(updated.id, "tenant_clinic");
  assert.equal(updated.name, "Clinica Sorriso Premium");
  assert.equal(updated.isActive, false);
});

test("superadmin can upsert tenant WABA mapping", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsSuperadmin(store);

  const updated = upsertTenantWabaAccount({
    session,
    store,
    tenantId: "tenant_legal",
    phoneNumberId: "waba_phone_legal_new",
    wabaAccountId: "waba_account_legal_new",
    displayName: "Lemes Advocacia WABA 2",
  });

  assert.equal(updated.tenantId, "tenant_legal");
  assert.equal(updated.phoneNumberId, "waba_phone_legal_new");

  const mapping = resolveTenantByPhoneNumberId({
    phoneNumberId: "waba_phone_legal_new",
    store,
  });
  assert.equal(mapping.tenantId, "tenant_legal");
  assert.equal(mapping.wabaAccountId, "waba_account_legal_new");
});

test("superadmin can create tenant user and toggle active status", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsSuperadmin(store);

  const created = createTenantUser({
    session,
    store,
    userId: "usr_novo",
    tenantId: "tenant_clinic",
    username: "novo.usuario",
    fullName: "Novo Usuario",
    email: "novo@clinic.com",
    password: "Novo@123456",
  });

  assert.equal(created.userId, "usr_novo");
  assert.equal(created.tenantId, "tenant_clinic");
  assert.equal(created.isActive, true);

  const disabled = setUserActive({
    session,
    store,
    userId: "usr_novo",
    isActive: false,
  });
  assert.equal(disabled.isActive, false);

  assert.throws(
    () => loginWithUsernamePassword({ store, username: "novo.usuario", password: "Novo@123456" }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    },
  );
});

test("setting active AI profile keeps exactly one active profile per tenant", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsSuperadmin(store);

  const created = createAiProfile({
    session,
    store,
    id: "aip_clinic_v2",
    tenantId: "tenant_clinic",
    name: "dentista-atendimento-v2",
    provider: "openai",
    model: "gpt-4.1-mini",
    credentialsRef: "secret://tenant_clinic/openai_secondary",
    isActive: false,
  });
  assert.equal(created.isActive, false);

  const activated = setActiveAiProfile({
    session,
    store,
    tenantId: "tenant_clinic",
    profileId: "aip_clinic_v2",
  });
  assert.equal(activated.id, "aip_clinic_v2");
  assert.equal(activated.isActive, true);

  const profiles = listAiProfiles({ session, store, tenantId: "tenant_clinic" });
  const active = profiles.filter((profile) => profile.isActive);

  assert.equal(active.length, 1);
  assert.equal(active[0]?.id, "aip_clinic_v2");
});

test("tenant_user cannot run superadmin management operations", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const session = loginAsAna(store);

  assert.throws(
    () => listTenants({ session, store }),
    (err: unknown) => {
      assert.ok(err instanceof BackendError);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    },
  );
});
