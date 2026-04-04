import test from "node:test";
import assert from "node:assert/strict";
import {
  formatConversationStatusLabel,
  isAssistantSenderId,
  resolveThreadMessageOrigin,
  shouldRenderMessageOnRight,
} from "../src/messagePresentation";

const OPERATOR_ID = "usr_ana";

test("identifica sender da IA por prefixo assistant", () => {
  assert.equal(isAssistantSenderId("assistant_whatsapp"), true);
  assert.equal(isAssistantSenderId("assistant-whatsapp"), true);
  assert.equal(isAssistantSenderId("assistant"), true);
  assert.equal(isAssistantSenderId(" usr_ana "), false);
  assert.equal(isAssistantSenderId("usr_caio"), false);
});

test("classifica origem da mensagem para operador, IA e cliente", () => {
  assert.equal(resolveThreadMessageOrigin("usr_ana", OPERATOR_ID), "operator");
  assert.equal(resolveThreadMessageOrigin("assistant_whatsapp", OPERATOR_ID), "assistant");
  assert.equal(resolveThreadMessageOrigin("usr_caio", OPERATOR_ID), "client");
});

test("define alinhamento da mensagem: operador e IA a direita", () => {
  assert.equal(shouldRenderMessageOnRight("usr_ana", OPERATOR_ID), true);
  assert.equal(shouldRenderMessageOnRight("assistant_whatsapp", OPERATOR_ID), true);
  assert.equal(shouldRenderMessageOnRight("usr_caio", OPERATOR_ID), false);
});

test("formata labels de status com emoji para triagem e atendimento", () => {
  assert.equal(formatConversationStatusLabel("EM_TRIAGEM"), "🤖 Em triagem");
  assert.equal(formatConversationStatusLabel("EM_ATENDIMENTO_HUMANO"), "🧑 Em atendimento");
  assert.equal(formatConversationStatusLabel("PENDENTE_HUMANO"), "Pendente humano");
  assert.equal(formatConversationStatusLabel("FECHADO"), "Finalizado");
});
