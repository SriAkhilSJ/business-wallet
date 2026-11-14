/**
 * Monthly ZIP archive assembly (pure): given already-fetched bytes it builds
 * the archive in memory and reports missing storage objects instead of
 * silently producing an incomplete archive.
 */
import JSZip from "jszip";

import { effectiveDateOf, formatDateDisplay, formatBytes } from "./dates";
import { sanitizeFilename, uniqueFilename } from "./filenames";
import type { DocumentRecord } from "./types";

export interface ArchiveItem {
  record: DocumentRecord;
  /** null when the storage object is missing. */
  bytes: Uint8Array | null;
}

export interface ArchiveMeta {
  businessName: string;
  periodLabel: string;
  generatedAt: string;
}

export type ArchiveResult =
  | { ok: true; zipBytes: Uint8Array; entryNames: Record<string, string> }
  | { ok: false; missing: DocumentRecord[] };

export function manifestText(
  items: { entryName: string; record: DocumentRecord }[],
  meta: ArchiveMeta,
): string {
  const lines: string[] = [
    `${meta.businessName} — Monthly Document Pack`,
    `Period: ${meta.periodLabel}`,
    `Generated: ${meta.generatedAt} (UTC)`,
    `Documents: ${items.length}`,
    "",
    "NOTE: Documents marked with no document date use their upload date.",
    "",
  ];
  items.forEach((item, index) => {
    const date = item.record.documentDate
      ? formatDateDisplay(item.record.documentDate)
      : `${formatDateDisplay(item.record.createdAt)} (upload date)`;
    lines.push(
      `${index + 1}. ${item.entryName} — ${item.record.category} — ${date} — ${formatBytes(item.record.fileSize)}`,
    );
    if (sanitizeFilename(item.record.originalFilename) !== item.entryName) {
      lines.push(`   (original filename: ${item.record.originalFilename})`);
    }
  });
  lines.push("");
  return lines.join("\n");
}

export async function buildMonthlyArchive(
  items: ArchiveItem[],
  meta: ArchiveMeta,
): Promise<ArchiveResult> {
  const missing = items
    .filter((item) => item.bytes === null)
    .map((item) => item.record);
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const ordered = [...items].sort((a, b) => {
    const da = effectiveDateOf(a.record);
    const db = effectiveDateOf(b.record);
    if (da !== db) return da < db ? -1 : 1;
    return a.record.originalFilename.localeCompare(b.record.originalFilename);
  });

  const zip = new JSZip();
  const used = new Set<string>();
  const named: { entryName: string; record: DocumentRecord }[] = [];
  const entryNames: Record<string, string> = {};

  for (const item of ordered) {
    const entryName = uniqueFilename(used, item.record.originalFilename);
    zip.file(entryName, item.bytes as Uint8Array);
    named.push({ entryName, record: item.record });
    entryNames[item.record.id] = entryName;
  }

  zip.file("manifest.txt", manifestText(named, meta));

  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { ok: true, zipBytes, entryNames };
}
