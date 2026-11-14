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
}
