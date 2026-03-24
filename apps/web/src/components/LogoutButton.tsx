"use client";

import { api } from "@repo/convex-backend";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearStoredSessionToken, readStoredSessionToken } from "@/lib/session-token";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const logout = useMutation(api.auth.logout);
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);

    try {
      const sessionToken = readStoredSessionToken();
      if (sessionToken) {
        await logout({ sessionToken });
      }
    } catch {
      // Session may already be expired; local cleanup still applies.
    } finally {
      clearStoredSessionToken();
      router.replace("/");
      router.refresh();
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className={className}
      aria-label="Encerrar sessão"
    >
      {loading ? "Saindo…" : "Sair"}
    </button>
  );
}
