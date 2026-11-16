import { cookies } from "next/headers";

import { parseOrThrow, readJsonBody } from "@/lib/api-helpers";
import {
  DEV_COOKIE_NAME,
  DEV_COOKIE_OPTIONS,
  devUserIdForEmail,
  newDevTokenPayload,
  signDevToken,
} from "@/lib/auth/dev-session";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { authCredentialsSchema } from "@/lib/file-validation";
import { getMode } from "@/lib/env";
import { AppError, jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { SupabaseDocumentStore } from "@/lib/store/supabase-store";
import type { SessionUser } from "@/lib/types";

import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = checkRateLimit(`signin:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return Response.json(
      {
        error: {
          code: "rate_limited",
          message: `Too many attempts. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`,
        },
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }
  try {
    const { email, password } = parseOrThrow(
      authCredentialsSchema,
      await readJsonBody(req),
      "Invalid sign-in details.",
    );
    const mode = getMode();

    if (mode === "dev-fallback") {
      // ⚠ Development fallback: any credentials work. NOT production auth.
      const user: SessionUser = {
        id: devUserIdForEmail(email),
        email,
        fullName: null,
      };
      const store = await getStore();
      const business = await store.provisionUser(user);
      const cookieStore = await cookies();
      cookieStore.set(
        DEV_COOKIE_NAME,
        signDevToken(newDevTokenPayload(user)),
        DEV_COOKIE_OPTIONS,
      );
      return Response.json({ user, business, mode, devFallback: true });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      throw new AppError(401, "invalid_credentials", "Invalid email or password.");
    }
    const fullName = data.user.user_metadata?.full_name;
    const user: SessionUser = {
      id: data.user.id,
      email: data.user.email ?? email,
      fullName: typeof fullName === "string" && fullName ? fullName : null,
    };
    const store = new SupabaseDocumentStore(supabase);
    const business = await store.provisionUser(user);
    return Response.json({ user, business, mode, devFallback: false });
  } catch (err) {
    return jsonError(err);
  }
}
