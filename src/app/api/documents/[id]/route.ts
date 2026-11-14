import { requireUser } from "@/lib/auth/session";
import { jsonError, notFound } from "@/lib/errors";
import { getStore } from "@/lib/store";

type RouteContext = { params: Promise<{ id: string }> };

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
