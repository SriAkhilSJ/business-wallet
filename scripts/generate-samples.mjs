/**
 * Generates 10 fictional sample PDF bills/invoices into sample-data/.
 *
 * Every document is watermarked "SAMPLE — NOT A REAL TAX INVOICE" and uses
 * fictional businesses, addresses, invoice numbers and amounts. No real
 * GSTINs, people or companies are used.
 *
 * Usage: npm run samples:generate
 */
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import PDFDocument from "pdfkit";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "sample-data");

const BUYER = {
  name: "Sharma Traders (fictional)",
  addr1: "12 Residency Road (sample address)",
  addr2: "Bengaluru 560025",
  gstin: "29SAMPLE0000X1Z0 (fictional)",
};

const SAMPLES = [
  {
    file: "sample-01-office-rent-invoice.pdf",
    title: "RENT INVOICE",
    number: "RENT/2026/10/001",
    date: "2026-10-05",
    category: "Expense",
    vendor: {
      name: "Sunrise Property Rentals (fictional)",
      addr1: "88 Anna Salai (sample address)",
      addr2: "Chennai 600002",
      gstin: "33SAMPLE0000B1Z1 (fictional)",
    },
    items: [
      { desc: "Office rent — October 2026, Shop 12", qty: 1, rate: 35000 },
      { desc: "Maintenance charges — October 2026", qty: 1, rate: 2500 },
    ],
  },
  {
    file: "sample-02-electricity-bill.pdf",
    title: "ELECTRICITY BILL",
    number: "ELE/2026/10/8842",
    date: "2026-10-18",
    category: "Utility Bill",
    vendor: {
      name: "Mangala Electric Supply Co. (fictional)",
      addr1: "Power House Road (sample address)",
      addr2: "Mangaluru 575001",
      gstin: "29SAMPLE0000C1Z2 (fictional)",
    },
    items: [
      {
        desc: "Electricity consumption — Sep 2026 to Oct 2026 (1,240 units)",
        qty: 1,
        rate: 4820,
      },
    ],
  },
  {
    file: "sample-03-internet-bill.pdf",
    title: "INTERNET BILL",
    number: "ISP/2026/11/0033",
    date: "2026-11-03",
    category: "Utility Bill",
    vendor: {
      name: "FiberFast Networks Pvt Ltd (fictional)",
      addr1: "4th Block, Jayanagar (sample address)",
      addr2: "Bengaluru 560041",
      gstin: "29SAMPLE0000D1Z3 (fictional)",
    },
    items: [
      { desc: "Business broadband — 300 Mbps, November 2026", qty: 1, rate: 1999 },
    ],
  },
  {
    file: "sample-04-laptop-purchase-invoice.pdf",
    title: "PURCHASE INVOICE",
    number: "PC/2026/10/1207",
    date: "2026-10-22",
    category: "Purchase Invoice",
    vendor: {
      name: "TechNova Computers (fictional)",
      addr1: "21 Nehru Place (sample address)",
      addr2: "New Delhi 110019",
      gstin: "07SAMPLE0000E1Z4 (fictional)",
    },
    items: [
      { desc: 'Laptop — 14" business model (8GB/512GB)', qty: 2, rate: 48500 },
    ],
  },
  {
    file: "sample-05-office-supplies-receipt.pdf",
    title: "SUPPLIES RECEIPT",
    number: "RCPT/2026/11/0091",
    date: "2026-11-07",
    category: "Receipt",
    vendor: {
      name: "Stationery Hub (fictional)",
      addr1: "Commercial Street (sample address)",
      addr2: "Bengaluru 560001",
      gstin: "29SAMPLE0000F1Z5 (fictional)",
    },
    items: [
      {
        desc: "Printer paper (10 reams), folders, pens, sticky notes",
        qty: 1,
        rate: 2450,
      },
    ],
  },
  {
    file: "sample-06-client-sales-invoice.pdf",
    title: "SALES INVOICE",
    number: "SAL/2026/11/0045",
    date: "2026-11-10",
    category: "Sales Invoice",
    vendor: {
      name: "Deccan Digital Studio (fictional)",
      addr1: "5th Cross, Indiranagar (sample address)",
      addr2: "Bengaluru 560038",
      gstin: "29SAMPLE0000G1Z6 (fictional)",
    },
    items: [
      { desc: "Website design & development services", qty: 1, rate: 55000 },
      { desc: "Content writing (10 pages)", qty: 10, rate: 1200 },
    ],
  },
  {
    file: "sample-07-fuel-receipt.pdf",
    title: "FUEL RECEIPT",
    number: "FUEL/2026/11/3312",
    date: "2026-11-12",
    category: "Receipt",
    vendor: {
      name: "CityFuel Petrol Pump (fictional)",
      addr1: "Hosur Road (sample address)",
      addr2: "Bengaluru 560068",
      gstin: "29SAMPLE0000H1Z7 (fictional)",
    },
    items: [{ desc: "Diesel — 42.5 litres @ sample rate", qty: 42.5, rate: 92.3 }],
  },
  {
    file: "sample-08-software-subscription-invoice.pdf",
    title: "SUBSCRIPTION INVOICE",
    number: "SUB/2026/10/0777",
    date: "2026-10-30",
    category: "Expense",
    vendor: {
      name: "CloudSuite Software Ltd (fictional)",
      addr1: "Prestige Tech Park (sample address)",
      addr2: "Bengaluru 560103",
      gstin: "29SAMPLE0000J1Z8 (fictional)",
    },
    items: [
      { desc: "Accounting software — annual subscription", qty: 1, rate: 11999 },
    ],
  },
  {
    file: "sample-09-equipment-purchase-bill.pdf",
    title: "EQUIPMENT BILL",
    number: "EQP/2026/11/0456",
    date: "2026-11-13",
    category: "Purchase Invoice",
    vendor: {
      name: "Industrial Equipment Co. (fictional)",
      addr1: "Peenya Industrial Area (sample address)",
      addr2: "Bengaluru 560058",
      gstin: "29SAMPLE0000K1Z9 (fictional)",
    },
    items: [
      { desc: "Heavy-duty laser printer", qty: 1, rate: 21500 },
      { desc: "Industrial laminator", qty: 1, rate: 5000 },
    ],
  },
  {
    file: "sample-10-payment-receipt.pdf",
    title: "PAYMENT RECEIPT",
    number: "PAY/2026/10/2210",
    date: "2026-10-15",
    category: "Payment Proof",
    vendor: {
      name: "QuickPay Transfers (fictional)",
      addr1: "Digital Payments Desk (sample address)",
      addr2: "Hyderabad 500081",
      gstin: "36SAMPLE0000L1ZA (fictional)",
    },
    items: [
      { desc: "NEFT transfer — security deposit refund (sample)", qty: 1, rate: 15000 },
    ],
  },
];

function money(n) {
  return `INR ${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function renderPdf(def, path) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = createWriteStream(path);
    doc.pipe(stream);

    // Sample banner
    doc.rect(50, 45, 495, 26).fill("#B91C1C");
    doc
      .fill("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("SAMPLE — NOT A REAL TAX INVOICE", 50, 51, {
        width: 495,
        align: "center",
      });

    // Header
    doc.fill("#111827").font("Helvetica-Bold").fontSize(18).text(def.title, 50, 90);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fill("#4B5563")
      .text(`Invoice no: ${def.number}`, 50, 114)
      .text(`Date: ${def.date}`);

    // From / To
    const fromY = 150;
    doc.fill("#6B7280").fontSize(9).text("FROM", 50, fromY);
    doc.fill("#111827").font("Helvetica-Bold").fontSize(11).text(def.vendor.name, 50, fromY + 14);
    doc.font("Helvetica").fontSize(9);
    doc.text(def.vendor.addr1, 50, doc.y + 2);
    doc.text(def.vendor.addr2);
    doc.text(`GSTIN: ${def.vendor.gstin}`);

    doc.fill("#6B7280").fontSize(9).text("TO", 320, fromY);
    doc.fill("#111827").font("Helvetica-Bold").fontSize(11).text(BUYER.name, 320, fromY + 14);
    doc.font("Helvetica").fontSize(9);
    doc.text(BUYER.addr1, 320, doc.y + 2);
    doc.text(BUYER.addr2);
    doc.text(`GSTIN: ${BUYER.gstin}`);

    // Items table
    let y = 250;
    const cols = { desc: 50, qty: 320, rate: 385, amt: 470 };
    doc
      .rect(50, y - 6, 495, 20)
      .fill("#F3F4F6");
    doc.fill("#374151").font("Helvetica-Bold").fontSize(9);
    doc.text("Description", cols.desc + 4, y);
    doc.text("Qty", cols.qty, y, { width: 50, align: "right" });
    doc.text("Rate", cols.rate, y, { width: 70, align: "right" });
    doc.text("Amount", cols.amt, y, { width: 75, align: "right" });
    y += 24;

    let subtotal = 0;
    doc.font("Helvetica").fill("#111827");
    for (const item of def.items) {
      const amount = item.qty * item.rate;
      subtotal += amount;
      doc.fontSize(9).text(item.desc, cols.desc + 4, y, { width: 255 });
      doc.text(String(item.qty), cols.qty, y, { width: 50, align: "right" });
      doc.text(money(item.rate), cols.rate, y, { width: 70, align: "right" });
      doc.text(money(amount), cols.amt, y, { width: 75, align: "right" });
      y = doc.y + 10;
    }

    // Totals
    const tax = Math.round(subtotal * 0.18 * 100) / 100;
    const total = subtotal + tax;
    y += 6;
    doc.moveTo(320, y).lineTo(545, y).strokeColor("#D1D5DB").stroke();
    y += 10;
    doc.fontSize(9).fill("#374151");
    doc.text("Subtotal", 320, y, { width: 150, align: "right" });
    doc.text(money(subtotal), 470, y, { width: 75, align: "right" });
    y += 16;
    doc.text("GST @ 18% (sample)", 320, y, { width: 150, align: "right" });
    doc.text(money(tax), 470, y, { width: 75, align: "right" });
    y += 18;
    doc.font("Helvetica-Bold").fill("#111827").fontSize(11);
    doc.text("Total", 320, y, { width: 150, align: "right" });
    doc.text(money(total), 470, y, { width: 75, align: "right" });

    // Footer
    doc
      .font("Helvetica")
      .fontSize(8)
      .fill("#6B7280")
      .text(
        "Generated for the BusinessVault POC demonstration. All business names, addresses, invoice numbers, amounts and tax identifiers in this document are fictional samples.",
        50,
        700,
        { width: 495 },
      );
    doc.text(
      "SAMPLE — NOT A REAL TAX INVOICE",
      50,
      716,
      { width: 495, align: "center" },
    );

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
  });
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const manifest = [];
  for (const def of SAMPLES) {
    const path = join(outDir, def.file);
    await renderPdf(def, path);
    manifest.push({
      file: def.file,
      title: def.title,
      category: def.category,
      documentDate: def.date,
    });
    console.log(`✓ ${def.file}`);
  }
  writeFileSync(
    join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(`✓ manifest.json (${manifest.length} samples in ${outDir})`);
}

main().catch((err) => {
  console.error("Sample generation failed:", err);
  process.exit(1);
});
