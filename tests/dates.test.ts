import { describe, expect, it } from "vitest";

import {
  effectiveDateOf,
  formatDateDisplay,
  formatBytes,
  isValidCalendarDate,
  monthKey,
  monthKeyFor,
  monthLabel,
  todayUtcDate,
  utcDateOfTimestamp,
  zipFilename,
} from "@/lib/dates";

describe("isValidCalendarDate", () => {
  it("accepts real dates", () => {
    expect(isValidCalendarDate("2026-11-14")).toBe(true);
    expect(isValidCalendarDate("2024-02-29")).toBe(true); // leap year
    expect(isValidCalendarDate("2026-12-31")).toBe(true);
  });

  it("rejects impossible or malformed dates", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("2026-13-01")).toBe(false);
    expect(isValidCalendarDate("2025-02-29")).toBe(false); // not a leap year
    expect(isValidCalendarDate("2026-1-5")).toBe(false);
    expect(isValidCalendarDate("14/11/2026")).toBe(false);
    expect(isValidCalendarDate("")).toBe(false);
  });
});

describe("effectiveDateOf", () => {
  it("uses the document date when present", () => {
    expect(
      effectiveDateOf({ documentDate: "2026-11-05", createdAt: "2026-11-20T10:00:00.000Z" }),
    ).toBe("2026-11-05");
  });

  it("falls back to the UTC upload date", () => {
    expect(
      effectiveDateOf({ documentDate: null, createdAt: "2026-10-31T18:30:00.000Z" }),
    ).toBe("2026-10-31");
    expect(
      effectiveDateOf({ documentDate: null, createdAt: "2026-11-01T00:15:00.000Z" }),
    ).toBe("2026-11-01");
  });
});

describe("month keys and labels", () => {
  it("builds month keys without timezone drift", () => {
    expect(monthKey("2026-11-14")).toBe("2026-11");
    expect(monthKeyFor(11, 2026)).toBe("2026-11");
    expect(monthKeyFor(3, 2026)).toBe("2026-03");
  });

  it("formats labels and zip names", () => {
    expect(monthLabel(11, 2026)).toBe("November 2026");
    expect(zipFilename(11, 2026)).toBe("BusinessVault_November_2026.zip");
  });
});

describe("display formatting", () => {
  it("formats dates for humans", () => {
    expect(formatDateDisplay("2026-11-14")).toBe("14 Nov 2026");
    expect(formatDateDisplay("2026-11-14T10:00:00.000Z")).toBe("14 Nov 2026");
    expect(formatDateDisplay("not-a-date")).toBe("not-a-date");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("normalizes timestamps to UTC calendar dates", () => {
    expect(utcDateOfTimestamp("2026-11-14T23:30:00.000Z")).toBe("2026-11-14");
    expect(todayUtcDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
