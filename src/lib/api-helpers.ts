/**
 * Shared helpers for API route handlers.
 */
import { badRequest } from "./errors";

/** Minimal structural type so we never depend on zod's generic naming. */
export interface SafeParser<T> {
  safeParse(
    value: unknown,
  ):
    | { success: true; data: T }
    | {
        success: false;
        error: { issues: { path: PropertyKey[]; message: string }[] };
      };
}

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
}

export function parseOrThrow<T>(
  schema: SafeParser<T>,
  value: unknown,
  message = "Invalid request.",
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw badRequest(
      message,
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/** RFC 5987 Content-Disposition with an ASCII fallback. */
export function contentDisposition(
  type: "inline" | "attachment",
  filename: string,
): string {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
