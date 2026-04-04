import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  BackendApiClientError,
  classifyErrorFeedback,
  shouldSuppressErrorFeedback,
  type ConversationInboxItemDTO,
  type ConversationThreadPayloadDTO,
  type DossierExportDTO,
  type ErrorFeedbackOperation,
  type TenantWorkspaceSummaryDTO,
  type TriageResult,
} from "utils";
import { backendClient } from "@/lib/backendClient";

export type InboxFilter = "ALL" | "APTO" | "REVISAO_HUMANA" | "NAO_APTO" | "FINALIZADO";

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
  blockingErrorMessage: string | null;
  toastErrorMessage: string | null;
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
  setConversationTriageResult: (triageResult: TriageResult) => Promise<void>;
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
  const [blockingErrorMessage, setBlockingErrorMessage] = useState<string | null>(null);
  const [toastErrorMessage, setToastErrorMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const clearError = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setBlockingErrorMessage(null);
    setToastErrorMessage(null);
  }, []);

  const publishFeedback = useCallback(
    (message: string, blocking: boolean) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }

      if (blocking) {
        setToastErrorMessage(null);
        setBlockingErrorMessage(message);
        return;
      }

      setBlockingErrorMessage(null);
      setToastErrorMessage(message);
      toastTimerRef.current = setTimeout(() => {
        setToastErrorMessage(null);
        toastTimerRef.current = null;
      }, 4500);
    },
    [],
  );

  const reportError = useCallback(
    (error: unknown, fallbackMessage: string, operation: ErrorFeedbackOperation) => {
      const code = error instanceof BackendApiClientError ? error.code : undefined;
      const message = error instanceof BackendApiClientError ? error.message : undefined;
      if (shouldSuppressErrorFeedback({ code, message, operation })) {
        if (operation === "loadDossier") {
          setDossier(null);
        }
        return;
      }

      if (code === "UNAUTHENTICATED") {
        resetState();
      }

      const feedback = classifyErrorFeedback({
        code,
        message,
        fallbackMessage,
        operation,
      });
      publishFeedback(feedback.message, feedback.blocking);
    },
    [publishFeedback, resetState],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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
      reportError(error, "Falha ao carregar conversas.", "loadConversations");
    } finally {
      setLoadingConversations(false);
    }
  }, [applyInboxFilter, reconcileSelectedConversation, reportError, search, statusQueryParam]);

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
        reportError(error, "Falha ao carregar mensagens.", "loadThread");
      } finally {
        setLoadingThread(false);
      }
    },
    [reportError],
  );

  const loadDossier = useCallback(
    async (conversationId: string) => {
      setLoadingDossier(true);
      setDossier(null);
      try {
        const payload = await backendClient.exportDossier(conversationId);
        setDossier(payload);
      } catch (error) {
        reportError(error, "Falha ao carregar dossie.", "loadDossier");
      } finally {
        setLoadingDossier(false);
      }
    },
    [reportError],
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
        reportError(error, "Falha ao carregar conversas.", "loadConversations");
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [applyInboxFilter, isAuthenticated, reconcileSelectedConversation, reportError, search, statusQueryParam]);

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
        reportError(error, "Falha ao carregar mensagens.", "loadThread");
      }
    })();

    void loadDossier(selectedConversationId);

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [isAuthenticated, loadDossier, reportError, selectedConversationId]);

  const login = useCallback(
    async (username: string, password: string) => {
      setLoadingAuth(true);
      clearError();
      try {
        await backendClient.login(username, password);
        await loadWorkspace();
      } catch (error) {
        reportError(error, "Falha no login.", "login");
      } finally {
        setLoadingAuth(false);
      }
    },
    [clearError, loadWorkspace, reportError],
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
      clearError();
      try {
        await backendClient.sendMessage(selectedConversationId, body);
      } catch (error) {
        reportError(error, "Falha ao enviar mensagem.", "sendMessage");
      } finally {
        setLoadingAction(false);
      }
    },
    [clearError, reportError, selectedConversationId],
  );

  const takeHandoff = useCallback(async () => {
    if (!selectedConversationId) return;
    setLoadingAction(true);
    clearError();
    try {
      await backendClient.takeHandoff(selectedConversationId);
    } catch (error) {
      reportError(error, "Falha ao assumir conversa.", "takeHandoff");
    } finally {
      setLoadingAction(false);
    }
  }, [clearError, reportError, selectedConversationId]);

  const closeConversation = useCallback(
    async (reason: string) => {
      if (!selectedConversationId) return;
      setLoadingAction(true);
      clearError();
      try {
        await backendClient.closeConversation(selectedConversationId, reason);
        await loadDossier(selectedConversationId);
      } catch (error) {
        reportError(error, "Falha ao encerrar conversa.", "closeConversation");
      } finally {
        setLoadingAction(false);
      }
    },
    [clearError, loadDossier, reportError, selectedConversationId],
  );

  const setConversationTriageResult = useCallback(
    async (triageResult: TriageResult) => {
      if (!selectedConversationId) return;
      setLoadingAction(true);
      clearError();
      try {
        await backendClient.setConversationTriageResult(selectedConversationId, triageResult);
        await loadConversations();
        await loadThread(selectedConversationId, false);
      } catch (error) {
        reportError(error, "Falha ao atualizar resultado da triagem.", "setTriageResult");
      } finally {
        setLoadingAction(false);
      }
    },
    [clearError, loadConversations, loadThread, reportError, selectedConversationId],
  );

  const exportDossier = useCallback(async () => {
    if (!selectedConversationId) return null;
    setLoadingAction(true);
    clearError();
    try {
      const payload = await backendClient.exportDossier(selectedConversationId);
      setDossier(payload);
      return payload;
    } catch (error) {
      reportError(error, "Falha ao exportar dossie.", "exportDossier");
      return null;
    } finally {
      setLoadingAction(false);
    }
  }, [clearError, reportError, selectedConversationId]);

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
      blockingErrorMessage,
      toastErrorMessage,
      isAuthenticated,
      setStatusFilter,
      setSearch,
      clearError,
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
      blockingErrorMessage,
      toastErrorMessage,
      isAuthenticated,
      clearError,
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
    throw new Error("useOperatorApp must be used inside OperatorAppProvider.");
  }

  return context;
}
