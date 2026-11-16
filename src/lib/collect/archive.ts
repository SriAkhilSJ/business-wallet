/**
 * Packs an accepted collection job into a ZIP: one folder per category, a
 * contents list, the coverage sheet, and the inputs that produced it.
 *
 * Two rules, both learned the hard way in this repo:
 *  - Never produce a silently incomplete archive. A missing object aborts.
 *  - Never drop a file without saying so. Everything left out is described.
 */
import { createHash } from "node:crypto";

import JSZip from "jszip";

import { AppError } from "../errors";
import { uniqueFilename } from "../filenames";
import { formatDateDisplay, zipFilename } from "../dates";
import type { CollectionJob, JobItem } from "./job";

export interface ArchiveInput {
  job: CollectionJob;
  businessName: string;
  bytesById: Record<string, Uint8Array>;
  generatedAt: Date;
}

export interface ArchiveResult {
  name: string;
  bytes: Uint8Array;
  duplicates: string[];
}

interface PreparedArchive {
  name: string;
  entries: { name: string; data: Uint8Array }[];
  duplicates: string[];
}

export function archiveFilename(job: CollectionJob): string {
  const { from, to } = job.input;
  const [year, month, day] = from.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isFullMonth =
    day === 1 && to === `${job.input.from.slice(0, 8)}${String(lastDay).padStart(2, "0")}`;
  return isFullMonth
    ? zipFilename(month, year)
    : `BusinessVault_${from}_to_${to}.zip`;
}

function coverageLine(row: CollectionJob["checklist"][number]): string {
  switch (row.status) {
    case "found":
      return `FOUND | ${row.label} | ${row.count} file(s)`;
    case "review":
      return `REVIEW | ${row.label} | ${row.hint ?? "needs confirmation"}`;
    case "download":
      return `DOWNLOAD | ${row.label} | ${row.hint ?? "you have to fetch this yourself"}`;
    case "cannot":
      return `CANNOT | ${row.label} | ${row.hint ?? "the app cannot read this; screenshot or export it"}`;
    case "missing":
      return `MISSING | ${row.label} | not found`;
  }
}

export async function buildArchive(input: ArchiveInput): Promise<ArchiveResult> {
  const prepared = prepareArchive(input);
  const zip = new JSZip();
  for (const entry of prepared.entries) zip.file(entry.name, entry.data);
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { name: prepared.name, bytes, duplicates: prepared.duplicates };
}

/**
 * Same archive, delivered as a Node stream. Streaming responses are exempt
 * from the hosting platform's 4.5 MB response cap, so a full month works.
 */
export function buildArchiveStream(input: ArchiveInput): {
  name: string;
  duplicates: string[];
  nodeStream: NodeJS.ReadableStream;
} {
  const prepared = prepareArchive(input);
  const zip = new JSZip();
  for (const entry of prepared.entries) zip.file(entry.name, entry.data);
  return {
    name: prepared.name,
    duplicates: prepared.duplicates,
    nodeStream: zip.generateNodeStream({
      type: "nodebuffer",
      streamFiles: true,
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }),
  };
}

function prepareArchive(input: ArchiveInput): PreparedArchive {
  const { job, businessName, bytesById, generatedAt } = input;

  // 1. Refuse to build if anything selected has no bytes. A pack that is
  //    quietly short is worse than no pack.
  const selected = job.items.filter((item) => item.decision === "include");
  const missing = selected.filter((item) => !bytesById[item.id]);
  if (missing.length > 0) {
    throw new AppError(
      502,
      "missing_objects",
      `${missing.length} selected file(s) could not be read, so the pack was not created. Missing: ${missing
        .map((item) => item.filename)
        .join(", ")}`,
      { missing: missing.map((item) => item.filename) },
    );
  }

  // 2. De-duplicate by content, not by name.
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  const unique: JobItem[] = [];
  for (const item of selected) {
    const hash = createHash("sha256").update(bytesById[item.id]).digest("hex");
    const first = seen.get(hash);
    if (first) {
      duplicates.push(`${item.filename} (same file as ${first})`);
      continue;
    }
    seen.set(hash, item.filename);
    unique.push(item);
  }

  const used = new Set<string>();
  const entries: { name: string; data: Uint8Array }[] = [];
  const packed: { entry: string; item: JobItem }[] = [];

  for (const item of unique) {
    const entry = `${item.category}/${uniqueFilename(used, item.filename)}`;
    entries.push({ name: entry, data: bytesById[item.id] });
    packed.push({ entry, item });
  }

  const lines = [
    `${businessName} — BusinessVault pack`,
    `Period: ${job.periodLabel}`,
    `Generated: ${generatedAt.toISOString()}`,
    `Documents: ${packed.length}`,
    "",
  ];

  if (job.input.note.trim()) {
    lines.push(`Asked for: ${job.input.note.trim()}`, "");
  }

  if (job.checklist.length > 0) {
    lines.push("COVERAGE");
    for (const row of job.checklist) {
      const mark =
        row.status === "found" ? "[x]" : row.status === "download" || row.status === "cannot" ? "[>]" : "[ ]";
      lines.push(`  ${mark} ${row.label} — ${coverageLine(row).split(" | ")[2]}`);
    }
    lines.push("");
  }

  lines.push("CONTENTS");
  packed.forEach(({ entry, item }, i) => {
    lines.push(
      `  ${i + 1}. ${entry} — ${item.date ? formatDateDisplay(item.date) : "date unknown"}`,
    );
  });
  lines.push("");

  if (duplicates.length > 0) {
    lines.push("DUPLICATES REMOVED (identical content)");
    for (const line of duplicates) lines.push(`  - ${line}`);
    lines.push("");
  }

  const review = job.items.filter((item) => item.decision === "review");
  if (review.length > 0) {
    lines.push("NEEDS CONFIRMATION (not included)");
    for (const item of review) lines.push(`  - ${item.filename}`);
    lines.push("");
  }

  if (job.alsoFound.length > 0) {
    lines.push("ALSO FOUND, NOT ASKED FOR (not included)");
    for (const item of job.alsoFound) {
      lines.push(`  - ${item.filename} (${item.category})`);
    }
    lines.push("");
  }

  const outside = job.items.filter((item) => !item.inPeriod);
  if (outside.length > 0) {
    lines.push("OUTSIDE THE PERIOD (not included)");
    for (const item of outside) {
      lines.push(`  - ${item.filename} — dated ${formatDateDisplay(item.date)}`);
    }
    lines.push("");
  }

  entries.push({ name: "_manifest.txt", data: Buffer.from(lines.join("\n"), "utf8") });

  entries.push({
    name: "_coverage.txt",
    data: Buffer.from(
      job.checklist.length > 0
        ? job.checklist.map(coverageLine).join("\n")
        : "No specific items were requested.",
      "utf8",
    ),
  });

  const amountNote =
    job.counts.amountUnread > 0
      ? "NOT APPLIED — amounts cannot be read yet, so no document was filtered by value."
      : "No amount range was set.";

  entries.push({
    name: "_request.txt",
    data: Buffer.from(
      [
        `From: ${job.input.from}`,
        `To: ${job.input.to}`,
        `Amount: ${job.input.minAmount ?? "any"} to ${job.input.maxAmount ?? "any"}`,
        `Amount filter: ${amountNote}`,
        `Note: ${job.input.note.trim() || "(empty — everything in the period)"}`,
      ].join("\n"),
      "utf8",
    ),
  });

  return { name: archiveFilename(job), entries, duplicates };
}
