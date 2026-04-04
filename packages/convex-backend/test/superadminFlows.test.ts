import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{ts,js}");

const seedDemoDataRef = makeFunctionReference<"action">("seedNode:seedDemoData");
const loginRef = makeFunctionReference<"action">("authNode:loginWithUsernamePassword");
const listTenantsRef = makeFunctionReference<"query">("tenants:listTenants");
const listUsersRef = makeFunctionReference<"query">("users:listUsers");
const createTenantUserRef = makeFunctionReference<"action">("usersNode:createTenantUser");
const resetUserPasswordRef = makeFunctionReference<"action">("usersNode:resetUserPassword");
const listAiProfilesRef = makeFunctionReference<"query">("aiProfiles:listAiProfiles");
const createAiProfileRef = makeFunctionReference<"mutation">("aiProfiles:createAiProfile");
const setActiveAiProfileRef = makeFunctionReference<"mutation">("aiProfiles:setActiveAiProfile");
const listConversationsRef = makeFunctionReference<"query">("chatDomain:listConversationsWithUnreadBadge");
const markConversationAsReadRef = makeFunctionReference<"mutation">("chatDomain:markConversationAsRead");
const getContactProfileRef = makeFunctionReference<"query">("chatDomain:getContactProfileWithEvents");

async function createSeededTestContext() {
  const t = convexTest(schema, modules);
  await t.action(seedDemoDataRef, {});
  return t;
}

async function loginAs(
  t: Awaited<ReturnType<typeof createSeededTestContext>>,
  username: string,
  password: string,
) {
  return await t.action(loginRef, { username, password });
}

async function expectBusinessError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error("Expected promise to reject with business error.");
  } catch (error) {
    const payload =
      typeof (error as { data?: unknown }).data === "string"
        ? JSON.parse((error as { data: string }).data)
        : (error as { data?: unknown }).data;

    expect(payload).toMatchObject({
      code,
    });
  }
}

describe("Convex superadmin and tenant contract", () => {
  it("allows superadmin login and tenant listing", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ops.root", "Root@123456");

    const tenants = await t.query(listTenantsRef, { sessionToken: session.sessionToken });
    expect(tenants).toHaveLength(2);
    expect(tenants[0]?.slug).toBe("clinica-sorriso");
    expect(tenants[1]?.slug).toBe("lemes-advocacia");
  });

  it("rejects unauthenticated access to superadmin query", async () => {
    const t = await createSeededTestContext();
    await expectBusinessError(
      t.query(listTenantsRef, {
        sessionToken: "sess_forged",
      }),
      "UNAUTHENTICATED",
    );
  });

  it("blocks tenant_user from superadmin modules", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await expectBusinessError(
      t.query(listTenantsRef, {
        sessionToken: session.sessionToken,
      }),
      "FORBIDDEN",
    );
  });

  it("enforces tenant isolation in user listing", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    await expectBusinessError(
      t.query(listUsersRef, {
        sessionToken: session.sessionToken,
        tenantId: "tenant_clinic",
      }),
      "FORBIDDEN",
    );
  });

  it("resets password and invalidates old sessions", async () => {
    const t = await createSeededTestContext();
    const superadminSession = await loginAs(t, "ops.root", "Root@123456");
    const anaSession = await loginAs(t, "ana.lima", "Ana@123456");

    const result = await t.action(resetUserPasswordRef, {
      sessionToken: superadminSession.sessionToken,
      userId: "usr_ana",
      nextPassword: "Nova@123456",
    });
    expect(result.userId).toBe("usr_ana");
    expect(result.revokedSessionCount).toBeGreaterThanOrEqual(1);

    await expectBusinessError(
      t.query(listConversationsRef, {
        sessionToken: anaSession.sessionToken,
      }),
      "UNAUTHENTICATED",
    );

    await expectBusinessError(
      t.action(loginRef, {
        username: "ana.lima",
        password: "Ana@123456",
      }),
      "UNAUTHENTICATED",
    );

    const newSession = await loginAs(t, "ana.lima", "Nova@123456");
    expect(newSession.sessionToken).not.toBe(anaSession.sessionToken);
  });

  it("keeps exactly one active ai profile per tenant", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ops.root", "Root@123456");

    const created = await t.mutation(createAiProfileRef, {
      sessionToken: session.sessionToken,
      id: "aip_clinic_v2",
      tenantId: "tenant_clinic",
      name: "dentista-atendimento-v2",
      provider: "openai",
      model: "gpt-4.1-mini",
      credentialsRef: "secret://tenant_clinic/openai_secondary",
      isActive: false,
    });
    expect(created.id).toBe("aip_clinic_v2");
    expect(created.isActive).toBe(false);

    const activated = await t.mutation(setActiveAiProfileRef, {
      sessionToken: session.sessionToken,
      tenantId: "tenant_clinic",
      profileId: "aip_clinic_v2",
    });
    expect(activated.id).toBe("aip_clinic_v2");
    expect(activated.isActive).toBe(true);

    const profiles = await t.query(listAiProfilesRef, {
      sessionToken: session.sessionToken,
      tenantId: "tenant_clinic",
    });
    expect(profiles.filter((profile: { isActive: boolean }) => profile.isActive)).toHaveLength(1);
  });

  it("updates unread counters after markConversationAsRead", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ana.lima", "Ana@123456");

    const before = await t.query(listConversationsRef, {
      sessionToken: session.sessionToken,
    });
    expect(before.find((row: { conversationId: string; unreadCount: number }) => row.conversationId === "conv_ana_caio")?.unreadCount).toBe(2);

    const update = await t.mutation(markConversationAsReadRef, {
      sessionToken: session.sessionToken,
      conversationId: "conv_ana_caio",
    });
    expect(update.updatedCount).toBe(2);

    const after = await t.query(listConversationsRef, {
      sessionToken: session.sessionToken,
    });
    expect(after.find((row: { conversationId: string; unreadCount: number }) => row.conversationId === "conv_ana_caio")?.unreadCount).toBe(0);
  });

  it("returns NOT_FOUND for contact profile access without conversation relationship", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "marina.rocha", "Marina@123456");

    await expectBusinessError(
      t.query(getContactProfileRef, {
        sessionToken: session.sessionToken,
        contactId: "usr_caio",
      }),
      "NOT_FOUND",
    );
  });

  it("creates tenant users with role-safe default and appears in scoped list", async () => {
    const t = await createSeededTestContext();
    const session = await loginAs(t, "ops.root", "Root@123456");

    await t.action(createTenantUserRef, {
      sessionToken: session.sessionToken,
      userId: "usr_novo",
      tenantId: "tenant_clinic",
      username: "novo.usuario",
      fullName: "Novo Usuario",
      email: "novo@clinic.com",
      password: "Novo@123456",
    });

    const users = await t.query(listUsersRef, {
      sessionToken: session.sessionToken,
      tenantId: "tenant_clinic",
    });

    const created = users.find((user: { userId: string; role: string; isActive: boolean }) => user.userId === "usr_novo");
    expect(created?.role).toBe("tenant_user");
    expect(created?.isActive).toBe(true);
  });
});
