import { describe, expect, it } from "vitest";
import { addCalendarInterval, daysBetween } from "../dates";

describe("addCalendarInterval", () => {
  it("HIPAA: 1-year renewal from 2026-09-01", () => {
    expect(addCalendarInterval("2026-09-01", 1, "years")).toBe("2027-09-01");
  });

  it("CPR: 2-year renewal from 2026-09-01", () => {
    expect(addCalendarInterval("2026-09-01", 2, "years")).toBe("2028-09-01");
  });

  it("Zero Tolerance: 3-year renewal from 2026-09-01", () => {
    expect(addCalendarInterval("2026-09-01", 3, "years")).toBe("2029-09-01");
  });

  it("FDLE: 5-year renewal from 2026-09-01", () => {
    expect(addCalendarInterval("2026-09-01", 5, "years")).toBe("2031-09-01");
  });

  it("handles leap-year completion dates correctly", () => {
    // 2024 is a leap year; +2 years should land on 2026-02-28 (2026 is not a leap year).
    expect(addCalendarInterval("2024-02-29", 2, "years")).toBe("2026-02-28");
    // +4 years lands back on another leap year, so the 29th is valid again.
    expect(addCalendarInterval("2024-02-29", 4, "years")).toBe("2028-02-29");
  });

  it("clamps month-end overflow instead of spilling into the next month", () => {
    // Jan 31 + 1 month has no Feb 31; clamp to the last day of February.
    expect(addCalendarInterval("2026-01-31", 1, "months")).toBe("2026-02-28");
  });

  it("adds days literally", () => {
    expect(addCalendarInterval("2026-09-01", 30, "days")).toBe("2026-10-01");
  });
});

describe("daysBetween", () => {
  it("is positive when the second date is later", () => {
    expect(daysBetween("2026-09-18", "2026-10-18")).toBe(30);
  });

  it("is negative when the second date is earlier (already expired)", () => {
    expect(daysBetween("2026-09-18", "2026-09-08")).toBe(-10);
  });

  it("is zero for the same date (expiration day)", () => {
    expect(daysBetween("2026-09-18", "2026-09-18")).toBe(0);
  });
});
