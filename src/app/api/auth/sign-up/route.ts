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
import { signUpSchema } from "@/lib/file-validation";
import { getMode } from "@/lib/env";
import { AppError, jsonError } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { SupabaseDocumentStore } from "@/lib/store/supabase-store";
import type { SessionUser } from "@/lib/types";

import { recordAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = checkRateLimit(`signup:${ip}`, 5, 60_000);
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
    const { email, password, fullName, businessName, aiConsent } = parseOrThrow(
      signUpSchema,
      await readJsonBody(req),
      "Invalid sign-up details.",
    );
    const mode = getMode();

    if (mode === "dev-fallback") {
      // ⚠ Development fallback: account created locally. NOT production auth.
      const user: SessionUser = {
        id: devUserIdForEmail(email),
        email,
        fullName,
      };
      const store = await getStore();
      const business = await store.provisionUser(user, { businessName });
      recordAudit({
        businessId: business.id,
        userId: user.id,
        action: "sign_up",
        targetType: "user",
        targetId: user.id,
        metadata: { aiConsent: aiConsent === true, mode: "dev-fallback" },
      });
      const cookieStore = await cookies();
      cookieStore.set(
        DEV_COOKIE_NAME,
        signDevToken(newDevTokenPayload(user)),
        DEV_COOKIE_OPTIONS,
      );
      return Response.json(
        { user, business, mode, devFallback: true },
        { status: 201 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      throw new AppError(
        400,
        "sign_up_failed",
        error.message === "User already registered"
          ? "An account with this email already exists. Try signing in."
          : "Could not create the account. Please try again.",
      );
    }
    if (!data.session || !data.user) {
      // Email confirmation is required by the Supabase project settings.
      return Response.json(
        {
          emailConfirmationRequired: true,
          user: null,
          business: null,
          mode,
          devFallback: false,
        },
        { status: 202 },
      );
    }

    const user: SessionUser = {
      id: data.user.id,
      email: data.user.email ?? email,
      fullName,
    };
    const store = new SupabaseDocumentStore(supabase);
    const business = await store.provisionUser(user, { businessName });
    const { recordAuditDb } = await import("@/lib/audit");
    await recordAuditDb(supabase, {
      businessId: business.id,
      userId: user.id,
      action: "sign_up",
      targetType: "user",
      targetId: user.id,
      metadata: { aiConsent: aiConsent === true, mode: "supabase" },
    });
    return Response.json(
      { user, business, mode, devFallback: false },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err);
  }
}
