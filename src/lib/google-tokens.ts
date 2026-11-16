import { getMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { refreshAccessToken } from "@/lib/google-oauth";

export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const mode = getMode();
  if (mode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("oauth_connections")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("provider", "google")
      .maybeSingle();
    if (!data) return null;
    const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
    if (expiresAt && Date.now() < expiresAt - 60_000) {
      return data.access_token as string;
    }
    if (!data.refresh_token) return data.access_token as string;
    const refreshed = await refreshAccessToken(data.refresh_token as string);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase
      .from("oauth_connections")
      .update({ access_token: refreshed.access_token, expires_at: newExpiry, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", "google");
    return refreshed.access_token;
  }

  // Dev fallback: read from .data/oauth-google.json
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const raw = await readFile(join(process.cwd(), ".data", "oauth-google.json"), "utf8");
    const parsed = JSON.parse(raw) as { userId: string; access_token: string; refresh_token?: string; expiresAt?: string };
    if (parsed.userId !== userId) return null;
    if (parsed.expiresAt && Date.now() < new Date(parsed.expiresAt).getTime() - 60_000) {
      return parsed.access_token;
    }
    if (!parsed.refresh_token) return parsed.access_token;
    const refreshed = await refreshAccessToken(parsed.refresh_token);
    return refreshed.access_token;
  } catch {
    return null;
  }
}