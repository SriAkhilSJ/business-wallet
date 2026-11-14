/**
 * Development fallback session: HMAC-signed cookie.
 *
 * ⚠ NOT production authentication. Any credentials work in dev-fallback mode;
 * this only keeps the UI workflow testable without Supabase. Disable by
 * setting AUTH_MODE=supabase.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const DEV_COOKIE_NAME = "bv_dev_session";

const FALLBACK_SECRET = "businessvault-dev-insecure-secret";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface DevTokenPayload {
  sub: string;
  email: string;
  fullName: string | null;
  exp: number;
}

function secret(): string {
  return process.env.DEV_SESSION_SECRET || FALLBACK_SECRET;
}

function hmac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function signDevToken(payload: DevTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifyDevToken(token: string): DevTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = hmac(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as DevTokenPayload;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newDevTokenPayload(user: {
  id: string;
  email: string;
  fullName: string | null;
}): DevTokenPayload {
  return {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
}

export const DEV_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

/**
 * Stable dev-fallback user id derived from the email (dev mode only), so a
 * signed-out and signed-in session address the same local records.
 */
export function devUserIdForEmail(email: string): string {
  const hash = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
  return `dev-${hash.slice(0, 32)}`;
}
