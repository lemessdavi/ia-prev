"use client";

import { api } from "@repo/convex-backend";
import { tokens } from "config";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { parseBusinessErrorMessage } from "@/lib/business-error";
import { storeSessionToken } from "@/lib/session-token";

export function LoginPage() {
  const router = useRouter();
  const login = useAction(api.auth.loginWithUsernamePassword);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const session = await login({
        username,
        password,
      });
      storeSessionToken(session.sessionToken);
      router.replace("/superadmin");
      router.refresh();
    } catch (requestError) {
      setError(parseBusinessErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center p-6"
      style={{
        background: "radial-gradient(circle at top left, #fef3c7 0%, #f8fafc 45%, #ecfeff 100%)",
      }}
    >
      <section
        className="w-full max-w-md rounded-3xl border p-8 shadow-xl"
        style={{
          backgroundColor: tokens.colors.panel,
          borderColor: tokens.colors.border,
        }}
      >
        <p className="text-sm uppercase tracking-[0.2em]" style={{ color: tokens.colors.textMuted }}>
          IA Prev
        </p>
        <h1 className="mt-2 text-3xl font-semibold" style={{ color: tokens.colors.text }}>
          Acesso administrativo
        </h1>
        <p className="mt-2 text-sm" style={{ color: tokens.colors.textMuted }}>
          Entre com usuário e senha para acessar o painel superadmin.
        </p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="username">
              Usuário
            </label>
            <input
              id="username"
              name="username"
              required
              autoComplete="username"
              className="w-full rounded-xl border px-4 py-3"
              style={{ borderColor: tokens.colors.border }}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              required
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border px-4 py-3"
              style={{ borderColor: tokens.colors.border }}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <p className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "#fecaca", color: "#b91c1c" }} role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: tokens.colors.primary }}
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="mt-8 rounded-xl border p-4 text-sm" style={{ borderColor: tokens.colors.border }}>
          <p className="font-medium">Credenciais de teste</p>
          <p className="mt-2" style={{ color: tokens.colors.textMuted }}>
            superadmin: <code>ops.root</code> / <code>Root@123456</code>
          </p>
          <p style={{ color: tokens.colors.textMuted }}>
            tenant_user: <code>ana.lima</code> / <code>Ana@123456</code>
          </p>
        </div>
      </section>
    </main>
  );
}
