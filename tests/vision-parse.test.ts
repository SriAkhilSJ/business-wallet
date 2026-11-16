import { describe, expect, it } from "vitest";

import { parseClassification } from "@/lib/classify/vision";

describe("parseClassification", () => {
  it("reads a clean JSON answer", () => {
    const result = parseClassification(
      JSON.stringify({
        docType: "Purchase Invoice",
        vendor: "Cloudtools Pvt Ltd",
        date: "2026-08-03",
        amount: 2499,
        gstin: "29AABCU9603R1ZM",
        confidence: 0.99,
      }),
    );
    expect(result).toMatchObject({
      docType: "Purchase Invoice",
      amount: 2499,
      date: "2026-08-03",
      vendor: "Cloudtools Pvt Ltd",
      gstin: "29AABCU9603R1ZM",
      confidence: 0.99,
    });
  });

  it("survives the model wrapping JSON in a code fence", () => {
    const result = parseClassification(
      '```json\n{"docType":"Receipt","amount":1200,"date":"2026-08-07","confidence":0.9}\n```',
    );
    expect(result?.docType).toBe("Receipt");
    expect(result?.amount).toBe(1200);
  });

  it("turns a rupee string into a number", () => {
    const result = parseClassification(
      '{"docType":"Expense","amount":"Rs 35,000.00","confidence":0.9}',
    );
    expect(result?.amount).toBe(35000);
  });

  it("accepts the model's own wording for a category", () => {
    const bills = parseClassification(
      '{"docType":"electricity bill","amount":5687.6,"date":"2026-10-18","confidence":0.99}',
    );
    expect(bills?.docType).toBe("Utility Bill");

    expect(parseClassification('{"docType":"Rent Receipt","confidence":0.9}')?.docType).toBe(
      "Expense",
    );
    expect(parseClassification('{"docType":"supplier invoice","confidence":0.9}')?.docType).toBe(
      "Purchase Invoice",
    );
    expect(parseClassification('{"docType":"UPI","confidence":0.9}')?.docType).toBe(
      "Payment Proof",
    );
  });

  it("refuses a category that is not one of ours", () => {
    expect(parseClassification('{"docType":"Boarding Pass","confidence":0.9}')).toBeNull();
    expect(parseClassification('{"docType":"Wedding Invitation","confidence":0.9}')).toBeNull();
  });

  it("refuses nonsense instead of guessing", () => {
    expect(parseClassification("I think this is a bill")).toBeNull();
    expect(parseClassification('{"docType":"Receipt"')).toBeNull();
  });

  it("keeps a usable answer but drops a bad date and a bad GSTIN", () => {
    const result = parseClassification(
      '{"docType":"Receipt","date":"31-08-2026","gstin":"NOT-A-GSTIN","confidence":0.8,"amount":100}',
    );
    expect(result?.date).toBeNull();
    expect(result?.gstin).toBeNull();
    expect(result?.docType).toBe("Receipt");
  });

  it("clamps confidence into 0..1", () => {
    expect(parseClassification('{"docType":"Receipt","confidence":1.7}')?.confidence).toBe(1);
    expect(parseClassification('{"docType":"Receipt","confidence":-3}')?.confidence).toBe(0);
  });

  it("treats a missing amount as unknown rather than zero", () => {
    expect(parseClassification('{"docType":"Receipt","confidence":0.5}')?.amount).toBeNull();
  });
});
