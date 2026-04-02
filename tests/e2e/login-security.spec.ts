import { expect, test } from "@playwright/test";
import { openConsole } from "./helpers/operatorConsole";

test.describe("IAP-21 - seguranca de login", () => {
  test("desktop inicia sem credenciais pre-preenchidas", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Cenario exclusivo do layout desktop.");

    await openConsole(page);

    await expect(page.getByTestId("login-screen")).toBeVisible();
    await expect(page.getByTestId("login-username-input")).toHaveValue("");
    await expect(page.getByTestId("login-password-input")).toHaveValue("");
  });

  test("mobile layout inicia sem credenciais pre-preenchidas", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-mobile", "Cenario exclusivo do layout mobile.");

    await openConsole(page);

    await expect(page.getByTestId("login-screen")).toBeVisible();
    await expect(page.getByTestId("login-username-input")).toHaveValue("");
    await expect(page.getByTestId("login-password-input")).toHaveValue("");
  });
});
