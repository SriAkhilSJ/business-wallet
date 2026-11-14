/**
 * Central application constants shared by client and server code.
 */

export const APP_NAME = "BusinessVault";

export const CATEGORIES = [
  "Sales Invoice",
  "Purchase Invoice",
  "Expense",
  "Receipt",
  "Utility Bill",
  "Payment Proof",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 20;

export const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"] as const;

export const STORAGE_BUCKET = "business-documents";

/** Lifetime of signed storage URLs issued for previews. */
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

/** Search input limit (characters). */
export const MAX_SEARCH_LENGTH = 200;
