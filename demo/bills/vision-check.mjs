/**
 * Sends the rendered bill images to a vision model and scores the answer
 * against truth.json. This is the honest test of "can the app read a bill".
 *
 * Run:
 *   node demo/bills/vision-check.mjs                     (uses the default model)
 *   node demo/bills/vision-check.mjs google/gemini-4-carbon
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");

const BASE_URL = process.env.VELONA_BASE_URL || "https://velona.in/v1";
const MODEL = process.argv[2] || process.env.MODEL || "google/gemini-4-carbon";

async function apiKey() {
  if (process.env.VELONA_API_KEY) return process.env.VELONA_API_KEY;
  const authPath = join(homedir(), ".local", "share", "opencode", "auth.json");
  const auth = JSON.parse(await readFile(authPath, "utf8"));
  const entry = auth.velona;
  if (!entry?.key) throw new Error("No velona key in opencode auth.json");
  return entry.key;
}

function extractJson(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

const prompt = `You are reading a photo of one Indian business document.
Return ONLY a JSON object, no prose:
{"docType": string, "vendor": string, "date": "YYYY-MM-DD", "amount": number, "gstin": string or null, "confidence": number between 0 and 1}

docType must be exactly one of these, chosen by these rules:
- "Utility Bill": electricity, water, gas, internet or phone bill from the utility provider.
- "Purchase Invoice": an invoice from a supplier or vendor for something the business bought.
- "Sales Invoice": an invoice issued BY this business TO its customer.
- "Receipt": a shop or counter receipt for goods bought over the counter.
- "Expense": rent (including a rent invoice or rent receipt), fuel, travel, supplies, salary.
- "Payment Proof": a UPI, NEFT, IMPS or bank confirmation that money was transferred.
- "Other": anything that does not fit.

Rules: amount is the grand total in rupees, digits only. date is the document date in ISO form. vendor is the business that issued the document.`;

const key = await apiKey();
const truth = JSON.parse(await readFile(join(out, "truth.json"), "utf8"));

console.log(`model: ${MODEL}`);
console.log(`endpoint: ${BASE_URL}/chat/completions\n`);

let typeHits = 0;
let dateHits = 0;
let amountHits = 0;
let vendorHits = 0;
let failures = 0;

for (const item of truth) {
  const png = await readFile(join(out, item.file));
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

  let body;
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
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
    if (!res.ok) {
      console.log(`${item.file}  HTTP ${res.status}: ${text.slice(0, 160)}`);
      failures += 1;
      continue;
    }
    body = JSON.parse(text);
  } catch (err) {
    console.log(`${item.file}  request failed: ${err.message}`);
    failures += 1;
    continue;
  }

  const answer = extractJson(body.choices?.[0]?.message?.content ?? "");
  if (!answer) {
    console.log(`${item.file}  unparseable: ${JSON.stringify(body).slice(0, 160)}`);
    failures += 1;
    continue;
  }

  const typeOk = answer.docType === item.docType;
  const dateOk = String(answer.date ?? "").slice(0, 10) === item.date;
  const amountOk = Math.abs(Number(answer.amount) - item.amount) < 1;
  const vendorOk =
    typeof answer.vendor === "string" &&
    item.vendor.toLowerCase().split(" ").some((w) => answer.vendor.toLowerCase().includes(w));

  if (typeOk) typeHits += 1;
  if (dateOk) dateHits += 1;
  if (amountOk) amountHits += 1;
  if (vendorOk) vendorHits += 1;

  console.log(
    `${item.file}\n  type   ${item.docType} -> ${answer.docType} ${typeOk ? "OK" : "WRONG"}` +
      `\n  date   ${item.date} -> ${answer.date} ${dateOk ? "OK" : "WRONG"}` +
      `\n  amount ${item.amount} -> ${answer.amount} ${amountOk ? "OK" : "WRONG"}` +
      `\n  vendor ${item.vendor} -> ${answer.vendor} ${vendorOk ? "OK" : "WRONG"}` +
      `\n  confidence ${answer.confidence}\n`,
  );
}

const n = truth.length;
console.log("─".repeat(48));
console.log(`documents      ${n}`);
console.log(`type correct   ${typeHits}/${n}`);
console.log(`date correct   ${dateHits}/${n}`);
console.log(`amount correct ${amountHits}/${n}`);
console.log(`vendor correct ${vendorHits}/${n}`);
console.log(`failed calls   ${failures}/${n}`);
