import { z } from "zod";

import { parseOrThrow, readJsonBody } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth/session";
import { isValidCalendarDate } from "@/lib/dates";
import { jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";

const schema = z.object({
  filename: z.string().trim().min(1).max(255),
  documentDate: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidCalendarDate(value), {
      message: "Document date must be a valid date.",
    })
    .optional()
    .transform((value) => (value && value !== "" ? value : null)),
});

/**
 * Hands the browser a short-lived URL so the file goes straight to Storage.
 * 501 means "this adapter cannot do that": the client falls back to multipart.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = parseOrThrow(
      schema,
      await readJsonBody(req),
      "Check the file name and date.",
    );

    const store = await getStore();
    if (!store.createSignedUpload) {
      return Response.json(
        { error: { code: "not_supported", message: "Direct upload is not available in this mode." } },
        { status: 501 },
      );
    }

    const target = await store.createSignedUpload(user.id, {
      filename: input.filename,
      documentDate: input.documentDate,
    });

    if (!target) {
      return Response.json(
        { error: { code: "not_supported", message: "Direct upload is not available in this mode." } },
        { status: 501 },
      );
    }

    return Response.json(target, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
