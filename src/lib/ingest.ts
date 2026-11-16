/**
 * The ingest seam: every source (multipart upload, sample loader, and any future
 * connector) turns a batch of files into stored documents through this one
 * function. Validation, metadata handling and persistence all live here so the
 * routes stay thin and the behaviour is testable without HTTP.
 */
import type { Category } from "./config";
import { validateUploadFile } from "./file-validation";
import type { DocumentStore, NewDocumentInput } from "./store/types";
import type { DocumentRecord } from "./types";

export interface IngestFile {
  /** Original filename as supplied by the source. */
  filename: string;
  /** Raw bytes. */
  bytes: Uint8Array;
  /** Declared size (defaults to bytes.length). */
  size?: number;
  /** Per-file metadata chosen by the user or the source. */
  documentDate?: string | null;
  category?: Category;
  /** Provenance (optional; defaults to "upload"). */
  sourceType?: string | null;
  sourceAccount?: string | null;
  sourceFileId?: string | null;
}

export interface IngestError {
  filename: string;
  error: string;
}

export interface IngestResult {
  created: DocumentRecord[];
  errors: IngestError[];
  notice: string | null;
  usedUploadDateFallback: number;
}

const MAX_FILES = 20;

/**
 * Ingest a batch of files for a user. Validates each file, builds the
 * NewDocumentInput list, persists via the store, and reports per-file errors.
 * Never throws on a single bad file; only infrastructure errors propagate.
 */
export async function ingest(
  store: DocumentStore,
  userId: string,
  files: IngestFile[],
): Promise<IngestResult> {
  if (files.length === 0) {
    return { created: [], errors: [], notice: null, usedUploadDateFallback: 0 };
  }
  if (files.length > MAX_FILES) {
    throw new Error(`You can upload up to ${MAX_FILES} files at a time.`);
  }

  const inputs: NewDocumentInput[] = [];
  const errors: IngestError[] = [];
  let usedUploadDateFallback = 0;

  for (const [i, file] of files.entries()) {
    const name = (file.filename || "").trim() || `file-${i + 1}`;
    const bytes = file.bytes;
    const size = file.size ?? bytes.length;

    const check = validateUploadFile({ filename: name, size, bytes });
    if (!check.ok) {
      errors.push({ filename: name, error: check.error });
      continue;
    }

    const documentDate = file.documentDate ?? null;
    if (documentDate === null) usedUploadDateFallback += 1;

    const category: Category = file.category ?? "Other";
    inputs.push({
      originalFilename: name,
      bytes,
      mimeType: check.mimeType,
      fileSize: bytes.length,
      documentDate,
      category,
      sourceType: file.sourceType,
      sourceAccount: file.sourceAccount,
      sourceFileId: file.sourceFileId,
    });
  }

  if (inputs.length === 0) {
    return {
      created: [],
      errors,
      notice: null,
      usedUploadDateFallback,
    };
  }

  const result = await store.createDocuments(userId, inputs);
  const allErrors = [...errors, ...result.errors];

  const notice =
    usedUploadDateFallback > 0
      ? `${usedUploadDateFallback} document(s) had no document date — the upload date was used instead.`
      : null;

  return {
    created: result.created,
    errors: allErrors,
    notice,
    usedUploadDateFallback,
  };
}
