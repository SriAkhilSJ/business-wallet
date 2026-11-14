import { describe, expect, it } from "vitest";

import {
  documentsForMonth,
  filterDocuments,
  sortDocuments,
  summarizeDocuments,
} from "@/lib/filters";
import type { DocumentRecord } from "@/lib/types";

function doc(overrides: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    businessId: "biz-1",
    uploadedBy: "user-1",
    originalFilename: "file.pdf",
    storagePath: "biz-1/2026/11/x.pdf",
    mimeType: "application/pdf",
    fileSize: 1000,
    documentDate: null,
    category: "Other",
    createdAt: "2026-11-10T10:00:00.000Z",
    updatedAt: "2026-11-10T10:00:00.000Z",
    ...overrides,
  };
}

const DOCS: DocumentRecord[] = [
  doc({
    id: "1",
    originalFilename: "electricity-oct.pdf",
    category: "Utility Bill",
    documentDate: "2026-10-28",
    createdAt: "2026-10-29T09:00:00.000Z",
  }),
  doc({
    id: "2",
    originalFilename: "client-invoice.pdf",
    category: "Sales Invoice",
    documentDate: "2026-11-03",
    createdAt: "2026-11-03T12:00:00.000Z",
  }),
  doc({
    id: "3",
    originalFilename: "fuel-receipt.pdf",
    category: "Receipt",
    documentDate: null,
    createdAt: "2026-11-12T18:00:00.000Z",
  }),
  doc({
    id: "4",
    originalFilename: "laptop.jpg",
    category: "Purchase Invoice",
    documentDate: "2025-11-20",
    createdAt: "2026-11-01T08:00:00.000Z",
  }),
];

describe("sortDocuments", () => {
  it("orders by effective date descending", () => {
    const sorted = sortDocuments(DOCS);
    expect(sorted.map((d) => d.id)).toEqual(["3", "2", "1", "4"]);
  });
});

describe("filterDocuments", () => {
  it("filters by month and year using the effective date", () => {
    const nov2026 = filterDocuments(DOCS, { month: 11, year: 2026 });
    expect(nov2026.map((d) => d.id).sort()).toEqual(["2", "3"]);

    const oct2026 = filterDocuments(DOCS, { month: 10, year: 2026 });
    expect(oct2026.map((d) => d.id)).toEqual(["1"]);

    const nov2025 = filterDocuments(DOCS, { month: 11, year: 2025 });
    expect(nov2025.map((d) => d.id)).toEqual(["4"]);
  });

  it("uses the upload date as fallback (doc 3 has no document date)", () => {
    // doc 3 created 2026-11-12 UTC but has no document date → November.
    const nov = filterDocuments(DOCS, { month: 11, year: 2026 });
    expect(nov.some((d) => d.id === "3")).toBe(true);
  });

  it("filters by category and search", () => {
    expect(
      filterDocuments(DOCS, { category: "Receipt" }).map((d) => d.id),
    ).toEqual(["3"]);
    // Search matches filenames only (laptop.jpg is a Purchase Invoice but the
    // word "invoice" is not in its filename).
    expect(
      filterDocuments(DOCS, { search: "INVOICE" }).map((d) => d.id),
    ).toEqual(["2"]);
    expect(filterDocuments(DOCS, { search: "nothing-here" })).toEqual([]);
  });

  it("combines filters", () => {
    const result = filterDocuments(DOCS, {
      month: 11,
      year: 2026,
      category: "Sales Invoice",
      search: "client",
    });
    expect(result.map((d) => d.id)).toEqual(["2"]);
  });
});

describe("documentsForMonth", () => {
  it("returns exactly the selected month regardless of category", () => {
    const result = documentsForMonth(DOCS, 11, 2026);
    expect(result.map((d) => d.id).sort()).toEqual(["2", "3"]);
  });

  it("returns empty for months without documents", () => {
    expect(documentsForMonth(DOCS, 7, 2026)).toEqual([]);
  });
});

describe("summarizeDocuments", () => {
  it("summarizes totals, current month and categories", () => {
    const summary = summarizeDocuments(DOCS, "2026-11-14");
    expect(summary.total).toBe(4);
    // Current month (Nov 2026): docs 2, 3 → doc 4's effective date is 2025-11.
    expect(summary.currentMonthCount).toBe(2);
    expect(summary.byCategory["Utility Bill"]).toBe(1);
    expect(summary.byCategory["Other"]).toBe(0);
    expect(summary.recent.map((d) => d.id)).toEqual(["3", "2", "1", "4"]);
    expect(summary.recent.length).toBe(5 > DOCS.length ? DOCS.length : 5);
  });

  it("counts nothing for an empty store", () => {
    const summary = summarizeDocuments([], "2026-11-14");
    expect(summary.total).toBe(0);
    expect(summary.currentMonthCount).toBe(0);
  });
});
