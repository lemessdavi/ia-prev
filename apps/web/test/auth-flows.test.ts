import assert from "node:assert/strict";
import test from "node:test";

import {
  resolvePostLoginRedirect,
  resolveSuperadminGate,
  runLoginFlow,
  type AppSession,
} from "../src/server/auth-flow";

const superadminSession: AppSession = {
  userId: "usr_superadmin",
  tenantId: "tenant_legal",
  role: "superadmin",
  sessionId: "sess_1",
  createdAt: 1,
};

const tenantUserSession: AppSession = {
  userId: "usr_ana",
  tenantId: "tenant_legal",
  role: "tenant_user",
  sessionId: "sess_2",
  createdAt: 1,
};

test("post-login redirect routes superadmin to /superadmin", () => {
  assert.equal(resolvePostLoginRedirect(superadminSession), "/superadmin");
});

test("post-login redirect keeps tenant_user blocked in admin entrypoint", () => {
  assert.equal(resolvePostLoginRedirect(tenantUserSession), "/superadmin");
});

test("superadmin guard redirects anonymous users to login", () => {
  assert.deepEqual(resolveSuperadminGate(null), {
    status: "redirect",
    to: "/",
  });
});

test("superadmin guard returns forbidden for tenant_user with CTA", () => {
  assert.deepEqual(resolveSuperadminGate(tenantUserSession), {
    status: "forbidden",
    ctaTo: "/app",
  });
});

test("superadmin guard allows superadmin", () => {
  assert.deepEqual(resolveSuperadminGate(superadminSession), {
    status: "allowed",
  });
});

test("invalid login returns unauthenticated error payload", () => {
  const result = runLoginFlow({
    username: "ana.lima",
    password: "senha-invalida",
    authenticate: () => {
      const error = new Error("Invalid username or password.") as Error & { code: string };
      error.code = "UNAUTHENTICATED";
      throw error;
    },
  });

  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: "Invalid username or password.",
  });
});
