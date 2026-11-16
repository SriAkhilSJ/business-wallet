import { describe, expect, it } from "vitest";
import { detectDuplicates, exactHash, financialIdentity, textSimilarity } from "@/lib/duplicates";

describe("duplicate detection", () => {
  it("exact hash returns 1 for identical hash", () => {
    expect(exactHash({ id: "a", contentHash: "h" }, { id: "b", contentHash: "h" })).toBe(1);
    expect(exactHash({ id: "a", contentHash: "h" }, { id: "b", contentHash: "x" })).toBe(0);
  });

  it("financial identity matches identical invoice", () => {
    const a = { id: "a", invoiceNumber: "INV-1", vendor: "Acme", date: "2026-08-01", amount: 100 };
    const b = { id: "b", invoiceNumber: "INV-1", vendor: "Acme", date: "2026-08-01", amount: 100 };
    expect(financialIdentity(a, b)).toBe(1);
  });

  it("text similarity is high for identical text", () => {
    const a = { id: "a", text: "electricity bill bescom aug 2026" };
    const b = { id: "b", text: "electricity bill bescom aug 2026" };
    expect(textSimilarity(a, b)).toBe(1);
  });

  it("detectDuplicates returns exact duplicates", () => {
    const docs = [
      { id: "a", contentHash: "h1", text: "rent aug" },
      { id: "b", contentHash: "h1", text: "rent aug" },
      { id: "c", contentHash: "h2", text: "fuel" },
    ];
    const res = detectDuplicates(docs);
    expect(res).toHaveLength(1);
    expect(res[0].score).toBe(1);
  });

  it("returns empty when nothing similar", () => {
    const docs = [
      { id: "a", contentHash: "h1", text: "rent" },
      { id: "b", contentHash: "h2", text: "fuel" },
    ];
    expect(detectDuplicates(docs, 0.9)).toHaveLength(0);
  });
});