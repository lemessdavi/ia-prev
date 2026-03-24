import { ConvexError } from "convex/values";

export type BusinessErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND";

export function throwBusinessError(
  code: BusinessErrorCode,
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new ConvexError({
    code,
    message,
    details: details ? JSON.stringify(details) : undefined,
  });
}

export function parseBusinessError(error: unknown): { code?: string; message?: string } {
  if (!error || typeof error !== "object") {
    return {};
  }

  const candidate = error as { data?: unknown; message?: string };
  if (candidate.data && typeof candidate.data === "object") {
    const data = candidate.data as { code?: string; message?: string };
    return {
      code: data.code,
      message: data.message,
    };
  }

  if (typeof candidate.data === "string") {
    try {
      const parsed = JSON.parse(candidate.data) as { code?: string; message?: string };
      return {
        code: parsed.code,
        message: parsed.message,
      };
    } catch {
      // Fall through to message extraction when payload is not JSON.
    }
  }

  if (typeof candidate.data === "string" && candidate.data.length > 0) {
    return {
      message: candidate.data,
    };
  }

  return {
    message: candidate.message,
  };
}
