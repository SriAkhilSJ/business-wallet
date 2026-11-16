/**
 * Reads a document with a vision model and returns what it says.
 *
 * One call per document. The model sees the file itself, so a phone photo, a
 * scanned PDF and a text PDF all take the same path — no OCR pipeline.
 *
 * Everything here degrades safely: if the call fails, times out, or returns
 * nonsense, the caller keeps whatever the human chose.
 */
import type { Category } from "../config";
import { isValidCalendarDate } from "../dates";
import { extractPdfText } from "./pdf-text";

export const CLASSIFIABLE_CATEGORIES: Category[] = [
  "Sales Invoice",
  "Purchase Invoice",
  "Expense",
  "Receipt",
  "Utility Bill",
  "Payment Proof",
  "Other",
];

export interface Classification {
  docType: Category;
  date: string | null;
  amount: number | null;
  vendor: string | null;
  gstin: string | null;
  confidence: number;
}

export const CLASSIFICATION_PROMPT = `You are reading a photo or scan of one Indian business document.
Return ONLY a JSON object, no prose:
{"docType": string, "vendor": string, "date": "YYYY-MM-DD", "amount": number, "gstin": string or null, "confidence": number between 0 and 1}

docType must be exactly one of these, chosen by these rules:
- "Utility Bill": electricity, water, gas, internet or phone bill from the utility provider.
- "Purchase Invoice": an invoice from a supplier or vendor for something the business bought.
- "Sales Invoice": an invoice issued BY this business TO its customer.
- "Receipt": a shop or counter receipt for goods bought over the counter.
- "Expense": rent (including a rent invoice or rent receipt), fuel, travel, supplies, salary.
- "Payment Proof": a UPI, NEFT, IMPS or bank confirmation that money was transferred.
- "Other": anything that does not fit.

Rules: amount is the grand total in rupees, digits only. date is the document date in ISO form. vendor is the business that issued the document.`;

function stripFences(text: string): string {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return start === -1 || end === -1 ? cleaned : cleaned.slice(start, end + 1);
}

const CATEGORY_ALIASES: Record<string, Category> = {
  "electricity bill": "Utility Bill",
  "power bill": "Utility Bill",
  "water bill": "Utility Bill",
  "gas bill": "Utility Bill",
  "internet bill": "Utility Bill",
  "phone bill": "Utility Bill",
  "utility": "Utility Bill",
  "utility bill": "Utility Bill",
  "purchase": "Purchase Invoice",
  "purchase bill": "Purchase Invoice",
  "purchase invoice": "Purchase Invoice",
  "supplier invoice": "Purchase Invoice",
  "vendor bill": "Purchase Invoice",
  "sales": "Sales Invoice",
  "sales bill": "Sales Invoice",
  "sales invoice": "Sales Invoice",
  "tax invoice": "Purchase Invoice",
  "rent": "Expense",
  "rent receipt": "Expense",
  "fuel": "Expense",
  "fuel receipt": "Expense",
  "travel": "Expense",
  "salary": "Expense",
  "receipt": "Receipt",
  "shop receipt": "Receipt",
  "payment": "Payment Proof",
  "payment proof": "Payment Proof",
  "upi": "Payment Proof",
  "bank transfer": "Payment Proof",
};

/**
 * Models answer with whatever wording they like ("electricity bill", "Rent
 * Receipt"). Rejecting that loses a correct answer, so map it onto our
 * vocabulary before deciding the document is unreadable.
 */
export function normalizeCategory(raw: string): Category | null {
  const value = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!value) return null;

  for (const category of CLASSIFIABLE_CATEGORIES) {
    if (category.toLowerCase() === value) return category;
  }
  if (CATEGORY_ALIASES[value]) return CATEGORY_ALIASES[value];

  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (value.includes(alias)) return category;
  }

  if (value.includes("utility") || value.includes("electric")) return "Utility Bill";
  if (value.includes("sales")) return "Sales Invoice";
  if (value.includes("invoice")) return "Purchase Invoice";
  if (value.includes("receipt")) return "Receipt";
  if (value.includes("payment") || value.includes("upi")) return "Payment Proof";
  if (value.includes("expense")) return "Expense";
  return null;
}

/** Validates a model reply. Returns null rather than trusting a wrong shape. */
export function parseClassification(raw: string): Classification | null {
  let value: unknown;
  try {
    value = JSON.parse(stripFences(raw));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const docType = record.docType;
  if (typeof docType !== "string") return null;
  const category = normalizeCategory(docType);
  if (!category) return null;

  const rawAmount = record.amount;
  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string"
        ? Number(rawAmount.replace(/[^\d.]/g, ""))
        : NaN;

  const rawDate = record.date;
  const date =
    typeof rawDate === "string" && isValidCalendarDate(rawDate.slice(0, 10))
      ? rawDate.slice(0, 10)
      : null;

  const confidence =
    typeof record.confidence === "number" && Number.isFinite(record.confidence)
      ? Math.max(0, Math.min(1, record.confidence))
      : 0;

  return {
    docType: category,
    date,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    vendor:
      typeof record.vendor === "string" && record.vendor.trim()
        ? record.vendor.trim().slice(0, 160)
        : null,
    gstin:
      typeof record.gstin === "string" && /^[0-9A-Z]{15}$/.test(record.gstin.trim())
        ? record.gstin.trim()
        : null,
    confidence,
  };
}

export function classificationConfig(): {
  baseUrl: string;
  apiKey: string;
  model: string;
} | null {
  const apiKey = process.env.VELONA_API_KEY;
  if (!apiKey) return null;
  return {
    baseUrl: process.env.VELONA_BASE_URL ?? "https://velona.in/v1",
    apiKey,
    model: process.env.VELONA_MODEL ?? "deepseek/deepseek-v4.1-flash-1017",
  };
}

const MAX_BYTES = 10 * 1024 * 1024;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function requestModel(content: ContentPart[]): Promise<Classification | null> {
  const config = classificationConfig();
  if (!config) return null;

  // One retry: upstream 503s and reasoning models returning an empty answer are
  // both transient, and losing a document to that is worse than paying twice.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          // Reasoning models spend tokens before answering; a small budget comes
          // back as finish_reason "length" with empty content.
          max_tokens: 2000,
          messages: [{ role: "user", content }],
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (!res.ok) continue;
      const body = (await res.json()) as {
        choices?: { message?: { content?: string | null } }[];
      };
      const answer = body.choices?.[0]?.message?.content;
      if (!answer) continue;

      const parsed = parseClassification(answer);
      if (parsed) return parsed;
    } catch {
      // fall through to the retry
    }
  }

  return null;
}

/**
 * Calls the model. Returns null on any failure — never throws at the caller.
 *
 * A PDF is read from its text layer, not as a picture: sending a PDF as an
 * image is rejected by the provider, which is why PDFs previously kept their
 * upload date and the category the uploader happened to pick.
 */
export async function classifyDocument(input: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<Classification | null> {
  if (input.bytes.length === 0 || input.bytes.length > MAX_BYTES) return null;
  if (!classificationConfig()) return null;

  if (input.mimeType === "application/pdf") {
    const text = await extractPdfText(input.bytes);
    // A scan has no text layer. Nothing to read, so it goes to review instead
    // of being guessed from its filename.
    if (text.trim().length < 40) return null;
    return requestModel([
      { type: "text", text: `${CLASSIFICATION_PROMPT}\n\nDOCUMENT TEXT:\n${text}` },
    ]);
  }

  if (input.mimeType === "text/plain") {
    const text = Buffer.from(input.bytes).toString("utf8").slice(0, 6000);
    if (text.trim().length < 20) return null;
    return requestModel([
      { type: "text", text: `${CLASSIFICATION_PROMPT}\n\nDOCUMENT TEXT:\n${text}` },
    ]);
  }

  const dataUrl = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString("base64")}`;
  return requestModel([
    { type: "text", text: CLASSIFICATION_PROMPT },
    { type: "image_url", image_url: { url: dataUrl } },
  ]);
}
