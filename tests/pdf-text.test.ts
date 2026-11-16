import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { extractPdfText } from "@/lib/classify/pdf-text";

const sample = async (name: string) =>
  new Uint8Array(await readFile(join(process.cwd(), "sample-data", name)));

describe("extractPdfText", () => {
  it("reads the text layer of a generated bill", async () => {
    const text = await extractPdfText(await sample("sample-02-electricity-bill.pdf"));
    expect(text.length).toBeGreaterThan(50);
    expect(text.toUpperCase()).toContain("ELECTRICITY");
  });

  it("finds the amount and the date printed on the page", async () => {
    const text = await extractPdfText(await sample("sample-01-office-rent-invoice.pdf"));
    expect(text).toMatch(/RENT/i);
    expect(text).toMatch(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}/);
  });

  it("returns empty text for a file that is not a real PDF", async () => {
    const garbage = new Uint8Array(2048).fill(7);
    expect(await extractPdfText(garbage)).toBe("");
  });
});
