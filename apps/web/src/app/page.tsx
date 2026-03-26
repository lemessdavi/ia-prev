"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { tokens } from "config";
import {
  BackendApiClientError,
  createBackendApiClient,
  type ConversationInboxItemDTO,
  type ConversationStatus,
  type ConversationThreadPayloadDTO,
  type DossierExportDTO,
  type TenantWorkspaceSummaryDTO,
} from "utils";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim() ?? "";
const api = createBackendApiClient(convexUrl);
const TOKEN_STORAGE_KEY = "iap.session.token";

const statusStyles: Record<ConversationStatus, { backgroundColor: string; color: string }> = {
  EM_TRIAGEM: { backgroundColor: tokens.colors.infoBg, color: tokens.colors.infoText },
  PENDENTE_HUMANO: { backgroundColor: tokens.colors.warningBg, color: tokens.colors.warningText },
  EM_ATENDIMENTO_HUMANO: { backgroundColor: tokens.colors.primary, color: "#ffffff" },
  FECHADO: { backgroundColor: "#e4e4e7", color: "#3f3f46" },
};

const statusOptions: Array<{ label: string; value: ConversationStatus | "ALL" }> = [
  { label: "Todos", value: "ALL" },
  { label: "Triagem", value: "EM_TRIAGEM" },
  { label: "Pendente", value: "PENDENTE_HUMANO" },
  { label: "Atendimento", value: "EM_ATENDIMENTO_HUMANO" },
  { label: "Fechado", value: "FECHADO" },
];

type MobilePanel = "inbox" | "chat" | "dossier";

export default function Home() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [workspace, setWorkspace] = useState<TenantWorkspaceSummaryDTO | null>(null);
  const [conversations, setConversations] = useState<ConversationInboxItemDTO[]>([]);
  const [thread, setThread] = useState<ConversationThreadPayloadDTO | null>(null);
  const [dossier, setDossier] = useState<DossierExportDTO | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("inbox");

  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "ALL">("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [username, setUsername] = useState("ana.lima");
  const [password, setPassword] = useState("Ana@123456");
  const [messageDraft, setMessageDraft] = useState("");
  const [closureReason, setClosureReason] = useState("");

  const [authLoading, setAuthLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [performingAction, setPerformingAction] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.conversationId === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );
  const isAuthenticated = workspace !== null;

  if (!convexUrl) {
    return (
      <main className="min-h-screen bg-zinc-50 p-8" data-testid="convex-url-missing-screen">
        {isHydrated ? <span data-testid="app-hydrated" hidden /> : null}
        <section className="mx-auto max-w-2xl rounded-2xl border bg-white p-6">
          <h1 className="text-2xl font-semibold">Convex URL nao configurada</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Defina <code>NEXT_PUBLIC_CONVEX_URL</code> para conectar o frontend ao backend Convex.
          </p>
        </section>
      </main>
    );
  }

  const clearSession = useCallback(() => {
    api.setSessionToken(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setWorkspace(null);
    setConversations([]);
    setThread(null);
    setDossier(null);
    setSelectedConversationId(null);
    setMobilePanel("inbox");
  }, []);

  const toReadableError = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof BackendApiClientError) {
        if (error.code === "UNAUTHENTICATED") {
          clearSession();
        }
        return error.message;
      }
      return fallback;
    },
    [clearSession],
  );

  const loadWorkspace = useCallback(async () => {
    const data = await api.getWorkspace();
    setWorkspace(data);
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const rows = await api.listConversations({
        status: statusFilter,
        search,
      });
      setConversations(rows);
      if (!selectedConversationId && rows[0]) {
        setSelectedConversationId(rows[0].conversationId);
      } else if (selectedConversationId && !rows.some((row) => row.conversationId === selectedConversationId)) {
        setSelectedConversationId(rows[0]?.conversationId ?? null);
      }
    } catch (error) {
      setErrorMessage(toReadableError(error, "Falha ao carregar conversas."));
    } finally {
      setLoadingConversations(false);
    }
  }, [search, selectedConversationId, statusFilter, toReadableError]);

  const loadThread = useCallback(
    async (conversationId: string, markRead: boolean) => {
      setLoadingThread(true);
      try {
        if (markRead) {
          await api.markConversationAsRead(conversationId);
        }
        const data = await api.getConversationThread(conversationId);
        setThread(data);
      } catch (error) {
        setErrorMessage(toReadableError(error, "Falha ao carregar chat da conversa."));
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
        const data = await api.exportDossier(conversationId);
        setDossier(data);
      } catch (error) {
        setErrorMessage(toReadableError(error, "Falha ao carregar dossie."));
      } finally {
        setLoadingDossier(false);
      }
    },
    [toReadableError],
  );

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existingToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!existingToken) return;

    api.setSessionToken(existingToken);
    setErrorMessage(null);
    void (async () => {
      try {
        await loadWorkspace();
      } catch (error) {
        clearSession();
        setErrorMessage(toReadableError(error, "Nao foi possivel restaurar a sessao."));
      }
    })();
  }, [clearSession, loadWorkspace, toReadableError]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadConversations();
  }, [isAuthenticated, loadConversations]);

  useEffect(() => {
    if (!isAuthenticated || !selectedConversationId) {
      setThread(null);
      setDossier(null);
      return;
    }

    void loadThread(selectedConversationId, true);
    void loadDossier(selectedConversationId);
  }, [isAuthenticated, loadDossier, loadThread, selectedConversationId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = window.setInterval(() => {
      void loadConversations();
      if (selectedConversationId) {
        void loadThread(selectedConversationId, false);
      }
    }, 6000);

    return () => window.clearInterval(timer);
  }, [isAuthenticated, loadConversations, loadThread, selectedConversationId]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.login(username, password);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, response.sessionToken);
      }
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(toReadableError(error, "Falha no login."));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // noop
    } finally {
      clearSession();
    }
  }

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversationId || !messageDraft.trim()) return;

    setSendingMessage(true);
    setErrorMessage(null);
    try {
      await api.sendMessage(selectedConversationId, messageDraft.trim());
      setMessageDraft("");
      await loadThread(selectedConversationId, false);
      await loadConversations();
    } catch (error) {
      setErrorMessage(toReadableError(error, "Falha ao enviar mensagem."));
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleTakeHandoff() {
    if (!selectedConversationId) return;
    setPerformingAction(true);
    setErrorMessage(null);
    try {
      await api.takeHandoff(selectedConversationId);
      await loadConversations();
      await loadThread(selectedConversationId, false);
    } catch (error) {
      setErrorMessage(toReadableError(error, "Falha ao assumir conversa."));
    } finally {
      setPerformingAction(false);
    }
  }

  async function handleCloseConversation() {
    if (!selectedConversationId) return;
    if (!closureReason.trim()) {
      setErrorMessage("Informe o motivo do encerramento.");
      return;
    }

    setPerformingAction(true);
    setErrorMessage(null);
    try {
      await api.closeConversation(selectedConversationId, closureReason.trim());
      setClosureReason("");
      await loadConversations();
      await loadThread(selectedConversationId, false);
      await loadDossier(selectedConversationId);
    } catch (error) {
      setErrorMessage(toReadableError(error, "Falha ao encerrar caso."));
    } finally {
      setPerformingAction(false);
    }
  }

  async function handleExportDossier() {
    if (!selectedConversationId) return;
    setPerformingAction(true);
    setErrorMessage(null);
    try {
      const payload = await api.exportDossier(selectedConversationId);
      setDossier(payload);
      downloadJson(`dossie-${selectedConversationId}.json`, payload);
    } catch (error) {
      setErrorMessage(toReadableError(error, "Falha ao exportar dossie."));
    } finally {
      setPerformingAction(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen p-4 md:p-8" style={{ backgroundColor: "#f3f4f6" }} data-testid="login-screen">
        {isHydrated ? <span data-testid="app-hydrated" hidden /> : null}
        <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[28px] border bg-white shadow-xl md:grid-cols-2">
          <section className="relative hidden md:block" style={{ background: "linear-gradient(140deg, #0f172a, #1e3a8a)" }}>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
            <div className="relative flex h-full flex-col justify-between p-10 text-white">
              <div>
                <p className="inline-flex rounded-full border border-white/40 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                  IA Prev Console
                </p>
                <h1 className="mt-5 max-w-sm text-4xl font-semibold leading-tight">Atendimento humano com contexto tenant-aware.</h1>
              </div>
              <p className="max-w-sm text-sm text-blue-100">
                Web e mobile conectados ao backend real, com isolamento por tenant, handoff, anexos e dossie operacional.
              </p>
            </div>
          </section>
          <section className="p-6 md:p-10" style={{ backgroundColor: "#fafafa" }} aria-label="Login do operador">
            <h2 className="text-3xl font-semibold">Entrar</h2>
            <p className="mt-2 text-sm text-zinc-500">Use um tenant_user valido para abrir a mesa de operacao.</p>
            <form className="mt-8 space-y-4" onSubmit={handleLogin} data-testid="login-form">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Usuario</span>
                <input
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3"
                  value={username}
                  data-testid="login-username-input"
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Senha</span>
                <input
                  type="password"
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-3"
                  value={password}
                  data-testid="login-password-input"
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-xl px-4 py-3 font-medium text-white"
                style={{ backgroundColor: "#0f172a" }}
                data-testid="login-submit-button"
                disabled={authLoading}
              >
                {authLoading ? "Entrando..." : "Acessar painel"}
              </button>
            </form>
            {errorMessage ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="global-error-banner">
                {errorMessage}
              </p>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-white" style={{ color: tokens.colors.text }}>
      {isHydrated ? <span data-testid="app-hydrated" hidden /> : null}
      <div className="flex h-full w-full flex-col">
        <header className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 md:px-6 md:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Tenant atual</p>
              <h1 className="text-2xl font-semibold" data-testid="workspace-tenant-name">
                {workspace.tenantName}
              </h1>
              <p className="text-sm text-zinc-500" data-testid="workspace-waba-profile">
                {workspace.wabaLabel} • IA: {workspace.activeAiProfileName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600" data-testid="workspace-operator-name">
                {workspace.operator.fullName}
              </span>
              <button onClick={handleLogout} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-100" data-testid="logout-button">
                Sair
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 lg:hidden">
            <button
              className={`rounded-lg px-3 py-2 text-sm ${mobilePanel === "inbox" ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"}`}
              onClick={() => setMobilePanel("inbox")}
              data-testid="mobile-tab-inbox"
            >
              Inbox
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-sm ${mobilePanel === "chat" ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"}`}
              onClick={() => setMobilePanel("chat")}
              data-testid="mobile-tab-chat"
            >
              Chat
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-sm ${mobilePanel === "dossier" ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"}`}
              onClick={() => setMobilePanel("dossier")}
              data-testid="mobile-tab-dossier"
            >
              Dossie
            </button>
          </div>
        </header>

        {errorMessage ? (
          <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 md:px-6" data-testid="global-error-banner">
            {errorMessage}
          </p>
        ) : null}

        <div className="min-h-0 flex-1">
          <div className="grid h-full lg:grid-cols-12">
            <section
              className={`${mobilePanel === "inbox" ? "flex" : "hidden"} h-full min-h-0 flex-col border-zinc-200 bg-white lg:col-span-4 lg:flex lg:border-r`}
              aria-label="Lista de conversas"
            >
              <div className="border-b border-zinc-200 p-4">
                <input
                  aria-label="Buscar conversa"
                  placeholder="Buscar por nome ou mensagem..."
                  className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm"
                  value={searchInput}
                  data-testid="inbox-search-input"
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {statusOptions.map((item) => (
                    <button
                      key={item.value}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                        item.value === statusFilter ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-700"
                      }`}
                      data-testid={`status-filter-${item.value}`}
                      onClick={() => setStatusFilter(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                {loadingConversations ? (
                  <p className="p-4 text-sm text-zinc-500" data-testid="inbox-loading-state">
                    Carregando conversas...
                  </p>
                ) : conversations.length > 0 ? (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.conversationId}
                      className="block w-full border-b border-zinc-200 p-4 text-left transition hover:bg-zinc-50"
                      data-testid={`conversation-item-${conversation.conversationId}`}
                      style={{
                        backgroundColor: conversation.conversationId === selectedConversationId ? "#f4f4f5" : undefined,
                      }}
                      onClick={() => {
                        setSelectedConversationId(conversation.conversationId);
                        setMobilePanel("chat");
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xl font-semibold leading-tight">{conversation.title}</h3>
                        <span className="text-xs text-zinc-500">{formatTime(conversation.lastActivityAt)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{conversation.lastMessagePreview}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span
                          className="rounded-md px-2 py-1 text-xs font-medium"
                          data-testid={`conversation-status-${conversation.conversationId}`}
                          style={statusStyles[conversation.conversationStatus]}
                        >
                          {toStatusLabel(conversation.conversationStatus)}
                        </span>
                        {conversation.unreadCount > 0 ? (
                          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-white">{conversation.unreadCount}</span>
                        ) : null}
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="p-4 text-sm text-zinc-500">Nenhuma conversa para os filtros atuais.</p>
                )}
              </div>
            </section>

            <section
              className={`${mobilePanel === "chat" ? "flex" : "hidden"} h-full min-h-0 flex-col border-zinc-200 bg-white lg:col-span-5 lg:flex lg:border-r`}
              aria-label="Chat da conversa"
            >
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 p-4">
                <div>
                  <h2 className="text-2xl font-semibold" data-testid="chat-title">
                    {selectedConversation?.title ?? "Selecione uma conversa"}
                  </h2>
                  <p className="text-sm text-zinc-500" data-testid="chat-triage">
                    Fluxo: {thread ? toTriageLabel(thread.triageResult) : "N/A"}
                  </p>
                </div>
                <button
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                  onClick={handleTakeHandoff}
                  data-testid="handoff-button"
                  disabled={!selectedConversationId || performingAction}
                >
                  Assumir conversa
                </button>
              </header>
              <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
                {loadingThread ? (
                  <p className="text-sm text-zinc-500" data-testid="thread-loading-state">
                    Carregando mensagens...
                  </p>
                ) : thread?.messages.length ? (
                  thread.messages.map((message) => {
                    const isOwn = message.senderId === workspace.operator.userId;
                    return (
                      <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`} data-testid={`thread-message-${message.id}`}>
                        <div className={`max-w-[86%] rounded-2xl border px-4 py-3 text-sm ${isOwn ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-900"}`}>
                          <p>{message.body}</p>
                          {message.attachment ? (
                            <a
                              className={`mt-2 block text-xs underline ${isOwn ? "text-zinc-200" : "text-zinc-600"}`}
                              href={message.attachment.url}
                              data-testid={`thread-message-attachment-${message.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {formatAttachmentLabel(message.attachment.fileName, message.attachment.contentType)}
                            </a>
                          ) : null}
                          <p className={`mt-2 text-[11px] ${isOwn ? "text-zinc-300" : "text-zinc-500"}`}>{formatDateTime(message.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-500">Sem mensagens para exibir.</p>
                )}
              </div>
              <footer className="border-t border-zinc-200 p-4">
                <form className="flex items-end gap-2" onSubmit={handleSendMessage} data-testid="chat-send-form">
                  <input
                    className="flex-1 rounded-xl border border-zinc-300 px-3 py-2.5 text-sm"
                    placeholder="Digite uma mensagem..."
                    value={messageDraft}
                    data-testid="chat-message-input"
                    onChange={(event) => setMessageDraft(event.target.value)}
                    disabled={!selectedConversationId || sendingMessage}
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                    data-testid="chat-send-button"
                    disabled={!selectedConversationId || sendingMessage || !messageDraft.trim()}
                  >
                    Enviar
                  </button>
                </form>
              </footer>
            </section>

            <aside
              className={`${mobilePanel === "dossier" ? "block" : "hidden"} h-full overflow-auto border-zinc-200 bg-white lg:col-span-3 lg:block`}
              aria-label="Dossie e acoes do caso"
            >
              <div className="border-b border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-2xl font-semibold">Dossie do caso</h2>
                  {thread ? (
                    <span className="rounded-md px-2 py-1 text-xs font-medium" data-testid="dossier-status-badge" style={statusStyles[thread.conversationStatus]}>
                      {toStatusLabel(thread.conversationStatus)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3 p-4">
                <section className="rounded-xl border border-zinc-200 p-3">
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500">Dados do cliente</h3>
                  {loadingDossier ? (
                    <p className="mt-2 text-sm text-zinc-500" data-testid="dossier-loading-state">
                      Carregando dossie...
                    </p>
                  ) : dossier ? (
                    <>
                      <p className="mt-3 text-lg font-semibold" data-testid="dossier-contact-id">
                        {dossier.contactId}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">{dossier.dossier.role}</p>
                      <p className="mt-1 text-sm text-zinc-600">{dossier.dossier.location}</p>
                      <p className="mt-3 text-sm">{dossier.dossier.summary}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">Selecione uma conversa para exibir o dossie.</p>
                  )}
                </section>

                <section className="rounded-xl border border-zinc-200 p-3">
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500">Anexos</h3>
                  {dossier?.attachments.length ? (
                    dossier.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        className="mt-2 block text-sm underline"
                        href={attachment.url}
                        data-testid={`dossier-attachment-${attachment.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {formatAttachmentLabel(attachment.fileName, attachment.contentType)}
                      </a>
                    ))
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">Nenhum anexo nesta conversa.</p>
                  )}
                </section>

                <section className="rounded-xl border border-zinc-200 p-3">
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500">Acoes</h3>
                  <button
                    className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                    onClick={handleExportDossier}
                    data-testid="dossier-export-button"
                    disabled={!selectedConversationId || performingAction}
                  >
                    Exportar dossie
                  </button>
                  <label htmlFor="closureReason" className="mt-3 block text-xs font-medium text-zinc-700">
                    Motivo de encerramento
                  </label>
                  <textarea
                    id="closureReason"
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="Ex: documentacao validada e caso concluido"
                    value={closureReason}
                    data-testid="dossier-closure-reason-input"
                    onChange={(event) => setClosureReason(event.target.value)}
                  />
                  <button
                    className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-40"
                    onClick={handleCloseConversation}
                    data-testid="dossier-close-button"
                    disabled={!selectedConversationId || performingAction}
                  >
                    Encerrar caso
                  </button>
                </section>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function toStatusLabel(status: ConversationStatus): string {
  switch (status) {
    case "EM_TRIAGEM":
      return "Em triagem";
    case "PENDENTE_HUMANO":
      return "Pendente humano";
    case "EM_ATENDIMENTO_HUMANO":
      return "Em atendimento";
    case "FECHADO":
      return "Fechado";
    default:
      return status;
  }
}

function toTriageLabel(result: string): string {
  switch (result) {
    case "APTO":
      return "Apto";
    case "REVISAO_HUMANA":
      return "Revisao humana";
    case "NAO_APTO":
      return "Nao apto";
    case "N_A":
      return "N/A";
    default:
      return result;
  }
}

function formatAttachmentLabel(fileName: string, contentType: string): string {
  if (contentType.includes("audio")) return `Reproduzir audio: ${fileName}`;
  if (contentType.includes("image")) return `Visualizar imagem: ${fileName}`;
  if (contentType.includes("pdf")) return `Visualizar PDF: ${fileName}`;
  return `Baixar arquivo: ${fileName}`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadJson(fileName: string, payload: unknown): void {
  const serialized = JSON.stringify(payload, null, 2);
  const blob = new Blob([serialized], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
