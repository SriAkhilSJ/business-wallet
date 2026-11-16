import { Readable } from "node:stream";

import { z } from "zod";

import { contentDisposition, parseOrThrow, readJsonBody } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth/session";
import { buildArchiveStream } from "@/lib/collect/archive";
import { planCollection } from "@/lib/collect/intent";
import { buildCollectionJob, type JobSourceDoc } from "@/lib/collect/job";
import { parseNote, periodFromNote, type WantedItem } from "@/lib/collect/request";
import { todayUtcDate } from "@/lib/dates";
import { getMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { createJob, createJobDb, updateJob, updateJobDb } from "@/lib/jobs";
import { jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

const collectSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    minAmount: z.number().nonnegative().nullable().optional(),
    maxAmount: z.number().nonnegative().nullable().optional(),
    note: z.string().max(2000).optional(),
    allDates: z.boolean().optional(),
    download: z.boolean().optional(),
  })
  .refine((value) => value.from <= value.to, {
    message: "The start date must be on or before the end date.",
  })
  .refine(
    (value) =>
      value.minAmount == null ||
      value.maxAmount == null ||
      value.minAmount <= value.maxAmount,
    { message: "The minimum amount must not exceed the maximum." },
  );

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = parseOrThrow(
      collectSchema,
      await readJsonBody(req),
      "Check the dates and amounts.",
    );

    const store = await getStore();
    const [documents, business] = await Promise.all([
      store.listDocuments(user.id),
      store.getBusinessForUser(user.id),
    ]);

    const jobId = crypto.randomUUID();
    const mode = getMode();
    if (mode === "supabase") {
      const supabase = await createSupabaseServerClient();
      await createJobDb(supabase, jobId, business?.id ?? "", user.id, { from: body.from, to: body.to, note: body.note }, documents.length);
    } else {
      createJob(jobId, business?.id ?? "", user.id, { from: body.from, to: body.to, note: body.note }, documents.length);
    }

    const source: JobSourceDoc[] = documents.map((doc) => ({
      id: doc.id,
      originalFilename: doc.originalFilename,
      category: doc.category,
      documentDate: doc.documentDate,
      createdAt: doc.createdAt,
      amount: doc.amount ?? null,
      contentHash: doc.contentHash ?? null,
      fileSize: doc.fileSize,
      sourceType: doc.sourceType ?? null,
    }));

    const today = todayUtcDate();
    const catalogue = source.map((doc) => ({
      id: doc.id,
      name: doc.originalFilename,
      category: doc.category,
      date: doc.documentDate ?? doc.createdAt.slice(0, 10),
      amount: doc.amount ?? null,
      vendor: null as string | null,
    }));
    const plan = await planCollection(body.note ?? "", today, catalogue);

    const wanted: WantedItem[] = plan?.asks.length
      ? plan.asks.map((ask) => ({
          id: ask.id,
          label: ask.label,
          kind: ask.kind,
          categories: [],
          keywords: [],
          hint: ask.hint,
        }))
      : parseNote(body.note ?? "");

    const selection = plan?.asks.length
      ? Object.fromEntries(plan.asks.map((ask) => [ask.id, ask.documentIds]))
      : undefined;

    const period = plan?.period ?? periodFromNote(body.note ?? "", today);

    const job = buildCollectionJob(
      {
        from: period?.from ?? body.from,
        to: period?.to ?? body.to,
        minAmount: body.minAmount ?? null,
        maxAmount: body.maxAmount ?? null,
        note: body.note ?? "",
        allDates: body.allDates === true,
      },
      source,
      { wanted, selection },
    );

    // Mark the job complete.
    if (mode === "supabase") {
      const supabase = await createSupabaseServerClient();
      await updateJobDb(supabase, jobId, {
        status: "completed",
        progress: { discovered: source.length, processed: job.counts.included, failed: 0, total: source.length },
      });
    } else {
      updateJob(jobId, {
        status: "completed",
        progress: { discovered: source.length, processed: job.counts.included, failed: 0, total: source.length },
      });
    }
    if (!body.download) {
      return Response.json({
        jobId,
        job,
        businessName: business?.businessName ?? "My Business",
        periodFromNote: period?.label ?? null,
      });
    }

    const bytesById: Record<string, Uint8Array> = {};
    for (const item of job.items) {
      if (item.decision !== "include") continue;
      const stored = await store.readDocument(user.id, item.id);
      if (stored?.bytes) bytesById[item.id] = stored.bytes;
    }

    const archive = buildArchiveStream({
      job,
      businessName: business?.businessName ?? "My Business",
      bytesById,
      generatedAt: new Date(),
    });

    // Streamed, not buffered: the platform caps buffered responses at 4.5 MB.
    return new Response(
      Readable.toWeb(archive.nodeStream as Readable) as ReadableStream,
      {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": contentDisposition("attachment", archive.name),
          "Cache-Control": "private, no-store",
          "X-BusinessVault-Documents": String(job.counts.included),
          "X-BusinessVault-Duplicates": String(archive.duplicates.length),
        },
      },
    );
  } catch (err) {
    return jsonError(err);
  }
}
