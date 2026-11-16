import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getMode } from "@/lib/env";
import { exchangeCode } from "@/lib/google-oauth";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    if (error) {
      return Response.redirect(`/dashboard?google=error&reason=${encodeURIComponent(error)}`);
    }
    if (!code || state !== user.id) {
      return Response.json({ error: { code: "bad_request", message: "Invalid OAuth callback." } }, { status: 400 });
    }

    const tokens = await exchangeCode(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const mode = getMode();
    if (mode === "supabase") {
      const supabase = await createSupabaseServerClient();
      await supabase.from("oauth_connections").upsert(
        {
          user_id: user.id,
          provider: "google",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          expires_at: expiresAt,
          scope: tokens.scope,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      );
    } else {
      // Dev fallback: store in a local JSON file.
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const dir = join(process.cwd(), ".data");
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, "oauth-google.json"),
        JSON.stringify({ userId: user.id, ...tokens, expiresAt }, null, 2),
        "utf8",
      );
    }

    return Response.redirect("/dashboard?google=connected");
  } catch (err) {
    return jsonError(err);
  }
}