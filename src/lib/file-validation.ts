/**
 * Server-side file validation. Browser-side checks are convenience only —
 * everything here runs again on the server for every upload.
 */
import { z } from "zod";

import {
  CATEGORIES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  MAX_SEARCH_LENGTH,
} from "./config";
import { isValidCalendarDate } from "./dates";
import { extensionOf } from "./filenames";

export type DetectedType = "pdf" | "jpeg" | "png" | "text";

export const DETECTED_MIME: Record<DetectedType, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
  text: "text/plain",
};

const EXTENSIONS_BY_TYPE: Record<DetectedType, readonly string[]> = {
  pdf: ["pdf"],
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  text: ["txt"],
};

const ALLOWED_EXT_SET = new Set(["pdf", "jpg", "jpeg", "png", "txt"]);

/**
 * Text has no magic bytes, so the check is the opposite: no NULs, no control
 * characters other than tab/newline, and a mostly printable sample.
 */
export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let printable = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte === 9 || byte === 10 || byte === 13) {
      printable += 1;
    } else if (byte < 32 || byte === 127) {
      return false;
    } else {
      printable += 1;
    }
  }
  return printable / sample.length > 0.95;
}

/** Identify file type from magic bytes. Never trusts the extension or MIME. */
export function detectFileType(bytes: Uint8Array): DetectedType | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  ) {
    return "pdf";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  return null;
}

export interface FileCheckInput {
  filename: string;
  size: number;
  bytes: Uint8Array;
}

export type FileCheckResult =
  | { ok: true; mimeType: string; detected: DetectedType }
  | { ok: false; error: string };

/**
 * Validate one uploaded file: extension allow-list, non-empty, size limit,
 * magic-byte sniffing, and content/extension agreement.
 */
export function validateUploadFile(input: FileCheckInput): FileCheckResult {
  const rawName = input.filename.trim();
  if (!rawName) {
    return { ok: false, error: "A file name is required." };
  }
  if (rawName.length > 255) {
    return {
      ok: false,
      error: `"${rawName.slice(0, 60)}…" has a name longer than 255 characters.`,
    };
  }
  const ext = extensionOf(rawName);
  if (!ext || !ALLOWED_EXT_SET.has(ext)) {
    return {
      ok: false,
      error: `"${rawName}" is not a supported file type. Allowed: PDF, JPG, JPEG, PNG, TXT.`,
    };
  }
  if (input.size <= 0 || input.bytes.length === 0) {
    return { ok: false, error: `"${rawName}" is empty.` };
  }
  if (input.size > MAX_FILE_SIZE_BYTES || input.bytes.length > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `"${rawName}" exceeds the ${MAX_FILE_SIZE_MB} MB size limit.`,
    };
  }
  if (ext === "txt") {
    if (!looksLikeText(input.bytes)) {
      return { ok: false, error: `"${rawName}" is not a plain text file.` };
    }
    return { ok: true, mimeType: DETECTED_MIME.text, detected: "text" };
  }
  const detected = detectFileType(input.bytes);
  if (!detected) {
    return {
      ok: false,
      error: `"${rawName}" is not a valid PDF, JPEG or PNG file.`,
    };
  }
  if (!EXTENSIONS_BY_TYPE[detected].includes(ext)) {
    return {
      ok: false,
      error: `"${rawName}" content does not match its .${ext} extension.`,
    };
  }
  return { ok: true, mimeType: DETECTED_MIME[detected], detected };
}

/* ----------------------------- Zod schemas ----------------------------- */

const optionalCalendarDate = z
  .string()
  .trim()
  .max(10)
  .refine((v) => v === "" || isValidCalendarDate(v), {
    message: "Document date must be a valid date in YYYY-MM-DD form.",
  })
  .transform((v) => (v === "" ? null : v));

/** Per-file metadata sent alongside an upload. */
export const documentMetadataSchema = z.object({
  category: z.enum(CATEGORIES),
  documentDate: optionalCalendarDate,
});

export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

export const authCredentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export const signUpSchema = authCredentialsSchema.extend({
  fullName: z.string().trim().min(1, "Full name is required.").max(120),
  businessName: z.string().trim().min(1, "Business name is required.").max(160),
  aiConsent: z.boolean().optional(),
});

export const exportRequestSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const listQuerySchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  category: z.enum(CATEGORIES).optional(),
  search: z.string().trim().max(MAX_SEARCH_LENGTH).optional(),
});
