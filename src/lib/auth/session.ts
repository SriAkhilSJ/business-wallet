/**
 * Mode-aware server session resolution. Every protected API route goes
 * through `requireUser()` — authorization is never left to the client.
 */
import { cookies } from "next/headers";

import { AppError, unauthorized } from "../errors";
import type { SessionUser } from "../types";
import {
  DEV_COOKIE_NAME,
  verifyDevToken,
} from "./dev-session";
import { getMode } from "../env";
import { createSupabaseServerClient } from "./supabase-server";

export async function getServerUser(): Promise<SessionUser | null> {
  if (getMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const fullName = data.user.user_metadata?.full_name;
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      fullName: typeof fullName === "string" && fullName ? fullName : null,
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(DEV_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyDevToken(token);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email, fullName: payload.fullName };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getServerUser();
  if (!user) throw unauthorized();
  return user;
}

export function assertDevFallback(): void {
  if (getMode() !== "dev-fallback") {
    throw new AppError(404, "not_found", "Not available in this mode.");
  }
}
