import { describe, expect, it } from "vitest";

import { looksLikeText, validateUploadFile } from "@/lib/file-validation";

const bytesOf = (text: string) => new TextEncoder().encode(text);

describe("plain text documents", () => {
  it("accepts an exported bank or UPI message", () => {
    const text =
      "Rs.2,499.00 debited from A/c XX4412 on 04-08-26 to V/CLOUDTOOLS IN. UPI Ref 413622889901.";
    const result = validateUploadFile({
      filename: "hdfc-alert.txt",
      size: bytesOf(text).length,
      bytes: bytesOf(text),
    });
    expect(result).toEqual({
      ok: true,
      mimeType: "text/plain",
      detected: "text",
    });
  });

  it("accepts a text file with Indian characters", () => {
    const text = "बिजली बिल ₹4,860.00 देय 18-08-2026";
    const bytes = bytesOf(text);
    expect(
      validateUploadFile({ filename: "bill.txt", size: bytes.length, bytes }),
    ).toMatchObject({ ok: true, mimeType: "text/plain" });
  });

  it("rejects binary content renamed to .txt", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = i % 7;
    const result = validateUploadFile({
      filename: "fake.txt",
      size: bytes.length,
      bytes,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a text file containing NUL bytes", () => {
    const bytes = new Uint8Array([65, 66, 0, 67, 68]);
    expect(looksLikeText(bytes)).toBe(false);
  });

  it("still rejects an unsupported extension", () => {
    const bytes = bytesOf("hello");
    expect(
      validateUploadFile({ filename: "notes.docx", size: bytes.length, bytes }).ok,
    ).toBe(false);
  });
});
