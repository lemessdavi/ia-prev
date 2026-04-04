import { expect, test } from "@playwright/test";
import { loginAs, openConsole, waitForInboxLoad } from "./helpers/operatorConsole";

const ANA_CREDENTIALS = {
  username: "ana.lima",
  password: "Ana@123456",
} as const;

const CONVERSATION_CAIO = "conv_ana_caio";

function buildBody(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index}`;
}

test.describe("IAP-21 - chat auto-scroll", () => {
  test("mantem no fim por padrao e respeita leitura quando usuario sobe", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Auto-scroll validado no cenário desktop.");

    await openConsole(page);
    await loginAs(page, ANA_CREDENTIALS);
    await waitForInboxLoad(page);

    await page.getByTestId(`conversation-item-${CONVERSATION_CAIO}`).click();
    await expect(page.getByTestId("chat-title")).toContainText("Caio");

    const chatScroll = page.getByTestId("chat-messages-scroll-container");

    const seedPrefix = `e2e-seed-${Date.now()}`;
    for (let index = 0; index < 12; index += 1) {
      const body = buildBody(seedPrefix, index);
      await page.getByTestId("chat-message-input").fill(body);
      await page.getByTestId("chat-send-button").click();
      await expect(page.locator("[data-testid^='thread-message-']").filter({ hasText: body }).first()).toBeVisible();
    }

    await chatScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    const pinnedBody = buildBody("e2e-pinned", 0);
    await page.getByTestId("chat-message-input").fill(pinnedBody);
    await page.getByTestId("chat-send-button").click();
    await expect(page.locator("[data-testid^='thread-message-']").filter({ hasText: pinnedBody }).first()).toBeVisible();

    const bottomDistancePinned = await chatScroll.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop);
    expect(bottomDistancePinned).toBeLessThanOrEqual(24);

    await chatScroll.evaluate((element) => {
      element.scrollTop = 0;
    });

    const awayFromBottomBefore = await chatScroll.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop);
    expect(awayFromBottomBefore).toBeGreaterThan(100);

    const unpinnedBody = buildBody("e2e-unpinned", 0);
    await page.getByTestId("chat-message-input").fill(unpinnedBody);
    await page.getByTestId("chat-send-button").click();
    await expect(page.locator("[data-testid^='thread-message-']").filter({ hasText: unpinnedBody }).first()).toBeVisible();

    const awayFromBottomAfter = await chatScroll.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop);
    expect(awayFromBottomAfter).toBeGreaterThan(100);

    const jumpButton = page.getByTestId("chat-scroll-to-latest-button");
    await expect(jumpButton).toBeVisible();
    await jumpButton.click();

    await expect
      .poll(async () => await chatScroll.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop))
      .toBeLessThanOrEqual(24);
    await expect(jumpButton).toBeHidden();
  });
});
