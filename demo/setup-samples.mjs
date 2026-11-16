/**
 * Builds the demo "phone" — folders that stand in for the sources a real
 * Android build would read: gallery, phone files, SMS, notifications,
 * WhatsApp media, email, and a Drive folder export.
 *
 * Run: node demo/setup-samples.mjs
 * Safe to re-run: it overwrites the demo files and never touches src/.
 */
import { mkdir, copyFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const sources = join(here, "sources");
const sampleData = join(here, "..", "sample-data");

/* ------------------------- tiny PNG writer ------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Draws a photo-like placeholder: a bill sheet on a desk, with text lines. */
function receiptPng({ width = 900, height = 1200, seed = 1 } = {}) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  const paper = { x0: 170, x1: 730, y0: 120, y1: 1080 };
  let rnd = seed;
  const next = () => {
    rnd = (rnd * 1103515245 + 12345) & 0x7fffffff;
    return rnd / 0x7fffffff;
  };

  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const i = rowStart + 1 + x * 3;
      let r, g, b;
      const onPaper =
        x >= paper.x0 && x <= paper.x1 && y >= paper.y0 && y <= paper.y1;
      if (onPaper) {
        const shade = 244 + Math.floor(next() * 8);
        r = shade; g = shade - 2; b = shade - 8;
        // simulated printed lines
        const lineY = (y - paper.y0) % 46;
        const inset = (y - paper.y0) < 90 ? 40 : 26;
        if (lineY < 7 && x > paper.x0 + inset && x < paper.x1 - 60 - Math.floor(next() * 120)) {
          const dark = 40 + Math.floor(next() * 40);
          r = dark; g = dark; b = dark + 6;
        }
      } else {
        // desk
        const n = next() * 14;
        r = 96 + n; g = 78 + n; b = 62 + n;
      }
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* --------------------------- sample files -------------------------- */

const textFiles = {
  "sms/sms-2026-08-04-hdfc.txt": `Rs.2,499.00 debited from A/c XX4412 on 04-08-26 to V/CLOUDTOOLS IN. UPI Ref 413622889901. Not you? Call 18002586161`,

  "sms/sms-2026-08-06-bescom.txt": `BESCOM: Your electricity bill of Rs.4,860.00 for Aug 2026 is due on 18-08-2026. Consumer No 9876543. Pay at bescom.org`,

  "sms/sms-2026-08-14-otp.txt": `482913 is your OTP for HDFC NetBanking login. Valid for 10 mins. Do not share with anyone.`,

  "notifications/notif-2026-08-07-gpay.txt": `GPay: Payment successful. Rs.1,200 paid to SHARMA ELECTRICALS on 7 Aug 2026. UPI ref 889122310098.`,

  "notifications/notif-2026-08-21-jio.txt": `Jio: Recharge successful. Rs.399 paid for 12-08-2026. Receipt no 778812.`,

  "notifications/notif-2026-08-09-amazon.txt": `Amazon: Your order 402-1234567-1234567 has been delivered. Rate your experience.`,

  "notifications/notif-2026-08-28-hdfc.txt": `HDFC: Auto-debit of Rs.35,000 scheduled for 01-09-2026 towards rent. Ensure sufficient balance.`,

  "whatsapp/chat-with-ca.txt": `Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
[09/08/26, 11:12] CA Ramesh: please send August bills
[09/08/26, 11:15] Me: sending today
[09/08/26, 11:16] Me: <Media omitted>`,

  "email/invoice-cloudtools-aug.txt": `From: billing@cloudtools.in
Subject: Invoice INV-2291 for August 2026
Date: 03-08-2026

Please find attached invoice INV-2291 dated 03-08-2026 for Rs.2,499.00 towards the Cloudtools subscription.
GSTIN: 29AABCU9603R1ZM`,

  "email/jio-recharge-receipt.txt": `From: noreply@jio.com
Subject: Recharge receipt
Date: 12-08-2026

Receipt: Rs.399 paid on 12-08-2026 for mobile recharge 98765 43210.`,

  "drive/README-drive.txt": `This folder stands in for a Google Drive folder that the owner connected.
A real connector would list and download these files with the drive.file scope.`,

  "request.txt": `Ramesh CA — WhatsApp, 02-Sep-2026, 10:41
Sharma ji, need the August accounts. Please send:
1. Electricity bill
2. Rent receipt
3. All purchase invoices
4. UPI payment proofs
5. Laptop purchase invoice
6. Bank statement for August
Kindly send by the 5th.`,
};

const pdfCopies = [
  ["sample-02-electricity-bill.pdf", "files/electricity-bill-aug-2026.pdf"],
  ["sample-08-software-subscription-invoice.pdf", "files/cloudtools-invoice-aug-2026.pdf"],
  ["sample-04-laptop-purchase-invoice.pdf", "files/scan0042.pdf"],
  ["sample-10-payment-receipt.pdf", "whatsapp/IMG-20260809-WA0004.pdf"],
  ["sample-01-office-rent-invoice.pdf", "drive/office-rent-aug-2026.pdf"],
  // The same electricity bill saved twice: this is what duplicate detection is for.
  ["sample-02-electricity-bill.pdf", "drive/electricity-bill-aug-2026 (1).pdf"],
];

const pngs = [
  ["photos/IMG_20260812_184501.png", { seed: 7 }],
  ["photos/IMG_20260818_093210.png", { seed: 21 }],
];

async function main() {
  for (const dir of ["photos", "files", "sms", "notifications", "whatsapp", "email", "drive"]) {
    await mkdir(join(sources, dir), { recursive: true });
  }

  for (const [rel, body] of Object.entries(textFiles)) {
    await writeFile(join(sources, rel), body, "utf8");
  }

  for (const [from, to] of pdfCopies) {
    await copyFile(join(sampleData, from), join(sources, to));
  }

  for (const [rel, opts] of pngs) {
    await writeFile(join(sources, rel), receiptPng(opts));
  }

  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(join(sources, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(rel);
      else files.push(rel);
    }
  }
  for (const dir of ["photos", "files", "sms", "notifications", "whatsapp", "email", "drive"]) {
    await walk(dir);
  }

  console.log(`Wrote ${files.length} demo source files:`);
  for (const f of files.sort()) console.log(`  sources/${f}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
