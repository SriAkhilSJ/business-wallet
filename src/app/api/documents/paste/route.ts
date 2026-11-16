import { z } from "zod";

import { parseOrThrow, readJsonBody } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth/session";
import { isValidCalendarDate } from "@/lib/dates";
import { jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { ingest } from "@/lib/ingest";

const schema = z.object({
  text: z.string().min(1).max(1_000_000),
  filename: z.string().trim().min(1).max(255).optional(),
  category: z.enum([
    "Sales Invoice",
    "Purchase Invoice",
    "Expense",
    "Receipt",
    "Utility Bill",
    "Payment Proof",
    "Other",
  ]).optional(),
  documentDate: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidCalendarDate(v), { message: "Invalid date." })
    .optional()
    .transform((v) => (v && v !== "" ? v : null)),
});

/** Lets owners paste exported SMS/notifications/WhatsApp text as a document. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = parseOrThrow(schema, await readJsonBody(req), "Check the pasted text.");
    const store = await getStore();
    const result = await ingest(store, user.id, [
      {
        filename: input.filename ?? "pasted-text.txt",
        bytes: new TextEncoder().encode(input.text),
        size: input.text.length,
        documentDate: input.documentDate ?? null,
        category: input.category ?? "Other",
        sourceType: "paste",
      },
    ]);
    if (result.created.length === 0) {
      return Response.json(
        { documents: [], errors: result.errors, error: { code: "paste_rejected", message: "Could not store the text." } },
        { status: 400 },
      );
    }
    return Response.json({ documents: result.created, errors: result.errors }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}