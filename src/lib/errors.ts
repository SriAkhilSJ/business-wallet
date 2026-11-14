/**
 * Application error type with safe, user-presentable messages.
 * Never put secrets, stack traces or storage paths into `message`.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function unauthorized(message = "You must be signed in to continue.") {
  return new AppError(401, "unauthorized", message);
}

export function notFound(message = "The requested document was not found.") {
  return new AppError(404, "not_found", message);
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(400, "bad_request", message, details);
}

/** Convert any thrown value into a safe JSON error response. */
export function jsonError(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
      { status: err.status },
    );
  }
  // Unknown error: log a minimal note server-side, return a generic message.
  console.error("[api] unexpected error:", err instanceof Error ? err.message : String(err));
  return Response.json(
    { error: { code: "internal_error", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}
