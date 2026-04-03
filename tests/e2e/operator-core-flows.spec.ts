import { expect, test } from "@playwright/test";
import { loginAs, logout, openConsole, waitForInboxLoad } from "./helpers/operatorConsole";

const ANA_CREDENTIALS = {
  username: "ana.lima",
  password: "Ana@123456",
} as const;

const CONVERSATION_CAIO = "conv_ana_caio";
const CONVERSATION_MARINA = "conv_ana_marina";

test.describe("IAP-21 - fluxo operacional principal", () => {
  test("valida login, sessao, inbox, chat, envio, handoff, fechamento e dossie", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "Fluxo completo validado no cenário desktop.");

    await openConsole(page);
    await loginAs(page, ANA_CREDENTIALS);

    await expect(page.getByTestId("workspace-tenant-name")).toHaveText("Lemes Advocacia");
    await expect(page.getByTestId("workspace-operator-name")).toContainText("Ana Lima");
    await expect(page.getByTestId(`conversation-item-${CONVERSATION_CAIO}`)).toBeVisible();
    await expect(page.getByTestId(`conversation-item-${CONVERSATION_MARINA}`)).toBeVisible();

    await page.getByTestId("inbox-search-input").fill("Marina");
    await expect(page.getByTestId(`conversation-item-${CONVERSATION_MARINA}`)).toBeVisible();
    await expect(page.getByTestId(`conversation-item-${CONVERSATION_CAIO}`)).toHaveCount(0);

    await page.getByTestId("inbox-search-input").fill("");
    await page.getByTestId("status-filter-PENDENTE_HUMANO").click();
    await waitForInboxLoad(page);
    const filteredConversationCount = await page.locator("[data-testid^='conversation-item-']").count();
    if (filteredConversationCount === 0) {
      await expect(page.getByText("Nenhuma conversa para os filtros atuais.")).toBeVisible();
    }

    await page.getByTestId("status-filter-ALL").click();
    await waitForInboxLoad(page);

    const marinaStatus = (await page.getByTestId(`conversation-status-${CONVERSATION_MARINA}`).textContent()) ?? "";
    const caioStatus = (await page.getByTestId(`conversation-status-${CONVERSATION_CAIO}`).textContent()) ?? "";
    const handoffConversationId = !marinaStatus.includes("Fechado")
      ? CONVERSATION_MARINA
      : !caioStatus.includes("Fechado")
        ? CONVERSATION_CAIO
        : null;

    test.skip(!handoffConversationId, "Nao ha conversa aberta para validar handoff. Rode em ambiente com seed limpa.");
    await page.getByTestId(`conversation-item-${handoffConversationId!}`).click();
    await expect(page.getByTestId("chat-title")).toBeVisible();

    await page.getByTestId("handoff-button").click();
    await expect(page.getByTestId(`conversation-status-${handoffConversationId!}`)).toContainText("Em atendimento");

    await page.getByTestId(`conversation-item-${CONVERSATION_CAIO}`).click();

    await expect(page.getByTestId("chat-title")).toContainText("Caio");
    await expect(page.getByTestId("thread-message-attachment-msg_3")).toBeVisible();

    const outboundBody = `Playwright e2e ${Date.now()}`;
    await page.getByTestId("chat-message-input").fill(outboundBody);
    await page.getByTestId("chat-send-button").click();
    const sentMessage = page.locator("[data-testid^='thread-message-']").filter({ hasText: outboundBody });
    await expect(sentMessage).toHaveCount(1);
    await expect(sentMessage.first()).toBeVisible();

    const closureReason = `Encerrado no e2e ${Date.now()}`;
    await page.getByTestId("dossier-closure-reason-input").fill(closureReason);
    await page.getByTestId("dossier-close-button").click();
    await expect(page.getByTestId("dossier-status-badge")).toContainText("Fechado");

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("dossier-export-button").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(`dossie-${CONVERSATION_CAIO}.zip`);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (!downloadPath) {
      throw new Error("Arquivo de exportacao do dossie nao foi salvo.");
    }

    const pdfDownloadPromise = page.waitForEvent("download");
    await page.getByTestId("dossier-export-pdf-button").click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toContain(`dossie-${CONVERSATION_CAIO}.pdf`);

    await page.reload();
    await expect(page.getByTestId("workspace-tenant-name")).toHaveText("Lemes Advocacia");

    await logout(page);
  });
});
