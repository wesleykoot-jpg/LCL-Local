import { describe, expect, it } from "vitest";
import { formatYearPhrase, getAllowedEventYears, isAllowedEventYear, resolveTargetYears } from "../supabase/functions/_shared/dateUtils.ts";

describe("event year guard", () => {
  const referenceDate = new Date("2026-01-18T00:00:00Z");

  it("returns current and next calendar year", () => {
    expect(getAllowedEventYears(referenceDate)).toEqual([2026, 2027]);
  });

  it("accepts dates in allowed window and rejects others", () => {
    expect(isAllowedEventYear("2026-05-01", referenceDate)).toBe(true);
    expect(isAllowedEventYear("2027-02-15", referenceDate)).toBe(true);
    expect(isAllowedEventYear("2028-01-01", referenceDate)).toBe(false);
  });

  it("honors explicit target year override", () => {
    expect(resolveTargetYears("2028", referenceDate)).toEqual([2028]);
  });

  it("formats year phrase with Dutch conjunction", () => {
    expect(formatYearPhrase([2026])).toBe("2026");
    expect(formatYearPhrase([2026, 2027])).toBe("2026 en 2027");
  });
});
