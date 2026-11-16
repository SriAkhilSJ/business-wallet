import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";

/** Documents the model was unsure about. */
export async function GET() {
  try {
    const user = await requireUser();
    const store = await getStore();
    const documents = await store.listForReview(user.id);
    return Response.json({ documents });
  } catch (err) {
    return jsonError(err);
  }
}
