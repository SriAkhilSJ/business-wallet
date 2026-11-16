/**
 * Turns the inputs plus the stored documents into a collection job: which
 * documents are in, which need a human, and how the result answers the note.
 *
 * Pure: no storage, no clock, no network. Tests call it directly.
 */
import type { Category } from "../config";
import { formatDateDisplay } from "../dates";
import { parseNote, type WantedItem } from "./request";

export interface CollectInput {
  from: string;
  to: string;
  minAmount: number | null;
  maxAmount: number | null;
  note: string;
  /** Ignore the period entirely: collect every document. */
  allDates?: boolean;
}

export interface JobSourceDoc {
  id: string;
  originalFilename: string;
  category: Category;
  documentDate: string | null;
  createdAt: string;
  /** Read from the document, or null when nothing has read it. */
  amount?: number | null;
  /** SHA-256 of the bytes, for duplicate detection. */
  contentHash?: string | null;
  /** Source provenance (upload, gmail, drive, ...). */
  sourceType?: string | null;
  /** Used as a duplicate key when no hash exists (older rows). */
  fileSize?: number;
}

export type Decision = "include" | "review" | "duplicate" | "excluded";

export interface JobItem {
  id: string;
  filename: string;
  category: Category;
  date: string;
  sourceType?: string | null;
  inPeriod: boolean;
  /** False until someone confirms what the document is. */
  confirmed: boolean;
  decision: Decision;
  reasons: string[];
  /** Null until amounts can actually be read. */
  amount: number | null;
}

export type ChecklistStatus = "found" | "review" | "missing" | "download" | "cannot";

export interface ChecklistRow {
  id: string;
  label: string;
  status: ChecklistStatus;
  count: number;
  hint?: string;
}

export interface CollectionJob {
  input: CollectInput;
  periodLabel: string;
  items: JobItem[];
  checklist: ChecklistRow[];
  alsoFound: { id: string; filename: string; category: Category }[];
  counts: {
    discovered: number;
    inPeriod: number;
    included: number;
    needsReview: number;
    excluded: number;
    amountUnread: number;
  };
  noteItems: WantedItem[];
}

function matchesWanted(wanted: WantedItem, item: JobItem): boolean {
  if (wanted.kind === "download") return false;
  if (wanted.narrow) {
    return wanted.narrow.some((word) => item.filename.toLowerCase().includes(word));
  }
  return wanted.categories.includes(item.category);
}

export function buildCollectionJob(
  input: CollectInput,
  docs: JobSourceDoc[],
  options: { wanted?: WantedItem[]; selection?: Record<string, string[]> } = {},
): CollectionJob {
  const noteItems = options.wanted ?? parseNote(input.note);
  const wantedDocs = noteItems.filter((item) => item.kind === "document");
  const selectedIds = options.selection
    ? new Set(Object.values(options.selection).flat())
    : null;

  const items: JobItem[] = [];
  const alsoFound: CollectionJob["alsoFound"] = [];
  const seenHashes = new Map<string, string>();
  let amountUnread = 0;

  for (const doc of docs) {
    const date = doc.documentDate ?? "";
    const inPeriod =
      input.allDates === true || date === "" || (date >= input.from && date <= input.to);
    // A category of "Other" means nobody has said what this is yet.
    const confirmed = doc.category !== "Other";

    const item: JobItem = {
      id: doc.id,
      filename: doc.originalFilename,
      category: doc.category,
      date,
      sourceType: doc.sourceType ?? null,
      inPeriod,
      confirmed,
      decision: "include",
      reasons: [],
      amount: doc.amount ?? null,
    };

    if (!inPeriod) {
      item.decision = "excluded";
      item.reasons.push(`dated ${date}, outside the selected period`);
      items.push(item);
      continue;
    }

    if (
      item.amount != null &&
      ((input.minAmount != null && item.amount < input.minAmount) ||
        (input.maxAmount != null && item.amount > input.maxAmount))
    ) {
      item.decision = "excluded";
      item.reasons.push(`amount ${item.amount} is outside the selected range`);
      items.push(item);
      continue;
    }

    const duplicateKey =
      doc.contentHash ??
      (doc.fileSize ? `${doc.originalFilename.toLowerCase()}|${doc.fileSize}` : null);

    if (duplicateKey) {
      const first = seenHashes.get(duplicateKey);
      if (first) {
        item.decision = "duplicate";
        item.reasons.push(`the same file as “${first}”`);
        items.push(item);
        continue;
      }
      seenHashes.set(duplicateKey, doc.originalFilename);
    }

    if (selectedIds) {
      if (!selectedIds.has(doc.id)) {
        item.decision = "excluded";
        item.reasons.push("the collection plan did not select this document");
        alsoFound.push({ id: doc.id, filename: doc.originalFilename, category: doc.category });
        items.push(item);
        continue;
      }
    } else if (wantedDocs.length > 0 && !wantedDocs.some((w) => matchesWanted(w, item))) {
      item.decision = "excluded";
      item.reasons.push("not one of the items asked for in the note");
      alsoFound.push({ id: doc.id, filename: doc.originalFilename, category: doc.category });
      items.push(item);
      continue;
    }

    if (!confirmed) {
      item.decision = "review";
      item.reasons.push("nobody has confirmed what this document is yet");
    }

    amountUnread += item.amount == null ? 1 : 0;
    items.push(item);
  }

  const inPeriod = items.filter((item) => item.inPeriod);
  const included = items.filter((item) => item.decision === "include");
  const review = items.filter((item) => item.decision === "review");

  const includedIds = new Set(included.map((item) => item.id));
  const checklist: ChecklistRow[] = noteItems.map((wanted) => {
    if (wanted.kind === "download") {
      return {
        id: wanted.id,
        label: wanted.label,
        status: "download",
        count: 0,
        hint: wanted.hint,
      };
    }

    if (wanted.kind === "cannot") {
      return {
        id: wanted.id,
        label: wanted.label,
        status: "cannot",
        count: 0,
        hint: wanted.hint,
      };
    }

    // When a collection plan exists, its selection is the answer: a file is
    // "found" only if the plan picked it and it survived review.
    if (options.selection) {
      const ids = options.selection[wanted.id] ?? [];
      const count = ids.filter((id) => includedIds.has(id)).length;
      return {
        id: wanted.id,
        label: wanted.label,
        status: count > 0 ? "found" : "missing",
        count,
      };
    }

    const matched = inPeriod.filter(
      (item) => item.decision !== "excluded" && matchesWanted(wanted, item),
    );
    const confirmedMatches = matched.filter((item) => item.decision === "include");

    if (confirmedMatches.length > 0) {
      return { id: wanted.id, label: wanted.label, status: "found", count: confirmedMatches.length };
    }
    if (matched.length > 0) {
      return {
        id: wanted.id,
        label: wanted.label,
        status: "review",
        count: matched.length,
        hint: "found, but needs your confirmation",
      };
    }
    return { id: wanted.id, label: wanted.label, status: "missing", count: 0 };
  });

  // When the note names no documents (empty, or only asks we cannot fulfil),
  // report what was actually selected instead of showing an empty checklist.
  if (noteItems.length === 0) {
    const byCategory = new Map<Category, number>();
    for (const item of included) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
    }
    for (const [category, count] of byCategory) {
      checklist.push({ id: category, label: category, status: "found", count });
    }
  }

  return {
    input,
    periodLabel: `${formatDateDisplay(input.from)} – ${formatDateDisplay(input.to)}`,
    items,
    checklist,
    alsoFound,
    noteItems,
    counts: {
      discovered: docs.length,
      inPeriod: inPeriod.length,
      included: included.length,
      needsReview: review.length,
      excluded: items.filter((item) => item.decision === "excluded").length,
      amountUnread,
    },
  };
}
