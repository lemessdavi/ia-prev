import { BackendError, logError } from "./errors";
import type { Session } from "./types";

export function requireSession(session: Session | null | undefined): Session {
  if (!session?.userId) {
    const error = new BackendError("You must be authenticated to call this function.", "UNAUTHENTICATED");
    logError(error);
    throw error;
  }
  return session;
}
