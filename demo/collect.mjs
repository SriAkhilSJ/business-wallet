#!/usr/bin/env node
/**
 * BusinessVault — collection demo
 *
 * Simulates the whole POC loop without a phone, a native app, or credentials:
 *
 *   sources (photos / files / sms / notifications / whatsapp / email / drive)
 *     -> discover
 *     -> classify + confidence
 *     -> de-duplicate by content hash
 *     -> auto-accept high confidence, queue the uncertain ones
 *     -> pack the approved ones into a ZIP, one folder per category
 *
 * Run:
 *   node demo/collect.mjs                 # leaves uncertain docs in the queue
 *   node demo/collect.mjs --approve-all   # approves the queue, full pack
 */
import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

import { classify } from "./lib/classify.mjs";
import { parseRequest, buildChecklist } from "./lib/request.mjs";
import { buildZip } from "./lib/zip.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sourcesDir = join(here, "sources");
const outDir = join(here, "out");

const args = new Set(process.argv.slice(2));
const approveAll = args.has("--approve-all");

const config = JSON.parse(await readFile(join(here, "config.json"), "utf8"));

// The job starts with what the CA asked for, not with a date picker.
let requestText = null;
try {
  requestText = await readFile(join(sourcesDir, "request.txt"), "utf8");
} catch {
  /* no request file: fall back to the configured range */
}
const request = requestText
  ? parseRequest(requestText, Number(config.range.from.slice(0, 4)))
  : { raw: null, period: null, wanted: [], deadline: null };

const { from, to } = request.period ?? config.range;
const { autoAccept, review: reviewThreshold } = config.thresholds;

const TEXT_EXT = new Set([".txt", ".eml", ".md"]);
const MIME = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
  ".eml": "message/rfc822",
};

/* ----------------------------- discovery ---------------------------- */

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

function sourceOf(absPath) {
  return absPath.slice(sourcesDir.length + 1).split(/[\\/]/)[0];
}

function relative(absPath) {
  return absPath.slice(sourcesDir.length + 1).split("\\").join("/");
}

const files = [];
for (const source of config.sources) {
  const found = await walk(join(sourcesDir, source));
  for (const f of found) {
    if (basename(f).toUpperCase().startsWith("README")) continue;
    files.push(f);
  }
}

/* ------------------------------ pipeline ---------------------------- */

const started = new Date();
const items = [];
const seenHashes = new Map();
let index = 0;

const ordered = [...files].sort((a, b) => {
  // Prefer the original over a "file (1).pdf" copy when both exist.
  const pa = /\(\d+\)/.test(basename(a)) ? 1 : 0;
  const pb = /\(\d+\)/.test(basename(b)) ? 1 : 0;
  if (pa !== pb) return pa - pb;
  return a.localeCompare(b);
});

for (const absPath of ordered) {
  index += 1;
  const rel = relative(absPath);
  const ext = extname(rel).toLowerCase();
  const filename = basename(rel);
  const bytes = await readFile(absPath);
  const info = await stat(absPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const text = TEXT_EXT.has(ext) ? bytes.toString("utf8").slice(0, 8000) : null;

  const item = {
    id: `item-${String(index).padStart(2, "0")}`,
    source: sourceOf(absPath),
    path: rel,
    filename,
    mime: MIME[ext] ?? "application/octet-stream",
    size: info.size,
    sha256,
    date: null,
    amount: null,
    vendor: null,
    category: "Other",
    confidence: 0,
    status: "discovered",
    reasons: [],
  };

  // 1. duplicate check on content, not filename
  const firstSeen = seenHashes.get(sha256);
  if (firstSeen) {
    item.status = "duplicate";
    item.duplicateOf = firstSeen;
    item.reasons.push(`identical bytes to ${firstSeen}`);
    items.push(item);
    console.log(`[${index}/${files.length}] ${rel} -> duplicate of ${firstSeen}`);
    continue;
  }
  seenHashes.set(sha256, rel);

  // 2. classify
  const result = classify({ filename, text, mime: item.mime });
  Object.assign(item, {
    category: result.category,
    confidence: result.confidence,
    date: result.date,
    amount: result.amount,
    vendor: result.vendor,
    reasons: result.reasons,
  });
  item.haystack = `${filename}\n${text ?? ""}`.toLowerCase();

  // 3. not a document at all
  if (result.nonDocument) {
    item.status = "ignored";
    item.reasons.push("not a financial document");
    items.push(item);
    console.log(`[${index}/${files.length}] ${rel} -> ignored (not a document)`);
    continue;
  }

  // 4. outside the selected period
  if (item.date && (item.date < from || item.date > to)) {
    item.status = "out_of_range";
    item.reasons.push(`dated ${item.date}, outside ${from}..${to}`);
    items.push(item);
    console.log(`[${index}/${files.length}] ${rel} -> out of range (${item.date})`);
    continue;
  }

  // 5. confidence routing
  if (item.confidence >= autoAccept) {
    item.status = "auto";
  } else if (item.confidence >= reviewThreshold) {
    item.status = "needs_review";
  } else {
    item.status = "ignored";
    item.reasons.push("confidence below review threshold");
  }

  items.push(item);
  const tag =
    item.status === "auto"
      ? "auto"
      : item.status === "needs_review"
        ? "review"
        : "ignored";
  console.log(
    `[${index}/${files.length}] ${rel} -> ${item.category} ${item.confidence.toFixed(2)} ${tag}`,
  );
}

/* ---------------------------- review queue -------------------------- */

const review = items.filter((i) => i.status === "needs_review");
const reviewFound = review.length;
if (approveAll) {
  for (const item of review) {
    item.status = "approved";
    item.reviewedBy = "demo-operator";
  }
}

/* ------------------------------- export ----------------------------- */

await mkdir(outDir, { recursive: true });

const exported = items.filter((i) => i.status === "auto" || i.status === "approved");
const duplicates = items.filter((i) => i.status === "duplicate");
const ignored = items.filter((i) => i.status === "ignored");
const outOfRange = items.filter((i) => i.status === "out_of_range");
const pending = items.filter((i) => i.status === "needs_review");

const [y, m] = from.split("-").map(Number);
const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", {
  month: "long",
  timeZone: "UTC",
});
const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
const zipName =
  from === `${y}-${String(m).padStart(2, "0")}-01` &&
  to === `${y}-${String(m).padStart(2, "0")}-${lastDay}`
    ? `BusinessVault_${monthName}_${y}.zip`
    : `BusinessVault_${from}_to_${to}.zip`;

function safeName(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

const used = new Set();
function uniqueName(category, original) {
  const base = safeName(original);
  let name = `${category}/${base}`;
  let n = 2;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  while (used.has(name.toLowerCase())) {
    name = `${category}/${stem} (${n})${ext}`;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

const entries = [];
const rows = [];

for (const item of exported) {
  const entryName = uniqueName(item.category, item.filename);
  item.exportName = entryName;
  entries.push({ name: entryName, data: await readFile(join(sourcesDir, item.path)) });
  rows.push(item);
}

const fmtDate = (d) =>
  d
    ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "date unknown";

const unread = items.filter(
  (item) =>
    item.category === "Other" &&
    (item.status === "needs_review" || item.status === "approved"),
);
const checklist = buildChecklist(
  request,
  exported.map((item) => ({ ...item, haystack: item.haystack ?? "" })),
  unread,
);

const manifest = [
  `${config.businessName} — BusinessVault pack`,
  `Period: ${fmtDate(from)} to ${fmtDate(to)}`,
  `Generated: ${started.toISOString()}`,
  `Documents: ${entries.length}`,
  "",
  "NOTE: documents with no date use the date the file was received.",
  "",
  ...(checklist.length > 0
    ? [
        "WHAT YOUR CA ASKED FOR",
        ...checklist.map(
          (c) =>
            `  [${c.status === "covered" ? "x" : " "}] ${c.label}` +
            (c.status === "covered"
              ? ` — ${c.matches.length} file(s)`
              : ` — ${c.hint ?? "not found"}`),
        ),
        "",
      ]
    : []),
  ...rows.map(
    (item, i) =>
      `${i + 1}. ${item.exportName} — ${item.category} — ${fmtDate(item.date)} — ${item.source} — confidence ${item.confidence.toFixed(2)}`,
  ),
  "",
];

if (pending.length > 0) {
  manifest.push(`NEEDS REVIEW (${pending.length}) — not included in this pack:`);
  for (const item of pending) {
    manifest.push(
      `  - ${item.filename} (${item.source}) — best guess: ${item.category} — confidence ${item.confidence.toFixed(2)}`,
    );
  }
  manifest.push("");
}

if (duplicates.length > 0) {
  manifest.push(`SKIPPED AS DUPLICATES (${duplicates.length}):`);
  for (const item of duplicates) {
    manifest.push(`  - ${item.filename} (${item.source}) — same file as ${item.duplicateOf}`);
  }
  manifest.push("");
}

entries.push({ name: "_manifest.txt", data: Buffer.from(manifest.join("\n"), "utf8") });

if (request.raw) {
  entries.push({ name: "_request.txt", data: Buffer.from(request.raw, "utf8") });
}
if (checklist.length > 0) {
  const coverageText = checklist
    .map(
      (c) =>
        `${c.status === "covered" ? "FOUND" : "MISSING"} | ${c.label} | ${
          c.status === "covered" ? `${c.matches.length} file(s)` : c.hint ?? "not found"
        }`,
    )
    .join("\n");
  entries.push({ name: "_coverage.txt", data: Buffer.from(coverageText, "utf8") });
}

const csv = [
  "file,category,date,source,confidence,status",
  ...items.map((item) =>
    [
      `"${item.filename}"`,
      item.category,
      item.date ?? "",
      item.source,
      item.confidence.toFixed(2),
      item.status,
    ].join(","),
  ),
].join("\n");
entries.push({ name: "_index.csv", data: Buffer.from(csv, "utf8") });

const zipBytes = buildZip(entries);
await writeFile(join(outDir, zipName), zipBytes);

/* ------------------------------- report ----------------------------- */

const report = {
  jobId: `demo-${started.toISOString().replace(/[:.]/g, "-")}`,
  businessName: config.businessName,
  range: { from, to },
  sources: config.sources,
  startedAt: started.toISOString(),
  finishedAt: new Date().toISOString(),
  counts: {
    discovered: items.length,
    autoAccepted: items.filter((i) => i.status === "auto").length,
    approvedFromReview: items.filter((i) => i.status === "approved").length,
    needsReview: pending.length,
    duplicates: duplicates.length,
    ignored: ignored.length,
    outOfRange: outOfRange.length,
    exported: entries.filter((e) => !e.name.startsWith("_")).length,
  },
  bytesWritten: zipBytes.length,
  request: {
    text: request.raw,
    period: request.period,
    deadline: request.deadline,
  },
  checklist,
  outputs: { zip: `${zipName}`, reviewQueue: "review-queue.json", report: "report.json" },
  items,
};

await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
await writeFile(
  join(outDir, "review-queue.json"),
  JSON.stringify(
    {
      note: "Approve or reject these, then re-run with --approve-all (demo) or from the review screen.",
      items: pending.map((i) => ({
        id: i.id,
        filename: i.filename,
        source: i.source,
        suggestedCategory: i.category,
        confidence: i.confidence,
        reasons: i.reasons,
      })),
    },
    null,
    2,
  ),
);

/* ------------------------------- output ----------------------------- */

const label = (s) => s.padEnd(18);
console.log("");
console.log("─".repeat(64));
console.log(`  ${config.businessName}   ${fmtDate(from)} → ${fmtDate(to)}`);
console.log("─".repeat(64));
console.log(`  ${label("Found")}${items.length} files across ${config.sources.length} sources`);
console.log(`  ${label("Auto-sorted")}${report.counts.autoAccepted}`);
console.log(`  ${label("Needs you")}${reviewFound}${approveAll && reviewFound ? " (approved for this run)" : ""}`);
console.log(`  ${label("Duplicates")}${duplicates.length}`);
console.log(`  ${label("Not documents")}${ignored.length}`);
console.log(`  ${label("Out of period")}${outOfRange.length}`);
console.log(`  ${label("In the ZIP")}${report.counts.exported}`);
if (checklist.length > 0) {
  console.log("─".repeat(64));
  console.log("  What the CA asked for:");
  for (const c of checklist) {
    const mark = c.status === "covered" ? "OK  " : "MISS";
    const detail =
      c.status === "covered" ? `${c.matches.length} file(s)` : c.hint ?? "not found";
    console.log(`   ${mark} ${c.label.padEnd(24)} ${detail}`);
  }
}
console.log("─".repeat(64));
console.log(`  ZIP:    demo/out/${zipName}  (${(zipBytes.length / 1024).toFixed(0)} KB)`);
console.log(`  Report: demo/out/report.json`);
console.log(`  Review: demo/out/review-queue.json`);
console.log("─".repeat(64));
