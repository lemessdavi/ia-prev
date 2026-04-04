/**
 * Mirror of packages/utils/src/conversationAttachmentExportZipFileName.ts — keep in sync.
 */
const CONV_WA_PREFIX = "conv_wa_";

export function conversationAttachmentExportZipFileName(conversationId: string): string {
  const trimmed = conversationId.trim();
  const contactToken = tryExtractWhatsappContactWaToken(trimmed);
  if (contactToken) {
    const safe = sanitizeZipPhoneBase(contactToken);
    return `${safe}.zip`;
  }
  return legacyArquivosConversaZipFileName(trimmed);
}

function tryExtractWhatsappContactWaToken(conversationId: string): string | undefined {
  if (!conversationId.startsWith(CONV_WA_PREFIX)) {
    return undefined;
  }
  const rest = conversationId.slice(CONV_WA_PREFIX.length);
  const parts = rest.split("_");
  if (parts.length < 3) {
    return undefined;
  }
  const last = parts[parts.length - 1];
  return last && last.length > 0 ? last : undefined;
}

function sanitizeZipPhoneBase(token: string): string {
  const normalized = token.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized.length > 0 ? normalized : "conversa";
}

function legacyArquivosConversaZipFileName(conversationId: string): string {
  const normalized = conversationId.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
  const safeConversationId = normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "conversa";
  return `arquivos-conversa-${safeConversationId}.zip`;
}
