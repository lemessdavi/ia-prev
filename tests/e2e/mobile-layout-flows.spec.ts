import { expect, test } from "@playwright/test";
import { loginAs, openConsole, waitForInboxLoad } from "./helpers/operatorConsole";

const ANA_CREDENTIALS = {
  username: "ana.lima",
  password: "Ana@123456",
} as const;

test.describe("IAP-21 - fluxo mobile layout (web)", () => {
  test("valida navegacao inbox/chat/dossie e envio no layout mobile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "Esse cenário valida o layout mobile no projeto mobile.");

    await openConsole(page);
    await loginAs(page, ANA_CREDENTIALS);
    await waitForInboxLoad(page);

    await expect(page.getByTestId("mobile-tab-inbox")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-chat")).toBeVisible();
    await expect(page.getByTestId("mobile-tab-dossier")).toBeVisible();

    await page.getByTestId("conversation-item-conv_ana_caio").click();
    await expect(page.getByTestId("chat-title")).toContainText("Caio");

    const body = `Mensagem mobile e2e ${Date.now()}`;
    await page.getByTestId("chat-message-input").fill(body);
    await page.getByTestId("chat-send-button").click();
    const sentMessage = page.locator("[data-testid^='thread-message-']").filter({ hasText: body });
    await expect(sentMessage).toHaveCount(1);
    await expect(sentMessage.first()).toBeVisible();

    await page.getByTestId("mobile-tab-dossier").click();
    await expect(page.getByTestId("dossier-contact-id")).toHaveText("usr_caio");
    await expect(page.getByTestId("dossier-export-button")).toBeEnabled();
  });
});
