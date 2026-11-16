import { requireUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/errors";
import { isGoogleConfigured, buildAuthUrl } from "@/lib/google-oauth";

export async function GET() {
  try {
    const user = await requireUser();
    if (!isGoogleConfigured()) {
      return Response.json(
        { error: { code: "not_configured", message: "Google OAuth is not configured." } },
        { status: 503 },
      );
    }
    const state = user.id;
    return Response.redirect(buildAuthUrl(state));
  } catch (err) {
    return jsonError(err);
  }
}