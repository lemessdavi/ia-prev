import { createBackendApiClient } from "utils";

const backendBaseUrl = process.env.EXPO_PUBLIC_CONVEX_URL?.trim() || "";

export const backendClient = createBackendApiClient(backendBaseUrl);
