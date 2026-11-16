import { z } from "zod";

import { parseOrThrow, readJsonBody } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth/session";
import { CATEGORIES } from "@/lib/config";
import { isValidCalendarDate } from "@/lib/dates";
import { jsonError, notFound } from "@/lib/errors";
import { getStore } from "@/lib/store";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  category: z.enum(CATEGORIES),
  documentDate: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidCalendarDate(value), {
      message: "Document date must be a valid date.",
    })
    .transform((value) => (value === "" ? null : value)),
  amount: z
    .number()
    .nonnegative()
    .max(999_999_999_999)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const store = await getStore();
    const deleted = await store.deleteDocument(user.id, id);
    if (!deleted) throw notFound();
    return Response.json({ deleted: true, id });
  } catch (err) {
    return jsonError(err);
  }
}

/** A human confirming or correcting a document. This outranks the model. */
export async function PATCH(req: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const patch = parseOrThrow(
      patchSchema,
      await readJsonBody(req),
      "Check the category, date and amount.",
    );

    const store = await getStore();
    const updated = await store.updateDocument(user.id, id, patch);
    if (!updated) throw notFound();

    return Response.json({ document: updated });
  } catch (err) {
    return jsonError(err);
  }
}
