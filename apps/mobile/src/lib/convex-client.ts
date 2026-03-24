import { ConvexReactClient } from "convex/react";

export const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? "";

let client: ConvexReactClient | null = null;

export function getConvexClient(): ConvexReactClient {
  if (!convexUrl) {
    throw new Error("EXPO_PUBLIC_CONVEX_URL is missing.");
  }

  if (!client) {
    client = new ConvexReactClient(convexUrl);
  }

  return client;
}
