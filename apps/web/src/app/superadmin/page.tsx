import Link from "next/link";
import { redirect } from "next/navigation";
import { listAiProfiles, listTenantWabaAccounts, listTenants, listUsers } from "@repo/backend";
import { LogoutButton } from "@/components/LogoutButton";
import { SuperadminDashboard } from "@/components/SuperadminDashboard";
import { resolveSuperadminGate } from "@/server/auth-flow";
import { getBackendStore } from "@/server/backend-store";
import { readValidatedSession } from "@/server/session-cookie";

export default async function SuperadminPage() {
  const session = await readValidatedSession();
  const gate = resolveSuperadminGate(session);

  if (gate.status === "redirect") {
    redirect(gate.to);
  }

  if (gate.status === "forbidden") {
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

  const authenticatedSession = session!;
  const store = getBackendStore();
  const initialTenants = listTenants({
    session: authenticatedSession,
    store,
  });
  const initialTenantId = initialTenants[0]?.id ?? null;

  const initialUsers = initialTenantId
    ? listUsers({
        session: authenticatedSession,
        store,
        tenantId: initialTenantId,
      })
    : [];

  const initialWabaMappings = initialTenantId
    ? listTenantWabaAccounts({
        session: authenticatedSession,
        store,
        tenantId: initialTenantId,
      })
    : [];
  const initialWaba = initialWabaMappings[0] ?? null;

  const initialAiProfiles = initialTenantId
    ? listAiProfiles({
        session: authenticatedSession,
        store,
        tenantId: initialTenantId,
      })
    : [];

  return (
    <SuperadminDashboard
      session={authenticatedSession}
      initialTenants={initialTenants}
      initialTenantId={initialTenantId}
      initialUsers={initialUsers}
      initialWaba={initialWaba}
      initialAiProfiles={initialAiProfiles}
    />
  );
}
