/**
 * Persistence abstraction. Two implementations:
 *  - SupabaseDocumentStore (Supabase Postgres + Storage, RLS enforced)
 *  - LocalDevDocumentStore (local JSON + files, development only)
 *
 * Every method takes the acting user's id and MUST enforce that the user can
 * only touch documents of businesses they own. Returning `null`/`false` for
 * foreign documents avoids leaking their existence.
 */
import type { Category } from "../config";
import type { BusinessInfo, DocumentRecord, SessionUser } from "../types";

export interface NewDocumentInput {
  originalFilename: string;
  bytes: Uint8Array;
  mimeType: string;
  fileSize: number;
  documentDate: string | null;
  category: Category;
  /** Provenance (optional; defaults to "upload"). */
  sourceType?: string | null;
  sourceAccount?: string | null;
  sourceFileId?: string | null;
}

export interface CreateResult {
  created: DocumentRecord[];
  errors: { filename: string; error: string }[];
}

export interface StoredBytes {
  record: DocumentRecord;
  /** null when the DB record exists but the storage object is gone. */
  bytes: Uint8Array | null;
}

/** A short-lived URL the browser writes a file to directly. */
export interface SignedUploadTarget {
  storagePath: string;
  token: string;
  signedUrl: string;
}

/** Metadata for a file the browser already wrote to storage. */
export interface UploadedDocumentInput {
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  documentDate: string | null;
  category: Category;
  sourceType?: string | null;
  sourceAccount?: string | null;
  sourceFileId?: string | null;
}

/** What a human can correct on a document. */
export interface DocumentPatch {
  category: Category;
  documentDate: string | null;
  amount: number | null;
}

/** A classification to write back onto a stored document. */
export interface StoredClassification {
  category: Category;
  documentDate: string | null;
  amount: number | null;
  vendor: string | null;
  gstin: string | null;
  confidence: number;
  model: string;
}

export interface DocumentStore {
  /** Idempotent: ensures profile + business exist for the user. */
  provisionUser(
    user: SessionUser,
    options?: { businessName?: string },
  ): Promise<BusinessInfo>;

  getBusinessForUser(userId: string): Promise<BusinessInfo | null>;

  listDocuments(userId: string): Promise<DocumentRecord[]>;

  createDocuments(
    userId: string,
    inputs: NewDocumentInput[],
  ): Promise<CreateResult>;

  getDocument(userId: string, docId: string): Promise<DocumentRecord | null>;

  deleteDocument(userId: string, docId: string): Promise<boolean>;

  readDocument(userId: string, docId: string): Promise<StoredBytes | null>;

  /** Short-lived authorized preview URL, or null when unavailable. */
  getPreviewUrl(userId: string, record: DocumentRecord): Promise<string | null>;

  /**
   * Optional: a URL the browser can upload to directly, bypassing the
   * serverless request-body limit. Adapters that cannot offer one return null
   * (or do not implement the method) and callers fall back to multipart.
   */
  createSignedUpload?(
    userId: string,
    input: { filename: string; documentDate: string | null },
  ): Promise<SignedUploadTarget | null>;

  /** Optional: record a file the browser has already written to storage. */
  registerUploadedDocument?(
    userId: string,
    input: UploadedDocumentInput,
  ): Promise<DocumentRecord>;

  /** Documents the model was unsure about, or nobody has classified. */
  listForReview(userId: string): Promise<DocumentRecord[]>;

  /** Applies a human correction and marks the document as confirmed. */
  updateDocument(
    userId: string,
    docId: string,
    patch: DocumentPatch,
  ): Promise<DocumentRecord | null>;

  /** Documents nobody has read yet, oldest first. */
  listUnreadDocuments(userId: string, limit: number): Promise<DocumentRecord[]>;

  /** How many documents are still unread. */
  countUnreadDocuments(userId: string): Promise<number>;

  /** Writes a model classification onto an existing document. */
  applyClassification(
    userId: string,
    docId: string,
    input: StoredClassification,
  ): Promise<DocumentRecord | null>;
}
