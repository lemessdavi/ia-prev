export class BackendError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "BAD_REQUEST"
      | "NOT_FOUND",
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

export function logError(error: BackendError): void {
  console.error("[backend:error]", {
    code: error.code,
    message: error.message,
    meta: error.meta ?? {},
  });
}

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  console.info("[backend:info]", { message, meta: meta ?? {} });
}
