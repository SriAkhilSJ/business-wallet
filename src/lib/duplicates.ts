/**
 * Multi-level duplicate detection. Each signal returns a 0..1 similarity;
 * the combined score is a weighted average of the signals that are available.
 * Exact file-hash matches short-circuit to 1.0 (identical bytes).
 *
 * Perceptual hashing for images is intentionally not implemented here: it needs
 * an image-decoding dependency not present in this repo. The seam (add a
 * `visual` signal) is left open for when that dependency lands.
 */
export interface DuplicateCandidate {
  a: string;
  b: string;
  score: number;
  signals: Record<string, number>;
  reason: string;
}

export interface DuplicateDoc {
  id: string;
  contentHash?: string | null;
  text?: string | null;
  invoiceNumber?: string | null;
  vendor?: string | null;
  date?: string | null;
  amount?: number | null;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const cur = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  const dist = prev[b.length];
  const max = Math.max(a.length, b.length);
  return 1 - dist / max;
}

export function textSimilarity(a: DuplicateDoc, b: DuplicateDoc): number {
  const ta = norm(a.text);
  const tb = norm(b.text);
  if (!ta || !tb) return 0;
  return levenshtein(ta, tb);
}

export function financialIdentity(a: DuplicateDoc, b: DuplicateDoc): number {
  let score = 0;
  let parts = 0;
  if (a.invoiceNumber && b.invoiceNumber) {
    parts++;
    if (norm(a.invoiceNumber) === norm(b.invoiceNumber)) score += 1;
  }
  if (a.vendor && b.vendor) {
    parts++;
    if (norm(a.vendor) === norm(b.vendor)) score += 1;
  }
  if (a.date && b.date) {
    parts++;
    if (a.date === b.date) score += 1;
  }
  if (a.amount != null && b.amount != null) {
    parts++;
    if (a.amount === b.amount) score += 1;
  }
  return parts === 0 ? 0 : score / parts;
}

export function exactHash(a: DuplicateDoc, b: DuplicateDoc): number {
  if (a.contentHash && b.contentHash && a.contentHash === b.contentHash) return 1;
  return 0;
}

const WEIGHTS = { hash: 0.5, text: 0.2, financial: 0.3 };

export function scorePair(a: DuplicateDoc, b: DuplicateDoc): DuplicateCandidate {
  const signals: Record<string, number> = {
    hash: exactHash(a, b),
    text: textSimilarity(a, b),
    financial: financialIdentity(a, b),
  };

  if (signals.hash === 1) {
    return { a: a.id, b: b.id, score: 1, signals, reason: "identical file bytes" };
  }

  const hasText = !!(a.text && b.text);
  const hasFinancial =
    !!(a.invoiceNumber || a.vendor || a.date || a.amount != null) &&
    !!(b.invoiceNumber || b.vendor || b.date || b.amount != null);

  let wSum = 0;
  let score = 0;
  if (hasText) {
    score += WEIGHTS.text * signals.text;
    wSum += WEIGHTS.text;
  }
  if (hasFinancial) {
    score += WEIGHTS.financial * signals.financial;
    wSum += WEIGHTS.financial;
  }
  const final = wSum > 0 ? score / wSum : 0;

  const reasons: string[] = [];
  if (hasFinancial && signals.financial === 1) reasons.push("same financial identity");
  if (hasText && signals.text > 0.8) reasons.push("similar text");
  if (reasons.length === 0) reasons.push("weak similarity");

  return { a: a.id, b: b.id, score: final, signals, reason: reasons.join("; ") };
}

export function detectDuplicates(docs: DuplicateDoc[], threshold = 0.7): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const c = scorePair(docs[i], docs[j]);
      if (c.score >= threshold) out.push(c);
    }
  }
  return out.sort((x, y) => y.score - x.score);
}