import { afterEach, describe, expect, it, vi } from "vitest";

import { getMode } from "@/lib/env";

const clear = () => {
  vi.stubEnv("AUTH_MODE", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.stubEnv("ALLOW_INSECURE_DEV_AUTH", "");
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getMode", () => {
  it("uses Supabase when both public values are configured", () => {
    clear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "key");
    expect(getMode()).toBe("supabase");
  });

  it("falls back to the local store outside production", () => {
    clear();
    vi.stubEnv("NODE_ENV", "development");
    expect(getMode()).toBe("dev-fallback");
  });

  it("refuses to run the open login in production when Supabase is missing", () => {
    clear();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getMode()).toThrow(/not configured in a production build/i);
  });

  it("refuses an explicit dev-fallback in production", () => {
    clear();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_MODE", "dev-fallback");
    expect(() => getMode()).toThrow(/Refusing dev-fallback/i);
  });

  it("allows the override for a deliberate local production build", () => {
    clear();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_MODE", "dev-fallback");
    vi.stubEnv("ALLOW_INSECURE_DEV_AUTH", "1");
    expect(getMode()).toBe("dev-fallback");
  });
});
