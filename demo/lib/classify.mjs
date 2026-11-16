/**
 * Rule-based document classifier for the demo.
 *
 * This is a stand-in for the production pipeline:
 *   OCR / text layer  ->  LLM structured extraction  ->  confidence score
 *
 * Here, the "text layer" is: SMS bodies, notification text, email bodies, and
 * filenames. PDFs and photos are NOT opened in this demo (no OCR yet), so their
 * only signal is the filename. The demo is honest about that: generic names
 * such as IMG_20260812.jpg land in the review queue, because a real system
 * would need OCR to know what they are.
 */

export const CATEGORIES = [
  "Sales Invoice",
  "Purchase Invoice",
  "Expense",
  "Receipt",
  "Utility Bill",
  "Payment Proof",
  "Other",
];

const NON_DOCUMENT = [
  /\bOTP\b/i,
  /\bone[- ]time password\b/i,
  /\bhas been delivered\b/i,
  /\bout for delivery\b/i,
  /\border (has been )?placed\b/i,
  /end-to-end encrypted/i,
  /\brate your (experience|order)\b/i,
];

const RULES = [
  {
    category: "Sales Invoice",
    weight: 0.34,
    re: /\b(sales invoice|invoice to (the )?(client|customer)|billed to)\b/i,
  },
  {
    category: "Utility Bill",
    weight: 0.34,
    re: /\b(electricity|water bill|gas bill|broadband|internet bill|utility bill|bescom|bses|tneb)\b/i,
  },
  {
    category: "Payment Proof",
    weight: 0.34,
    re: /\b(upi|neft|imps|rtgs|payment successful|paid to|debited|txn ref|transaction id)\b/i,
  },
  {
    category: "Receipt",
    weight: 0.30,
    re: /\b(receipt|acknowledg(e)?ment|recharge successful|paid on)\b/i,
  },
  {
    category: "Purchase Invoice",
    weight: 0.30,
    re: /\b(invoice|vendor|subscription|gstin|bill from)\b/i,
  },
  {
    category: "Expense",
    weight: 0.30,
    re: /\b(rent|fuel|diesel|petrol|travel|office supplies|stationery|maintenance|salary)\b/i,
  },
];

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad2 = (n) => String(n).padStart(2, "0");

function isoFrom(y, m, d) {
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const year = y < 100 ? 2000 + y : y;
  return `${year}-${pad2(m)}-${pad2(d)}`;
}

export function extractDate(text) {
  if (!text) return null;

  // 2026-08-04
  let m = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (m) return isoFrom(Number(m[1]), Number(m[2]), Number(m[3]));

  // 04-08-26, 04/08/2026, 4.8.26
  m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (m) return isoFrom(Number(m[3]), Number(m[2]), Number(m[1]));

  // 7 Aug 2026 / 07 August 2026
  m = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (month) return isoFrom(Number(m[3]), month, Number(m[1]));
  }

  return null;
}

export function extractAmount(text) {
  if (!text) return null;
  const m = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

export function extractVendor(text) {
  if (!text) return null;
  const m = text.match(/\bpaid to\s+([A-Z][A-Z0-9&.\s]{2,30})/);
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

/**
 * @param {{ filename: string, text: string|null, mime: string }} input
 * @returns {{
 *   category: string, confidence: number, date: string|null, amount: number|null,
 *   vendor: string|null, nonDocument: boolean, reasons: string[]
 * }}
 */
export function classify(input) {
  const { filename, text } = input;
  const reasons = [];

  const haystack = `${filename}\n${text ?? ""}`;

  const isNonDocument = NON_DOCUMENT.some((re) => re.test(haystack));
  if (isNonDocument) {
    return {
      category: "Other",
      confidence: 0.05,
      date: extractDate(text),
      amount: extractAmount(text),
      vendor: null,
      nonDocument: true,
      reasons: ["matched a non-document pattern (OTP, delivery notice, chat export)"],
    };
  }

  const scores = new Map();
  for (const rule of RULES) {
    if (rule.re.test(haystack)) {
      scores.set(rule.category, (scores.get(rule.category) ?? 0) + rule.weight);
      reasons.push(`matched ${rule.category.toLowerCase()} keyword`);
    }
  }

  let category = "Other";
  let bestWeight = 0;
  for (const [cat, weight] of scores) {
    if (weight > bestWeight) {
      category = cat;
      bestWeight = weight;
    }
  }

  // Is the filename carrying real information, or is it noise like IMG_1234?
  const hasKeywordInName = RULES.some((rule) => rule.re.test(filename));
  const hasMonthYearInName =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_ ]?(20\d{2})\b/i.test(
      filename,
    );
  const hasDateInName = Boolean(extractDate(filename)) || hasMonthYearInName;
  const filenameIsRich = hasKeywordInName && hasDateInName;

  const hasText = Boolean(text && text.trim().length > 20);
  let base;
  if (hasText) {
    base = 0.45;
    reasons.push("text signal");
  } else if (filenameIsRich) {
    base = 0.55;
    reasons.push("descriptive filename");
  } else {
    base = 0.35;
    reasons.push("no text; filename carries no reliable signal");
  }

  const date = extractDate(text) ?? extractDate(filename);
  const amount = extractAmount(text);
  const vendor = extractVendor(text);

  let confidence = base + bestWeight;
  if (date) confidence += 0.10;
  if (amount) confidence += 0.08;

  // A scheduled debit or a due-date reminder is not proof that anything was paid.
  if (/\b(scheduled|reminder|upcoming)\b|\bauto[- ]debit\b/i.test(haystack)) {
    confidence -= 0.30;
    reasons.push("reminder or scheduled payment, not proof of payment");
  }

  confidence = Math.max(0.05, Math.min(0.97, Number(confidence.toFixed(2))));

  return { category, confidence, date, amount, vendor, nonDocument: false, reasons };
}
