import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  BackendApiClientError,
  type ConversationInboxItemDTO,
  type ConversationThreadPayloadDTO,
  type DossierExportDTO,
  type TenantWorkspaceSummaryDTO,
  type TriageResult,
} from "utils";
import { backendClient } from "@/lib/backendClient";

export type InboxFilter = "ALL" | "APTO" | "REVISAO_HUMANA" | "NAO_APTO" | "FINALIZADO";
type ManualTriageResult = Exclude<TriageResult, "N_A">;

type OperatorAppContextValue = {
  workspace: TenantWorkspaceSummaryDTO | null;
  conversations: ConversationInboxItemDTO[];
  thread: ConversationThreadPayloadDTO | null;
  dossier: DossierExportDTO | null;
  selectedConversationId: string | null;
  statusFilter: InboxFilter;
  search: string;
  loadingAuth: boolean;
  loadingConversations: boolean;
  loadingThread: boolean;
  loadingDossier: boolean;
  loadingAction: boolean;
  errorMessage: string | null;
  isAuthenticated: boolean;
  setStatusFilter: (status: InboxFilter) => void;
  setSearch: (value: string) => void;
  clearError: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  takeHandoff: () => Promise<void>;
  closeConversation: (reason: string) => Promise<void>;
  setConversationTriageResult: (triageResult: ManualTriageResult) => Promise<void>;
  exportDossier: () => Promise<DossierExportDTO | null>;
  refresh: () => Promise<void>;
};

const OperatorAppContext = createContext<OperatorAppContextValue | undefined>(undefined);

export function OperatorAppProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<TenantWorkspaceSummaryDTO | null>(null);
  const [conversations, setConversations] = useState<ConversationInboxItemDTO[]>([]);
  const [thread, setThread] = useState<ConversationThreadPayloadDTO | null>(null);
  const [dossier, setDossier] = useState<DossierExportDTO | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<InboxFilter>("ALL");
  const [search, setSearch] = useState("");

  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAuthenticated = workspace !== null;

  const reconcileSelectedConversation = useCallback((rows: ConversationInboxItemDTO[]) => {
    setSelectedConversationId((currentId) => {
      if (!currentId) {
        return rows[0]?.conversationId ?? null;
      }

      if (rows.some((item) => item.conversationId === currentId)) {
        return currentId;
      }

      return rows[0]?.conversationId ?? null;
    });
  }, []);

  const resetState = useCallback(() => {
    backendClient.setSessionToken(null);
    setWorkspace(null);
    setConversations([]);
    setThread(null);
    setDossier(null);
    setSelectedConversationId(null);
  }, []);

  const toReadableError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof BackendApiClientError) {
        if (error.code === "UNAUTHENTICATED") {
          resetState();
        }
        return error.message;
      }
      return fallback;
    },
    [resetState],
  );

  const loadWorkspace = useCallback(async () => {
    const data = await backendClient.getWorkspace();
    setWorkspace(data);
  }, []);

  const statusQueryParam = useMemo(() => (statusFilter === "FINALIZADO" ? "FECHADO" : "ALL"), [statusFilter]);

  const applyInboxFilter = useCallback(
    (rows: ConversationInboxItemDTO[]) => {
      if (statusFilter === "APTO" || statusFilter === "REVISAO_HUMANA" || statusFilter === "NAO_APTO") {
        return rows.filter((row) => row.triageResult === statusFilter);
      }

      return rows;
    },
    [statusFilter],
  );

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const rows = await backendClient.listConversations({
        status: statusQueryParam,
        search: search.trim() || undefined,
      });
      const filteredRows = applyInboxFilter(rows);
      setConversations(filteredRows);
      reconcileSelectedConversation(filteredRows);
    } catch (error) {
      setErrorMessage(toReadableError(error, "Falha ao carregar conversas."));
    } finally {
      setLoadingConversations(false);
    }
  }, [applyInboxFilter, reconcileSelectedConversation, search, statusQueryParam, toReadableError]);

  const loadThread = useCallback(
    async (conversationId: string, markRead: boolean) => {
      setLoadingThread(true);
      try {
        if (markRead) {
          await backendClient.markConversationAsRead(conversationId);
        }
        const payload = await backendClient.getConversationThread(conversationId);
        setThread(payload);
      } catch (error) {
        setErrorMessage(toReadableError(error, "Falha ao carregar mensagens."));
      } finally {
        setLoadingThread(false);
      }
    },
    [toReadableError],
  );

  const loadDossier = useCallback(
    async (conversationId: string) => {
      setLoadingDossier(true);
      try {
        const payload = await backendClient.exportDossier(conversationId);
        setDossier(payload);
      } catch (error) {
        setErrorMessage(toReadableError(error, "Falha ao carregar dossie."));
      } finally {
        setLoadingDossier(false);
      }
    },
    [toReadableError],
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    setLoadingConversations(true);
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      try {
        unsubscribe = await backendClient.subscribeToConversations(
          {
            status: statusQueryParam,
            search: search.trim() || undefined,
          },
          (rows) => {
            if (cancelled) return;
            const filteredRows = applyInboxFilter(rows);
            setConversations(filteredRows);
            reconcileSelectedConversation(filteredRows);
            setLoadingConversations(false);
          },
        );
      } catch (error) {
        if (cancelled) return;
        setLoadingConversations(false);
        setErrorMessage(toReadableError(error, "Falha ao carregar conversas."));
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [applyInboxFilter, isAuthenticated, reconcileSelectedConversation, search, statusQueryParam, toReadableError]);

  useEffect(() => {
    if (!isAuthenticated || !selectedConversationId) {
      setThread(null);
      setDossier(null);
      return;
    }

    setLoadingThread(true);
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void (async () => {
      try {
        await backendClient.markConversationAsRead(selectedConversationId);
        unsubscribe = await backendClient.subscribeToConversationThread(selectedConversationId, (payload) => {
          if (cancelled) return;
          setThread(payload);
          setLoadingThread(false);
        });
      } catch (error) {
        if (cancelled) return;
        setLoadingThread(false);
        setErrorMessage(toReadableError(error, "Falha ao carregar mensagens."));
      }
    })();

    void loadDossier(selectedConversationId);

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAuthenticated, loadDossier, selectedConversationId, toReadableError]);

  const login = useCallback(
    async (username: string, password: string) => {
      setLoadingAuth(true);
      setErrorMessage(null);
      try {
        await backendClient.login(username, password);
        await loadWorkspace();
      } catch (error) {
        setErrorMessage(toReadableError(error, "Falha no login."));
      } finally {
        setLoadingAuth(false);
      }
    },
    [loadWorkspace, toReadableError],
  );

  const logout = useCallback(async () => {
    try {
      await backendClient.logout();
    } catch {
      // no-op
    } finally {
      resetState();
    }
  }, [resetState]);

  const selectConversation = useCallback(async (conversationId: string) => {
    setSelectedConversationId(conversationId);
  }, []);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!selectedConversationId) return;
      setLoadingAction(true);
      setErrorMessage(null);
      try {
        await backendClient.sendMessage(selectedConversationId, body);
      } catch (error) {
        setErrorMessage(toReadableError(error, "Falha ao enviar mensagem."));
      } finally {
        setLoadingAction(false);
      }
    },
    [selectedConversationId, toReadableError],
  );

  const takeHandoff = useCallback(async () => {
    if (!selectedConversationId) return;
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      await backendClient.takeHandoff(selectedConversationId);
    } catch (error) {
      setErrorMessage(toReadableError(error, "Falha ao assumir conversa."));
    } finally {
      setLoadingAction(false);
    }
  }, [selectedConversationId, toReadableError]);

  const closeConversation = useCallback(
    async (reason: string) => {
      if (!selectedConversationId) return;
      setLoadingAction(true);
      setErrorMessage(null);
      try {
        await backendClient.closeConversation(selectedConversationId, reason);
        await loadDossier(selectedConversationId);
      } catch (error) {
        setErrorMessage(toReadableError(error, "Falha ao encerrar conversa."));
      } finally {
        setLoadingAction(false);
      }
    },
    [loadDossier, selectedConversationId, toReadableError],
  );

  const setConversationTriageResult = useCallback(
    async (triageResult: ManualTriageResult) => {
      if (!selectedConversationId) return;
      setLoadingAction(true);
      setErrorMessage(null);
      try {
        await backendClient.setConversationTriageResult(selectedConversationId, triageResult);
        await loadConversations();
        await loadThread(selectedConversationId, false);
      } catch (error) {
        setErrorMessage(toReadableError(error, "Falha ao atualizar resultado da triagem."));
      } finally {
        setLoadingAction(false);
      }
    },
    [loadConversations, loadThread, selectedConversationId, toReadableError],
  );

  const exportDossier = useCallback(async () => {
    if (!selectedConversationId) return null;
    setLoadingAction(true);
    setErrorMessage(null);
    try {
      const payload = await backendClient.exportDossier(selectedConversationId);
      setDossier(payload);
      return payload;
    } catch (error) {
      setErrorMessage(toReadableError(error, "Falha ao exportar dossie."));
      return null;
    } finally {
      setLoadingAction(false);
    }
  }, [selectedConversationId, toReadableError]);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    await loadConversations();
    if (selectedConversationId) {
      await loadThread(selectedConversationId, false);
    }
  }, [isAuthenticated, loadConversations, loadThread, selectedConversationId]);

  const value = useMemo<OperatorAppContextValue>(
    () => ({
      workspace,
      conversations,
      thread,
      dossier,
      selectedConversationId,
      statusFilter,
      search,
      loadingAuth,
      loadingConversations,
      loadingThread,
      loadingDossier,
      loadingAction,
      errorMessage,
      isAuthenticated,
      setStatusFilter,
      setSearch,
      clearError: () => setErrorMessage(null),
      login,
      logout,
      selectConversation,
      sendMessage,
      takeHandoff,
      closeConversation,
      setConversationTriageResult,
      exportDossier,
      refresh,
    }),
    [
      workspace,
      conversations,
      thread,
      dossier,
      selectedConversationId,
      statusFilter,
      search,
      loadingAuth,
      loadingConversations,
      loadingThread,
      loadingDossier,
      loadingAction,
      errorMessage,
      isAuthenticated,
      login,
      logout,
      selectConversation,
      sendMessage,
      takeHandoff,
      closeConversation,
      setConversationTriageResult,
      exportDossier,
      refresh,
    ],
  );

  return <OperatorAppContext.Provider value={value}>{children}</OperatorAppContext.Provider>;
}

export function useOperatorApp() {
  const context = useContext(OperatorAppContext);
  if (!context) {
    throw new Error("useOperatorApp must be used inside OperatorAppProvider");
  }

  return context;
}
