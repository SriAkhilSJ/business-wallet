/**
 * Reads what the CA asked for and turns it into a job.
 *
 * The owner does not fill a form. They paste or forward the CA's message:
 *
 *   "Sharma ji, need the August accounts. Electricity bill, rent receipt,
 *    all purchase invoices, UPI payment proofs, laptop invoice, and the
 *    bank statement. By the 5th."
 *
 * This module extracts the period and the checklist. Everything after this is
 * just matching documents against that checklist.
 */

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const pad2 = (n) => String(n).padStart(2, "0");

/** The things a CA commonly asks for, and how to recognise them. */
export const CATALOG = [
  {
    id: "electricity",
    label: "Electricity bill",
    categories: ["Utility Bill"],
    keywords: ["electricity", "bescom", "power bill"],
  },
  {
    id: "rent",
    label: "Rent receipt",
    categories: ["Expense"],
    keywords: ["rent"],
  },
  {
    id: "purchases",
    label: "Purchase invoices",
    categories: ["Purchase Invoice"],
    keywords: ["purchase invoice", "purchase invoices", "bills from vendors"],
  },
  {
    id: "sales",
    label: "Sales invoices",
    categories: ["Sales Invoice"],
    keywords: ["sales invoice", "sales invoices", "sales bills"],
  },
  {
    id: "upi",
    label: "UPI payment proofs",
    categories: ["Payment Proof"],
    keywords: ["upi", "payment proof", "payment proofs", "neft", "imps"],
  },
  {
    id: "receipts",
    label: "Expense receipts",
    categories: ["Receipt"],
    keywords: ["receipts", "expense receipts", "bills"],
  },
  {
    id: "laptop",
    label: "Laptop purchase invoice",
    categories: ["Purchase Invoice"],
    keywords: ["laptop"],
    narrow: ["laptop"],
  },
  {
    id: "bank",
    label: "Bank statement",
    categories: ["Bank Statement"],
    keywords: ["bank statement", "bank statements", "statement"],
  },
];

export function periodFromText(text, fallbackYear) {
  const lower = text.toLowerCase();

  let month = null;
  for (const [name, number] of Object.entries(MONTHS)) {
    if (new RegExp(`\\b${name}\\b`).test(lower)) {
      month = number;
      break;
    }
  }

  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : fallbackYear;

  if (!month) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(lastDay)}`,
    label: `${Object.keys(MONTHS).find((k) => MONTHS[k] === month)} ${year}`,
  };
}

/**
 * @param {string} message the CA's message, as forwarded by the owner
 * @param {number} fallbackYear used when the message does not name a year
 */
export function parseRequest(message, fallbackYear = new Date().getUTCFullYear()) {
  const lower = message.toLowerCase();

  const period = periodFromText(message, fallbackYear);

  const wanted = CATALOG.filter((entry) =>
    entry.keywords.some((keyword) => lower.includes(keyword)),
  );

  return {
    raw: message.trim(),
    period,
    wanted,
    deadline: (message.match(/\bby the (\d{1,2})(?:st|nd|rd|th)?\b/i) ?? [])[1] ?? null,
  };
}

/**
 * Compare what was asked for against what is in the pack.
 *
 * @param {ReturnType<typeof parseRequest>} request
 * @param {Array<{category: string, filename: string, haystack: string, status: string}>} exported
 * @param {Array<{filename: string, category: string}>} pending review items
 */
export function buildChecklist(request, exported, pending) {
  return request.wanted.map((entry) => {
    const matches = exported.filter((doc) => {
      const byCategory = entry.categories.includes(doc.category);
      const terms = entry.narrow ?? entry.keywords;
      const byKeyword = terms.some((term) => doc.haystack.includes(term));
      // A narrow ask ("laptop invoice") must match the word, not the category.
      return entry.narrow ? byKeyword : byCategory || byKeyword;
    });

    if (matches.length > 0) {
      return { ...entry, status: "covered", matches: matches.map((m) => m.filename) };
    }

    // Nothing matched. Is there something unread that could be it?
    const maybe = pending.filter((item) => item.category === "Other");
    const names = maybe.slice(0, 3).map((m) => m.filename).join(", ");
    const more = maybe.length > 3 ? ` and ${maybe.length - 3} more` : "";
    return {
      ...entry,
      status: "missing",
      matches: [],
      hint:
        maybe.length > 0
          ? `not found — ${maybe.length} unread file(s) could be it: ${names}${more}`
          : "not found",
    };
  });
}
