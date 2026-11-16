/**
 * Does the vision model actually read a PDF sent as an image?
 * Run: node demo/bills/probe-pdf.mjs
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const auth = JSON.parse(
  await readFile(join(homedir(), ".local", "share", "opencode", "auth.json"), "utf8"),
);
const key = auth.velona.key;
const model = "deepseek/deepseek-v4.1-flash-1017";

const pdf = await readFile(join(root, "sample-data", "sample-02-electricity-bill.pdf"));
const dataUrl = `data:application/pdf;base64,${pdf.toString("base64")}`;

const prompt =
  'Return ONLY JSON: {"docType":string,"vendor":string,"date":"YYYY-MM-DD","amount":number,"confidence":number}';

const res = await fetch("https://velona.in/v1/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    temperature: 0,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  }),
});

const text = await res.text();
console.log("HTTP", res.status);
console.log(text.slice(0, 500));
