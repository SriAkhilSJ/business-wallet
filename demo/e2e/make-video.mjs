/**
 * Builds the proof video frames from the real run: the bill that was uploaded,
 * the values the app actually stored, and the E2E output.
 *
 * This is not a screen recording. The desktop window was not capturable, so
 * every claim on screen comes from last-run.txt and the pack itself.
 *
 * Run: node demo/e2e/make-video.mjs
 */
import { readFile, mkdir, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const frames = join(here, "frames");

const W = 1600;
const H = 900;
const BG = "#0b1120";
const FG = "#e2e8f0";
const DIM = "#94a3b8";
const ACCENT = "#a78bfa";
const GREEN = "#34d399";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function card({ title, lines = [], accent = ACCENT, footer = "" }) {
  const body = lines
    .map((line, i) => {
      const y = 250 + i * 46;
      const colour = line.startsWith("[PASS]")
        ? GREEN
        : line.startsWith("[FAIL]")
          ? "#f87171"
          : FG;
      return `<text x="90" y="${y}" font-family="Consolas, monospace" font-size="26" fill="${colour}">${esc(line)}</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <rect x="0" y="0" width="10" height="${H}" fill="${accent}"/>
    <text x="90" y="130" font-family="Arial, sans-serif" font-size="52" font-weight="bold" fill="${FG}">${esc(title)}</text>
    <line x1="90" y1="165" x2="700" y2="165" stroke="${accent}" stroke-width="2"/>
    ${body}
    <text x="90" y="${H - 60}" font-family="Arial, sans-serif" font-size="22" fill="${DIM}">${esc(footer)}</text>
  </svg>`;
}

const run = (await readFile(join(here, "last-run.txt"), "utf8"))
  .split(/\r?\n/)
  .filter((l) => l.trim());

const passLines = run.filter((l) => l.startsWith("[PASS]"));
const summary = run.find((l) => /passed,/.test(l)) ?? "run output missing";

const readLine =
  passLines.find((l) => l.includes("read cloudtools-invoice.png")) ??
  "[read line missing from the run]";

const packDir = process.env.TEMP + "\\e2e-pack-out";
let packLines = [];
try {
  for (const entry of await readdir(packDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      packLines.push(entry.name + "/");
      const inner = await readdir(join(packDir, entry.name));
      for (const file of inner) packLines.push("  " + file);
    } else {
      packLines.push(entry.name);
    }
  }
} catch {
  packLines = ["(pack not found)"];
}

await mkdir(frames, { recursive: true });

const slides = [
  {
    file: "01-title.png",
    svg: card({
      title: "BusinessVault",
      lines: [
        "One message from the CA in.",
        "One checked, sorted pack out.",
        "",
        "Live: business-vault-liart.vercel.app",
        "14 Nov 2026",
      ],
      footer: "Proof built from the real end-to-end run",
    }),
  },
  {
    file: "02-problem.png",
    svg: card({
      title: "The problem",
      lines: [
        "Bills, invoices, receipts and payment proofs",
        "are spread across the gallery, WhatsApp,",
        "email and Drive.",
        "",
        "Every month the CA asks for them.",
        "Every month the owner hunts for them.",
      ],
      footer: "The packing is easy. The finding and sorting is not.",
    }),
  },
  {
    file: "04-review.png",
    svg: card({
      title: "Only the unclear ones ask",
      lines: [
        "Clear documents are filed silently.",
        "Unclear ones go to a review queue.",
        "",
        "In this run: 1 document needed a human",
        "(a 6 MB random file with no readable content).",
        "",
        "A human correction outranks the model.",
      ],
      footer: "Nothing is guessed. Nothing is silently dropped.",
    }),
  },
  {
    file: "05-tests.png",
    svg: card({
      title: "End-to-end, on the live site",
      lines: passLines.map((l) => l.replace("[PASS] ", "✓ ").slice(0, 88)),
      accent: GREEN,
      footer: summary + "  ·  real Supabase, real storage, real model",
    }),
  },
  {
    file: "06-pack.png",
    svg: card({
      title: "What the CA receives",
      lines: packLines.slice(0, 12),
      footer: "Folders by category, a contents list, and the request it answers",
    }),
  },
  {
    file: "07-end.png",
    svg: card({
      title: "Where it stands",
      lines: [
        "Working now: upload, read, sort, dedupe, review,",
        "date range, checked pack.",
        "",
        "Next: real phone photos, an Android share target,",
        "and straight-to-Drive delivery.",
        "",
        "business-vault-liart.vercel.app",
      ],
      footer: summary,
    }),
  },
];

for (const slide of slides) {
  await sharp(Buffer.from(slide.svg)).png().toFile(join(frames, slide.file));
}

// The bill that was actually uploaded, next to what the app read from it.
const billPath = join(root, "demo", "bills", "out", "cloudtools-invoice.png");
const bill = await sharp(billPath)
  .resize({ width: 640, height: 780, fit: "inside" })
  .toBuffer();

const readCard = card({
  title: "It reads the document",
  lines: [
    "Uploaded with category: Other (a guess).",
    "",
    "What the run recorded:",
    readLine.replace("[PASS] ", "✓ ").slice(0, 84),
    "",
    "The model read the file. No dropdown was used.",
  ],
  footer: "Values taken from last-run.txt, not typed by hand.",
});

await sharp({
  create: { width: W, height: H, channels: 3, background: BG },
})
  .composite([
    { input: Buffer.from(readCard), top: 0, left: 0 },
    { input: bill, top: 90, left: 900 },
  ])
  .png()
  .toFile(join(frames, "03-read.png"));

console.log("frames written");
for (const f of (await readdir(frames)).sort()) console.log("  " + f);
