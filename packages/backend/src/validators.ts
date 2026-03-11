import { BackendError } from "./errors";

export function assertId(value: string, field: string): string {
  if (!value || typeof value !== "string" || value.trim().length < 3) {
    throw new BackendError(`Invalid ${field}.`, "BAD_REQUEST", { field, value });
  }
  return value;
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
