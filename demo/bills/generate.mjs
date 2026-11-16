/**
 * Renders six fictional Indian business documents as PNG "phone photos" with
 * real, readable text, plus truth.json — the answers the vision model must
 * reproduce.
 *
 * Generated images are used because a generative image model writes gibberish
 * text: useless for testing whether a document can be read. These are drawn
 * from SVG, so the text is exact.
 *
 * Run: node demo/bills/generate.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function frame(body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
  <rect width="900" height="1200" fill="#f6f5f2"/>
  <rect x="40" y="40" width="820" height="1120" fill="#ffffff" stroke="#c9c5bd" stroke-width="2"/>
  <text x="70" y="105" font-family="Arial" font-size="24" fill="#777">${esc(title)}</text>
  ${body}
</svg>`;
}

function text(x, y, value, { size = 22, bold = false, fill = "#111" } = {}) {
  return `<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" fill="${fill}"${
    bold ? ' font-weight="bold"' : ""
  }>${esc(value)}</text>`;
}

function row(y, label, value, bold = false) {
  return (
    text(80, y, label, { size: 20, fill: "#444" }) +
    text(700, y, value, { size: 20, bold, fill: "#111" })
  );
}

const bills = [
  {
    file: "bescom-electricity.png",
    title: "TAX INVOICE / BILL OF SUPPLY",
    truth: { docType: "Utility Bill", vendor: "BESCOM", date: "2026-08-18", amount: 4860 },
    svg: frame(
      text(70, 165, "BESCOM", { size: 40, bold: true }) +
        text(70, 205, "Bangalore Electricity Supply Company Ltd", { fill: "#555" }) +
        text(70, 240, "Consumer No: 9876543210", { size: 20 }) +
        text(70, 275, "Bill Month: August 2026", { size: 20 }) +
        row(400, "Units consumed", "412 kWh") +
        row(450, "Energy charges", "Rs 3,980.00") +
        row(500, "Fixed charges", "Rs 400.00") +
        row(550, "Electricity duty", "Rs 480.00") +
        row(650, "Total amount payable", "Rs 4,860.00", true) +
        text(70, 730, "Due date: 18-08-2026", { size: 24, bold: true }) +
        text(70, 800, "Pay online at bescom.org", { size: 18, fill: "#666" }),
      "ELECTRICITY",
    ),
  },
  {
    file: "sharma-properties-rent.png",
    title: "RENT INVOICE",
    truth: { docType: "Expense", vendor: "Sharma Properties", date: "2026-08-01", amount: 35000 },
    svg: frame(
      text(70, 165, "Sharma Properties", { size: 40, bold: true }) +
        text(70, 205, "Landlord: R. Sharma", { fill: "#555" }) +
        text(70, 240, "Invoice No: RENT/AUG/2026", { size: 20 }) +
        text(70, 275, "Date: 01-08-2026", { size: 20 }) +
        row(400, "Rent for August 2026", "Rs 35,000.00") +
        row(450, "Maintenance", "Rs 0.00") +
        row(650, "Total", "Rs 35,000.00", true) +
        text(70, 730, "Received by: R. Sharma", { size: 22 }) +
        text(70, 800, "PAN: ABCPS1234K", { size: 18, fill: "#666" }),
      "RENT",
    ),
  },
  {
    file: "cloudtools-invoice.png",
    title: "TAX INVOICE",
    truth: {
      docType: "Purchase Invoice",
      vendor: "Cloudtools Pvt Ltd",
      date: "2026-08-03",
      amount: 2499,
      gstin: "29AABCU9603R1ZM",
    },
    svg: frame(
      text(70, 165, "Cloudtools Pvt Ltd", { size: 40, bold: true }) +
        text(70, 205, "GSTIN: 29AABCU9603R1ZM", { fill: "#555" }) +
        text(70, 240, "Invoice No: INV-2291", { size: 20 }) +
        text(70, 275, "Invoice Date: 03-08-2026", { size: 20 }) +
        text(70, 310, "Billed to: Sharma Traders", { size: 20 }) +
        row(420, "Cloudtools subscription (Aug)", "Rs 2,117.80") +
        row(470, "CGST 9%", "Rs 190.60") +
        row(520, "SGST 9%", "Rs 190.60") +
        row(650, "Invoice total", "Rs 2,499.00", true) +
        text(70, 730, "Payment due within 15 days", { size: 20, fill: "#555" }),
      "PURCHASE INVOICE",
    ),
  },
  {
    file: "electricals-upi.png",
    title: "PAYMENT RECEIPT",
    truth: {
      docType: "Payment Proof",
      vendor: "Sharma Electricals",
      date: "2026-08-07",
      amount: 1200,
    },
    svg: frame(
      text(70, 165, "Sharma Electricals", { size: 40, bold: true }) +
        text(70, 205, "Payment receipt", { fill: "#555" }) +
        text(70, 240, "Date: 07-08-2026", { size: 20 }) +
        text(70, 275, "UPI Ref: 889122310098", { size: 20 }) +
        row(420, "Amount paid", "Rs 1,200.00") +
        row(470, "Mode", "UPI / GPay") +
        row(520, "Paid by", "Sharma Traders") +
        row(650, "Total received", "Rs 1,200.00", true) +
        text(70, 760, "Thank you for your payment", { size: 20, fill: "#666" }),
      "PAYMENT",
    ),
  },
  {
    file: "mehta-sales-invoice.png",
    title: "TAX INVOICE",
    truth: { docType: "Sales Invoice", vendor: "Sharma Traders", date: "2026-08-22", amount: 18500 },
    svg: frame(
      text(70, 165, "Sharma Traders", { size: 40, bold: true }) +
        text(70, 205, "GSTIN: 29AACCS5678K1Z9", { fill: "#555" }) +
        text(70, 240, "Invoice No: ST/2026/118", { size: 20 }) +
        text(70, 275, "Date: 22-08-2026", { size: 20 }) +
        text(70, 310, "Billed to: Mehta Traders, Pune", { size: 20 }) +
        row(420, "Supply of office furniture", "Rs 15,678.00") +
        row(470, "CGST 9%", "Rs 1,411.00") +
        row(520, "SGST 9%", "Rs 1,411.00") +
        row(650, "Invoice total", "Rs 18,500.00", true),
      "SALES INVOICE",
    ),
  },
  {
    file: "indianoil-fuel.png",
    title: "FUEL RECEIPT",
    truth: { docType: "Expense", vendor: "Indian Oil", date: "2026-08-14", amount: 2200 },
    svg: frame(
      text(70, 165, "Indian Oil", { size: 40, bold: true }) +
        text(70, 205, "Retail outlet: Whitefield, Bengaluru", { fill: "#555" }) +
        text(70, 240, "Date: 14-08-2026  Time: 19:42", { size: 20 }) +
        row(420, "Diesel (28.4 L)", "Rs 2,200.00") +
        row(470, "Rate", "Rs 77.46 / L") +
        row(650, "Total", "Rs 2,200.00", true) +
        text(70, 760, "Vehicle: KA-01-AB-1234", { size: 20, fill: "#555" }),
      "FUEL",
    ),
  },
];

await mkdir(out, { recursive: true });
const truth = [];

for (const bill of bills) {
  await sharp(Buffer.from(bill.svg)).png().toFile(join(out, bill.file));
  truth.push({ file: bill.file, ...bill.truth });
}

await writeFile(join(out, "truth.json"), JSON.stringify(truth, null, 2));
console.log(`Wrote ${truth.length} bill images + truth.json to demo/bills/out`);
for (const t of truth) console.log(`  ${t.file}  ${t.docType}  ${t.date}  ₹${t.amount}`);
