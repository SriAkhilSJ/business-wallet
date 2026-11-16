import { describe, expect, it } from "vitest";

import { LocalDevDocumentStore } from "@/lib/store/local-store";
import { type Category } from "@/lib/config";
import { ingest } from "@/lib/ingest";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

function store() {
  const dir = mkdtempSync(join(tmpdir(), "bv-ingest-"));
  return { store: new LocalDevDocumentStore(dir), dir };
}

function pdfBytes() {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
}

describe("ingest seam", () => {
  it("accepts a valid file and stores it", async () => {
    const { store: s, dir } = store();
    try {
      await s.provisionUser({ id: "u1", email: "u1@x.com", fullName: null }, {});
      const res = await ingest(s, "u1", [
        { filename: "a.pdf", bytes: pdfBytes(), category: "Receipt" as Category },
      ]);
      expect(res.created).toHaveLength(1);
      expect(res.errors).toHaveLength(0);
      const docs = await s.listDocuments("u1");
      expect(docs).toHaveLength(1);
      expect(docs[0].originalFilename).toBe("a.pdf");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects an invalid file and reports it", async () => {
    const { store: s, dir } = store();
    try {
      await s.provisionUser({ id: "u1", email: "u1@x.com", fullName: null }, {});
      const res = await ingest(s, "u1", [
        { filename: "bad.exe", bytes: new Uint8Array([1, 2, 3]) },
      ]);
      expect(res.created).toHaveLength(0);
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].filename).toBe("bad.exe");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty result for empty batch", async () => {
    const { store: s, dir } = store();
    try {
      const res = await ingest(s, "u1", []);
      expect(res.created).toHaveLength(0);
      expect(res.errors).toHaveLength(0);
      expect(res.notice).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});