import { api as convexApi } from "@repo/convex-backend";
import { ConvexReactClient } from "convex/react";
import type {
  BackendApiError,
  ConversationInboxItemDTO,
  ConversationThreadPayloadDTO,
  DossierExportDTO,
  LoginResponse,
  TenantWorkspaceSummaryDTO,
} from "./backendApiTypes";

const DEFAULT_CONVEX_URL = "";

const convexClientsByUrl = new Map<string, ConvexReactClient>();

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

function getConvexClient(convexUrl: string): ConvexReactClient {
  const normalized = convexUrl.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new BackendApiClientError("Convex URL is not configured.", "INTERNAL", 500);
  }

  const existing = convexClientsByUrl.get(normalized);
  if (existing) return existing;

  const next = new ConvexReactClient(normalized);
  convexClientsByUrl.set(normalized, next);
  return next;
}

function parseBackendError(error: unknown): BackendApiError["error"] {
  const fallback = {
    code: "INTERNAL" as const,
    message: error instanceof Error ? error.message : "Unexpected Convex error.",
    meta: undefined as Record<string, unknown> | undefined,
  };

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const candidate = error as { data?: unknown; message?: string };

  if (candidate.data && typeof candidate.data === "object") {
    const data = candidate.data as { code?: string; message?: string; details?: string };
    let meta: Record<string, unknown> | undefined;

    if (typeof data.details === "string") {
      try {
        const parsed = JSON.parse(data.details) as Record<string, unknown>;
        meta = parsed;
      } catch {
        meta = undefined;
      }
    }

    return {
      code: (data.code as BackendApiError["error"]["code"]) ?? "INTERNAL",
      message: data.message ?? fallback.message,
      meta,
    };
  }

  if (typeof candidate.data === "string" && candidate.data.length > 0) {
    try {
      const parsed = JSON.parse(candidate.data) as { code?: string; message?: string; details?: string };
      return {
        code: (parsed.code as BackendApiError["error"]["code"]) ?? "INTERNAL",
        message: parsed.message ?? fallback.message,
      };
    } catch {
      return {
        code: "INTERNAL",
        message: candidate.data,
      };
    }
  }

  return {
    code: "INTERNAL",
    message: candidate.message ?? fallback.message,
  };
}

export function createBackendApiClient(convexUrl = DEFAULT_CONVEX_URL): BackendApiClient {
  let sessionToken: string | null = null;

  function requireSessionToken(): string {
    if (!sessionToken) {
      throw new BackendApiClientError("You must be logged in.", "UNAUTHENTICATED", 401);
    }
    return sessionToken;
  }

  async function execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof BackendApiClientError) {
        throw error;
      }

      const parsed = parseBackendError(error);
      const status =
        parsed.code === "BAD_REQUEST"
          ? 400
          : parsed.code === "UNAUTHENTICATED"
            ? 401
            : parsed.code === "FORBIDDEN"
              ? 403
              : parsed.code === "NOT_FOUND"
                ? 404
                : 500;

      throw new BackendApiClientError(parsed.message, parsed.code, status, parsed.meta);
    }
  }

  return {
    setSessionToken(token: string | null) {
      sessionToken = token;
    },
    getSessionToken() {
      return sessionToken;
    },
    async login(username: string, password: string) {
      return await execute(async () => {
        const client = getConvexClient(convexUrl);
        const session = await client.action(convexApi.auth.loginWithUsernamePassword, {
          username,
          password,
        });

        sessionToken = session.sessionToken;

        return {
          sessionToken: session.sessionToken,
          session: {
            sessionId: session.sessionToken,
            userId: session.userId,
            tenantId: session.tenantId,
            role: session.role,
            createdAt: session.createdAt,
          },
        };
      });
    },
    async logout() {
      await execute(async () => {
        if (!sessionToken) {
          return;
        }

        const client = getConvexClient(convexUrl);
        await client.mutation(convexApi.auth.logout, {
          sessionToken,
        });

        sessionToken = null;
      });
    },
    async getWorkspace() {
      return await execute(async () => {
        const client = getConvexClient(convexUrl);
        return await client.query(convexApi.chat.getTenantWorkspaceSummary, {
          sessionToken: requireSessionToken(),
        });
      });
    },
    async listConversations(params) {
      return await execute(async () => {
        const client = getConvexClient(convexUrl);
        return await client.query(convexApi.chat.listConversationsForInbox, {
          sessionToken: requireSessionToken(),
          status: params?.status as "ALL" | "EM_TRIAGEM" | "PENDENTE_HUMANO" | "EM_ATENDIMENTO_HUMANO" | "FECHADO" | undefined,
          search: params?.search,
        });
      });
    },
    async getConversationThread(conversationId) {
      return await execute(async () => {
        const client = getConvexClient(convexUrl);
        return await client.query(convexApi.chat.getConversationThread, {
          sessionToken: requireSessionToken(),
          conversationId,
        });
      });
    },
    async markConversationAsRead(conversationId) {
      return await execute(async () => {
        const client = getConvexClient(convexUrl);
        return await client.mutation(convexApi.chat.markConversationAsRead, {
          sessionToken: requireSessionToken(),
          conversationId,
        });
      });
    },
    async sendMessage(conversationId, body, attachmentUrl) {
      await execute(async () => {
        const client = getConvexClient(convexUrl);
        await client.action(convexApi.chat.sendMessage, {
          sessionToken: requireSessionToken(),
          conversationId,
          body,
          attachmentUrl,
        });
      });
    },
    async takeHandoff(conversationId) {
      await execute(async () => {
        const client = getConvexClient(convexUrl);
        await client.action(convexApi.chat.takeConversationHandoff, {
          sessionToken: requireSessionToken(),
          conversationId,
        });
      });
    },
    async closeConversation(conversationId, reason) {
      await execute(async () => {
        const client = getConvexClient(convexUrl);
        await client.mutation(convexApi.chat.closeConversationWithReason, {
          sessionToken: requireSessionToken(),
          conversationId,
          reason,
        });
      });
    },
    async exportDossier(conversationId) {
      return await execute(async () => {
        const client = getConvexClient(convexUrl);
        return await client.mutation(convexApi.chat.exportConversationDossier, {
          sessionToken: requireSessionToken(),
          conversationId,
        });
      });
    },
  };
}
