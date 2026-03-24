import Link from "next/link";

export default function TenantAppPlaceholderPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <section className="w-full max-w-xl rounded-2xl border bg-white p-8">
        <h1 className="text-2xl font-semibold">/app placeholder</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Esta rota será usada pela experiência tenant_user nas próximas fases.
        </p>
        <div className="mt-6">
          <Link href="/" className="rounded-xl border px-4 py-2 text-sm">
            Voltar para login
          </Link>
        </div>
      </section>
    </main>
  );
}
