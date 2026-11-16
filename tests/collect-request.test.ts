import { describe, expect, it } from "vitest";

import { parseNote } from "@/lib/collect/request";

describe("parseNote", () => {
  it("reads the common monthly asks out of a normal sentence", () => {
    const wanted = parseNote(
      "Sharma ji, please send electricity bill, rent receipt and UPI proofs for August",
    );
    expect(wanted.map((w) => w.id)).toEqual(["electricity", "rent", "upi"]);
  });

  it("marks a bank statement as something the app cannot fetch", () => {
    const wanted = parseNote("Bank statement for August");
    expect(wanted).toHaveLength(1);
    expect(wanted[0].id).toBe("bank");
    expect(wanted[0].kind).toBe("download");
    expect(wanted[0].hint).toContain("bank");
  });

  it("returns nothing for an empty note", () => {
    expect(parseNote("")).toEqual([]);
    expect(parseNote("   ")).toEqual([]);
  });

  it("ignores punctuation and line breaks", () => {
    const wanted = parseNote("1. Electricity bill\n2. Rent receipt\n3. UPI proofs");
    expect(wanted.map((w) => w.id)).toEqual(["electricity", "rent", "upi"]);
  });

  it("keeps a narrow ask separate from the broad category", () => {
    const wanted = parseNote("laptop purchase invoice");
    const laptop = wanted.find((w) => w.id === "laptop");
    expect(laptop?.narrow).toEqual(["laptop"]);
  });

  it("understands the way people actually type a request", () => {
    expect(parseNote("i am looking for sales documents").map((w) => w.id)).toEqual([
      "sales",
    ]);
    expect(parseNote("need the bills").map((w) => w.id)).toContain("receipts");
  });

  it("says plainly when an ask cannot be collected by a web app", () => {
    const wanted = parseNote("any notifications or sms this week");
    expect(wanted.map((w) => w.id)).toEqual(["sms"]);
    expect(wanted[0].kind).toBe("download");
    expect(wanted[0].hint).toContain("cannot read");
  });

  it("does not invent asks that were not mentioned", () => {
    const wanted = parseNote("electricity bill");
    expect(wanted.map((w) => w.id)).toEqual(["electricity"]);
  });
});
