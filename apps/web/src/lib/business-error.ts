export function parseBusinessErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Unexpected error.";
  }

  const candidate = error as { data?: unknown; message?: string };
  if (typeof candidate.data === "string") {
    try {
      const parsed = JSON.parse(candidate.data) as { message?: string };
      if (parsed.message) {
        return parsed.message;
      }
    } catch {
      if (candidate.data.length > 0) {
        return candidate.data;
      }
    }
  }

  if (candidate.data && typeof candidate.data === "object") {
    const parsed = candidate.data as { message?: string };
    if (parsed.message) {
      return parsed.message;
    }
  }

  return candidate.message ?? "Unexpected error.";
}
