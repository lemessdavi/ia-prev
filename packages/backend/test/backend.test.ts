import test from "node:test";
import assert from "node:assert/strict";
import {
  BackendError,
  InMemoryBackendStore,
  createPrototypeAlignedFixtures,
  getContactDossierWithEvents,
  ingestWhatsAppWebhook,
  listUsers,
  listConversationsWithUnreadBadge,
  loginWithUsernamePassword,
  markConversationAsRead,
  requireSession,
  resolveTenantByPhoneNumberId,
  resetUserPassword,
  schema,
  sendMessage,
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

function buildInboundWebhookPayload(input: {
  phoneNumberId: string;
  messageId: string;
  from: string;
  type: "text" | "image" | "audio" | "document";
  body?: string;
  mediaId?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  timestamp?: string;
}) {
  const message =
    input.type === "text"
      ? {
          id: input.messageId,
          from: input.from,
          timestamp: input.timestamp ?? "1700000000",
          type: "text" as const,
          text: { body: input.body ?? "mensagem texto" },
        }
      : input.type === "image"
        ? {
            id: input.messageId,
            from: input.from,
            timestamp: input.timestamp ?? "1700000000",
            type: "image" as const,
            image: {
              id: input.mediaId ?? `media_${input.messageId}`,
              mime_type: input.mimeType ?? "image/jpeg",
              caption: input.body ?? "imagem recebida",
              url: input.mediaUrl ?? `https://cdn.iaprev.com/media/${input.messageId}.jpg`,
            },
          }
        : input.type === "audio"
          ? {
              id: input.messageId,
              from: input.from,
              timestamp: input.timestamp ?? "1700000000",
              type: "audio" as const,
              audio: {
                id: input.mediaId ?? `media_${input.messageId}`,
                mime_type: input.mimeType ?? "audio/ogg",
                url: input.mediaUrl ?? `https://cdn.iaprev.com/media/${input.messageId}.ogg`,
              },
            }
          : {
              id: input.messageId,
              from: input.from,
              timestamp: input.timestamp ?? "1700000000",
              type: "document" as const,
              document: {
                id: input.mediaId ?? `media_${input.messageId}`,
                filename: input.fileName ?? "documento.pdf",
                mime_type: input.mimeType ?? "application/pdf",
                url: input.mediaUrl ?? `https://cdn.iaprev.com/media/${input.messageId}.pdf`,
              },
            };

  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "entry_1",
        changes: [
          {
            field: "messages",
            value: {
              metadata: {
                phone_number_id: input.phoneNumberId,
              },
              messages: [message],
            },
          },
        ],
      },
    ],
  };
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

test("webhook ingestion isolates tenant routing between tenant A and B", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));

  const legalPayload = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_legal_1",
    messageId: "wamid_legal_001",
    from: "5511999991001",
    type: "text",
    body: "Mensagem para tenant legal",
  });
  const clinicPayload = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_clinic_1",
    messageId: "wamid_clinic_001",
    from: "5511999992002",
    type: "text",
    body: "Mensagem para tenant clinic",
  });

  const legalResult = ingestWhatsAppWebhook({ payload: legalPayload, store, now: 1_600_000 });
  const clinicResult = ingestWhatsAppWebhook({ payload: clinicPayload, store, now: 1_600_500 });

  assert.equal(legalResult.status, "processed");
  assert.equal(legalResult.tenantId, "tenant_legal");
  assert.equal(clinicResult.status, "processed");
  assert.equal(clinicResult.tenantId, "tenant_clinic");

  const snapshot = store.snapshot();
  const legalMessage = snapshot.messages.find((item) => item.id === legalResult.messageId);
  const clinicMessage = snapshot.messages.find((item) => item.id === clinicResult.messageId);

  assert.equal(legalMessage?.tenantId, "tenant_legal");
  assert.equal(legalMessage?.body, "Mensagem para tenant legal");
  assert.equal(clinicMessage?.tenantId, "tenant_clinic");
  assert.equal(clinicMessage?.body, "Mensagem para tenant clinic");
  assert.notEqual(legalMessage?.tenantId, clinicMessage?.tenantId);
});

test("webhook ingestion fails closed when phone_number_id is unknown", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const before = store.snapshot();

  const payload = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_unknown",
    messageId: "wamid_unknown_001",
    from: "5511999993003",
    type: "text",
    body: "Mensagem sem mapeamento",
  });

  const result = ingestWhatsAppWebhook({ payload, store, now: 1_601_000 });
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "unmapped_phone_number_id");

  const after = store.snapshot();
  assert.equal(after.messages.length, before.messages.length);
  assert.equal(after.attachments.length, before.attachments.length);
  assert.ok(after.auditLogs.some((log) => log.action === "webhook.routing.failed" && log.targetId === "waba_phone_unknown"));
});

test("webhook ingestion is idempotent for reprocessed webhook id", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const payload = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_legal_1",
    messageId: "wamid_idempotent_001",
    from: "5511999994004",
    type: "text",
    body: "Teste de idempotencia",
  });

  const first = ingestWhatsAppWebhook({ payload, store, now: 1_602_000 });
  const second = ingestWhatsAppWebhook({ payload, store, now: 1_602_100 });

  assert.equal(first.status, "processed");
  assert.equal(second.status, "ignored");
  assert.equal(second.deduplicated, true);

  const snapshot = store.snapshot();
  assert.equal(snapshot.messages.filter((item) => item.id === first.messageId).length, 1);
});

test("webhook ingestion does not collide different raw message ids with special chars", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const payloadA = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_legal_1",
    messageId: "wamid.A+B",
    from: "5511999994100",
    type: "text",
    body: "Primeira mensagem",
  });
  const payloadB = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_legal_1",
    messageId: "wamid.A/B",
    from: "5511999994100",
    type: "text",
    body: "Segunda mensagem",
  });

  const first = ingestWhatsAppWebhook({ payload: payloadA, store, now: 1_602_200 });
  const second = ingestWhatsAppWebhook({ payload: payloadB, store, now: 1_602_300 });

  assert.equal(first.status, "processed");
  assert.equal(second.status, "processed");
  assert.notEqual(first.messageId, second.messageId);

  const snapshot = store.snapshot();
  assert.equal(snapshot.messages.filter((item) => item.id === first.messageId).length, 1);
  assert.equal(snapshot.messages.filter((item) => item.id === second.messageId).length, 1);
});

test("webhook ingestion does not collide attachment ids with special chars", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const payloadA = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_legal_1",
    messageId: "wamid_media_001",
    from: "5511999994200",
    type: "image",
    mediaId: "media.A+B",
    mimeType: "image/jpeg",
  });
  const payloadB = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_legal_1",
    messageId: "wamid_media_002",
    from: "5511999994200",
    type: "image",
    mediaId: "media.A/B",
    mimeType: "image/jpeg",
  });

  const first = ingestWhatsAppWebhook({ payload: payloadA, store, now: 1_602_400 });
  const second = ingestWhatsAppWebhook({ payload: payloadB, store, now: 1_602_500 });
  assert.equal(first.status, "processed");
  assert.equal(second.status, "processed");

  const snapshot = store.snapshot();
  const firstAttachment = snapshot.attachments.find((item) => item.messageId === first.messageId);
  const secondAttachment = snapshot.attachments.find((item) => item.messageId === second.messageId);

  assert.ok(firstAttachment?.id);
  assert.ok(secondAttachment?.id);
  assert.notEqual(firstAttachment?.id, secondAttachment?.id);
});

test("webhook ingestion persists text message", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const payload = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_legal_1",
    messageId: "wamid_text_001",
    from: "5511999995005",
    type: "text",
    body: "Mensagem de texto inbound",
  });

  const result = ingestWhatsAppWebhook({ payload, store, now: 1_603_000 });
  assert.equal(result.status, "processed");

  const snapshot = store.snapshot();
  const message = snapshot.messages.find((item) => item.id === result.messageId);
  assert.equal(message?.body, "Mensagem de texto inbound");
  assert.equal(message?.attachmentUrl, undefined);
});

test("webhook ingestion persists image attachment", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const payload = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_legal_1",
    messageId: "wamid_image_001",
    from: "5511999996006",
    type: "image",
    body: "Comprovante em imagem",
    mimeType: "image/jpeg",
  });

  const result = ingestWhatsAppWebhook({ payload, store, now: 1_604_000 });
  assert.equal(result.status, "processed");

  const snapshot = store.snapshot();
  const attachment = snapshot.attachments.find((item) => item.messageId === result.messageId);
  assert.equal(attachment?.tenantId, "tenant_legal");
  assert.equal(attachment?.contentType, "image/jpeg");
});

test("webhook ingestion persists audio attachment", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const payload = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_clinic_1",
    messageId: "wamid_audio_001",
    from: "5511999997007",
    type: "audio",
    mimeType: "audio/ogg",
  });

  const result = ingestWhatsAppWebhook({ payload, store, now: 1_605_000 });
  assert.equal(result.status, "processed");

  const snapshot = store.snapshot();
  const attachment = snapshot.attachments.find((item) => item.messageId === result.messageId);
  assert.equal(attachment?.tenantId, "tenant_clinic");
  assert.equal(attachment?.contentType, "audio/ogg");
});

test("webhook ingestion persists pdf attachment", () => {
  const store = new InMemoryBackendStore(createPrototypeAlignedFixtures(1_000_000));
  const payload = buildInboundWebhookPayload({
    phoneNumberId: "waba_phone_clinic_1",
    messageId: "wamid_pdf_001",
    from: "5511999998008",
    type: "document",
    fileName: "laudo.pdf",
    mimeType: "application/pdf",
  });

  const result = ingestWhatsAppWebhook({ payload, store, now: 1_606_000 });
  assert.equal(result.status, "processed");

  const snapshot = store.snapshot();
  const attachment = snapshot.attachments.find((item) => item.messageId === result.messageId);
  assert.equal(attachment?.tenantId, "tenant_clinic");
  assert.equal(attachment?.contentType, "application/pdf");
  assert.equal(attachment?.fileName, "laudo.pdf");
});
