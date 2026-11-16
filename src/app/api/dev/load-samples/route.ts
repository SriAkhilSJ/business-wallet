/**
 * Loads the generated sample PDFs from sample-data/ into the local
 * development store so the full workflow can be demonstrated in one click.
 *
 * Dev-fallback mode only (404 in Supabase mode — use scripts/upload-samples.mjs
 * there). Skips files already uploaded, so clicking twice never duplicates.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

import { assertDevFallback, requireUser } from "@/lib/auth/session";
import { CATEGORIES } from "@/lib/config";
import { badRequest, jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { ingest } from "@/lib/ingest";

const manifestEntrySchema = z.object({
  file: z.string().min(1),
  category: z.enum(CATEGORIES),
  documentDate: z.string().min(10),
  title: z.string().optional(),
});

const manifestSchema = z.array(manifestEntrySchema);

export async function POST() {
  try {
    assertDevFallback();
    const user = await requireUser();
    const sampleDir = join(process.cwd(), "sample-data");

    let manifestRaw: string;
    try {
      manifestRaw = await readFile(join(sampleDir, "manifest.json"), "utf8");
    } catch {
      throw badRequest(
        "Sample files not found. Run `npm run samples:generate` first.",
      );
    }

    const manifest = parseManifest(manifestRaw);
    const store = await getStore();
    const existing = new Set(
      (await store.listDocuments(user.id)).map((d) => d.originalFilename),
    );

    const skipped: string[] = [];
    const errors: { filename: string; error: string }[] = [];

    const ingestFiles: { filename: string; bytes: Uint8Array; documentDate: string; category: (typeof CATEGORIES)[number] }[] = [];

    for (const entry of manifest) {
      if (existing.has(entry.file)) {
        skipped.push(entry.file);
        continue;
      }
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await readFile(join(sampleDir, entry.file)));
      } catch {
        errors.push({
          filename: entry.file,
          error: "Sample file is missing. Run `npm run samples:generate`.",
        });
        continue;
      }
      ingestFiles.push({
        filename: entry.file,
        bytes,
        documentDate: entry.documentDate,
        category: entry.category,
      });
    }

    const result = await ingest(store, user.id, ingestFiles);
    return Response.json(
      {
        documents: result.created,
        skipped,
        errors: [...errors, ...result.errors],
      },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err);
  }
}

function parseManifest(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw badRequest("sample-data/manifest.json is not valid JSON.");
  }
  const result = manifestSchema.safeParse(parsed);
  if (!result.success) {
    throw badRequest("sample-data/manifest.json has an unexpected shape.");
  }
  return result.data;
}
