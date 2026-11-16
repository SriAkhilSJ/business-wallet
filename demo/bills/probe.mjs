/**
 * Finds which Velona models can actually see an image. Sends one small bill to
 * a list of candidates and prints status + a short reply.
 *
 * Run: node demo/bills/probe.mjs
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

const png = await readFile(join(here, "out", "cloudtools-invoice.png"));
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

const candidates = [
  "openai/gpt-6.1-terra",
  "anthropic/claude-haiku-5.5",
  "nvidia/nemotron-3.5-super-vl",
  "google/gemini-4-argon",
  "moondream/moondream3.1-9b-a2b",
  "anthropic/claude-fable-5.2",
];

for (const model of candidates) {
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
              { type: "text", text: "Return only JSON: {\"vendor\":string,\"amount\":number}" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    const text = await res.text();
    console.log(`${model}\n  HTTP ${res.status}  ${text.slice(0, 140).replace(/\s+/g, " ")}`);
  } catch (err) {
    console.log(`${model}\n  failed: ${err.message}`);
  }
}
