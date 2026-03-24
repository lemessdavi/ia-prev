export type AppRole = "superadmin" | "tenant_user";

export type AppSession = {
  userId: string;
  tenantId: string;
  role: AppRole;
  sessionId: string;
  createdAt: number;
};

export type SuperadminGate =
  | {
      status: "redirect";
      to: "/";
    }
  | {
      status: "forbidden";
      ctaTo: "/app";
    }
  | {
      status: "allowed";
    };

export function resolvePostLoginRedirect(_session: AppSession): "/superadmin" {
  return "/superadmin";
}

export function resolveSuperadminGate(session: AppSession | null): SuperadminGate {
  if (!session) {
    return {
      status: "redirect",
      to: "/",
    };
  }

  if (session.role !== "superadmin") {
    return {
      status: "forbidden",
      ctaTo: "/app",
    };
  }

  return {
    status: "allowed",
  };
}

type LoginErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "BAD_REQUEST";

function errorCodeToStatus(code?: string): number {
  const typedCode = code as LoginErrorCode | undefined;
  if (typedCode === "UNAUTHENTICATED") return 401;
  if (typedCode === "FORBIDDEN") return 403;
  if (typedCode === "BAD_REQUEST") return 400;
  return 500;
}

export function runLoginFlow(input: {
  username: string;
  password: string;
  authenticate: (credentials: { username: string; password: string }) => AppSession;
}):
  | {
      ok: true;
      status: 200;
      session: AppSession;
      redirectTo: "/superadmin";
    }
  | {
      ok: false;
      status: number;
      error: string;
    } {
  try {
    const session = input.authenticate({ username: input.username, password: input.password });
    return {
      ok: true,
      status: 200,
      session,
      redirectTo: resolvePostLoginRedirect(session),
    };
  } catch (error) {
    const known = error as { code?: string; message?: string };
    return {
      ok: false,
      status: errorCodeToStatus(known.code),
      error: known.message ?? "Unexpected error.",
    };
  }
}
