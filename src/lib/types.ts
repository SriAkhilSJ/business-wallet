import type { Category } from "./config";

/** A stored business financial document (serializable, mode-agnostic). */
export interface DocumentRecord {
  id: string;
  businessId: string;
  uploadedBy: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  /** Calendar date `YYYY-MM-DD`, or null meaning "use the upload date". */
  documentDate: string | null;
  category: Category;
  /** ISO 8601 UTC timestamp. */
  createdAt: string;
  updatedAt: string;
  /** Read from the document by a model. Absent means nobody read it. */
  amount?: number | null;
  vendor?: string | null;
  gstin?: string | null;
  confidence?: number | null;
  classifiedBy?: string | null;
  /** SHA-256 of the file bytes, for duplicate detection. */
  contentHash?: string | null;
  /** Set when this upload is the same file as an earlier one. Not persisted. */
  duplicateOf?: string | null;
  /** Provenance: where the document came from. */
  sourceType?: string | null;
  sourceAccount?: string | null;
  sourceFileId?: string | null;
  importedAt?: string | null;
  processingStatus?: string | null;
  verificationStatus?: string | null;
  duplicateGroupId?: string | null;
  /** Soft delete marker (ISO timestamp). Null means live. */
  deletedAt?: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
}

export interface BusinessInfo {
  id: string;
  businessName: string;
}
