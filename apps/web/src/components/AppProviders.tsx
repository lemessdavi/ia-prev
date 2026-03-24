"use client";

import { ConvexProvider } from "convex/react";
import { convexUrl, getConvexClient } from "@/lib/convex-client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  if (!convexUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <section className="w-full max-w-xl rounded-2xl border bg-white p-8">
          <h1 className="text-2xl font-semibold">Convex URL não configurada</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Defina <code>NEXT_PUBLIC_CONVEX_URL</code> para conectar o frontend ao backend Convex.
          </p>
        </section>
      </main>
    );
  }

  return <ConvexProvider client={getConvexClient()}>{children}</ConvexProvider>;
}
