/**
 * Pure document filtering and summary logic, shared by API routes and the
 * dashboard so both runtime modes behave identically.
 */
import type { Category } from "./config";
import { CATEGORIES } from "./config";
import { effectiveDateOf, monthKey, pad2, todayUtcDate } from "./dates";
import type { DocumentRecord } from "./types";

export interface DocumentFilter {
  month?: number | null;
  year?: number | null;
  category?: Category | null;
  search?: string | null;
}

/** Newest effective date first; stable tiebreak on createdAt then id. */
export function sortDocuments(docs: DocumentRecord[]): DocumentRecord[] {
  return [...docs].sort((a, b) => {
    const da = effectiveDateOf(a);
    const db = effectiveDateOf(b);
    if (da !== db) return da < db ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

export function filterDocuments(
  docs: DocumentRecord[],
  filter: DocumentFilter,
): DocumentRecord[] {
  const search = filter.search?.trim().toLowerCase() || null;
  return sortDocuments(
    docs.filter((doc) => {
      if (filter.category && doc.category !== filter.category) return false;

      if (filter.month || filter.year) {
        const key = monthKey(effectiveDateOf(doc));
        if (filter.year && key.slice(0, 4) !== String(filter.year)) return false;
        if (filter.month && key.slice(5, 7) !== pad2(filter.month)) return false;
      }

      if (search && !doc.originalFilename.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    }),
  );
}

/** Documents belonging to one specific month (used by the ZIP export). */
export function documentsForMonth(
  docs: DocumentRecord[],
  month: number,
  year: number,
): DocumentRecord[] {
  return filterDocuments(docs, { month, year });
}

export interface DocumentSummary {
  total: number;
  currentMonthCount: number;
  byCategory: Record<Category, number>;
  recent: DocumentRecord[];
}

export function summarizeDocuments(
  docs: DocumentRecord[],
  today: string = todayUtcDate(),
): DocumentSummary {
  const byCategory = Object.fromEntries(
    CATEGORIES.map((c) => [c, 0]),
  ) as Record<Category, number>;
  let currentMonthCount = 0;
  const currentMonthPrefix = today.slice(0, 7);

  for (const doc of docs) {
    byCategory[doc.category] += 1;
    if (effectiveDateOf(doc).slice(0, 7) === currentMonthPrefix) {
      currentMonthCount += 1;
    }
  }

  return {
    total: docs.length,
    currentMonthCount,
    byCategory,
    recent: sortDocuments(docs).slice(0, 5),
  };
}
