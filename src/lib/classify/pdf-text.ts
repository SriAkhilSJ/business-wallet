/**
 * Text extraction for PDFs.
 *
 * Why this exists: the vision model rejects a PDF sent as an image (upstream
 * 503), so every PDF used to fall through with no classification at all — the
 * document kept its upload date and whatever category the person picked.
 *
 * Text-based PDFs (most vendor bills) carry their own text layer, which is
 * cheaper and more accurate to read than a picture of the page.
 */

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_CHARS = 6000;

/**
 * Extracts the text layer of the first pages, with the failure reason kept for
 * diagnostics. Returns "" when the PDF has no text layer (a scan), so the
 * caller can decide to send it for review instead of guessing.
 */
export async function extractPdfTextWithError(
  bytes: Uint8Array,
): Promise<{ text: string; error: string | null }> {
  try {
    const loadingTask = pdfjs.getDocument({
      data: bytes,
      useSystemFonts: true,
      // No worker in a serverless function.
      disableFontFace: true,
    });
    const doc = await loadingTask.promise;

    const pages = Math.min(doc.numPages, 3);
    const parts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) parts.push(text);
      if (parts.join(" ").length > MAX_CHARS) break;
    }

    await loadingTask.destroy();
    return { text: parts.join("\n").slice(0, MAX_CHARS), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[classify] pdf text extraction failed:", message);
    return { text: "", error: message };
  }
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  return (await extractPdfTextWithError(bytes)).text;
}
