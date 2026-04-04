import type { ConversationStatus } from "./backendApiTypes";

export type ThreadMessageOrigin = "operator" | "assistant" | "client";

const ASSISTANT_SENDER_PREFIXES = ["assistant", "ai_"] as const;

export function isAssistantSenderId(senderId: string): boolean {
  const normalized = senderId.trim().toLowerCase();
  if (!normalized) return false;
  return ASSISTANT_SENDER_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function resolveThreadMessageOrigin(senderId: string, operatorUserId: string): ThreadMessageOrigin {
  if (senderId === operatorUserId) return "operator";
  if (isAssistantSenderId(senderId)) return "assistant";
  return "client";
}

export function shouldRenderMessageOnRight(senderId: string, operatorUserId: string): boolean {
  return resolveThreadMessageOrigin(senderId, operatorUserId) !== "client";
}

export function formatConversationStatusLabel(status: ConversationStatus): string {
  switch (status) {
    case "EM_TRIAGEM":
      return "🤖 Em triagem";
    case "PENDENTE_HUMANO":
      return "Pendente humano";
    case "EM_ATENDIMENTO_HUMANO":
      return "🧑 Em atendimento";
    case "FECHADO":
      return "Finalizado";
    default:
      return status;
  }
}
