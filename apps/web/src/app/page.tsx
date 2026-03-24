"use client";

import { api } from "@repo/convex-backend";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginPage } from "@/components/LoginPage";
import { clearStoredSessionToken, readStoredSessionToken } from "@/lib/session-token";

export default function HomePage() {
  const router = useRouter();
  const [storedToken, setStoredToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setStoredToken(readStoredSessionToken());
  }, []);

  const session = useQuery(api.auth.getSession, storedToken ? { sessionToken: storedToken } : "skip");

  useEffect(() => {
    if (storedToken === undefined) return;
    if (!storedToken) return;
    if (session === undefined) return;

    if (session) {
      router.replace("/superadmin");
      return;
    }

    clearStoredSessionToken();
    setStoredToken(null);
  }, [router, session, storedToken]);

  if (storedToken !== undefined && storedToken && session === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-zinc-500">Validando sessão…</p>
      </main>
    );
  }

  return <LoginPage />;
}
