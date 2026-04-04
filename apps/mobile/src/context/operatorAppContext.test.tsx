import React, { type ReactNode, useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { OperatorAppProvider, useOperatorApp } from "./operatorAppContext";

const hoisted = vi.hoisted(() => {
  class MockBackendApiClientError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly status: number,
    ) {
      super(message);
      this.name = "BackendApiClientError";
    }
  }

  return {
    MockBackendApiClientError,
  };
});

vi.mock("utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("utils")>();
  return {
    ...actual,
    BackendApiClientError: hoisted.MockBackendApiClientError,
  };
});

type Conversation = {
  conversationId: string;
  title: string;
  conversationStatus: "EM_TRIAGEM" | "PENDENTE_HUMANO" | "EM_ATENDIMENTO_HUMANO" | "FECHADO";
  unreadCount: number;
  lastMessagePreview: string;
};

type Thread = {
  conversationId: string;
  title: string;
  conversationStatus: "EM_TRIAGEM" | "PENDENTE_HUMANO" | "EM_ATENDIMENTO_HUMANO" | "FECHADO";
  messages: Array<{
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    createdAt: number;
    attachment: null;
  }>;
  handoffHistory: unknown[];
};

type Dossier = {
  conversationId: string;
  contactId: string;
  generatedAtIso: string;
  dossier: {
    role: string;
    location: string;
    summary: string;
  };
  attachments: Array<{
    id: string;
    fileName: string;
    contentType: string;
    url: string;
  }>;
};

type Workspace = {
  tenantId: string;
  tenantName: string;
  wabaLabel: string;
  activeAiProfileName: string;
  operator: {
    userId: string;
    fullName: string;
  };
};

type ConversationsSubscription = (rows: Conversation[]) => void;
type ThreadSubscription = (payload: Thread) => void;

const mocks = vi.hoisted(() => {
  let sessionToken: string | null = null;
  let conversationsState: Conversation[] = [];
  const threadState = new Map<string, Thread>();
  const dossierState = new Map<string, Dossier>();
  let workspaceState: Workspace = {
    tenantId: "tenant-1",
    tenantName: "IA Prev Demo",
    wabaLabel: "WA Demo",
    activeAiProfileName: "IA Prev Assistente",
    operator: {
      userId: "operator-1",
      fullName: "Ana Lima",
    },
  };

  let conversationsSubscription: ConversationsSubscription | null = null;
  const threadSubscriptions = new Map<string, ThreadSubscription>();

  const backendClient = {
    setSessionToken: vi.fn((token: string | null) => {
      sessionToken = token;
    }),
    getSessionToken: vi.fn(() => sessionToken),
    login: vi.fn(async () => {
      sessionToken = "session-token";
      return {
        sessionToken,
        session: {
          sessionId: sessionToken,
          userId: "operator-1",
          tenantId: "tenant-1",
          role: "tenant_user",
          createdAt: Date.now(),
        },
      };
    }),
    logout: vi.fn(async () => {
      sessionToken = null;
    }),
    getWorkspace: vi.fn(async () => workspaceState),
    listConversations: vi.fn(async () => conversationsState),
    getConversationThread: vi.fn(async (conversationId: string) => {
      const payload = threadState.get(conversationId);
      if (!payload) {
        throw new hoisted.MockBackendApiClientError("Thread not found", "NOT_FOUND", 404);
      }
      return payload;
    }),
    markConversationAsRead: vi.fn(async (conversationId: string) => ({
      conversationId,
      updatedCount: 1,
    })),
    sendMessage: vi.fn(async () => {}),
    takeHandoff: vi.fn(async () => {}),
    closeConversation: vi.fn(async () => {}),
    exportDossier: vi.fn(async (conversationId: string) => {
      const payload = dossierState.get(conversationId);
      if (!payload) {
        throw new hoisted.MockBackendApiClientError("Dossier not found", "NOT_FOUND", 404);
      }
      return payload;
    }),
    subscribeToConversations: vi.fn(async (_params: unknown, onUpdate: ConversationsSubscription) => {
      conversationsSubscription = onUpdate;
      onUpdate(conversationsState);
      return () => {
        if (conversationsSubscription === onUpdate) {
          conversationsSubscription = null;
        }
      };
    }),
    subscribeToConversationThread: vi.fn(async (conversationId: string, onUpdate: ThreadSubscription) => {
      threadSubscriptions.set(conversationId, onUpdate);
      const payload = threadState.get(conversationId);
      if (payload) {
        onUpdate(payload);
      }

      return () => {
        threadSubscriptions.delete(conversationId);
      };
    }),
  };

  const reset = () => {
    sessionToken = null;
    conversationsState = [];
    workspaceState = {
      tenantId: "tenant-1",
      tenantName: "IA Prev Demo",
      wabaLabel: "WA Demo",
      activeAiProfileName: "IA Prev Assistente",
      operator: {
        userId: "operator-1",
        fullName: "Ana Lima",
      },
    };

    threadState.clear();
    dossierState.clear();
    conversationsSubscription = null;
    threadSubscriptions.clear();
    Object.values(backendClient).forEach((candidate) => {
      if (typeof candidate === "function" && "mockClear" in candidate) {
        candidate.mockClear();
      }
    });
  };

  const seed = (input: { conversations: Conversation[]; threadByConversation: Record<string, Thread>; dossierByConversation: Record<string, Dossier> }) => {
    conversationsState = input.conversations;
    threadState.clear();
    dossierState.clear();

    Object.entries(input.threadByConversation).forEach(([conversationId, payload]) => {
      threadState.set(conversationId, payload);
    });

    Object.entries(input.dossierByConversation).forEach(([conversationId, payload]) => {
      dossierState.set(conversationId, payload);
    });
  };

  const emitConversations = (rows: Conversation[]) => {
    conversationsState = rows;
    conversationsSubscription?.(rows);
  };

  const emitThread = (conversationId: string, payload: Thread) => {
    threadState.set(conversationId, payload);
    const subscription = threadSubscriptions.get(conversationId);
    if (subscription) {
      subscription(payload);
    }
  };

  return {
    backendClient,
    reset,
    seed,
    emitConversations,
    emitThread,
  };
});

vi.mock("@/lib/backendClient", () => ({
  backendClient: mocks.backendClient,
}));

function conversation(id: string, unreadCount = 0): Conversation {
  return {
    conversationId: id,
    title: `Conversa ${id}`,
    conversationStatus: "EM_TRIAGEM",
    unreadCount,
    lastMessagePreview: `Preview ${id}`,
  };
}

function thread(conversationId: string, messages: string[]): Thread {
  return {
    conversationId,
    title: `Thread ${conversationId}`,
    conversationStatus: "EM_TRIAGEM",
    handoffHistory: [],
    messages: messages.map((body, index) => ({
      id: `${conversationId}-m-${index + 1}`,
      conversationId,
      senderId: index % 2 === 0 ? "operator-1" : "contact-1",
      body,
      createdAt: 1_700_000_000_000 + index,
      attachment: null,
    })),
  };
}

function dossier(conversationId: string): Dossier {
  return {
    conversationId,
    contactId: `contact-${conversationId}`,
    generatedAtIso: "2026-03-31T12:00:00.000Z",
    dossier: {
      role: "Aposentada",
      location: "Sao Paulo",
      summary: `Resumo ${conversationId}`,
    },
    attachments: [],
  };
}

function TestHarness({ onContext }: { onContext: (value: ReturnType<typeof useOperatorApp>) => void }) {
  const value = useOperatorApp();

  useEffect(() => {
    onContext(value);
  }, [onContext, value]);

  return null;
}

function renderProvider() {
  let latestContext: ReturnType<typeof useOperatorApp> | null = null;

  function Wrapper({ children }: { children: ReactNode }) {
    return <OperatorAppProvider>{children}</OperatorAppProvider>;
  }

  render(<TestHarness onContext={(ctx) => (latestContext = ctx)} />, {
    wrapper: Wrapper,
  });

  const getContext = () => {
    if (!latestContext) {
      throw new Error("Context not initialized");
    }
    return latestContext;
  };

  return { getContext };
}

beforeEach(() => {
  mocks.reset();
  vi.clearAllTimers();
});

describe("OperatorAppProvider realtime behavior", () => {
  it("updates conversations reactively without polling", async () => {
    const intervalSpy = vi.spyOn(globalThis, "setInterval");

    mocks.seed({
      conversations: [conversation("c-1", 1)],
      threadByConversation: { "c-1": thread("c-1", ["Mensagem inicial"]) },
      dossierByConversation: { "c-1": dossier("c-1") },
    });

    const app = renderProvider();

    await act(async () => {
      await app.getContext().login("ana.lima", "Ana@123456");
    });

    await waitFor(() => {
      expect(mocks.backendClient.subscribeToConversations).toHaveBeenCalledTimes(1);
      expect(app.getContext().conversations).toHaveLength(1);
      expect(app.getContext().selectedConversationId).toBe("c-1");
    });

    await act(async () => {
      mocks.emitConversations([conversation("c-1", 0), conversation("c-2", 3)]);
    });

    await waitFor(() => {
      expect(app.getContext().conversations.map((item) => item.conversationId)).toEqual(["c-1", "c-2"]);
    });

    expect(intervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 6000);
  });

  it("updates thread messages reactively without polling", async () => {
    const intervalSpy = vi.spyOn(globalThis, "setInterval");

    mocks.seed({
      conversations: [conversation("c-1", 2)],
      threadByConversation: { "c-1": thread("c-1", ["Ola"]) },
      dossierByConversation: { "c-1": dossier("c-1") },
    });

    const app = renderProvider();

    await act(async () => {
      await app.getContext().login("ana.lima", "Ana@123456");
    });

    await waitFor(() => {
      expect(mocks.backendClient.subscribeToConversationThread).toHaveBeenCalledWith("c-1", expect.any(Function));
      expect(app.getContext().thread?.messages).toHaveLength(1);
    });

    await act(async () => {
      mocks.emitThread("c-1", thread("c-1", ["Ola", "Nova mensagem sem polling"]));
    });

    await waitFor(() => {
      expect(app.getContext().thread?.messages).toHaveLength(2);
      expect(app.getContext().thread?.messages[1]?.body).toBe("Nova mensagem sem polling");
    });

    expect(mocks.backendClient.markConversationAsRead).toHaveBeenCalledWith("c-1");
    expect(intervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 6000);
  });

  it("keeps main operator flow without regression", async () => {
    mocks.seed({
      conversations: [conversation("c-1", 0)],
      threadByConversation: { "c-1": thread("c-1", ["Fluxo inicial"]) },
      dossierByConversation: { "c-1": dossier("c-1") },
    });

    const app = renderProvider();

    await act(async () => {
      await app.getContext().login("ana.lima", "Ana@123456");
    });

    await waitFor(() => {
      expect(app.getContext().selectedConversationId).toBe("c-1");
      expect(app.getContext().dossier?.conversationId).toBe("c-1");
    });

    await act(async () => {
      await app.getContext().sendMessage("Resposta do operador");
      await app.getContext().takeHandoff();
      await app.getContext().closeConversation("Caso concluido");
    });

    expect(mocks.backendClient.sendMessage).toHaveBeenCalledWith("c-1", "Resposta do operador");
    expect(mocks.backendClient.takeHandoff).toHaveBeenCalledWith("c-1");
    expect(mocks.backendClient.closeConversation).toHaveBeenCalledWith("c-1", "Caso concluido");

    await act(async () => {
      const exported = await app.getContext().exportDossier();
      expect(exported?.conversationId).toBe("c-1");
    });

    await act(async () => {
      await app.getContext().refresh();
    });

    expect(mocks.backendClient.listConversations).toHaveBeenCalled();
    expect(mocks.backendClient.getConversationThread).toHaveBeenCalledWith("c-1");
  });

  it("classifies login error as blocking modal feedback", async () => {
    mocks.backendClient.login.mockRejectedValueOnce(
      new hoisted.MockBackendApiClientError("Invalid username or password.", "UNAUTHENTICATED", 401),
    );

    const app = renderProvider();
    await act(async () => {
      await app.getContext().login("ana.lima", "senha-invalida");
    });

    await waitFor(() => {
      expect(app.getContext().blockingErrorMessage).toBe("Usuario ou senha invalidos.");
      expect(app.getContext().toastErrorMessage).toBeNull();
    });
  });

  it("classifies search filter errors as non-blocking toast feedback", async () => {
    mocks.seed({
      conversations: [conversation("c-1", 1)],
      threadByConversation: { "c-1": thread("c-1", ["Mensagem inicial"]) },
      dossierByConversation: { "c-1": dossier("c-1") },
    });

    mocks.backendClient.subscribeToConversations.mockImplementationOnce(async () => {
      throw new hoisted.MockBackendApiClientError("search filter is too long.", "BAD_REQUEST", 400);
    });

    const app = renderProvider();
    await act(async () => {
      await app.getContext().login("ana.lima", "Ana@123456");
    });

    await waitFor(() => {
      expect(app.getContext().toastErrorMessage).toBe("O filtro de busca esta muito longo.");
      expect(app.getContext().blockingErrorMessage).toBeNull();
    });
  });

  it("does not show toast when dossier is missing during automatic load", async () => {
    mocks.seed({
      conversations: [conversation("c-1", 1)],
      threadByConversation: { "c-1": thread("c-1", ["Mensagem inicial"]) },
      dossierByConversation: {},
    });

    const app = renderProvider();
    await act(async () => {
      await app.getContext().login("ana.lima", "Ana@123456");
    });

    await waitFor(() => {
      expect(mocks.backendClient.exportDossier).toHaveBeenCalledWith("c-1");
      expect(app.getContext().dossier).toBeNull();
      expect(app.getContext().toastErrorMessage).toBeNull();
      expect(app.getContext().blockingErrorMessage).toBeNull();
    });
  });
});
