/**
 * Supabase server client bound to the incoming request's cookies
 * (documented @supabase/ssr pattern). Used for both auth and RLS-scoped DB
 * access — the database is the second authorization layer.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "../env";

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component where cookies are read-only;
          // middleware/session refresh handles cookie writes in that case.
        }
      },
    },
  });
}
