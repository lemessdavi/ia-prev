import test from "node:test";
import assert from "node:assert/strict";
import { classifyErrorFeedback, shouldSuppressErrorFeedback, translateErrorMessage } from "../src/errorFeedback";

test("traduz mensagem de negocio em ingles para portugues", () => {
  assert.equal(translateErrorMessage("Conversation not found."), "Conversa nao encontrada.");
  assert.equal(translateErrorMessage("search filter is too long."), "O filtro de busca esta muito longo.");
});

test("classifica erros de autenticacao como bloqueantes com modal", () => {
  const feedback = classifyErrorFeedback({
    code: "UNAUTHENTICATED",
    message: "Invalid username or password.",
    fallbackMessage: "Falha no login.",
    operation: "login",
  });

  assert.equal(feedback.message, "Usuario ou senha invalidos.");
  assert.equal(feedback.blocking, true);
  assert.equal(feedback.surface, "modal");
});

test("classifica erro de filtro de busca como nao bloqueante com toast", () => {
  const feedback = classifyErrorFeedback({
    code: "BAD_REQUEST",
    message: "search filter is too long.",
    fallbackMessage: "Falha ao carregar conversas.",
    operation: "loadConversations",
  });

  assert.equal(feedback.message, "O filtro de busca esta muito longo.");
  assert.equal(feedback.blocking, false);
  assert.equal(feedback.surface, "toast");
});

test("classifica validacao local bloqueante em fechamento como modal", () => {
  const feedback = classifyErrorFeedback({
    fallbackMessage: "Informe o motivo do encerramento.",
    operation: "closeConversation",
  });

  assert.equal(feedback.message, "Informe o motivo do encerramento para continuar.");
  assert.equal(feedback.blocking, true);
  assert.equal(feedback.surface, "modal");
});

test("suprime toast quando o dossie ainda nao existe na carga automatica", () => {
  const shouldSuppress = shouldSuppressErrorFeedback({
    code: "NOT_FOUND",
    message: "Dossier not found for this conversation.",
    operation: "loadDossier",
  });

  assert.equal(shouldSuppress, true);
});

test("suprime toast para variacao curta de mensagem de dossie ausente", () => {
  const shouldSuppress = shouldSuppressErrorFeedback({
    code: "NOT_FOUND",
    message: "Dossier not found",
    operation: "loadDossier",
  });

  assert.equal(shouldSuppress, true);
});

test("nao suprime feedback para outras operacoes mesmo com NOT_FOUND", () => {
  const shouldSuppress = shouldSuppressErrorFeedback({
    code: "NOT_FOUND",
    message: "Dossier not found for this conversation.",
    operation: "exportDossier",
  });

  assert.equal(shouldSuppress, false);
});
