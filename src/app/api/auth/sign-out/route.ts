import { cookies } from "next/headers";

import { DEV_COOKIE_NAME } from "@/lib/auth/dev-session";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getMode } from "@/lib/env";
import { jsonError } from "@/lib/errors";

export async function POST() {
  try {
    const mode = getMode();
    if (mode === "supabase") {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    }
    const cookieStore = await cookies();
    cookieStore.delete(DEV_COOKIE_NAME);
    return Response.json({ signedOut: true, mode });
  } catch (err) {
    return jsonError(err);
  }
}
