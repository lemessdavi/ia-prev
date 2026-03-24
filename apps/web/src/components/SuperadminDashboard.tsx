"use client";

import { tokens } from "config";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { LogoutButton } from "./LogoutButton";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: number;
};

type UserAccountSummary = {
  userId: string;
  tenantId: string;
  username: string;
  fullName: string;
  email: string;
  role: "superadmin" | "tenant_user";
  isActive: boolean;
};

type TenantWabaAccount = {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  wabaAccountId: string;
  displayName: string;
  createdAt: number;
};

type AiProfile = {
  id: string;
  tenantId: string;
  name: string;
  provider: string;
  model: string;
  credentialsRef: string;
  isActive: boolean;
  createdAt: number;
};

type LoadStatus = "loading" | "ready" | "empty" | "error" | "forbidden";

type DataState<T> = {
  status: LoadStatus;
  data: T;
  error: string | null;
};

type HttpResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

const sectionClassName = "rounded-2xl border p-5";

function buildArrayState<T>(items: T[]): DataState<T[]> {
  return {
    status: items.length > 0 ? "ready" : "empty",
    data: items,
    error: null,
  };
}

function buildNullableState<T>(item: T | null): DataState<T | null> {
  return {
    status: item ? "ready" : "empty",
    data: item,
    error: null,
  };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<HttpResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: null,
        error: (payload as { error?: string } | null)?.error ?? "Erro na requisição.",
      };
    }

    return {
      ok: true,
      status: response.status,
      data: payload as T,
      error: null,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Falha de conexão com a API.",
    };
  }
}

function toArrayState<T>(result: HttpResult<{ [key: string]: T[] }>, field: string): DataState<T[]> {
  if (!result.ok) {
    return {
      status: result.status === 403 ? "forbidden" : "error",
      data: [],
      error: result.error,
    };
  }

  const data = (result.data?.[field as keyof typeof result.data] as T[] | undefined) ?? [];
  return buildArrayState(data);
}

function StatusMessage({ state, emptyMessage }: { state: DataState<unknown>; emptyMessage: string }) {
  if (state.status === "loading") {
    return <p style={{ color: tokens.colors.textMuted }}>Carregando…</p>;
  }

  if (state.status === "empty") {
    return <p style={{ color: tokens.colors.textMuted }}>{emptyMessage}</p>;
  }

  if (state.status === "forbidden") {
    return <p style={{ color: "#b45309" }}>Acesso negado para este módulo.</p>;
  }

  if (state.status === "error") {
    return <p style={{ color: "#b91c1c" }}>{state.error ?? "Erro inesperado."}</p>;
  }

  return null;
}

export function SuperadminDashboard({
  session,
  initialTenants,
  initialTenantId,
  initialUsers,
  initialWaba,
  initialAiProfiles,
}: {
  session: {
    userId: string;
    tenantId: string;
  };
  initialTenants: Tenant[];
  initialTenantId: string | null;
  initialUsers: UserAccountSummary[];
  initialWaba: TenantWabaAccount | null;
  initialAiProfiles: AiProfile[];
}) {
  const initialSelectedTenant = initialTenants.find((tenant) => tenant.id === initialTenantId) ?? null;

  const [tenantsState, setTenantsState] = useState<DataState<Tenant[]>>(buildArrayState(initialTenants));
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(initialTenantId);
  const [usersState, setUsersState] = useState<DataState<UserAccountSummary[]>>(buildArrayState(initialUsers));
  const [wabaState, setWabaState] = useState<DataState<TenantWabaAccount | null>>(buildNullableState(initialWaba));
  const [aiState, setAiState] = useState<DataState<AiProfile[]>>(buildArrayState(initialAiProfiles));

  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantSlug, setNewTenantSlug] = useState("");

  const [tenantEditName, setTenantEditName] = useState(initialSelectedTenant?.name ?? "");
  const [tenantEditSlug, setTenantEditSlug] = useState(initialSelectedTenant?.slug ?? "");

  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");

  const [wabaPhoneNumberId, setWabaPhoneNumberId] = useState(initialWaba?.phoneNumberId ?? "");
  const [wabaAccountId, setWabaAccountId] = useState(initialWaba?.wabaAccountId ?? "");
  const [wabaDisplayName, setWabaDisplayName] = useState(initialWaba?.displayName ?? "");

  const [newAiName, setNewAiName] = useState("");
  const [newAiProvider, setNewAiProvider] = useState("openai");
  const [newAiModel, setNewAiModel] = useState("gpt-4.1-mini");
  const [newAiCredentialsRef, setNewAiCredentialsRef] = useState("");

  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  const selectedTenant = useMemo(
    () => tenantsState.data.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [selectedTenantId, tenantsState.data],
  );

  const loadTenantModules = useCallback(async (tenantId: string) => {
    setUsersState({ status: "loading", data: [], error: null });
    setWabaState({ status: "loading", data: null, error: null });
    setAiState({ status: "loading", data: [], error: null });

    const [usersResult, wabaResult, aiResult] = await Promise.all([
      requestJson<{ users: UserAccountSummary[] }>(`/api/superadmin/users?tenantId=${tenantId}`),
      requestJson<{ mappings: TenantWabaAccount[] }>(`/api/superadmin/waba?tenantId=${tenantId}`),
      requestJson<{ profiles: AiProfile[] }>(`/api/superadmin/ai-profiles?tenantId=${tenantId}`),
    ]);

    const usersMapped = toArrayState<UserAccountSummary>(
      usersResult as HttpResult<{ [key: string]: UserAccountSummary[] }>,
      "users",
    );
    setUsersState(usersMapped);

    if (!wabaResult.ok) {
      setWabaState({
        status: wabaResult.status === 403 ? "forbidden" : "error",
        data: null,
        error: wabaResult.error,
      });
    } else {
      const mapping = wabaResult.data?.mappings?.[0] ?? null;
      setWabaState(buildNullableState(mapping));
      setWabaPhoneNumberId(mapping?.phoneNumberId ?? "");
      setWabaAccountId(mapping?.wabaAccountId ?? "");
      setWabaDisplayName(mapping?.displayName ?? "");
    }

    const aiMapped = toArrayState<AiProfile>(aiResult as HttpResult<{ [key: string]: AiProfile[] }>, "profiles");
    setAiState(aiMapped);
  }, []);

  const loadTenants = useCallback(async () => {
    setTenantsState({ status: "loading", data: [], error: null });

    const result = await requestJson<{ tenants: Tenant[] }>("/api/superadmin/tenants");
    const mapped = toArrayState<Tenant>(result as HttpResult<{ [key: string]: Tenant[] }>, "tenants");
    setTenantsState(mapped);

    if (mapped.status === "forbidden" || mapped.status === "error") {
      return;
    }

    const candidateId = mapped.data.find((tenant) => tenant.id === selectedTenantId)?.id ?? mapped.data[0]?.id ?? null;
    setSelectedTenantId(candidateId);

    const candidate = mapped.data.find((tenant) => tenant.id === candidateId) ?? null;
    setTenantEditName(candidate?.name ?? "");
    setTenantEditSlug(candidate?.slug ?? "");

    if (!candidateId) {
      setUsersState({ status: "empty", data: [], error: null });
      setWabaState({ status: "empty", data: null, error: null });
      setAiState({ status: "empty", data: [], error: null });
      return;
    }

    await loadTenantModules(candidateId);
  }, [loadTenantModules, selectedTenantId]);

  async function selectTenant(tenant: Tenant) {
    setSelectedTenantId(tenant.id);
    setTenantEditName(tenant.name);
    setTenantEditSlug(tenant.slug);
    await loadTenantModules(tenant.id);
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGlobalMessage(null);

    const response = await requestJson<{ tenant: Tenant }>("/api/superadmin/tenants", {
      method: "POST",
      body: JSON.stringify({
        slug: newTenantSlug,
        name: newTenantName,
      }),
    });

    if (!response.ok) {
      setGlobalMessage(response.error ?? "Não foi possível criar tenant.");
      return;
    }

    setNewTenantName("");
    setNewTenantSlug("");
    await loadTenants();
    setGlobalMessage("Tenant criado com sucesso.");
  }

  async function updateSelectedTenant(payload: { isActive?: boolean }) {
    if (!selectedTenantId) return;
    setGlobalMessage(null);

    const response = await requestJson<{ tenant: Tenant }>(`/api/superadmin/tenants/${selectedTenantId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: tenantEditName,
        slug: tenantEditSlug,
        ...payload,
      }),
    });

    if (!response.ok) {
      setGlobalMessage(response.error ?? "Não foi possível atualizar tenant.");
      return;
    }

    await loadTenants();
    setGlobalMessage("Tenant atualizado.");
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantId) return;

    const response = await requestJson<{ user: UserAccountSummary }>("/api/superadmin/users", {
      method: "POST",
      body: JSON.stringify({
        tenantId: selectedTenantId,
        username: newUserUsername,
        fullName: newUserFullName,
        email: newUserEmail,
        password: newUserPassword,
      }),
    });

    if (!response.ok) {
      setGlobalMessage(response.error ?? "Não foi possível criar usuário.");
      return;
    }

    setNewUserUsername("");
    setNewUserFullName("");
    setNewUserEmail("");
    setNewUserPassword("");
    await loadTenantModules(selectedTenantId);
    setGlobalMessage("Usuário criado.");
  }

  async function toggleUserActive(user: UserAccountSummary) {
    const response = await requestJson<{ user: { isActive: boolean } }>(`/api/superadmin/users/${user.userId}/active`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !user.isActive }),
    });

    if (!response.ok) {
      setGlobalMessage(response.error ?? "Não foi possível atualizar usuário.");
      return;
    }

    if (selectedTenantId) {
      await loadTenantModules(selectedTenantId);
    }
    setGlobalMessage("Status do usuário atualizado.");
  }

  async function resetUserPassword(userId: string) {
    const nextPassword = resetPasswords[userId];
    if (!nextPassword) return;

    const response = await requestJson<{ result: { userId: string } }>(`/api/superadmin/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ nextPassword }),
    });

    if (!response.ok) {
      setGlobalMessage(response.error ?? "Não foi possível resetar senha.");
      return;
    }

    setResetPasswords((previous) => ({ ...previous, [userId]: "" }));
    setGlobalMessage("Senha resetada e sessões anteriores revogadas.");
  }

  async function saveWaba(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantId) return;

    const response = await requestJson<{ mapping: TenantWabaAccount }>("/api/superadmin/waba", {
      method: "PUT",
      body: JSON.stringify({
        tenantId: selectedTenantId,
        phoneNumberId: wabaPhoneNumberId,
        wabaAccountId,
        displayName: wabaDisplayName,
      }),
    });

    if (!response.ok) {
      setGlobalMessage(response.error ?? "Não foi possível salvar configuração WABA.");
      return;
    }

    await loadTenantModules(selectedTenantId);
    setGlobalMessage("WABA atualizado.");
  }

  async function createAiProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantId) return;

    const response = await requestJson<{ profile: AiProfile }>("/api/superadmin/ai-profiles", {
      method: "POST",
      body: JSON.stringify({
        tenantId: selectedTenantId,
        name: newAiName,
        provider: newAiProvider,
        model: newAiModel,
        credentialsRef: newAiCredentialsRef,
        isActive: false,
      }),
    });

    if (!response.ok) {
      setGlobalMessage(response.error ?? "Não foi possível criar perfil de IA.");
      return;
    }

    setNewAiName("");
    setNewAiCredentialsRef("");
    await loadTenantModules(selectedTenantId);
    setGlobalMessage("Perfil de IA criado.");
  }

  async function activateAiProfile(profileId: string) {
    if (!selectedTenantId) return;

    const response = await requestJson<{ profile: AiProfile }>("/api/superadmin/ai-profiles/activate", {
      method: "POST",
      body: JSON.stringify({
        tenantId: selectedTenantId,
        profileId,
      }),
    });

    if (!response.ok) {
      setGlobalMessage(response.error ?? "Não foi possível ativar perfil de IA.");
      return;
    }

    await loadTenantModules(selectedTenantId);
    setGlobalMessage("Perfil de IA ativo atualizado.");
  }

  return (
    <main
      className="min-h-screen p-4 md:p-6"
      style={{
        background: "linear-gradient(165deg, #f8fafc 0%, #fffbeb 52%, #ecfeff 100%)",
        color: tokens.colors.text,
      }}
    >
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-2xl border p-5" style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.panel }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: tokens.colors.textMuted }}>
                IAP-19
              </p>
              <h1 className="mt-1 text-3xl font-semibold">Painel Superadmin</h1>
              <p className="mt-2 text-sm" style={{ color: tokens.colors.textMuted }}>
                Sessão ativa: <code>{session.userId}</code>
              </p>
            </div>
            <LogoutButton className="rounded-xl border px-4 py-2 text-sm font-medium" />
          </div>
          {globalMessage ? (
            <p
              className="mt-4 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: tokens.colors.border }}
              role="status"
              aria-live="polite"
            >
              {globalMessage}
            </p>
          ) : null}
        </header>

        <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className={`${sectionClassName} space-y-4`} style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.panel }}>
            <div>
              <h2 className="text-lg font-semibold">Tenants</h2>
              <StatusMessage state={tenantsState} emptyMessage="Nenhum tenant cadastrado." />
            </div>

            {tenantsState.status === "ready" || tenantsState.status === "empty" ? (
              <div className="space-y-2">
                {tenantsState.data.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    className="w-full rounded-xl border px-3 py-2 text-left"
                    style={{
                      borderColor: tenant.id === selectedTenantId ? tokens.colors.primary : tokens.colors.border,
                      backgroundColor: tenant.id === selectedTenantId ? "#fff7ed" : "transparent",
                    }}
                    onClick={() => void selectTenant(tenant)}
                  >
                    <p className="font-medium">{tenant.name}</p>
                    <p className="text-xs" style={{ color: tokens.colors.textMuted }}>
                      {tenant.slug} · {tenant.isActive ? "Ativo" : "Inativo"}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}

            <form className="space-y-2 border-t pt-4" style={{ borderColor: tokens.colors.border }} onSubmit={createTenant}>
              <p className="text-sm font-medium">Novo tenant</p>
              <input
                required
                name="tenant_name"
                autoComplete="off"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: tokens.colors.border }}
                placeholder="Nome do tenant…"
                aria-label="Nome do novo tenant"
                value={newTenantName}
                onChange={(event) => setNewTenantName(event.target.value)}
              />
              <input
                required
                name="tenant_slug"
                autoComplete="off"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: tokens.colors.border }}
                placeholder="slug-do-tenant…"
                aria-label="Slug do novo tenant"
                value={newTenantSlug}
                onChange={(event) => setNewTenantSlug(event.target.value)}
              />
              <button type="submit" className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
                Criar tenant
              </button>
            </form>
          </aside>

          <div className="space-y-4">
            <section className={sectionClassName} style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.panel }}>
              <h2 className="text-lg font-semibold">Tenant selecionado</h2>
              {!selectedTenant ? (
                <p className="mt-2 text-sm" style={{ color: tokens.colors.textMuted }}>
                  Selecione um tenant para gerenciar os módulos.
                </p>
              ) : (
                <form
                  className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void updateSelectedTenant({});
                  }}
                >
                  <input
                    required
                    name="selected_tenant_name"
                    autoComplete="off"
                    className="rounded-xl border px-3 py-2"
                    style={{ borderColor: tokens.colors.border }}
                    value={tenantEditName}
                    onChange={(event) => setTenantEditName(event.target.value)}
                    aria-label="Nome do tenant"
                  />
                  <input
                    required
                    name="selected_tenant_slug"
                    autoComplete="off"
                    className="rounded-xl border px-3 py-2"
                    style={{ borderColor: tokens.colors.border }}
                    value={tenantEditSlug}
                    onChange={(event) => setTenantEditSlug(event.target.value)}
                    aria-label="Slug do tenant"
                  />
                  <button className="rounded-xl border px-3 py-2" style={{ borderColor: tokens.colors.border }} type="submit">
                    Salvar
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2"
                    style={{ borderColor: tokens.colors.border }}
                    onClick={() => void updateSelectedTenant({ isActive: !selectedTenant.isActive })}
                  >
                    {selectedTenant.isActive ? "Desativar" : "Ativar"}
                  </button>
                </form>
              )}
            </section>

            <section className={`${sectionClassName} space-y-4`} style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.panel }}>
              <div>
                <h2 className="text-lg font-semibold">Usuários</h2>
                <StatusMessage state={usersState} emptyMessage="Nenhum usuário para este tenant." />
              </div>

              {usersState.status === "ready" ? (
                <div className="space-y-2">
                  {usersState.data.map((user) => (
                    <article key={user.userId} className="rounded-xl border p-3" style={{ borderColor: tokens.colors.border }}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{user.fullName}</p>
                          <p className="text-xs" style={{ color: tokens.colors.textMuted }}>
                            {user.username} · {user.email} · {user.role}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-lg border px-2 py-1 text-xs"
                          style={{ borderColor: tokens.colors.border }}
                          onClick={() => void toggleUserActive(user)}
                        >
                          {user.isActive ? "Desativar" : "Ativar"}
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          name={`reset_password_${user.userId}`}
                          className="min-w-[220px] rounded-lg border px-2 py-1 text-sm"
                          style={{ borderColor: tokens.colors.border }}
                          placeholder="Nova senha…"
                          type="password"
                          aria-label={`Nova senha para ${user.username}`}
                          autoComplete="new-password"
                          value={resetPasswords[user.userId] ?? ""}
                          onChange={(event) =>
                            setResetPasswords((previous) => ({
                              ...previous,
                              [user.userId]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="rounded-lg border px-2 py-1 text-xs"
                          style={{ borderColor: tokens.colors.border }}
                          onClick={() => void resetUserPassword(user.userId)}
                        >
                          Reset senha
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}

              <form className="grid gap-2 border-t pt-4 md:grid-cols-2" style={{ borderColor: tokens.colors.border }} onSubmit={createUser}>
                <input
                  required
                  name="new_user_username"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="username…"
                  aria-label="Username do novo usuário"
                  autoComplete="username"
                  spellCheck={false}
                  value={newUserUsername}
                  onChange={(event) => setNewUserUsername(event.target.value)}
                />
                <input
                  required
                  name="new_user_full_name"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="Nome completo…"
                  aria-label="Nome completo do novo usuário"
                  autoComplete="name"
                  value={newUserFullName}
                  onChange={(event) => setNewUserFullName(event.target.value)}
                />
                <input
                  required
                  name="new_user_email"
                  type="email"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="email@dominio.com…"
                  aria-label="Email do novo usuário"
                  autoComplete="email"
                  spellCheck={false}
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                />
                <input
                  required
                  name="new_user_password"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="Senha inicial…"
                  type="password"
                  aria-label="Senha inicial do novo usuário"
                  autoComplete="new-password"
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                />
                <button className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 md:col-span-2" type="submit">
                  Criar usuário
                </button>
              </form>
            </section>

            <section className={`${sectionClassName} space-y-4`} style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.panel }}>
              <div>
                <h2 className="text-lg font-semibold">WABA</h2>
                <StatusMessage state={wabaState} emptyMessage="Nenhum mapeamento WABA para este tenant." />
              </div>

              <form className="grid gap-2 md:grid-cols-3" onSubmit={saveWaba}>
                <input
                  required
                  name="waba_phone_number_id"
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="phone_number_id…"
                  aria-label="WABA phone_number_id"
                  value={wabaPhoneNumberId}
                  onChange={(event) => setWabaPhoneNumberId(event.target.value)}
                />
                <input
                  required
                  name="waba_account_id"
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="waba_account_id…"
                  aria-label="WABA account id"
                  value={wabaAccountId}
                  onChange={(event) => setWabaAccountId(event.target.value)}
                />
                <input
                  required
                  name="waba_display_name"
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="Nome de exibição…"
                  aria-label="Nome de exibição da conta WABA"
                  value={wabaDisplayName}
                  onChange={(event) => setWabaDisplayName(event.target.value)}
                />
                <button className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 md:col-span-3" type="submit">
                  Salvar WABA
                </button>
              </form>
            </section>

            <section className={`${sectionClassName} space-y-4`} style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.panel }}>
              <div>
                <h2 className="text-lg font-semibold">Perfis de IA</h2>
                <StatusMessage state={aiState} emptyMessage="Nenhum perfil de IA para este tenant." />
              </div>

              {aiState.status === "ready" ? (
                <div className="space-y-2">
                  {aiState.data.map((profile) => (
                    <article key={profile.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3" style={{ borderColor: tokens.colors.border }}>
                      <div>
                        <p className="font-medium">{profile.name}</p>
                        <p className="text-xs" style={{ color: tokens.colors.textMuted }}>
                          {profile.provider}/{profile.model} · {profile.credentialsRef}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void activateAiProfile(profile.id)}
                        disabled={profile.isActive}
                        className="rounded-lg border px-2 py-1 text-xs disabled:opacity-50"
                        style={{ borderColor: tokens.colors.border }}
                      >
                        {profile.isActive ? "Ativo" : "Definir ativo"}
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}

              <form className="grid gap-2 border-t pt-4 md:grid-cols-2" style={{ borderColor: tokens.colors.border }} onSubmit={createAiProfile}>
                <input
                  required
                  name="ai_profile_name"
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="Nome do perfil…"
                  aria-label="Nome do novo perfil IA"
                  value={newAiName}
                  onChange={(event) => setNewAiName(event.target.value)}
                />
                <input
                  required
                  name="ai_credentials_ref"
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="secret://tenant/openai_primary…"
                  aria-label="CredentialsRef do perfil IA"
                  value={newAiCredentialsRef}
                  onChange={(event) => setNewAiCredentialsRef(event.target.value)}
                />
                <input
                  required
                  name="ai_provider"
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="provider…"
                  aria-label="Provider do perfil IA"
                  value={newAiProvider}
                  onChange={(event) => setNewAiProvider(event.target.value)}
                />
                <input
                  required
                  name="ai_model"
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="model…"
                  aria-label="Modelo do perfil IA"
                  value={newAiModel}
                  onChange={(event) => setNewAiModel(event.target.value)}
                />
                <button className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 md:col-span-2" type="submit">
                  Criar perfil IA
                </button>
              </form>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
