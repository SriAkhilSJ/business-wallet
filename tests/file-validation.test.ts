import { describe, expect, it } from "vitest";

import {
  MAX_FILE_SIZE_BYTES,
  MAX_SEARCH_LENGTH,
} from "@/lib/config";
import {
  detectFileType,
  documentMetadataSchema,
  exportRequestSchema,
  listQuerySchema,
  signUpSchema,
  validateUploadFile,
} from "@/lib/file-validation";

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const GARBAGE = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);

describe("detectFileType (magic bytes)", () => {
  it("identifies pdf, jpeg and png content", () => {
    expect(detectFileType(PDF_BYTES)).toBe("pdf");
    expect(detectFileType(JPEG_BYTES)).toBe("jpeg");
    expect(detectFileType(PNG_BYTES)).toBe("png");
  });

  it("rejects unknown content", () => {
    expect(detectFileType(GARBAGE)).toBeNull();
    expect(detectFileType(new Uint8Array(0))).toBeNull();
  });
});

describe("validateUploadFile", () => {
  it("accepts valid pdf, jpeg and png files", () => {
    expect(
      validateUploadFile({ filename: "invoice.pdf", size: PDF_BYTES.length, bytes: PDF_BYTES }),
    ).toEqual({ ok: true, mimeType: "application/pdf", detected: "pdf" });
    expect(
      validateUploadFile({ filename: "scan.jpg", size: JPEG_BYTES.length, bytes: JPEG_BYTES }),
    ).toEqual({ ok: true, mimeType: "image/jpeg", detected: "jpeg" });
    expect(
      validateUploadFile({ filename: "receipt.png", size: PNG_BYTES.length, bytes: PNG_BYTES }),
    ).toEqual({ ok: true, mimeType: "image/png", detected: "png" });
  });

  it("rejects disallowed extensions", () => {
    const res = validateUploadFile({
      filename: "malware.exe",
      size: PDF_BYTES.length,
      bytes: PDF_BYTES,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects empty files", () => {
    const res = validateUploadFile({
      filename: "empty.pdf",
      size: 0,
      bytes: new Uint8Array(0),
    });
    expect(res.ok).toBe(false);
  });

  it("rejects oversized files", () => {
    const res = validateUploadFile({
      filename: "big.pdf",
      size: MAX_FILE_SIZE_BYTES + 1,
      bytes: PDF_BYTES,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects content that does not match the extension (spoofing)", () => {
    const res = validateUploadFile({
      filename: "actually-a-pdf.png",
      size: PDF_BYTES.length,
      bytes: PDF_BYTES,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects unknown binary content", () => {
    const res = validateUploadFile({
      filename: "notes.pdf",
      size: GARBAGE.length,
      bytes: GARBAGE,
    });
    expect(res.ok).toBe(false);
  });

  it("rejects missing or overlong filenames", () => {
    expect(
      validateUploadFile({ filename: "   ", size: PDF_BYTES.length, bytes: PDF_BYTES }).ok,
    ).toBe(false);
    expect(
      validateUploadFile({
        filename: `${"a".repeat(300)}.pdf`,
        size: PDF_BYTES.length,
        bytes: PDF_BYTES,
      }).ok,
    ).toBe(false);
  });
});

describe("documentMetadataSchema", () => {
  it("accepts valid metadata and normalizes empty dates to null", () => {
    const parsed = documentMetadataSchema.parse({
      category: "Receipt",
      documentDate: "",
    });
    expect(parsed).toEqual({ category: "Receipt", documentDate: null });

    const withDate = documentMetadataSchema.parse({
      category: "Utility Bill",
      documentDate: "2026-11-05",
    });
    expect(withDate.documentDate).toBe("2026-11-05");
  });

  it("rejects invalid categories and dates", () => {
    expect(
      documentMetadataSchema.safeParse({
        category: "Not A Category",
        documentDate: "",
      }).success,
    ).toBe(false);
    expect(
      documentMetadataSchema.safeParse({
        category: "Expense",
        documentDate: "2026-13-01",
      }).success,
    ).toBe(false);
    expect(
      documentMetadataSchema.safeParse({
        category: "Expense",
        documentDate: "05-11-2026",
      }).success,
    ).toBe(false);
  });
});

describe("request schemas", () => {
  it("validates export requests", () => {
    expect(exportRequestSchema.safeParse({ month: 11, year: 2026 }).success).toBe(true);
    expect(exportRequestSchema.safeParse({ month: 0, year: 2026 }).success).toBe(false);
    expect(exportRequestSchema.safeParse({ month: 11, year: 1999 }).success).toBe(false);
  });

  it("validates list query filters", () => {
    const parsed = listQuerySchema.parse({
      month: 11,
      year: 2026,
      category: "Expense",
      search: "invoice",
    });
    expect(parsed.month).toBe(11);
    expect(
      listQuerySchema.safeParse({ month: 13 }).success,
    ).toBe(false);
    expect(
      listQuerySchema.safeParse({ search: "x".repeat(MAX_SEARCH_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it("validates sign-up payloads", () => {
    expect(
      signUpSchema.safeParse({
        email: "owner@business.com",
        password: "longenough",
        fullName: "Priya",
        businessName: "Sharma Traders",
      }).success,
    ).toBe(true);
    expect(
      signUpSchema.safeParse({
        email: "not-an-email",
        password: "longenough",
        fullName: "Priya",
        businessName: "Traders",
      }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        email: "a@b.com",
        password: "short",
        fullName: "Priya",
        businessName: "Traders",
      }).success,
    ).toBe(false);
  });
});
