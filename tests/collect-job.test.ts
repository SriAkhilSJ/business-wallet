import { describe, expect, it } from "vitest";

import type { Category } from "@/lib/config";
import {
  buildCollectionJob,
  type CollectInput,
  type JobSourceDoc,
} from "@/lib/collect/job";

const input = (overrides: Partial<CollectInput> = {}): CollectInput => ({
  from: "2026-08-01",
  to: "2026-08-31",
  minAmount: null,
  maxAmount: null,
  note: "",
  ...overrides,
});

const doc = (overrides: Partial<JobSourceDoc> & { category: Category }): JobSourceDoc => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  originalFilename: overrides.originalFilename ?? "file.pdf",
  documentDate:
    "documentDate" in overrides ? (overrides.documentDate as string | null) : "2026-08-10",
  createdAt: overrides.createdAt ?? "2026-08-10T10:00:00.000Z",
  category: overrides.category,
  amount: overrides.amount ?? null,
  contentHash: overrides.contentHash ?? null,
  fileSize: overrides.fileSize,
});

const AUGUST = [
  doc({ id: "rent", originalFilename: "office-rent-aug-2026.pdf", category: "Expense" }),
  doc({
    id: "elec-july",
    originalFilename: "electricity-bill-july-2026.pdf",
    category: "Utility Bill",
    documentDate: "2026-07-10",
  }),
  doc({ id: "scan", originalFilename: "IMG_20260812.jpg", category: "Other" }),
  doc({
    id: "invoice",
    originalFilename: "cloudtools-invoice.pdf",
    category: "Purchase Invoice",
  }),
];

describe("buildCollectionJob", () => {
  it("collects the period and reports what it found when no note is given", () => {
    const job = buildCollectionJob(input(), AUGUST);

    expect(job.counts.discovered).toBe(4);
    expect(job.counts.inPeriod).toBe(3); // July electricity is outside
    expect(job.counts.included).toBe(2); // rent + purchase invoice
    expect(job.counts.needsReview).toBe(1); // the unlabelled scan
    expect(job.checklist.map((row) => row.label)).toEqual([
      "Expense",
      "Purchase Invoice",
    ]);
  });

  it("sends an unlabelled document to review instead of into the pack", () => {
    const job = buildCollectionJob(input(), AUGUST);
    const scan = job.items.find((item) => item.id === "scan");
    expect(scan?.decision).toBe("review");
    expect(scan?.confirmed).toBe(false);
  });

  it("says a found-but-unconfirmed item needs confirmation, not that it is missing", () => {
    const job = buildCollectionJob(input({ note: "rent receipt" }), [
      doc({ id: "rent-scan", originalFilename: "rent-receipt-scan.jpg", category: "Other" }),
    ]);
    expect(job.checklist[0].status).toBe("review");
    expect(job.checklist[0].count).toBe(1);
    expect(job.checklist[0].hint).toContain("confirmation");
  });

  it("keeps only the items named in the note and says what else it saw", () => {
    const job = buildCollectionJob(input({ note: "electricity bill" }), AUGUST);

    // The only electricity bill is July, so nothing is included and the
    // checklist must say so rather than pretend the pack is complete.
    expect(job.counts.included).toBe(0);
    expect(job.checklist).toHaveLength(1);
    expect(job.checklist[0].status).toBe("missing");
    expect(job.alsoFound.map((item) => item.filename)).toContain(
      "office-rent-aug-2026.pdf",
    );
  });

  it("answers a request that mixes documents with things the app cannot fetch", () => {
    const job = buildCollectionJob(
      input({ note: "rent receipt and bank statement" }),
      AUGUST,
    );

    expect(job.counts.included).toBe(1);
    const rent = job.checklist.find((row) => row.id === "rent");
    const bank = job.checklist.find((row) => row.id === "bank");
    expect(rent?.status).toBe("found");
    expect(rent?.count).toBe(1);
    expect(bank?.status).toBe("download");
    expect(bank?.hint).toContain("bank");
  });

  it("keeps a narrow ask from sweeping in its neighbours", () => {
    const job = buildCollectionJob(input({ note: "electricity bill" }), [
      doc({
        id: "elec",
        originalFilename: "electricity-bill-oct-2026.pdf",
        category: "Utility Bill",
      }),
      doc({
        id: "net",
        originalFilename: "internet-bill-nov-2026.pdf",
        category: "Utility Bill",
        documentDate: "2026-08-20",
      }),
    ]);

    expect(job.counts.included).toBe(1);
    expect(job.items.find((i) => i.id === "elec")?.decision).toBe("include");
    expect(job.items.find((i) => i.id === "net")?.decision).toBe("excluded");
    expect(job.checklist[0].count).toBe(1);
  });

  it("uses a known amount to filter, and keeps documents whose amount is unknown", () => {
    const job = buildCollectionJob(
      input({ minAmount: 10000, maxAmount: 50000 }),
      [
        doc({
          id: "small",
          originalFilename: "small.pdf",
          category: "Receipt",
          amount: 500,
        }),
        doc({
          id: "rent",
          originalFilename: "rent.pdf",
          category: "Expense",
          amount: 35000,
        }),
        doc({
          id: "unknown",
          originalFilename: "unread.pdf",
          category: "Receipt",
        }),
      ],
    );

    expect(job.items.find((i) => i.id === "small")?.decision).toBe("excluded");
    expect(job.items.find((i) => i.id === "rent")?.decision).toBe("include");
    expect(job.items.find((i) => i.id === "unknown")?.decision).toBe("include");
    expect(job.counts.amountUnread).toBe(1);
  });

  it("marks a second copy of the same file as a duplicate", () => {
    const job = buildCollectionJob(input(), [
      doc({
        id: "first",
        originalFilename: "electricity.txt",
        category: "Utility Bill",
        contentHash: "abc123",
      }),
      doc({
        id: "second",
        originalFilename: "electricity (1).txt",
        category: "Utility Bill",
        contentHash: "abc123",
      }),
    ]);

    expect(job.items.find((i) => i.id === "first")?.decision).toBe("include");
    const second = job.items.find((i) => i.id === "second");
    expect(second?.decision).toBe("duplicate");
    expect(second?.reasons[0]).toContain("electricity.txt");
    expect(job.counts.included).toBe(1);
  });

  it("falls back to name and size when an older row has no hash", () => {
    const job = buildCollectionJob(input(), [
      doc({ id: "a", originalFilename: "alert.txt", category: "Payment Proof", fileSize: 180 }),
      doc({ id: "b", originalFilename: "alert.txt", category: "Payment Proof", fileSize: 180 }),
    ]);
    expect(job.items.find((i) => i.id === "b")?.decision).toBe("duplicate");
  });

  it("uses the plan's selection instead of category matching", () => {
    const job = buildCollectionJob(input({ note: "rent" }), AUGUST, {
      wanted: [
        { id: "rent-ask", label: "Rent", kind: "document", categories: [], keywords: [] },
      ],
      selection: { "rent-ask": ["rent"] },
    });

    expect(job.counts.included).toBe(1);
    expect(job.items.find((i) => i.id === "invoice")?.decision).toBe("excluded");
    expect(job.checklist[0]).toMatchObject({ status: "found", count: 1 });
  });

  it("never drops a document because its amount is unreadable", () => {
    const job = buildCollectionJob(
      input({ minAmount: 5000, maxAmount: 10000 }),
      AUGUST,
    );
    // No amounts are read yet, so everything in range must survive the filter.
    expect(job.counts.included).toBe(2);
    expect(job.counts.amountUnread).toBe(3);
  });

  it("keeps an undated document and says the date is unknown", () => {
    const job = buildCollectionJob(input(), [
      doc({
        id: "undated",
        originalFilename: "bill.pdf",
        category: "Receipt",
        documentDate: null,
        createdAt: "2026-08-29T18:30:00.000Z",
      }),
    ]);
    expect(job.counts.inPeriod).toBe(1);
    expect(job.items[0].date).toBe("");
  });

  it("labels the period for the pack", () => {
    expect(buildCollectionJob(input(), AUGUST).periodLabel).toBe(
      "1 Aug 2026 – 31 Aug 2026",
    );
  });
});
