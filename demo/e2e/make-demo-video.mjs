/**
 * Turns the four screenshots of the live site into a short demo video.
 * Frames are the real pages; only the caption bar is added.
 *
 * Run: node demo/e2e/make-demo-video.mjs
 */
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "shots");
const frames = join(here, "frames");

const sequence = [
  ["01-landing.jpeg", "The live site — business-vault-liart.vercel.app"],
  ["05-upload-selected.jpeg", "Owner adds three bills — category left as Other"],
  ["06-uploaded.jpeg", "Uploaded in 15s. The model filled category, vendor, date and amount"],
  ["07-collect-filled.jpeg", "The period and what the CA asked for"],
  ["08-collect-result.jpeg", "3 ready. UPI proofs missing — said plainly, not hidden"],
  ["04-review.jpeg", "Only what the model could not read asks a human"],
];

await mkdir(frames, { recursive: true });

const files = sequence;

for (const [index, entry] of files.entries()) {
  const [file, caption] = entry;
  const image = await sharp(join(shots, file))
    .resize({ width: 1560, height: 790, fit: "inside" })
    .toBuffer();
  const meta = await sharp(image).metadata();
  const left = Math.round((1600 - (meta.width ?? 1560)) / 2);
  const top = Math.round((790 - (meta.height ?? 700)) / 2) + 10;

  const bar = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <rect y="800" width="1600" height="4" fill="#a78bfa"/>
    <rect y="804" width="1600" height="96" fill="#0b1120"/>
    <text x="60" y="866" font-family="Arial, sans-serif" font-size="32" fill="#e2e8f0">${caption
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</text>
  </svg>`;

  await sharp({
    create: { width: 1600, height: 900, channels: 3, background: "#0b1120" },
  })
    .composite([
      { input: image, top, left },
      { input: Buffer.from(bar), top: 0, left: 0 },
    ])
    .png()
    .toFile(join(frames, `demo-${String(index + 1).padStart(2, "0")}.png`));

  console.log(`frame ${index + 1}: ${file}`);
}
