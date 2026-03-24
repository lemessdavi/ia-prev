import { api, type SessionInfo } from "@repo/convex-backend";
import { useConvex } from "convex/react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type SessionContextValue = {
  session: SessionInfo | null;
  sessionToken: string | null;
  loading: boolean;
  error: string | null;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  sessionToken: null,
  loading: true,
  error: null,
});

function parseBusinessErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Unexpected error.";

  const candidate = error as { data?: unknown; message?: string };
  if (typeof candidate.data === "string") {
    try {
      const parsed = JSON.parse(candidate.data) as { message?: string };
      if (parsed.message) return parsed.message;
    } catch {
      if (candidate.data.length > 0) return candidate.data;
    }
  }

  return candidate.message ?? "Unexpected error.";
}

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const convex = useConvex();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);

      try {
        const username = process.env.EXPO_PUBLIC_DEMO_USERNAME ?? "ana.lima";
        const password = process.env.EXPO_PUBLIC_DEMO_PASSWORD ?? "Ana@123456";
        const nextSession = await convex.action(api.auth.loginWithUsernamePassword, {
          username,
          password,
        });

        if (!disposed) {
          setSession(nextSession);
        }
      } catch (bootstrapError) {
        if (!disposed) {
          setSession(null);
          setError(parseBusinessErrorMessage(bootstrapError));
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      disposed = true;
    };
  }, [convex]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      sessionToken: session?.sessionToken ?? null,
      loading,
      error,
    }),
    [error, loading, session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAppSession() {
  return useContext(SessionContext);
}
