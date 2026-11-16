/**
 * The job is defined by three inputs: a date range, an amount range, and an
 * optional free-text note. This module turns the note into a checklist.
 *
 * The catalogue is deliberately a fixed list, not an AI call. It is the part
 * that has to be predictable: if a CA asks for a bank statement, the app must
 * always answer "you have to download that", never guess.
 */
import type { Category } from "../config";

export type WantedKind = "document" | "download" | "cannot";

export interface WantedItem {
  id: string;
  label: string;
  kind: WantedKind;
  categories: Category[];
  keywords: string[];
  /** When set, only these words count (a narrow ask beats a broad category). */
  narrow?: string[];
  /** Shown when the app cannot fetch this itself. */
  hint?: string;
}

export const REQUEST_CATALOG: WantedItem[] = [
  {
    id: "electricity",
    label: "Electricity bill",
    kind: "document",
    categories: ["Utility Bill"],
    keywords: ["electricity", "power bill", "bescom"],
    narrow: ["electricity", "power", "bescom"],
  },
  {
    id: "internet",
    label: "Internet / phone bill",
    kind: "document",
    categories: ["Utility Bill"],
    keywords: ["internet", "broadband", "phone bill", "mobile bill"],
    narrow: ["internet", "broadband", "wifi", "wi-fi"],
  },
  {
    id: "rent",
    label: "Rent receipt",
    kind: "document",
    categories: ["Expense"],
    keywords: ["rent"],
    narrow: ["rent"],
  },
  {
    id: "purchases",
    label: "Purchase invoices",
    kind: "document",
    categories: ["Purchase Invoice"],
    keywords: ["purchase invoice", "purchase invoices", "vendor bill", "vendor bills", "purchase documents"],
  },
  {
    id: "sales",
    label: "Sales invoices",
    kind: "document",
    categories: ["Sales Invoice"],
    keywords: [
      "sales invoice",
      "sales invoices",
      "sale bill",
      "sale bills",
      "sales document",
      "sales documents",
      "sales",
    ],
  },
  {
    id: "upi",
    label: "UPI payment proofs",
    kind: "document",
    categories: ["Payment Proof"],
    keywords: ["upi", "payment proof", "payment proofs", "neft", "imps"],
  },
  {
    id: "receipts",
    label: "Expense receipts",
    kind: "document",
    categories: ["Receipt", "Expense"],
    keywords: ["receipts", "expense receipts", "bills", "expense bills"],
  },
  {
    id: "laptop",
    label: "Laptop purchase invoice",
    kind: "document",
    categories: ["Purchase Invoice"],
    keywords: ["laptop"],
    narrow: ["laptop"],
  },
  {
    id: "sms",
    label: "SMS / phone notifications",
    kind: "download",
    categories: [],
    keywords: ["sms", "notification", "notifications", "message", "messages", "text message", "text messages"],
    hint: "The app cannot read SMS or phone notifications. Screenshot or export them and add the files.",
  },
  {
    id: "bank",
    label: "Bank statement",
    kind: "download",
    categories: [],
    keywords: ["bank statement", "bank statements"],
    hint: "Download it from your bank's app or net banking — the app cannot reach your bank.",
  },
  {
    id: "creditcard",
    label: "Credit card statement",
    kind: "download",
    categories: [],
    keywords: ["credit card statement", "card statement"],
    hint: "Download it from your card app — the app cannot reach your card issuer.",
  },
  {
    id: "loan",
    label: "Loan / interest certificate",
    kind: "download",
    categories: [],
    keywords: ["loan statement", "interest certificate"],
    hint: "Ask your lender for this — the app cannot reach your lender.",
  },
];

/** Order matters: longer phrases first so "bank statement" beats "statement". */
/** A period the owner wrote in the note, e.g. "this month". */
export interface NotePeriod {
  from: string;
  to: string;
  label: string;
}

const MONTH_WORDS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

function monthRange(year: number, month: number): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/**
 * Dates written in the note. The form has date inputs, but people type
 * "this month" instead of setting them, and silently ignoring that looks like
 * the app did nothing.
 */
export function periodFromNote(note: string, today: string): NotePeriod | null {
  const text = note.toLowerCase();
  const [year, month, day] = today.split("-").map(Number);
  if (!year || !month || !day) return null;

  if (/\bthis month\b/.test(text)) {
    return { ...monthRange(year, month), label: "this month" };
  }

  if (/\blast month\b/.test(text)) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return { ...monthRange(prevYear, prevMonth), label: "last month" };
  }

  if (/\btoday\b/.test(text)) return { from: today, to: today, label: "today" };

  if (/\byesterday\b/.test(text)) {
    const date = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
    return { from: date, to: date, label: "yesterday" };
  }

  if (/\b(this|last) week\b/.test(text)) {
    const current = new Date(Date.UTC(year, month - 1, day));
    const mondayOffset = (current.getUTCDay() + 6) % 7;
    const monday = new Date(current);
    monday.setUTCDate(current.getUTCDate() - mondayOffset);
    if (/last week/.test(text)) monday.setUTCDate(monday.getUTCDate() - 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
      label: /last week/.test(text) ? "last week" : "this week",
    };
  }

  const monthWord = Object.keys(MONTH_WORDS).find((word) =>
    new RegExp(`\\b${word}\\b`).test(text),
  );
  if (monthWord) {
    const yearMatch = text.match(/\b(20\d{2})\b/);
    const chosenYear = yearMatch ? Number(yearMatch[1]) : year;
    return {
      ...monthRange(chosenYear, MONTH_WORDS[monthWord]),
      label: `${monthWord} ${chosenYear}`,
    };
  }

  return null;
}

export function parseNote(note: string): WantedItem[] {
  const normalised = note.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalised) return [];
  const haystack = ` ${normalised} `;

  const found: WantedItem[] = [];
  for (const item of REQUEST_CATALOG) {
    const hit = item.keywords.some((keyword) => haystack.includes(` ${keyword} `));
    if (hit && !found.some((f) => f.id === item.id)) found.push(item);
  }
  return found;
}
