import { contentDisposition } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth/session";
import { AppError, jsonError, notFound } from "@/lib/errors";
import { sanitizeFilename } from "@/lib/filenames";
import { getStore } from "@/lib/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const store = await getStore();
    const stored = await store.readDocument(user.id, id);
    if (!stored) throw notFound();
    if (!stored.bytes) {
      throw new AppError(
        410,
        "missing_object",
        "The stored file for this document is missing from storage.",
      );
    }

    const inline = new URL(req.url).searchParams.get("inline") === "1";
    const filename = sanitizeFilename(stored.record.originalFilename);

    return new Response(stored.bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": stored.record.mimeType,
        "Content-Disposition": contentDisposition(
          inline ? "inline" : "attachment",
          filename,
        ),
        "Content-Length": String(stored.bytes.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}
