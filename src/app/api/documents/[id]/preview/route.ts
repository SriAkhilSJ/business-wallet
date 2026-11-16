import { requireUser } from "@/lib/auth/session";
import { AppError, jsonError, notFound } from "@/lib/errors";
import { getStore } from "@/lib/store";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const store = await getStore();
    const doc = await store.getDocument(user.id, id);
    if (!doc) throw notFound();

    const url = await store.getPreviewUrl(user.id, doc);
    if (!url) {
      throw new AppError(
        502,
        "preview_unavailable",
        "Preview is temporarily unavailable for this document.",
      );
    }
    return Response.json({
      url,
      mimeType: doc.mimeType,
      kind:
        doc.mimeType === "application/pdf"
          ? "pdf"
          : doc.mimeType === "text/plain"
            ? "text"
            : "image",
      filename: doc.originalFilename,
    });
  } catch (err) {
    return jsonError(err);
  }
}
