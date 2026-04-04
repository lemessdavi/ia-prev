import { expect, test } from "@playwright/test";
import { loginAs, openConsole, waitForInboxLoad } from "./helpers/operatorConsole";

const ANA_CREDENTIALS = {
  username: "ana.lima",
  password: "Ana@123456",
} as const;

const CONVERSATION_CAIO = "conv_ana_caio";

test.describe("IAP-21 - realtime sem polling visual", () => {
  test("nao reapresenta loading periodico no inbox/chat apos primeira carga", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Validacao focada no fluxo desktop.");

    await openConsole(page);
    await loginAs(page, ANA_CREDENTIALS);
    await waitForInboxLoad(page);

    await page.getByTestId(`conversation-item-${CONVERSATION_CAIO}`).click();
    await expect(page.getByTestId("chat-title")).toContainText("Caio");
    await expect(page.getByTestId("thread-message-msg_1")).toBeVisible();

    await expect(page.getByTestId("inbox-loading-state")).toHaveCount(0);
    await expect(page.getByTestId("thread-loading-state")).toHaveCount(0);

    await page.evaluate(() => {
      const mark = () => {
        if (document.querySelector("[data-testid='inbox-loading-state'], [data-testid='thread-loading-state']")) {
          (window as typeof window & { __iapLoaderSeen?: boolean }).__iapLoaderSeen = true;
        }
      };

      (window as typeof window & { __iapLoaderSeen?: boolean }).__iapLoaderSeen = false;
      mark();

      const observer = new MutationObserver(mark);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      (window as typeof window & { __iapLoaderObserver?: MutationObserver }).__iapLoaderObserver = observer;
    });

    await page.waitForTimeout(7_000);

    const loaderSeen = await page.evaluate(() => {
      const typedWindow = window as typeof window & {
        __iapLoaderSeen?: boolean;
        __iapLoaderObserver?: MutationObserver;
      };
      typedWindow.__iapLoaderObserver?.disconnect();
      return typedWindow.__iapLoaderSeen ?? false;
    });

    expect(loaderSeen).toBe(false);
  });
});
