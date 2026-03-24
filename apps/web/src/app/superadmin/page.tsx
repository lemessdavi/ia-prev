"use client";

import { api } from "@repo/convex-backend";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { SuperadminDashboard } from "@/components/SuperadminDashboard";
import { clearStoredSessionToken, readStoredSessionToken } from "@/lib/session-token";

export default function SuperadminPage() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setSessionToken(readStoredSessionToken());
  }, []);

  const session = useQuery(api.auth.getSession, sessionToken ? { sessionToken } : "skip");

  useEffect(() => {
    if (sessionToken === undefined) return;
    if (!sessionToken) {
      router.replace("/");
      return;
    }
    if (session === undefined) return;
    if (session) return;

    clearStoredSessionToken();
    setSessionToken(null);
    router.replace("/");
  }, [router, session, sessionToken]);

  if (sessionToken === undefined || (sessionToken && session === undefined)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-zinc-500">Carregando painel…</p>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  if (session.role !== "superadmin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <section className="w-full max-w-lg rounded-2xl border bg-white p-8">
          <h1 className="text-2xl font-semibold">403 · Área restrita</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Seu perfil está autenticado, mas não possui acesso ao painel superadmin.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/app" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
              Ir para /app
            </Link>
            <LogoutButton className="rounded-xl border px-4 py-2 text-sm" />
          </div>
        </section>
      </main>
    );
  }

  return <SuperadminDashboard session={session} />;
}
