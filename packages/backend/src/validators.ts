import { BackendError } from "./errors";
import type { ConversationStatus } from "./types";

export function assertId(value: string, field: string): string {
  if (!value || typeof value !== "string" || value.trim().length < 3) {
    throw new BackendError(`Invalid ${field}.`, "BAD_REQUEST", { field, value });
  }
  return value;
}

export function assertUsername(username: string): string {
  if (!username || typeof username !== "string") {
    throw new BackendError("Username is required.", "BAD_REQUEST");
  }

  const normalized = username.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 64 || !/^[a-z0-9._-]+$/.test(normalized)) {
    throw new BackendError("Username must have 3 to 64 chars and use only letters, numbers, dot, dash or underscore.", "BAD_REQUEST", {
      username,
    });
  }

  return normalized;
}

export function assertPassword(password: string, field = "password"): string {
  if (!password || typeof password !== "string") {
    throw new BackendError(`${field} is required.`, "BAD_REQUEST");
  }

  if (password.length < 8 || password.length > 128) {
    throw new BackendError(`${field} must be between 8 and 128 chars.`, "BAD_REQUEST", {
      field,
      length: password.length,
    });
  }

  return password;
}

export function assertMessageBody(body: string): string {
  if (!body || typeof body !== "string") {
    throw new BackendError("Message body is required.", "BAD_REQUEST");
  }
  const trimmed = body.trim();
  if (trimmed.length < 1 || trimmed.length > 1500) {
    throw new BackendError("Message must be between 1 and 1500 chars.", "BAD_REQUEST", {
      length: trimmed.length,
    });
  }
  return trimmed;
}

export function assertAttachmentUrl(attachmentUrl?: string): string | undefined {
  if (attachmentUrl === undefined) return undefined;
  if (!attachmentUrl.startsWith("https://")) {
    throw new BackendError("Attachment URL must use https.", "BAD_REQUEST", {
      attachmentUrl,
    });
  }
  return attachmentUrl;
}

export function assertConversationStatusFilter(status?: string): ConversationStatus | "ALL" {
  if (!status) return "ALL";
  const normalized = status.trim().toUpperCase();
  if (normalized === "ALL") return "ALL";

  const allowedStatuses: ConversationStatus[] = ["EM_TRIAGEM", "PENDENTE_HUMANO", "EM_ATENDIMENTO_HUMANO", "FECHADO"];
  if ((allowedStatuses as string[]).includes(normalized)) {
    return normalized as ConversationStatus;
  }

  throw new BackendError("Invalid conversation status filter.", "BAD_REQUEST", { status });
}

export function assertSearchTerm(search?: string): string | undefined {
  if (search === undefined) return undefined;
  if (typeof search !== "string") {
    throw new BackendError("Search term must be a string.", "BAD_REQUEST");
  }

  const normalized = search.trim();
  if (!normalized) return undefined;
  if (normalized.length > 120) {
    throw new BackendError("Search term must have up to 120 chars.", "BAD_REQUEST", {
      length: normalized.length,
    });
  }

  return normalized.toLowerCase();
}

export function assertClosureReason(reason: string): string {
  if (!reason || typeof reason !== "string") {
    throw new BackendError("Closure reason is required.", "BAD_REQUEST");
  }

  const normalized = reason.trim();
  if (normalized.length < 5 || normalized.length > 320) {
    throw new BackendError("Closure reason must be between 5 and 320 chars.", "BAD_REQUEST", {
      length: normalized.length,
    });
  }

  return normalized;
}
