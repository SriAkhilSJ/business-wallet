import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import type { DocumentRecord } from "@/lib/types";
import { buildMonthlyArchive, type ArchiveItem } from "@/lib/zip";

function doc(overrides: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    businessId: "biz-1",
    uploadedBy: "user-1",
    originalFilename: "file.pdf",
    storagePath: "biz-1/2026/11/x.pdf",
    mimeType: "application/pdf",
    fileSize: 10,
    documentDate: "2026-11-05",
    category: "Other",
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: "2026-11-05T10:00:00.000Z",
    ...overrides,
  };
}

const META = {
  businessName: "Sharma Traders",
  periodLabel: "November 2026",
  generatedAt: "2026-11-14T10:00:00.000Z",
};

const bytes = (text: string) => new TextEncoder().encode(text);

describe("buildMonthlyArchive", () => {
  it("builds a zip with all documents and a manifest", async () => {
    const items: ArchiveItem[] = [
      {
        record: doc({ id: "a", originalFilename: "invoice.pdf", documentDate: "2026-11-03" }),
        bytes: bytes("pdf-a"),
      },
      {
        record: doc({ id: "b", originalFilename: "receipt.png", documentDate: null }),
        bytes: bytes("png-b"),
      },
    ];
    const result = await buildMonthlyArchive(items, META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const zip = await JSZip.loadAsync(result.zipBytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    expect(names).toContain("invoice.pdf");
    expect(names).toContain("receipt.png");
    expect(names).toContain("manifest.txt");

    const content = await zip.files["invoice.pdf"].async("string");
    expect(content).toBe("pdf-a");

    const manifest = await zip.files["manifest.txt"].async("string");
    expect(manifest).toContain("Sharma Traders — Monthly Document Pack");
    expect(manifest).toContain("Period: November 2026");
    expect(manifest).toContain("invoice.pdf");
    expect(manifest).toContain("upload date");
  });

  it("de-duplicates identical filenames with unique suffixes", async () => {
    const items: ArchiveItem[] = [
      { record: doc({ id: "a", originalFilename: "bill.pdf" }), bytes: bytes("1") },
      { record: doc({ id: "b", originalFilename: "bill.pdf" }), bytes: bytes("2") },
      { record: doc({ id: "c", originalFilename: "BILL.pdf" }), bytes: bytes("3") },
    ];
    const result = await buildMonthlyArchive(items, META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const zip = await JSZip.loadAsync(result.zipBytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    expect(names).toContain("bill.pdf");
    expect(names).toContain("bill (2).pdf");
    expect(names).toContain("BILL (3).pdf");
    expect(result.entryNames["a"]).toBe("bill.pdf");
    expect(result.entryNames["b"]).toBe("bill (2).pdf");
    expect(result.entryNames["c"]).toBe("BILL (3).pdf");
  });

  it("sanitizes unsafe entry names", async () => {
    const items: ArchiveItem[] = [
      {
        record: doc({ id: "a", originalFilename: "../../etc/passwd.pdf" }),
        bytes: bytes("x"),
      },
    ];
    const result = await buildMonthlyArchive(items, META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const zip = await JSZip.loadAsync(result.zipBytes);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    expect(names).toContain("passwd.pdf");
    expect(names.every((n) => !n.includes(".."))).toBe(true);
  });

  it("aborts instead of building an incomplete archive when files are missing", async () => {
    const items: ArchiveItem[] = [
      { record: doc({ id: "a", originalFilename: "here.pdf" }), bytes: bytes("1") },
      { record: doc({ id: "b", originalFilename: "gone.pdf" }), bytes: null },
      { record: doc({ id: "c", originalFilename: "also-gone.pdf" }), bytes: null },
    ];
    const result = await buildMonthlyArchive(items, META);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing.map((d) => d.originalFilename)).toEqual([
      "gone.pdf",
      "also-gone.pdf",
    ]);
  });

  it("orders documents by date inside the archive", async () => {
    const items: ArchiveItem[] = [
      {
        record: doc({ id: "late", originalFilename: "late.pdf", documentDate: "2026-11-20" }),
        bytes: bytes("late"),
      },
      {
        record: doc({ id: "early", originalFilename: "early.pdf", documentDate: "2026-11-01" }),
        bytes: bytes("early"),
      },
    ];
    const result = await buildMonthlyArchive(items, META);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const manifest = await (await JSZip.loadAsync(result.zipBytes)).files[
      "manifest.txt"
    ].async("string");
    expect(manifest.indexOf("early.pdf")).toBeLessThan(manifest.indexOf("late.pdf"));
  });
});
