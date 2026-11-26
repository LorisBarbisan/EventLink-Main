import { describe, it, expect } from "vitest";
import { billableOvertime, computeOvertime, workedMinutes, minutesToHours } from "./overtime";

describe("workedMinutes", () => {
  it("subtracts the break", () => {
    expect(workedMinutes("09:00", "17:00", 60)).toBe(420);
  });
  it("wraps past midnight", () => {
    expect(workedMinutes("22:00", "06:00", 0)).toBe(480);
  });
  it("never goes negative", () => {
    expect(workedMinutes("09:00", "09:00", 30)).toBe(0);
  });
});

describe("minutesToHours", () => {
  it("rounds to two decimals", () => {
    expect(minutesToHours(210)).toBe(3.5);
    expect(minutesToHours(100)).toBe(1.67);
  });
});

describe("computeOvertime", () => {
  const entries = [
    { start_time: "09:00", finish_time: "18:00", break_minutes: 60 }, // 480 worked, 0 ot
    { start_time: "08:00", finish_time: "20:00", break_minutes: 30 }, // 690 worked, 210 ot
  ];

  it("counts overtime beyond the standard day and prices it", () => {
    const r = computeOvertime(entries, { standard_hours_per_day: 8, overtime_rate_pence: 1500 });
    expect(r.has_standard).toBe(true);
    expect(r.total_worked_minutes).toBe(1170);
    expect(r.total_overtime_minutes).toBe(210);
    expect(r.overtime_hours).toBe(3.5);
    expect(r.overtime_pence).toBe(5250); // 3.5h × £15.00
    expect(r.per_day).toEqual([
      { worked_minutes: 480, overtime_minutes: 0 },
      { worked_minutes: 690, overtime_minutes: 210 },
    ]);
  });

  it("with no standard day set, overtime is unknown (null per day), not zero-billed", () => {
    const r = computeOvertime(entries, { standard_hours_per_day: null, overtime_rate_pence: 1500 });
    expect(r.has_standard).toBe(false);
    expect(r.total_worked_minutes).toBe(1170);
    expect(r.total_overtime_minutes).toBe(0);
    expect(r.per_day.every((d) => d.overtime_minutes === null)).toBe(true);
  });

  it("with no rate set, the pence figure is unknown (null)", () => {
    const r = computeOvertime(entries, { standard_hours_per_day: 8, overtime_rate_pence: null });
    expect(r.overtime_hours).toBe(3.5);
    expect(r.overtime_pence).toBeNull();
  });

  it("no entries: everything zero / empty", () => {
    const r = computeOvertime([], { standard_hours_per_day: 8, overtime_rate_pence: 1500 });
    expect(r.total_worked_minutes).toBe(0);
    expect(r.total_overtime_minutes).toBe(0);
    expect(r.overtime_pence).toBe(0);
    expect(r.per_day).toEqual([]);
  });
});

describe("billableOvertime", () => {
  // The Aster case: one 09:00–20:00 day, no break, 10-hour standard, £18.75/h
  const logged = computeOvertime(
    [{ start_time: "09:00", finish_time: "20:00", break_minutes: 0 }],
    {
      standard_hours_per_day: 10,
      overtime_rate_pence: 1875,
    }
  );

  it("bills the logged overtime when nothing is confirmed", () => {
    expect(
      billableOvertime(logged, { standard_hours_per_day: 10, overtime_rate_pence: 1875 })
    ).toEqual({
      hours: 1,
      pence: 1875,
      source: "logged",
    });
  });

  it("a confirmed figure wins over the logged one (decimal strings from the db too)", () => {
    expect(
      billableOvertime(logged, {
        standard_hours_per_day: 10,
        overtime_rate_pence: 1875,
        overtime_hours_confirmed: "1.50",
      })
    ).toEqual({ hours: 1.5, pence: 2813, source: "confirmed" });
  });

  it("a confirmed zero means no overtime, not the logged hours", () => {
    expect(
      billableOvertime(logged, {
        standard_hours_per_day: 10,
        overtime_rate_pence: 1875,
        overtime_hours_confirmed: 0,
      })
    ).toEqual({ hours: 0, pence: 0, source: "confirmed" });
  });

  it("without a standard day or confirmed figure there is nothing to bill", () => {
    const noStd = computeOvertime(
      [{ start_time: "09:00", finish_time: "20:00", break_minutes: 0 }],
      {
        standard_hours_per_day: null,
        overtime_rate_pence: 1875,
      }
    );
    expect(
      billableOvertime(noStd, { standard_hours_per_day: null, overtime_rate_pence: 1875 })
    ).toEqual({
      hours: null,
      pence: null,
      source: null,
    });
  });

  it("knows the hours but not the money when no rate is set", () => {
    expect(
      billableOvertime(logged, { standard_hours_per_day: 10, overtime_rate_pence: null })
    ).toEqual({
      hours: 1,
      pence: null,
      source: "logged",
    });
  });
});
