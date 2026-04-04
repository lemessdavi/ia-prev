import { throwBusinessError } from "./coreErrors";

export function assertId(value: string, field: string): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length < 3) {
    throwBusinessError("BAD_REQUEST", `${field} invalido.`, { field, value });
  }
  return normalized;
}

export function assertUsername(username: string): string {
  const normalized = username?.trim().toLowerCase();
  if (!normalized || normalized.length < 3 || normalized.length > 64 || !/^[a-z0-9._-]+$/.test(normalized)) {
    throwBusinessError(
      "BAD_REQUEST",
      "O nome de usuario deve ter de 3 a 64 caracteres e usar apenas letras, numeros, ponto, hifen ou underscore.",
      { username },
    );
  }
  return normalized;
}

export function assertPassword(password: string, field = "password"): string {
  if (!password || password.length < 8 || password.length > 128) {
    throwBusinessError("BAD_REQUEST", `${field} deve ter entre 8 e 128 caracteres.`, {
      field,
      length: password?.length ?? 0,
    });
  }
  return password;
}

export function assertTenantName(name: string, field = "name"): string {
  const normalized = name?.trim();
  if (!normalized || normalized.length < 2 || normalized.length > 120) {
    throwBusinessError("BAD_REQUEST", `${field} deve ter entre 2 e 120 caracteres.`, {
      field,
      length: normalized?.length ?? 0,
    });
  }
  return normalized;
}

export function assertSlug(slug: string, field = "slug"): string {
  const normalized = slug?.trim().toLowerCase();
  if (!normalized || !/^[a-z0-9-]{3,64}$/.test(normalized)) {
    throwBusinessError(
      "BAD_REQUEST",
      `${field} deve ter de 3 a 64 caracteres e usar apenas letras minusculas, numeros e hifen.`,
      {
        field,
        slug,
      },
    );
  }
  return normalized;
}

export function assertEmail(email: string): string {
  const normalized = email?.trim().toLowerCase();
  if (!normalized || normalized.length < 5 || normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throwBusinessError("BAD_REQUEST", "E-mail invalido.", { email });
  }
  return normalized;
}

export function assertMessageBody(body: string): string {
  const trimmed = body?.trim();
  if (!trimmed || trimmed.length < 1 || trimmed.length > 1500) {
    throwBusinessError("BAD_REQUEST", "A mensagem deve ter entre 1 e 1500 caracteres.", {
      length: trimmed?.length ?? 0,
    });
  }
  return trimmed;
}

export function assertAttachmentUrl(attachmentUrl?: string): string | undefined {
  if (attachmentUrl === undefined) return undefined;
  if (!attachmentUrl.startsWith("https://")) {
    throwBusinessError("BAD_REQUEST", "A URL do anexo deve usar HTTPS.", {
      attachmentUrl,
    });
  }
  return attachmentUrl;
}

export function assertConversationStatusFilter(status?: string):
  | "ALL"
  | "EM_TRIAGEM"
  | "PENDENTE_HUMANO"
  | "EM_ATENDIMENTO_HUMANO"
  | "FECHADO" {
  if (!status || status.trim().length === 0) {
    return "ALL";
  }

  const normalized = status.trim().toUpperCase();
  if (
    normalized === "ALL" ||
    normalized === "EM_TRIAGEM" ||
    normalized === "PENDENTE_HUMANO" ||
    normalized === "EM_ATENDIMENTO_HUMANO" ||
    normalized === "FECHADO"
  ) {
    return normalized;
  }

  throwBusinessError("BAD_REQUEST", "O filtro de status e invalido.", {
    status,
  });
}

export function assertSearchTerm(search?: string): string | undefined {
  if (!search) return undefined;
  const normalized = search.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  if (normalized.length > 120) {
    throwBusinessError("BAD_REQUEST", "O filtro de busca esta muito longo.", {
      length: normalized.length,
    });
  }
  return normalized;
}

export function assertClosureReason(reason: string): string {
  const normalized = reason?.trim();
  if (!normalized || normalized.length < 5 || normalized.length > 500) {
    throwBusinessError("BAD_REQUEST", "O motivo de encerramento deve ter entre 5 e 500 caracteres.", {
      length: normalized?.length ?? 0,
    });
  }
  return normalized;
}
