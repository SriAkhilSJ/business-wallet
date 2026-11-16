/**
 * Reads the owner's note with the model instead of a keyword list.
 *
 * A fixed list kept missing real phrasing ("extract all messages this month",
 * "sales documents"). The model returns a period and a list of asks; the
 * matcher stays deterministic and testable.
 */
import { CLASSIFIABLE_CATEGORIES } from "../classify/vision";
import type { Category } from "../config";
import type { WantedItem } from "./request";

export interface ParsedIntent {
  period: { from: string; to: string; label: string } | null;
  items: WantedItem[];
}

export const INTENT_PROMPT = `You read a business owner's request to collect documents for their accountant.

Return ONLY JSON, no prose:
{"period": {"from":"YYYY-MM-DD","to":"YYYY-MM-DD","label":"short label"} or null,
 "items": [{"label":"Electricity bill","category":"Utility Bill" or null,"match":["electricity"],"kind":"document"|"download"|"cannot","hint":"..."}]}

Rules:
- Resolve dates against TODAY, which is given to you. Understand "this month", "last month", "this week", "last week", "today", "yesterday", "August", "last 3 months". If no period is mentioned, period is null.
- Only include what the note asks for. If it asks for everything, return an empty items list.
- "kind" is exactly one of:
  - "document": the owner can have it as a photo, PDF or text file.
  - "download": a bank statement, credit-card statement or loan statement. The owner must fetch it; put the advice in "hint".
  - "cannot": SMS, WhatsApp messages, phone notifications or an email inbox. A web app cannot read those; "hint" says to screenshot, export or paste them.
- "category" must be one of ${JSON.stringify(CLASSIFIABLE_CATEGORIES)} or null.
- "match" is 1-3 short lowercase words likely to appear in the filename or text of that kind of document (e.g. ["electricity"], ["rent"], ["upi"]). Use [] when not applicable.
- Never invent an item that was not asked for.`;

function slug(label: string, index: number): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base ? base.slice(0, 40) : `item-${index + 1}`;
}

/** Validates the model's JSON and maps it onto the job vocabulary. */
export function parseIntentsJson(raw: string, today: string): ParsedIntent | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  let value: unknown;
  try {
    value = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  let period: ParsedIntent["period"] = null;
  const rawPeriod = record.period as Record<string, unknown> | null | undefined;
  if (rawPeriod && typeof rawPeriod === "object") {
    const from = String(rawPeriod.from ?? "").slice(0, 10);
    const to = String(rawPeriod.to ?? "").slice(0, 10);
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(from) && iso.test(to) && from <= to) {
      period = {
        from,
        to,
        label: String(rawPeriod.label ?? "").slice(0, 60) || `${from} to ${to}`,
      };
    }
  }

  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items: WantedItem[] = [];

  for (const [index, entry] of rawItems.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const label = String(item.label ?? "").trim().slice(0, 80);
    if (!label) continue;

    const rawKind = String(item.kind ?? "document");
    const kind =
      rawKind === "document"
        ? "document"
        : rawKind === "cannot"
          ? "cannot"
          : "download";

    const rawCategory = String(item.category ?? "");
    const category = (CLASSIFIABLE_CATEGORIES as string[]).includes(rawCategory)
      ? (rawCategory as Category)
      : null;

    const match = Array.isArray(item.match)
      ? item.match
          .map((word) => String(word).toLowerCase().trim())
          .filter((word) => word.length >= 3 && word.length <= 30)
          .slice(0, 3)
      : [];

    items.push({
      id: slug(label, index),
      label,
      kind,
      categories: category ? [category] : [],
      keywords: match,
      // A specific ask ("electricity") must not match every utility bill.
      narrow: match.length > 0 ? match : undefined,
      hint:
        typeof item.hint === "string" && item.hint.trim()
          ? item.hint.trim().slice(0, 200)
          : kind === "download"
            ? "You have to fetch this yourself."
            : undefined,
    });
  }

  // "Today" is accepted but unused; keeps the signature honest for callers.
  void today;
  return { period, items };
}

export const PLANNER_PROMPT = `You decide which of a business owner's documents satisfy their accountant's request.

Return ONLY JSON:
{"period": {"from":"YYYY-MM-DD","to":"YYYY-MM-DD","label":"..."} or null,
 "asks": [{"label":"Electricity bill","kind":"document"|"download"|"cannot","hint":"...","documentIds":["id", ...]}]}

Rules:
- Only use ids that appear in DOCUMENTS. Never invent an id.
- An ask with nothing matching gets an empty documentIds array. Do not pad it.
- Decide from the evidence on each document: vendor, filename, category, date and amount. Do not guess from the id itself.
- Resolve dates against TODAY. "this month", "last month", "this week", "August", "last 3 months". If no period is mentioned, period is null.
- If the note asks for everything in the period, return one ask "All documents" with every id that falls in the period.
- kind "cannot" for SMS, WhatsApp or phone notifications, with a hint to screenshot or export them. kind "download" for bank, card or loan statements.
- Do not invent an ask that was not requested.`;

export interface PlannedAsk {
  id: string;
  label: string;
  kind: "document" | "download" | "cannot";
  hint?: string;
  documentIds: string[];
}

export interface CollectionPlan {
  period: ParsedIntent["period"];
  asks: PlannedAsk[];
}

/** Validates the planner's JSON and drops any id it did not receive. */
export function parsePlanJson(raw: string, validIds: string[]): CollectionPlan | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;

  let value: unknown;
  try {
    value = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const known = new Set(validIds);
  let period: CollectionPlan["period"] = null;
  const rawPeriod = record.period as Record<string, unknown> | null | undefined;
  if (rawPeriod && typeof rawPeriod === "object") {
    const from = String(rawPeriod.from ?? "").slice(0, 10);
    const to = String(rawPeriod.to ?? "").slice(0, 10);
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(from) && iso.test(to) && from <= to) {
      period = {
        from,
        to,
        label: String(rawPeriod.label ?? "").slice(0, 60) || `${from} to ${to}`,
      };
    }
  }

  const rawAsks = Array.isArray(record.asks) ? record.asks : [];
  const asks: PlannedAsk[] = [];

  for (const [index, entry] of rawAsks.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const ask = entry as Record<string, unknown>;
    const label = String(ask.label ?? "").trim().slice(0, 80);
    if (!label) continue;

    const rawKind = String(ask.kind ?? "document");
    const kind =
      rawKind === "document"
        ? "document"
        : rawKind === "cannot"
          ? "cannot"
          : "download";

    const documentIds = Array.isArray(ask.documentIds)
      ? ask.documentIds
          .map((id) => String(id))
          .filter((id) => known.has(id))
      : [];

    asks.push({
      id: slug(label, index),
      label,
      kind,
      hint:
        typeof ask.hint === "string" && ask.hint.trim()
          ? ask.hint.trim().slice(0, 200)
          : undefined,
      documentIds: [...new Set(documentIds)],
    });
  }

  if (asks.length === 0 && !period) return null;
  return { period, asks };
}

export interface CatalogueDocument {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number | null;
  vendor: string | null;
}

export async function planCollection(
  note: string,
  today: string,
  documents: CatalogueDocument[],
): Promise<CollectionPlan | null> {
  const apiKey = process.env.VELONA_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.VELONA_BASE_URL ?? "https://velona.in/v1";
  const model = process.env.VELONA_MODEL ?? "deepseek/deepseek-v4.1-flash-1017";

  const catalogue = documents.slice(0, 120);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `${PLANNER_PROMPT}\n\nTODAY: ${today}\n\nOWNER'S NOTE:\n${note.trim()}\n\nDOCUMENTS:\n${JSON.stringify(catalogue)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    return parsePlanJson(content, catalogue.map((doc) => doc.id));
  } catch {
    return null;
  }
}

export async function readIntent(
  note: string,
  today: string,
): Promise<ParsedIntent | null> {
  const trimmed = note.trim();
  if (trimmed.length < 3) return { period: null, items: [] };

  const apiKey = process.env.VELONA_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.VELONA_BASE_URL ?? "https://velona.in/v1";
  const model = process.env.VELONA_MODEL ?? "deepseek/deepseek-v4.1-flash-1017";

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: `${INTENT_PROMPT}\n\nTODAY: ${today}\n\nOWNER'S NOTE:\n${trimmed}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseIntentsJson(content, today);
  } catch {
    return null;
  }
}
