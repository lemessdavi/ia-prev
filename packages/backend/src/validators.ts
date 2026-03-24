import { BackendError } from "./errors";

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

export function assertTenantName(name: string, field = "name"): string {
  if (!name || typeof name !== "string") {
    throw new BackendError(`${field} is required.`, "BAD_REQUEST", { field });
  }

  const normalized = name.trim();
  if (normalized.length < 2 || normalized.length > 120) {
    throw new BackendError(`${field} must be between 2 and 120 chars.`, "BAD_REQUEST", {
      field,
      length: normalized.length,
    });
  }

  return normalized;
}

export function assertSlug(slug: string, field = "slug"): string {
  if (!slug || typeof slug !== "string") {
    throw new BackendError(`${field} is required.`, "BAD_REQUEST", { field });
  }

  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,64}$/.test(normalized)) {
    throw new BackendError(`${field} must have 3 to 64 chars and use only lowercase letters, numbers and dash.`, "BAD_REQUEST", {
      field,
      slug: normalized,
    });
  }

  return normalized;
}

export function assertEmail(email: string): string {
  if (!email || typeof email !== "string") {
    throw new BackendError("email is required.", "BAD_REQUEST");
  }

  const normalized = email.trim().toLowerCase();
  if (normalized.length < 5 || normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new BackendError("email is invalid.", "BAD_REQUEST", { email });
  }

  return normalized;
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
