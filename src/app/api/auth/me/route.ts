import { getMode } from "@/lib/env";
import { getServerUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { jsonError } from "@/lib/errors";

export async function GET() {
  try {
    const mode = getMode();
    const user = await getServerUser();
    if (!user) {
      return Response.json({ user: null, business: null, mode });
    }
    const store = await getStore();
    const business = await store.getBusinessForUser(user.id);
    return Response.json({ user, business, mode });
  } catch (err) {
    return jsonError(err);
  }
}
