import { readFile } from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const data = new Uint8Array(await readFile("sample-data/sample-02-electricity-bill.pdf"));
try {
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  console.log("pages", doc.numPages);
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  console.log("items", content.items.length);
  console.log(JSON.stringify(content.items.slice(0, 12)));
} catch (err) {
  console.log("ERROR:", err && err.message);
  console.log(String(err).slice(0, 400));
}
