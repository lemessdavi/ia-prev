import { expect, test } from "@playwright/test";
import { loginAs, openConsole, waitForInboxLoad } from "./helpers/operatorConsole";

const VALID_CREDENTIALS = {
  username: "ana.lima",
  password: "Ana@123456",
} as const;

test.describe("feedback de erro global", () => {
  test("exibe modal para erro bloqueante no login", async ({ page }) => {
    await openConsole(page);

    await page.getByTestId("login-username-input").fill("ana.lima");
    await page.getByTestId("login-password-input").fill("senha-invalida");
    await page.getByTestId("login-submit-button").click();

    await expect(page.getByTestId("global-error-modal")).toBeVisible();
    await expect(page.getByTestId("global-error-modal-message")).toContainText("Usuario ou senha invalidos.");

    await page.getByTestId("global-error-modal-close").click();
    await expect(page.getByTestId("global-error-modal")).toHaveCount(0);
  });

  test("exibe toast para erro nao bloqueante ao filtrar inbox", async ({ page }) => {
    await openConsole(page);
    await loginAs(page, VALID_CREDENTIALS);
    await waitForInboxLoad(page);

    const initialToast = page.getByTestId("global-error-toast");
    if ((await initialToast.count()) > 0) {
      await page.waitForTimeout(5000);
    }

    await page.getByTestId("inbox-search-input").fill("x".repeat(130));
    await expect(page.getByTestId("global-error-toast")).toContainText("O filtro de busca esta muito longo.");
  });
});
