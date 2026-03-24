"use client";

import { api, type SessionInfo } from "@repo/convex-backend";
import { tokens } from "config";
import { useAction, useMutation, useQuery } from "convex/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { parseBusinessErrorMessage } from "@/lib/business-error";
import { LogoutButton } from "./LogoutButton";

const sectionClassName = "rounded-2xl border p-5";

export function SuperadminDashboard({ session }: { session: SessionInfo }) {
  const sessionToken = session.sessionToken;

  const listTenants = useQuery(api.tenants.listTenants, { sessionToken });
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const selectedTenant = useMemo(
    () => listTenants?.find((tenant) => tenant.id === selectedTenantId) ?? null,
    [listTenants, selectedTenantId],
  );

  useEffect(() => {
    if (!listTenants) return;
    if (listTenants.length === 0) {
      setSelectedTenantId(null);
      return;
    }
    if (!selectedTenantId || !listTenants.some((tenant) => tenant.id === selectedTenantId)) {
      setSelectedTenantId(listTenants[0].id);
    }
  }, [listTenants, selectedTenantId]);

  const users = useQuery(api.users.listUsers, selectedTenantId ? { sessionToken, tenantId: selectedTenantId } : "skip");
  const wabaMappings = useQuery(
    api.waba.listTenantWabaAccounts,
    selectedTenantId ? { sessionToken, tenantId: selectedTenantId } : "skip",
  );
  const aiProfiles = useQuery(
    api.aiProfiles.listAiProfiles,
    selectedTenantId ? { sessionToken, tenantId: selectedTenantId } : "skip",
  );

  const createTenantMutation = useMutation(api.tenants.createTenant);
  const updateTenantMutation = useMutation(api.tenants.updateTenant);
  const createTenantUserAction = useAction(api.users.createTenantUser);
  const setUserActiveMutation = useMutation(api.users.setUserActive);
  const resetUserPasswordAction = useAction(api.users.resetUserPassword);
  const upsertWabaMutation = useMutation(api.waba.upsertTenantWabaAccount);
  const createAiProfileMutation = useMutation(api.aiProfiles.createAiProfile);
  const setActiveAiProfileMutation = useMutation(api.aiProfiles.setActiveAiProfile);

  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantSlug, setNewTenantSlug] = useState("");
  const [tenantEditName, setTenantEditName] = useState("");
  const [tenantEditSlug, setTenantEditSlug] = useState("");

  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  const [wabaPhoneNumberId, setWabaPhoneNumberId] = useState("");
  const [wabaAccountId, setWabaAccountId] = useState("");
  const [wabaDisplayName, setWabaDisplayName] = useState("");

  const [newAiName, setNewAiName] = useState("");
  const [newAiProvider, setNewAiProvider] = useState("openai");
  const [newAiModel, setNewAiModel] = useState("gpt-4.1-mini");
  const [newAiCredentialsRef, setNewAiCredentialsRef] = useState("");

  useEffect(() => {
    setTenantEditName(selectedTenant?.name ?? "");
    setTenantEditSlug(selectedTenant?.slug ?? "");
  }, [selectedTenant?.id, selectedTenant?.name, selectedTenant?.slug]);

  const selectedWaba = wabaMappings?.[0] ?? null;
  useEffect(() => {
    setWabaPhoneNumberId(selectedWaba?.phoneNumberId ?? "");
    setWabaAccountId(selectedWaba?.wabaAccountId ?? "");
    setWabaDisplayName(selectedWaba?.displayName ?? "");
  }, [selectedWaba?.id, selectedWaba?.phoneNumberId, selectedWaba?.wabaAccountId, selectedWaba?.displayName]);

  async function runAction(actionKey: string, fn: () => Promise<void>, successMessage: string) {
    setPendingAction(actionKey);
    setGlobalMessage(null);
    try {
      await fn();
      setGlobalMessage(successMessage);
    } catch (error) {
      setGlobalMessage(parseBusinessErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      "createTenant",
      async () => {
        const created = await createTenantMutation({
          sessionToken,
          name: newTenantName,
          slug: newTenantSlug,
        });
        setSelectedTenantId(created.id);
        setNewTenantName("");
        setNewTenantSlug("");
      },
      "Tenant criado com sucesso.",
    );
  }

  async function updateSelectedTenant(payload: { isActive?: boolean }) {
    if (!selectedTenantId) return;
    await runAction(
      "updateTenant",
      async () => {
        await updateTenantMutation({
          sessionToken,
          tenantId: selectedTenantId,
          name: tenantEditName,
          slug: tenantEditSlug,
          ...payload,
        });
      },
      "Tenant atualizado.",
    );
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantId) return;

    await runAction(
      "createUser",
      async () => {
        await createTenantUserAction({
          sessionToken,
          tenantId: selectedTenantId,
          username: newUserUsername,
          fullName: newUserFullName,
          email: newUserEmail,
          password: newUserPassword,
        });
        setNewUserUsername("");
        setNewUserFullName("");
        setNewUserEmail("");
        setNewUserPassword("");
      },
      "Usuário criado.",
    );
  }

  async function toggleUserActive(userId: string, isActive: boolean) {
    await runAction(
      `toggleUser_${userId}`,
      async () => {
        await setUserActiveMutation({
          sessionToken,
          userId,
          isActive: !isActive,
        });
      },
      "Status do usuário atualizado.",
    );
  }

  async function resetUserPassword(userId: string) {
    const nextPassword = resetPasswords[userId];
    if (!nextPassword) return;

    await runAction(
      `resetPassword_${userId}`,
      async () => {
        await resetUserPasswordAction({
          sessionToken,
          userId,
          nextPassword,
        });
        setResetPasswords((current) => ({ ...current, [userId]: "" }));
      },
      "Senha resetada e sessões anteriores revogadas.",
    );
  }

  async function saveWaba(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantId) return;

    await runAction(
      "saveWaba",
      async () => {
        await upsertWabaMutation({
          sessionToken,
          tenantId: selectedTenantId,
          phoneNumberId: wabaPhoneNumberId,
          wabaAccountId,
          displayName: wabaDisplayName,
        });
      },
      "WABA atualizado.",
    );
  }

  async function createAiProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenantId) return;

    await runAction(
      "createAiProfile",
      async () => {
        await createAiProfileMutation({
          sessionToken,
          tenantId: selectedTenantId,
          name: newAiName,
          provider: newAiProvider,
          model: newAiModel,
          credentialsRef: newAiCredentialsRef,
          isActive: false,
        });
        setNewAiName("");
        setNewAiCredentialsRef("");
      },
      "Perfil de IA criado.",
    );
  }

  async function activateAiProfile(profileId: string) {
    if (!selectedTenantId) return;
    await runAction(
      `activateAi_${profileId}`,
      async () => {
        await setActiveAiProfileMutation({
          sessionToken,
          tenantId: selectedTenantId,
          profileId,
        });
      },
      "Perfil de IA ativo atualizado.",
    );
  }

  const loadingTenants = listTenants === undefined;
  const loadingUsers = selectedTenantId !== null && users === undefined;
  const loadingWaba = selectedTenantId !== null && wabaMappings === undefined;
  const loadingAi = selectedTenantId !== null && aiProfiles === undefined;

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
                IAP-2
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
              {loadingTenants ? (
                <p style={{ color: tokens.colors.textMuted }}>Carregando tenants…</p>
              ) : !listTenants?.length ? (
                <p style={{ color: tokens.colors.textMuted }}>Nenhum tenant cadastrado.</p>
              ) : null}
            </div>

            {listTenants?.length ? (
              <div className="space-y-2">
                {listTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    className="w-full rounded-xl border px-3 py-2 text-left"
                    style={{
                      borderColor: tenant.id === selectedTenantId ? tokens.colors.primary : tokens.colors.border,
                      backgroundColor: tenant.id === selectedTenantId ? "#fff7ed" : "transparent",
                    }}
                    onClick={() => setSelectedTenantId(tenant.id)}
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
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: tokens.colors.border }}
                placeholder="Nome do tenant…"
                value={newTenantName}
                onChange={(event) => setNewTenantName(event.target.value)}
              />
              <input
                required
                className="w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: tokens.colors.border }}
                placeholder="slug-do-tenant…"
                value={newTenantSlug}
                onChange={(event) => setNewTenantSlug(event.target.value)}
              />
              <button
                type="submit"
                disabled={pendingAction === "createTenant"}
                className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
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
                    className="rounded-xl border px-3 py-2"
                    style={{ borderColor: tokens.colors.border }}
                    value={tenantEditName}
                    onChange={(event) => setTenantEditName(event.target.value)}
                  />
                  <input
                    required
                    className="rounded-xl border px-3 py-2"
                    style={{ borderColor: tokens.colors.border }}
                    value={tenantEditSlug}
                    onChange={(event) => setTenantEditSlug(event.target.value)}
                  />
                  <button
                    className="rounded-xl border px-3 py-2"
                    style={{ borderColor: tokens.colors.border }}
                    type="submit"
                    disabled={pendingAction === "updateTenant"}
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2"
                    style={{ borderColor: tokens.colors.border }}
                    disabled={pendingAction === "updateTenant"}
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
                {loadingUsers ? (
                  <p style={{ color: tokens.colors.textMuted }}>Carregando usuários…</p>
                ) : !users?.length ? (
                  <p style={{ color: tokens.colors.textMuted }}>Nenhum usuário para este tenant.</p>
                ) : null}
              </div>

              {users?.length ? (
                <div className="space-y-2">
                  {users.map((user) => (
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
                          disabled={pendingAction === `toggleUser_${user.userId}`}
                          onClick={() => void toggleUserActive(user.userId, user.isActive)}
                        >
                          {user.isActive ? "Desativar" : "Ativar"}
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          className="min-w-[220px] rounded-lg border px-2 py-1 text-sm"
                          style={{ borderColor: tokens.colors.border }}
                          placeholder="Nova senha…"
                          type="password"
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
                          disabled={pendingAction === `resetPassword_${user.userId}`}
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
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="username…"
                  autoComplete="username"
                  spellCheck={false}
                  value={newUserUsername}
                  onChange={(event) => setNewUserUsername(event.target.value)}
                />
                <input
                  required
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="Nome completo…"
                  autoComplete="name"
                  value={newUserFullName}
                  onChange={(event) => setNewUserFullName(event.target.value)}
                />
                <input
                  required
                  type="email"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="email@dominio.com…"
                  autoComplete="email"
                  spellCheck={false}
                  value={newUserEmail}
                  onChange={(event) => setNewUserEmail(event.target.value)}
                />
                <input
                  required
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="Senha inicial…"
                  type="password"
                  autoComplete="new-password"
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                />
                <button
                  className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 md:col-span-2 disabled:opacity-60"
                  type="submit"
                  disabled={pendingAction === "createUser"}
                >
                  Criar usuário
                </button>
              </form>
            </section>

            <section className={`${sectionClassName} space-y-4`} style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.panel }}>
              <div>
                <h2 className="text-lg font-semibold">WABA</h2>
                {loadingWaba ? (
                  <p style={{ color: tokens.colors.textMuted }}>Carregando configuração WABA…</p>
                ) : !wabaMappings?.length ? (
                  <p style={{ color: tokens.colors.textMuted }}>Nenhum mapeamento WABA para este tenant.</p>
                ) : null}
              </div>

              <form className="grid gap-2 md:grid-cols-3" onSubmit={saveWaba}>
                <input
                  required
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="phone_number_id…"
                  value={wabaPhoneNumberId}
                  onChange={(event) => setWabaPhoneNumberId(event.target.value)}
                />
                <input
                  required
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="waba_account_id…"
                  value={wabaAccountId}
                  onChange={(event) => setWabaAccountId(event.target.value)}
                />
                <input
                  required
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="Nome de exibição…"
                  value={wabaDisplayName}
                  onChange={(event) => setWabaDisplayName(event.target.value)}
                />
                <button
                  className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 md:col-span-3 disabled:opacity-60"
                  type="submit"
                  disabled={pendingAction === "saveWaba"}
                >
                  Salvar WABA
                </button>
              </form>
            </section>

            <section className={`${sectionClassName} space-y-4`} style={{ borderColor: tokens.colors.border, backgroundColor: tokens.colors.panel }}>
              <div>
                <h2 className="text-lg font-semibold">Perfis de IA</h2>
                {loadingAi ? (
                  <p style={{ color: tokens.colors.textMuted }}>Carregando perfis de IA…</p>
                ) : !aiProfiles?.length ? (
                  <p style={{ color: tokens.colors.textMuted }}>Nenhum perfil de IA para este tenant.</p>
                ) : null}
              </div>

              {aiProfiles?.length ? (
                <div className="space-y-2">
                  {aiProfiles.map((profile) => (
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
                        disabled={profile.isActive || pendingAction === `activateAi_${profile.id}`}
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
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="Nome do perfil…"
                  value={newAiName}
                  onChange={(event) => setNewAiName(event.target.value)}
                />
                <input
                  required
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="secret://tenant/openai_primary…"
                  value={newAiCredentialsRef}
                  onChange={(event) => setNewAiCredentialsRef(event.target.value)}
                />
                <input
                  required
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="provider…"
                  value={newAiProvider}
                  onChange={(event) => setNewAiProvider(event.target.value)}
                />
                <input
                  required
                  autoComplete="off"
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: tokens.colors.border }}
                  placeholder="model…"
                  value={newAiModel}
                  onChange={(event) => setNewAiModel(event.target.value)}
                />
                <button
                  className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 md:col-span-2 disabled:opacity-60"
                  type="submit"
                  disabled={pendingAction === "createAiProfile"}
                >
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
