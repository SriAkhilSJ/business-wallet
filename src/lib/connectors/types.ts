/**
 * Common connector interface. Every source (manual upload, sample loader, and
 * future Gmail/Drive/device connectors) implements this so document processing
 * never depends on where a file came from.
 */
import type { Category } from "../config";
import type { DocumentStore } from "../store/types";
import type { IngestFile, IngestResult } from "../ingest";

export interface ConnectorContext {
  userId: string;
  store: DocumentStore;
}

export interface DiscoveredDocument {
  filename: string;
  bytes: Uint8Array;
  size?: number;
  sourceFileId: string;
  documentDate?: string | null;
  category?: Category;
}

export interface DocumentConnector {
  /** Stable identifier for this source (e.g. "upload", "gmail", "drive"). */
  readonly sourceType: string;
  /**
   * Discover candidate documents. Returns an empty array when the source has
   * nothing to offer (e.g. manual upload); the caller supplies the files.
   */
  discover(ctx: ConnectorContext, params?: unknown): Promise<DiscoveredDocument[]>;
  /** Import the given documents through the ingest seam. */
  import(ctx: ConnectorContext, docs: DiscoveredDocument[]): Promise<IngestResult>;
}

/** Convert discovered documents into the ingest input shape. */
export function toIngestFiles(docs: DiscoveredDocument[]): IngestFile[] {
  return docs.map((d) => ({
    filename: d.filename,
    bytes: d.bytes,
    size: d.size,
    documentDate: d.documentDate ?? null,
    category: d.category,
    sourceType: undefined, // filled by the connector's import
    sourceFileId: d.sourceFileId,
  }));
}