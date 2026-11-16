import type { DocumentStore } from "../store/types";
import { ingest } from "../ingest";
import type { DiscoveredDocument, DocumentConnector } from "./types";
import { toIngestFiles } from "./types";

export const manualConnector: DocumentConnector = {
  sourceType: "upload",

  async discover(_ctx, params) {
    // Manual upload has no discovery step; files are supplied by the caller.
    const files = (params as { files?: DiscoveredDocument[] } | undefined)?.files;
    return files ?? [];
  },

  async import(ctx, docs) {
    const inputs = toIngestFiles(docs).map((f) => ({
      ...f,
      sourceType: "upload",
    }));
    return ingest(ctx.store, ctx.userId, inputs);
  },
};

export async function importManual(
  store: DocumentStore,
  userId: string,
  docs: DiscoveredDocument[],
): Promise<ReturnType<typeof ingest>> {
  return manualConnector.import({ userId, store }, docs);
}