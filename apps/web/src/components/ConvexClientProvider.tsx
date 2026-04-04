"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim() ?? "";
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

type ConvexClientProviderProps = {
  children: unknown;
};

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  if (!convexClient) {
    return <>{children as React.ReactNode}</>;
  }

  return <ConvexProvider client={convexClient}>{children as React.ReactNode}</ConvexProvider>;
}
