import { createBackendApiClient } from "utils";

const backendBaseUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim() || "http://localhost:3000/api/backend";

export const backendClient = createBackendApiClient(backendBaseUrl);
