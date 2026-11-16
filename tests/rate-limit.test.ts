import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit", () => {
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit("k", 3, 1000, 1000);
      expect(r.allowed).toBe(true);
    }
    const r = checkRateLimit("k", 3, 1000, 1000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window", () => {
    checkRateLimit("k", 1, 1000, 1000);
    expect(checkRateLimit("k", 1, 1000, 1000).allowed).toBe(false);
    expect(checkRateLimit("k", 1, 1000, 2500).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    checkRateLimit("a", 1, 1000, 1000);
    expect(checkRateLimit("a", 1, 1000, 1000).allowed).toBe(false);
    expect(checkRateLimit("b", 1, 1000, 1000).allowed).toBe(true);
  });
});