import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalDevDocumentStore } from "@/lib/store/local-store";
import type { SessionUser } from "@/lib/types";

const ALICE: SessionUser = {
  id: "user-alice",
  email: "alice@example.com",
  fullName: "Alice",
};
const BOB: SessionUser = {
  id: "user-bob",
  email: "bob@example.com",
  fullName: "Bob",
};

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

describe("LocalDevDocumentStore (dev fallback)", () => {
  let dataDir: string;
  let store: LocalDevDocumentStore;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "bv-store-"));
    store = new LocalDevDocumentStore(dataDir);
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("provisions users idempotently with a business", async () => {
    const first = await store.provisionUser(ALICE, { businessName: "Alice Ltd" });
    const second = await store.provisionUser(ALICE);
    expect(second.id).toBe(first.id);
    expect(second.businessName).toBe("Alice Ltd");

    const business = await store.getBusinessForUser(ALICE.id);
    expect(business?.businessName).toBe("Alice Ltd");
    expect(await store.getBusinessForUser("unknown")).toBeNull();
  });

  it("creates and lists documents with metadata", async () => {
    await store.provisionUser(ALICE);
    const { created, errors } = await store.createDocuments(ALICE.id, [
      {
        originalFilename: "invoice.pdf",
        bytes: PDF,
        mimeType: "application/pdf",
        fileSize: PDF.length,
        documentDate: "2026-11-05",
        category: "Sales Invoice",
      },
      {
        originalFilename: "receipt.pdf",
        bytes: PDF,
        mimeType: "application/pdf",
        fileSize: PDF.length,
        documentDate: null,
        category: "Receipt",
      },
    ]);
    expect(errors).toEqual([]);
    expect(created).toHaveLength(2);

    const docs = await store.listDocuments(ALICE.id);
    expect(docs).toHaveLength(2);
    const invoice = docs.find((d) => d.originalFilename === "invoice.pdf");
    expect(invoice?.documentDate).toBe("2026-11-05");
    expect(invoice?.category).toBe("Sales Invoice");
    expect(invoice?.mimeType).toBe("application/pdf");
    expect(invoice?.storagePath).toMatch(
      new RegExp(`^${invoice!.businessId}/2026/11/[0-9a-f-]+\\.pdf$`),
    );
    const receipt = docs.find((d) => d.originalFilename === "receipt.pdf");
    expect(receipt?.documentDate).toBeNull();
  });

  it("enforces per-user authorization on read, preview and delete", async () => {
    await store.provisionUser(ALICE);
    await store.provisionUser(BOB);
    const { created } = await store.createDocuments(ALICE.id, [
      {
        originalFilename: "secret.pdf",
        bytes: PDF,
        mimeType: "application/pdf",
        fileSize: PDF.length,
        documentDate: null,
        category: "Other",
      },
    ]);
    const docId = created[0].id;

    // Bob must not see, read, preview or delete Alice's document.
    expect(await store.listDocuments(BOB.id)).toEqual([]);
    expect(await store.getDocument(BOB.id, docId)).toBeNull();
    expect(await store.readDocument(BOB.id, docId)).toBeNull();
    expect(await store.getPreviewUrl(BOB.id, created[0])).toBeNull();
    expect(await store.deleteDocument(BOB.id, docId)).toBe(false);

    // Alice still owns it.
    expect(await store.getDocument(ALICE.id, docId)).not.toBeNull();
  });

  it("deletes both the record and the stored file", async () => {
    await store.provisionUser(ALICE);
    const { created } = await store.createDocuments(ALICE.id, [
      {
        originalFilename: "temp.pdf",
        bytes: PDF,
        mimeType: "application/pdf",
        fileSize: PDF.length,
        documentDate: null,
        category: "Other",
      },
    ]);
    const record = created[0];
    const filePath = join(dataDir, "files", record.storagePath);
    expect(existsSync(filePath)).toBe(true);

    expect(await store.deleteDocument(ALICE.id, record.id)).toBe(true);
    expect(await store.getDocument(ALICE.id, record.id)).toBeNull();
    expect(existsSync(filePath)).toBe(false);
    // Deleting again is a no-op.
    expect(await store.deleteDocument(ALICE.id, record.id)).toBe(false);
  });

  it("reports missing storage objects without failing", async () => {
    await store.provisionUser(ALICE);
    const { created } = await store.createDocuments(ALICE.id, [
      {
        originalFilename: "lost.pdf",
        bytes: PDF,
        mimeType: "application/pdf",
        fileSize: PDF.length,
        documentDate: null,
        category: "Other",
      },
    ]);
    const record = created[0];
    rmSync(join(dataDir, "files", record.storagePath));

    const stored = await store.readDocument(ALICE.id, record.id);
    expect(stored).not.toBeNull();
    expect(stored!.record.id).toBe(record.id);
    expect(stored!.bytes).toBeNull();
  });

  it("issues dev preview URLs for the owner", async () => {
    await store.provisionUser(ALICE);
    const { created } = await store.createDocuments(ALICE.id, [
      {
        originalFilename: "p.pdf",
        bytes: PDF,
        mimeType: "application/pdf",
        fileSize: PDF.length,
        documentDate: null,
        category: "Other",
      },
    ]);
    const url = await store.getPreviewUrl(ALICE.id, created[0]);
    expect(url).toBe(`/api/documents/${created[0].id}/download?inline=1`);
  });
});
