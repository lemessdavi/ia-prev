import type {
  BackendApiError,
  ConversationInboxItemDTO,
  ConversationThreadPayloadDTO,
  DossierExportDTO,
  LoginResponse,
  TenantWorkspaceSummaryDTO,
} from "./backendApiTypes";

const DEFAULT_BASE_URL = "/api/backend";
const SESSION_HEADER = "x-iap-session";

export class BackendApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BackendApiClientError";
  }
}

export interface BackendApiClient {
  setSessionToken(token: string | null): void;
  getSessionToken(): string | null;
  login(username: string, password: string): Promise<LoginResponse>;
  logout(): Promise<void>;
  getWorkspace(): Promise<TenantWorkspaceSummaryDTO>;
  listConversations(params?: { status?: string; search?: string }): Promise<ConversationInboxItemDTO[]>;
  getConversationThread(conversationId: string): Promise<ConversationThreadPayloadDTO>;
  markConversationAsRead(conversationId: string): Promise<{ conversationId: string; updatedCount: number }>;
  sendMessage(conversationId: string, body: string, attachmentUrl?: string): Promise<void>;
  takeHandoff(conversationId: string): Promise<void>;
  closeConversation(conversationId: string, reason: string): Promise<void>;
  exportDossier(conversationId: string): Promise<DossierExportDTO>;
}

export function createBackendApiClient(baseUrl = DEFAULT_BASE_URL): BackendApiClient {
  let sessionToken: string | null = null;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (sessionToken) {
      headers.set(SESSION_HEADER, sessionToken);
    }

    const response = await fetch(`${normalizedBaseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const fallbackMessage = `Request failed with status ${response.status}`;
      let payload: BackendApiError | null = null;
      try {
        payload = (await response.json()) as BackendApiError;
      } catch {
        payload = null;
      }

      throw new BackendApiClientError(
        payload?.error?.message ?? fallbackMessage,
        payload?.error?.code ?? "INTERNAL",
        response.status,
        payload?.error?.meta,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  return {
    setSessionToken(token: string | null) {
      sessionToken = token;
    },
    getSessionToken() {
      return sessionToken;
    },
    async login(username: string, password: string) {
      const payload = await request<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      sessionToken = payload.sessionToken;
      return payload;
    },
    async logout() {
      await request<void>("/auth/logout", { method: "POST" });
      sessionToken = null;
    },
    getWorkspace() {
      return request<TenantWorkspaceSummaryDTO>("/workspace");
    },
    listConversations(params) {
      const query = new URLSearchParams();
      if (params?.status) query.set("status", params.status);
      if (params?.search) query.set("search", params.search);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return request<ConversationInboxItemDTO[]>(`/conversations${suffix}`);
    },
    getConversationThread(conversationId) {
      return request<ConversationThreadPayloadDTO>(`/conversations/${conversationId}/thread`);
    },
    markConversationAsRead(conversationId) {
      return request<{ conversationId: string; updatedCount: number }>(`/conversations/${conversationId}/read`, {
        method: "POST",
      });
    },
    async sendMessage(conversationId, body, attachmentUrl) {
      await request(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, attachmentUrl }),
      });
    },
    async takeHandoff(conversationId) {
      await request(`/conversations/${conversationId}/handoff`, {
        method: "POST",
      });
    },
    async closeConversation(conversationId, reason) {
      await request(`/conversations/${conversationId}/close`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    exportDossier(conversationId) {
      return request<DossierExportDTO>(`/conversations/${conversationId}/dossier/export`);
    },
  };
}
