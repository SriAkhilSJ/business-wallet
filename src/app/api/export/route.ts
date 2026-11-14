import { contentDisposition, parseOrThrow, readJsonBody } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth/session";
import { monthLabel, zipFilename } from "@/lib/dates";
import { exportRequestSchema } from "@/lib/file-validation";
import { documentsForMonth } from "@/lib/filters";
import { AppError, jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { buildMonthlyArchive, type ArchiveItem } from "@/lib/zip";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { month, year } = parseOrThrow(
      exportRequestSchema,
      await readJsonBody(req),
      "Invalid export request.",
    );

    const store = await getStore();
    const all = await store.listDocuments(user.id);
    const docs = documentsForMonth(all, month, year);
    const label = monthLabel(month, year);

    if (docs.length === 0) {
      throw new AppError(
        404,
        "no_documents",
        `No documents found for ${label}. Upload documents or pick another month.`,
      );
    }

    const items: ArchiveItem[] = [];
    for (const doc of docs) {
      const stored = await store.readDocument(user.id, doc.id);
      items.push({ record: doc, bytes: stored?.bytes ?? null });
    }

    const business = await store.getBusinessForUser(user.id);
    const result = await buildMonthlyArchive(items, {
      businessName: business?.businessName ?? "BusinessVault",
      periodLabel: label,
      generatedAt: new Date().toISOString(),
    });

    if (!result.ok) {
      // Never produce a silently incomplete archive.
      throw new AppError(
        502,
        "missing_objects",
        `${result.missing.length} of ${docs.length} files are missing from storage, so the archive was not created. Missing: ${result.missing
          .map((d) => d.originalFilename)
          .join(", ")}`,
        {
          missing: result.missing.map((d) => d.originalFilename),
          documentCount: docs.length,
          period: label,
        },
      );
    }

    return new Response(result.zipBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDisposition(
          "attachment",
          zipFilename(month, year),
        ),
        "Content-Length": String(result.zipBytes.length),
        "Cache-Control": "private, no-store",
        "X-BusinessVault-Documents": String(docs.length),
        "X-BusinessVault-Period": label,
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
