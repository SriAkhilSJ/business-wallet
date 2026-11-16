import { describe, expect, it } from "vitest";

import { parseIntentsJson, parsePlanJson } from "@/lib/collect/intent";

describe("parsePlanJson", () => {
  const ids = ["doc-1", "doc-2", "doc-3"];

  it("keeps only documents it was actually given", () => {
    const plan = parsePlanJson(
      JSON.stringify({
        period: { from: "2026-11-01", to: "2026-11-30", label: "this month" },
        asks: [
          { label: "Rent", kind: "document", documentIds: ["doc-1", "made-up"] },
        ],
      }),
      ids,
    );
    expect(plan?.asks[0].documentIds).toEqual(["doc-1"]);
  });

  it("leaves an ask empty when nothing matched, instead of padding it", () => {
    const plan = parsePlanJson(
      JSON.stringify({ period: null, asks: [{ label: "Bank statement", kind: "download", documentIds: [] }] }),
      ids,
    );
    expect(plan?.asks[0].documentIds).toEqual([]);
    expect(plan?.asks[0].kind).toBe("download");
  });

  it("refuses a plan with no asks and no period", () => {
    expect(parsePlanJson('{"asks":[]}', ids)).toBeNull();
    expect(parsePlanJson("not json", ids)).toBeNull();
  });
});

describe("parseIntentsJson", () => {
  it("reads a period and a list of asks", () => {
    const parsed = parseIntentsJson(
      JSON.stringify({
        period: { from: "2026-11-01", to: "2026-11-30", label: "this month" },
        items: [
          {
            label: "Electricity bill",
            category: "Utility Bill",
            match: ["electricity"],
            kind: "document",
          },
        ],
      }),
      "2026-11-15",
    );

    expect(parsed?.period?.from).toBe("2026-11-01");
    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0]).toMatchObject({
      label: "Electricity bill",
      kind: "document",
      categories: ["Utility Bill"],
      narrow: ["electricity"],
    });
  });

  it("keeps an ask the app cannot fulfil, with the reason", () => {
    const parsed = parseIntentsJson(
      JSON.stringify({
        period: null,
        items: [
          {
            label: "WhatsApp messages",
            category: null,
            match: [],
            kind: "cannot",
            hint: "Screenshot or export them.",
          },
        ],
      }),
      "2026-11-15",
    );

    expect(parsed?.items[0].kind).toBe("cannot");
    expect(parsed?.items[0].hint).toBe("Screenshot or export them.");
  });

  it("drops a category outside our vocabulary but keeps the ask", () => {
    const parsed = parseIntentsJson(
      JSON.stringify({
        period: null,
        items: [{ label: "Bank statement", category: "Bank", kind: "download" }],
      }),
      "2026-11-15",
    );
    expect(parsed?.items[0].categories).toEqual([]);
    expect(parsed?.items[0].kind).toBe("download");
  });

  it("refuses a backwards period", () => {
    const parsed = parseIntentsJson(
      JSON.stringify({
        period: { from: "2026-11-30", to: "2026-11-01", label: "bad" },
        items: [],
      }),
      "2026-11-15",
    );
    expect(parsed?.period).toBeNull();
  });

  it("returns null on nonsense", () => {
    expect(parseIntentsJson("I think this is a bill", "2026-11-15")).toBeNull();
    expect(parseIntentsJson('{"items":', "2026-11-15")).toBeNull();
  });
});
