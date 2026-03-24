export const SESSION_TOKEN_STORAGE_KEY = "iap_convex_session_token";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function readStoredSessionToken(): string | null {
  if (!isBrowser()) return null;
  const token = window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
  if (!token) return null;
  return token.trim().length > 0 ? token : null;
}

export function storeSessionToken(sessionToken: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, sessionToken);
}

export function clearStoredSessionToken(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
}
