/**
 * Can a DeepSeek model read a bill image? And what does it cost?
 * Prints the DeepSeek models on Velona, any vision-capable alternatives, and
 * the result of sending one bill image to each DeepSeek candidate.
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = "https://velona.in/v1";

const auth = JSON.parse(
  await readFile(join(homedir(), ".local", "share", "opencode", "auth.json"), "utf8"),
);
const key = auth.velona.key;

const list = await (await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${key}` } })).json();
const ids = list.data.map((m) => m.id);

console.log(`total models: ${ids.length}\n`);

const deepseek = ids.filter((id) => /deepseek/i.test(id));
const vl = ids.filter((id) => /\/(.*)(vl|vision|omni)/i.test(id));

console.log("DEEPSEEK");
for (const id of deepseek) {
  const m = list.data.find((x) => x.id === id);
  const price = m?.pricing ? JSON.stringify(m.pricing) : "no pricing field";
  console.log(`  ${id}   ${price}`);
}

console.log("\nVISION-CAPABLE LOOKING");
for (const id of vl) console.log(`  ${id}`);

const png = await readFile(join(here, "out", "cloudtools-invoice.png"));
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

console.log("\nIMAGE TEST (DeepSeek candidates)");
for (const model of deepseek.slice(0, 6)) {
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 120,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What is the vendor name and total amount in this image? JSON only." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    const text = await res.text();
    let summary = text.slice(0, 150).replace(/\s+/g, " ");
    try {
      const parsed = JSON.parse(text);
      summary = parsed.choices?.[0]?.message?.content ?? parsed.error?.message ?? text.slice(0, 150);
    } catch {}
    console.log(`  ${model}\n    HTTP ${res.status}  ${String(summary).slice(0, 160)}`);
  } catch (err) {
    console.log(`  ${model}\n    failed: ${err.message}`);
  }
}
