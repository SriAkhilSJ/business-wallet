import { describe, expect, it } from "vitest";

import {
  buildStoragePath,
  extensionOf,
  sanitizeFilename,
  uniqueFilename,
} from "@/lib/filenames";

describe("extensionOf", () => {
  it("extracts lowercased extensions", () => {
    expect(extensionOf("invoice.PDF")).toBe("pdf");
    expect(extensionOf("a.b.jpeg")).toBe("jpeg");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf(".hidden")).toBe("");
  });
});

describe("sanitizeFilename", () => {
  it("strips directory components and traversal", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\x\\bill.pdf")).toBe("bill.pdf");
    expect(sanitizeFilename("..\\..\\boot.ini")).toBe("boot.ini");
  });

  it("removes control and reserved characters", () => {
    expect(sanitizeFilename("in\u0000voice\u001f.pdf")).toBe("invoice.pdf");
    expect(sanitizeFilename('a<b>c:d"e|f?g*h.pdf')).toBe("a_b_c_d_e_f_g_h.pdf");
  });

  it("handles hidden, reserved and empty names", () => {
    expect(sanitizeFilename("...secret.pdf")).toBe("secret.pdf");
    expect(sanitizeFilename("")).toBe("document");
    expect(sanitizeFilename("   ")).toBe("document");
    expect(sanitizeFilename("con.pdf")).toBe("_con.pdf");
    expect(sanitizeFilename("NUL")).toBe("_NUL");
  });

  it("keeps a sane length while preserving the extension", () => {
    const long = `${"a".repeat(300)}.pdf`;
    const clean = sanitizeFilename(long);
    expect(clean.endsWith(".pdf")).toBe(true);
    expect(clean.length).toBeLessThanOrEqual(124);
  });

  it("collapses whitespace", () => {
    expect(sanitizeFilename("my   messy    file.pdf")).toBe("my messy file.pdf");
  });
});

describe("uniqueFilename", () => {
  it("returns the sanitized name when free", () => {
    const used = new Set<string>();
    expect(uniqueFilename(used, "bill.pdf")).toBe("bill.pdf");
  });

  it("de-duplicates with numeric suffixes, case-insensitively", () => {
    const used = new Set<string>();
    expect(uniqueFilename(used, "bill.pdf")).toBe("bill.pdf");
    expect(uniqueFilename(used, "bill.pdf")).toBe("bill (2).pdf");
    // Matching is case-insensitive; the suffix keeps the incoming case.
    expect(uniqueFilename(used, "BILL.pdf")).toBe("BILL (3).pdf");
    expect(uniqueFilename(used, "bill")).toBe("bill");
    expect(uniqueFilename(used, "bill")).toBe("bill (2)");
  });
});

describe("buildStoragePath", () => {
  it("uses the server-generated business/year/month layout", () => {
    const path = buildStoragePath("biz-1", "2026-11-14", "pdf", "uuid-123");
    expect(path).toBe("biz-1/2026/11/uuid-123.pdf");
  });
});
