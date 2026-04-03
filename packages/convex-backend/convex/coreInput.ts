import { throwBusinessError } from "./coreErrors";
import {
  formatClosureReason,
  getClosureReasonByCode,
  normalizeClosureReasonDetail,
  type ClosureReasonCode,
} from "../src/closureReasons";

export function assertId(value: string, field: string): string {
  const normalized = value?.trim();
  if (!normalized || normalized.length < 3) {
    throwBusinessError("BAD_REQUEST", `Invalid ${field}.`, { field, value });
  }
  return normalized;
}

export function assertUsername(username: string): string {
  const normalized = username?.trim().toLowerCase();
  if (!normalized || normalized.length < 3 || normalized.length > 64 || !/^[a-z0-9._-]+$/.test(normalized)) {
    throwBusinessError(
      "BAD_REQUEST",
      "Username must have 3 to 64 chars and use only letters, numbers, dot, dash or underscore.",
      { username },
    );
  }
  return normalized;
}

export function assertPassword(password: string, field = "password"): string {
  if (!password || password.length < 8 || password.length > 128) {
    throwBusinessError("BAD_REQUEST", `${field} must be between 8 and 128 chars.`, {
      field,
      length: password?.length ?? 0,
    });
  }
  return password;
}

export function assertTenantName(name: string, field = "name"): string {
  const normalized = name?.trim();
  if (!normalized || normalized.length < 2 || normalized.length > 120) {
    throwBusinessError("BAD_REQUEST", `${field} must be between 2 and 120 chars.`, {
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
      `${field} must have 3 to 64 chars and use only lowercase letters, numbers and dash.`,
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
    throwBusinessError("BAD_REQUEST", "email is invalid.", { email });
  }
  return normalized;
}

export function assertMessageBody(body: string): string {
  const trimmed = body?.trim();
  if (!trimmed || trimmed.length < 1 || trimmed.length > 1500) {
    throwBusinessError("BAD_REQUEST", "Message must be between 1 and 1500 chars.", {
      length: trimmed?.length ?? 0,
    });
  }
  return trimmed;
}

export function assertAttachmentUrl(attachmentUrl?: string): string | undefined {
  if (attachmentUrl === undefined) return undefined;
  if (!attachmentUrl.startsWith("https://")) {
    throwBusinessError("BAD_REQUEST", "Attachment URL must use https.", {
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

  throwBusinessError("BAD_REQUEST", "status filter is invalid.", {
    status,
  });
}

export function assertSearchTerm(search?: string): string | undefined {
  if (!search) return undefined;
  const normalized = search.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  if (normalized.length > 120) {
    throwBusinessError("BAD_REQUEST", "search filter is too long.", {
      length: normalized.length,
    });
  }
  return normalized;
}

export function assertClosureReasonPayload(input: { reasonCode: string; reasonDetail?: string }): {
  reasonCode: ClosureReasonCode;
  reasonDetail?: string;
  closureReason: string;
} {
  const entry = getClosureReasonByCode(input.reasonCode);
  if (!entry) {
    throwBusinessError("BAD_REQUEST", "Closure reason code is invalid.", {
      reasonCode: input.reasonCode,
    });
  }

  const reasonDetail = normalizeClosureReasonDetail(input.reasonDetail);
  if (reasonDetail && reasonDetail.length > 320) {
    throwBusinessError("BAD_REQUEST", "Closure reason detail must be up to 320 chars.", {
      length: reasonDetail.length,
      reasonCode: entry.code,
    });
  }

  if (entry.requiresDetail && !reasonDetail) {
    throwBusinessError("BAD_REQUEST", "Closure reason detail is required for this reason code.", {
      reasonCode: entry.code,
    });
  }

  const closureReason = formatClosureReason(entry.code, reasonDetail);
  if (closureReason.length > 500) {
    throwBusinessError("BAD_REQUEST", "Closure reason summary must be up to 500 chars.", {
      length: closureReason.length,
      reasonCode: entry.code,
    });
  }

  return {
    reasonCode: entry.code,
    reasonDetail,
    closureReason,
  };
}
