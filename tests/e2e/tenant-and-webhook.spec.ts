import { expect, test } from "@playwright/test";
import { loginAs, logout, openConsole, waitForInboxLoad } from "./helpers/operatorConsole";
import { buildInboundPayload, buildUniqueMessageId, postWabaWebhook } from "./helpers/wabaWebhook";

const ANA_CREDENTIALS = {
  username: "ana.lima",
  password: "Ana@123456",
} as const;

const BRUNA_CREDENTIALS = {
  username: "bruna.alves",
  password: "Bruna@123456",
} as const;

test.describe("IAP-21 - tenant-aware e webhook WABA", () => {
  test("isola dados entre tenants no fluxo de operador", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Isolamento tenant validado no cenário desktop.");

    await openConsole(page);
    await loginAs(page, ANA_CREDENTIALS);

    await expect(page.getByTestId("workspace-tenant-name")).toHaveText("Lemes Advocacia");
    await expect(page.getByTestId("conversation-item-conv_ana_caio")).toBeVisible();
    await expect(page.getByTestId("conversation-item-conv_ana_marina")).toBeVisible();
    await expect(page.getByTestId("conversation-item-conv_bruna_joao")).toHaveCount(0);

    await logout(page);

    await loginAs(page, BRUNA_CREDENTIALS);
    await expect(page.getByTestId("workspace-tenant-name")).toHaveText("Clinica Sorriso");
    await waitForInboxLoad(page);
    await expect(page.getByTestId("conversation-item-conv_bruna_joao")).toBeVisible();
    await expect(page.getByTestId("conversation-item-conv_ana_caio")).toHaveCount(0);
    await expect(page.getByTestId("conversation-item-conv_ana_marina")).toHaveCount(0);

    await logout(page);
  });

  test("valida fail-closed e idempotencia no webhook WABA", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Webhook validado uma vez no cenário desktop.");

    const convexUrl = process.env.E2E_CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
    test.skip(!convexUrl, "Defina E2E_CONVEX_URL (ou NEXT_PUBLIC_CONVEX_URL) para validar webhook no Convex.");

    const unknownPayload = buildInboundPayload({
      phoneNumberId: "waba_phone_unknown",
      fromWaId: "5511988889999",
      externalMessageId: buildUniqueMessageId("wamid-e2e-unknown"),
      textBody: "Mensagem bloqueada e2e",
    });

    const unknownResult = await postWabaWebhook(request, convexUrl!, unknownPayload);
    expect(unknownResult.response.status()).toBe(404);
    expect(unknownResult.body).toEqual({
      processed: 0,
      duplicates: 0,
      blocked: 1,
      ignored: 0,
    });

    const duplicateMessageId = buildUniqueMessageId("wamid-e2e-dup");
    const duplicatePayload = buildInboundPayload({
      phoneNumberId: "waba_phone_legal_1",
      fromWaId: "5511977776666",
      externalMessageId: duplicateMessageId,
      textBody: "Mensagem idempotente e2e",
    });

    const first = await postWabaWebhook(request, convexUrl!, duplicatePayload);
    expect(first.response.status()).toBe(200);
    expect(first.body).toEqual({
      processed: 1,
      duplicates: 0,
      blocked: 0,
      ignored: 0,
    });

    const second = await postWabaWebhook(request, convexUrl!, duplicatePayload);
    expect(second.response.status()).toBe(200);
    expect(second.body).toEqual({
      processed: 0,
      duplicates: 1,
      blocked: 0,
      ignored: 0,
    });
  });
});
