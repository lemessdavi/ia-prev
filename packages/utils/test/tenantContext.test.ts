import test from "node:test";
import assert from "node:assert/strict";
import { createTenantWorkspaceMocks } from "../src";

test("creates tenant-scoped workspace mocks with dynamic assistant identity", () => {
  const payload = createTenantWorkspaceMocks({
    tenantName: "Clinica Sorriso",
    assistantDisplayName: "IA da Clinica Sorriso",
    activeAiProfileName: "dentist-triage-v1",
    wabaLabel: "Clinica Sorriso WABA",
  });

  assert.equal(payload.tenant.tenantName, "Clinica Sorriso");
  assert.equal(payload.tenant.activeAiProfileName, "dentist-triage-v1");
  assert.equal(payload.tenant.wabaLabel, "Clinica Sorriso WABA");
  assert.match(payload.messages[0]?.text ?? "", /IA da Clinica Sorriso/);
  assert.doesNotMatch(payload.messages[0]?.text ?? "", /Lemes Advocacia/);
});
