import { z } from "zod";

import { parseOrThrow, readJsonBody } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth/session";
import { CATEGORIES, MAX_FILE_SIZE_BYTES } from "@/lib/config";
import { isValidCalendarDate } from "@/lib/dates";
import { badRequest, jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";

const schema = z.object({
  storagePath: z.string().min(1).max(512),
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "text/plain"]),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  category: z.enum(CATEGORIES),
  documentDate: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidCalendarDate(value), {
      message: "Document date must be a valid date.",
    })
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
});

/** Records a file the browser uploaded directly to Storage. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = parseOrThrow(
      schema,
      await readJsonBody(req),
      "Check the file details.",
    );

    const store = await getStore();
    if (!store.registerUploadedDocument) {
      throw badRequest("Direct upload is not available in this mode.");
    }

    const record = await store.registerUploadedDocument(user.id, {
      storagePath: input.storagePath,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      documentDate: input.documentDate,
      category: input.category,
    });

    return Response.json(
      { document: record, duplicateOf: record.duplicateOf ?? null },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err);
  }
}
