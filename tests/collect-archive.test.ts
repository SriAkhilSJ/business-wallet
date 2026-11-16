import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { buildArchive, archiveFilename } from "@/lib/collect/archive";
import { buildCollectionJob, type CollectInput, type JobSourceDoc } from "@/lib/collect/job";

const input: CollectInput = {
  from: "2026-08-01",
  to: "2026-08-31",
  minAmount: null,
  maxAmount: null,
  note: "rent receipt and bank statement",
};

const docs: JobSourceDoc[] = [
  {
    id: "rent",
    originalFilename: "office-rent-aug-2026.pdf",
    category: "Expense",
    documentDate: "2026-08-01",
    createdAt: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "scan",
    originalFilename: "IMG_0001.jpg",
    category: "Other",
    documentDate: "2026-08-02",
    createdAt: "2026-08-02T10:00:00.000Z",
  },
];

const bytes = new TextEncoder().encode("%PDF-1.4 fake");

async function pack(note = input.note) {
  const job = buildCollectionJob({ ...input, note }, docs);
  const result = await buildArchive({
    job,
    businessName: "Sharma Traders",
    bytesById: { rent: bytes, scan: bytes },
    generatedAt: new Date("2026-09-02T10:00:00.000Z"),
  });
  const zip = await JSZip.loadAsync(result.bytes);
  return { job, result, zip };
}

describe("buildArchive", () => {
  it("puts accepted documents in a folder named after the category", async () => {
    const { zip } = await pack();
    const names = Object.keys(zip.files);
    expect(names).toContain("Expense/office-rent-aug-2026.pdf");
  });

  it("keeps review items out of the pack but describes them", async () => {
    const { zip } = await pack(""); // no note: the unlabelled scan cannot be matched
    const names = Object.keys(zip.files);
    expect(names).not.toContain("Other/IMG_0001.jpg");
    const manifest = await zip.file("_manifest.txt")!.async("string");
    expect(manifest).toContain("NEEDS CONFIRMATION");
    expect(manifest).toContain("IMG_0001.jpg");
  });

  it("carries the coverage sheet, including what cannot be fetched", async () => {
    const { zip } = await pack();
    const coverage = await zip.file("_coverage.txt")!.async("string");
    expect(coverage).toContain("FOUND | Rent receipt");
    expect(coverage).toContain("DOWNLOAD | Bank statement");
  });

  it("records the inputs that produced the pack", async () => {
    const { zip } = await pack();
    const request = await zip.file("_request.txt")!.async("string");
    expect(request).toContain("From: 2026-08-01");
    expect(request).toContain("To: 2026-08-31");
    expect(request).toContain("rent receipt and bank statement");
  });

  it("refuses to build a pack when a selected file cannot be read", async () => {
    const job = buildCollectionJob(input, docs);
    await expect(
      buildArchive({
        job,
        businessName: "Sharma Traders",
        bytesById: {},
        generatedAt: new Date("2026-09-02T10:00:00.000Z"),
      }),
    ).rejects.toThrow(/could not be read/);
  });

  it("removes files with identical content and says so", async () => {
    const duplicateDocs: JobSourceDoc[] = [
      docs[0],
      { ...docs[0], id: "rent-copy", originalFilename: "office-rent-copy.pdf" },
    ];
    const job = buildCollectionJob({ ...input, note: "" }, duplicateDocs);
    const result = await buildArchive({
      job,
      businessName: "Sharma Traders",
      bytesById: { rent: bytes, "rent-copy": bytes },
      generatedAt: new Date("2026-09-02T10:00:00.000Z"),
    });

    expect(result.duplicates).toHaveLength(1);
    const zip = await JSZip.loadAsync(result.bytes);
    const files = Object.keys(zip.files).filter(
      (n) => n.startsWith("Expense/") && !zip.files[n].dir,
    );
    expect(files).toHaveLength(1);
    const manifest = await zip.file("_manifest.txt")!.async("string");
    expect(manifest).toContain("DUPLICATES REMOVED");
  });

  it("names a full calendar month after the month", () => {
    const job = buildCollectionJob(input, docs);
    expect(archiveFilename(job)).toBe("BusinessVault_August_2026.zip");
  });

  it("names a partial period by its range", () => {
    const job = buildCollectionJob({ ...input, to: "2026-08-15" }, docs);
    expect(archiveFilename(job)).toBe("BusinessVault_2026-08-01_to_2026-08-15.zip");
  });
});
