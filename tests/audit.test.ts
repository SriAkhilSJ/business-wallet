import { describe, expect, it, beforeEach } from "vitest";
import { recordAudit, listAudit, resetAudit } from "@/lib/audit";

describe("audit", () => {
  beforeEach(() => resetAudit());

  it("records and lists by business", () => {
    recordAudit({ businessId: "b1", userId: "u1", action: "upload", targetType: "document", targetId: "d1", metadata: { n: 1 } });
    recordAudit({ businessId: "b2", userId: "u2", action: "delete", targetType: "document", targetId: "d2", metadata: null });
    expect(listAudit("b1")).toHaveLength(1);
    expect(listAudit("b1")[0].action).toBe("upload");
    expect(listAudit("b2")).toHaveLength(1);
  });
});