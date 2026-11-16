import { z } from "zod";

import { MAX_FILES_PER_UPLOAD } from "@/lib/config";
import type { Category } from "@/lib/config";
import { parseOrThrow } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth/session";
import { documentMetadataSchema, listQuerySchema } from "@/lib/file-validation";
import { filterDocuments, summarizeDocuments } from "@/lib/filters";
import { badRequest, jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { ingest } from "@/lib/ingest";

const metadataListSchema = z.array(documentMetadataSchema);

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const params = url.searchParams;

    const filter = parseOrThrow(
      listQuerySchema,
      {
        month: params.get("month") ? Number(params.get("month")) : undefined,
        year: params.get("year") ? Number(params.get("year")) : undefined,
        category: params.get("category") || undefined,
        search: params.get("search") || undefined,
      },
      "Invalid filter values.",
    );

    const store = await getStore();
    const all = await store.listDocuments(user.id);
    return Response.json({
      documents: filterDocuments(all, filter),
      summary: summarizeDocuments(all),
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw badRequest("Upload must be sent as multipart form data.");
    }

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      throw badRequest("No files were uploaded.");
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      throw badRequest(
        `You can upload up to ${MAX_FILES_PER_UPLOAD} files at a time.`,
      );
    }

    let rawMeta: unknown;
    try {
      rawMeta = JSON.parse(String(form.get("meta") ?? "[]"));
    } catch {
      throw badRequest("Invalid upload metadata.");
    }
    const metas = parseOrThrow(
      metadataListSchema,
      rawMeta,
      "Invalid upload metadata.",
    );
    if (metas.length !== files.length) {
      throw badRequest("Upload metadata does not match the number of files.");
    }

    const ingestFiles = await Promise.all(
      files.map(async (file, i) => ({
        filename: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        size: file.size,
        documentDate: metas[i].documentDate,
        category: metas[i].category as Category,
      })),
    );

    const store = await getStore();
    const result = await ingest(store, user.id, ingestFiles);

    if (result.created.length === 0 && result.errors.length > 0) {
      return Response.json(
        {
          documents: [],
          errors: result.errors,
          notice: result.notice,
          error: {
            code: "upload_rejected",
            message: "None of the files were accepted. See errors for details.",
          },
        },
        { status: 400 },
      );
    }

    return Response.json(
      { documents: result.created, errors: result.errors, notice: result.notice },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err);
  }
}
