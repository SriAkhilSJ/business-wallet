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
  if (explicit === "supabase" || explicit === "dev-fallback") {
    return explicit;
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? "supabase"
    : "dev-fallback";
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
