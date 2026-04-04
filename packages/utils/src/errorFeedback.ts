export type ErrorFeedbackSurface = "modal" | "toast";

export type ErrorFeedbackOperation =
  | "config"
  | "login"
  | "restoreSession"
  | "loadConversations"
  | "loadThread"
  | "loadDossier"
  | "markConversationAsRead"
  | "sendMessage"
  | "retryMessageSend"
  | "takeHandoff"
  | "setTriageResult"
  | "closeConversation"
  | "exportDossier"
  | "unknown";

export type ErrorFeedbackInput = {
  code?: string | null;
  message?: string | null;
  fallbackMessage: string;
  operation: ErrorFeedbackOperation;
};

export type ErrorFeedbackSuppressionInput = Pick<ErrorFeedbackInput, "code" | "message" | "operation">;

export type ErrorFeedback = {
  message: string;
  blocking: boolean;
  surface: ErrorFeedbackSurface;
};

const TRANSLATIONS: Record<string, string> = {
  "Convex URL is not configured.": "A URL do Convex nao esta configurada.",
  "You must be logged in.": "Voce precisa estar autenticado para continuar.",
  "Unexpected Convex error.": "Ocorreu um erro inesperado no backend.",
  "Invalid username or password.": "Usuario ou senha invalidos.",
  "Your session is invalid or has expired.": "Sua sessao e invalida ou expirou. Faca login novamente.",
  "This user is disabled.": "Este usuario esta desativado.",
  "You do not have permission to access this resource.": "Voce nao tem permissao para acessar este recurso.",
  "You do not have permission to access this tenant.": "Voce nao tem permissao para acessar este tenant.",
  "Operator was not found for this session.": "Operador nao encontrado para esta sessao.",
  "Conversation not found.": "Conversa nao encontrada.",
  "Conversation not found for mapped tenant.": "Conversa nao encontrada para o tenant mapeado.",
  "Conversation is missing participants.": "A conversa esta sem participantes.",
  "Conversation is already closed.": "A conversa ja esta encerrada.",
  "Conversation is not linked to a WhatsApp contact.": "A conversa nao esta vinculada a um contato do WhatsApp.",
  "Conversation WhatsApp contact is invalid.": "O contato do WhatsApp da conversa e invalido.",
  "You cannot access this conversation.": "Voce nao pode acessar esta conversa.",
  "You cannot send messages to this conversation.": "Voce nao pode enviar mensagens para esta conversa.",
  "You cannot update this conversation.": "Voce nao pode atualizar esta conversa.",
  "You cannot update triage for this conversation.": "Voce nao pode atualizar a triagem desta conversa.",
  "No active WABA mapping found for tenant.": "Nenhum mapeamento WABA ativo foi encontrado para o tenant.",
  "Unable to resolve WABA mapping for conversation.": "Nao foi possivel resolver o mapeamento WABA da conversa.",
  "WABA mapping not found for phone_number_id.": "Mapeamento WABA nao encontrado para o phone_number_id.",
  "Dossier not found for this conversation.": "Dossie nao encontrado para esta conversa.",
  "Dossier not found for this contact.": "Dossie nao encontrado para este contato.",
  "User account is linked to an unknown user.": "A conta esta vinculada a um usuario desconhecido.",
  "User not found.": "Usuario nao encontrado.",
  "Tenant workspace is not fully configured.": "O workspace do tenant nao esta totalmente configurado.",
  "Tenant not found.": "Tenant nao encontrado.",
  "User id already exists.": "O ID de usuario ja existe.",
  "Username already exists.": "O nome de usuario ja existe.",
  "Email already exists for this tenant.": "O e-mail ja existe para este tenant.",
  "AI profile id already exists.": "O ID do perfil de IA ja existe.",
  "AI profile not found for this tenant.": "Perfil de IA nao encontrado para este tenant.",
  "AI profile not found.": "Perfil de IA nao encontrado.",
  "Tenant id already exists.": "O ID do tenant ja existe.",
  "Tenant slug already exists.": "O slug do tenant ja existe.",
  "phone_number_id already mapped to another tenant.": "O phone_number_id ja esta mapeado para outro tenant.",
  "phoneNumberId and contactWaId are required.": "phoneNumberId e contactWaId sao obrigatorios.",
  "phoneNumberId, conversationId and body are required.": "phoneNumberId, conversationId e body sao obrigatorios.",
  "Session revocation requires write access to the database.": "A revogacao de sessao exige acesso de escrita ao banco de dados.",
  "Invalid seed key.": "Chave de seed invalida.",
  "Failed to send handoff notification to WhatsApp.": "Falha ao enviar a notificacao de handoff para o WhatsApp.",
  "Failed to send message to WhatsApp.": "Falha ao enviar mensagem para o WhatsApp.",
  "Message body must not be empty.": "O conteudo da mensagem nao pode estar vazio.",
  "Message must be between 1 and 1500 chars.": "A mensagem deve ter entre 1 e 1500 caracteres.",
  "Attachment URL must use https.": "A URL do anexo deve usar HTTPS.",
  "status filter is invalid.": "O filtro de status e invalido.",
  "search filter is too long.": "O filtro de busca esta muito longo.",
  "Closure reason must be between 5 and 500 chars.": "O motivo de encerramento deve ter entre 5 e 500 caracteres.",
  "flowType is required when triage answers were not previously initialized.":
    "flowType e obrigatorio quando as respostas de triagem ainda nao foram inicializadas.",
  "Falha no login.": "Nao foi possivel entrar. Verifique suas credenciais e tente novamente.",
  "Nao foi possivel restaurar a sessao.": "Nao foi possivel restaurar a sessao. Faca login novamente.",
  "Falha ao carregar conversas.": "Nao foi possivel carregar as conversas.",
  "Falha ao carregar mensagens.": "Nao foi possivel carregar as mensagens.",
  "Falha ao carregar dossie.": "Nao foi possivel carregar o dossie.",
  "Falha ao marcar conversa como lida.": "Nao foi possivel marcar a conversa como lida.",
  "Falha ao enviar mensagem.": "Nao foi possivel enviar a mensagem.",
  "Falha ao reenviar mensagem.": "Nao foi possivel reenviar a mensagem.",
  "Falha ao assumir conversa.": "Nao foi possivel assumir a conversa.",
  "Falha ao atualizar resultado da triagem.": "Nao foi possivel atualizar o resultado da triagem.",
  "Falha ao encerrar conversa.": "Nao foi possivel encerrar a conversa.",
  "Falha ao encerrar caso.": "Nao foi possivel encerrar o caso.",
  "Falha ao exportar dossie.": "Nao foi possivel exportar o dossie.",
  "Informe o motivo do encerramento.": "Informe o motivo do encerramento para continuar.",
};

const BLOCKING_CODES = new Set(["UNAUTHENTICATED", "FORBIDDEN"]);
const BLOCKING_OPERATIONS = new Set<ErrorFeedbackOperation>(["config", "login", "restoreSession"]);
const BLOCKING_MESSAGES = new Set([
  "A URL do Convex nao esta configurada.",
  "Informe o motivo do encerramento para continuar.",
]);
const DOSSIER_NOT_FOUND_PATTERN = /(dossie|dossier).*(nao encontrado|not found)|(nao encontrado|not found).*(dossie|dossier)/i;

export function translateErrorMessage(message: string): string {
  const normalized = message.trim();
  if (normalized.length === 0) return "Ocorreu um erro inesperado.";

  if (normalized in TRANSLATIONS) {
    return TRANSLATIONS[normalized];
  }

  const invalidFieldMatch = normalized.match(/^Invalid (.+)\.$/);
  if (invalidFieldMatch) {
    return `${invalidFieldMatch[1]} invalido.`;
  }

  const betweenCharsMatch = normalized.match(/^(.+) must be between (\d+) and (\d+) chars\.$/);
  if (betweenCharsMatch) {
    return `${betweenCharsMatch[1]} deve ter entre ${betweenCharsMatch[2]} e ${betweenCharsMatch[3]} caracteres.`;
  }

  const charsAndCharsetMatch = normalized.match(
    /^(.+) must have 3 to 64 chars and use only lowercase letters, numbers and dash\.$/,
  );
  if (charsAndCharsetMatch) {
    return `${charsAndCharsetMatch[1]} deve ter de 3 a 64 caracteres e usar apenas letras minusculas, numeros e hifen.`;
  }

  const requestFailedMatch = normalized.match(/^request_failed:(.+)$/);
  if (requestFailedMatch) {
    return `Falha na requisicao: ${requestFailedMatch[1]}.`;
  }

  const httpFailureMatch = normalized.match(/^http_(\d+):(.+)$/);
  if (httpFailureMatch) {
    return `Falha HTTP ${httpFailureMatch[1]}: ${httpFailureMatch[2]}.`;
  }

  return normalized;
}

export function classifyErrorFeedback(input: ErrorFeedbackInput): ErrorFeedback {
  const sourceMessage = (input.message && input.message.trim().length > 0 ? input.message : input.fallbackMessage).trim();
  const translatedMessage = translateErrorMessage(sourceMessage);
  const normalizedCode = input.code?.trim().toUpperCase();
  const isBlocking =
    Boolean(normalizedCode && BLOCKING_CODES.has(normalizedCode)) ||
    BLOCKING_OPERATIONS.has(input.operation) ||
    BLOCKING_MESSAGES.has(translatedMessage);

  return {
    message: translatedMessage,
    blocking: isBlocking,
    surface: isBlocking ? "modal" : "toast",
  };
}

export function shouldSuppressErrorFeedback(input: ErrorFeedbackSuppressionInput): boolean {
  const normalizedCode = input.code?.trim().toUpperCase();
  if (input.operation !== "loadDossier" || normalizedCode !== "NOT_FOUND") {
    return false;
  }

  const rawMessage = (input.message ?? "").trim();
  const translatedMessage = translateErrorMessage(rawMessage);
  return DOSSIER_NOT_FOUND_PATTERN.test(rawMessage) || DOSSIER_NOT_FOUND_PATTERN.test(translatedMessage);
}
