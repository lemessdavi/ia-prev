import { expect, type Page } from "@playwright/test";

export type OperatorCredentials = {
  username: string;
  password: string;
};

async function waitForHydration(page: Page): Promise<void> {
  await expect(page.getByTestId("app-hydrated")).toBeAttached({ timeout: 20_000 });
}

export async function openConsole(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const expectedAppMarkerCount =
    (await page.getByTestId("login-screen").count()) +
    (await page.getByTestId("workspace-tenant-name").count()) +
    (await page.getByTestId("convex-url-missing-screen").count());

  if (expectedAppMarkerCount === 0) {
    throw new Error(
      "A URL de E2E nao aponta para o app web do IAPrev. Defina E2E_BASE_URL corretamente ou libere a porta 3100 para o servidor de teste.",
    );
  }

  if ((await page.getByTestId("convex-url-missing-screen").count()) > 0) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL nao configurada para o app web durante o E2E.");
  }

  await waitForHydration(page);
}

export async function loginAs(page: Page, credentials: OperatorCredentials): Promise<void> {
  await waitForHydration(page);

  const loginScreen = page.getByTestId("login-screen");
  if ((await loginScreen.count()) > 0) {
    await expect(loginScreen).toBeVisible();
    await page.getByTestId("login-username-input").fill(credentials.username);
    await page.getByTestId("login-password-input").fill(credentials.password);
    await page.getByTestId("login-submit-button").click();
  }

  try {
    await expect(page.getByTestId("workspace-tenant-name")).toBeVisible({ timeout: 15_000 });
  } catch {
    const errorBanner = page.getByTestId("global-error-banner");
    const errorMessage = (await errorBanner.first().textContent().catch(() => null))?.trim();
    throw new Error(
      `Falha ao autenticar no E2E. ${errorMessage ? `Mensagem da UI: ${errorMessage}` : "Sem mensagem de erro visivel."}`,
    );
  }

  await waitForInboxLoad(page);
}

export async function logout(page: Page): Promise<void> {
  if ((await page.getByTestId("logout-button").count()) === 0) {
    return;
  }

  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("login-screen")).toBeVisible();
}

export async function waitForInboxLoad(page: Page): Promise<void> {
  const loader = page.getByTestId("inbox-loading-state");
  if ((await loader.count()) > 0) {
    await loader.first().waitFor({ state: "detached" }).catch(() => undefined);
  }
}
