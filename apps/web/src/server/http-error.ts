export function mapBackendErrorToHttp(error: unknown): {
  status: number;
  error: string;
} {
  const candidate = error as { code?: string; message?: string };

  if (candidate?.code === "UNAUTHENTICATED") {
    return {
      status: 401,
      error: candidate.message ?? "Unauthenticated.",
    };
  }

  if (candidate?.code === "FORBIDDEN") {
    return {
      status: 403,
      error: candidate.message ?? "Forbidden.",
    };
  }

  if (candidate?.code === "BAD_REQUEST") {
    return {
      status: 400,
      error: candidate.message ?? "Invalid request.",
    };
  }

  if (candidate?.code === "NOT_FOUND") {
    return {
      status: 404,
      error: candidate.message ?? "Resource not found.",
    };
  }

  return {
    status: 500,
    error: candidate?.message ?? "Unexpected error.",
  };
}
