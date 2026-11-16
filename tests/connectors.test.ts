import { describe, expect, it } from "vitest";

import { LocalDevDocumentStore } from "@/lib/store/local-store";
import { manualConnector } from "@/lib/connectors/manual";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

function pdfBytes() {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
}

describe("manual connector", () => {
  it("imports discovered documents with upload provenance", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bv-conn-"));
    try {
      const store = new LocalDevDocumentStore(dir);
      await store.provisionUser({ id: "u1", email: "u1@x.com", fullName: null }, {});
      const res = await manualConnector.import(
        { userId: "u1", store },
        [{ filename: "x.pdf", bytes: pdfBytes(), sourceFileId: "local-1" }],
      );
      expect(res.created).toHaveLength(1);
      const docs = await store.listDocuments("u1");
      expect(docs[0].sourceType).toBe("upload");
      expect(docs[0].sourceFileId).toBe("local-1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discover returns supplied files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bv-conn-"));
    try {
      const store = new LocalDevDocumentStore(dir);
      const docs = await manualConnector.discover(
        { userId: "u1", store },
        { files: [{ filename: "y.pdf", bytes: pdfBytes(), sourceFileId: "f2" }] },
      );
      expect(docs).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});