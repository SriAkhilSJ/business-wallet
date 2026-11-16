/**
 * Runtime mode selection.
 *
 * - `supabase`: Supabase Auth + Postgres + Storage (production path).
 * - `dev-fallback`: local JSON store + signed dev cookie (development only,
 *   NOT secure — exists so the full workflow can be tested without
 *   cloud credentials).
 */
export type AppMode = "supabase" | "dev-fallback";

export function getMode(): AppMode {
  const explicit = process.env.AUTH_MODE;
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const production = process.env.NODE_ENV === "production";
  const override = process.env.ALLOW_INSECURE_DEV_AUTH === "1";

  if (explicit === "supabase" || explicit === "dev-fallback") {
    if (explicit === "dev-fallback" && production && !override) {
      throw new Error(
        "Refusing dev-fallback auth in production. Set ALLOW_INSECURE_DEV_AUTH=1 only for a deliberate local production build.",
      );
    }
    return explicit;
  }

  if (configured) return "supabase";

  if (production && !override) {
    throw new Error(
      "Supabase is not configured in a production build, and the insecure fallback is disabled.",
    );
  }

  return "dev-fallback";
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
