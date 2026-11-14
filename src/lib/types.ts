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
