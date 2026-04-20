// Lightweight test suite for buildShiftInstance.
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toEqual: (expected: unknown) => void;
};
import { buildShiftInstance } from "./shiftInstance";
import { getTimezoneForCountry } from "./timezoneUtils";

const def = (start: string, end: string) => ({ start_time: start, end_time: end });

describe("buildShiftInstance", () => {
  it("computes 8h day shift in Berlin (no DST)", () => {
    const inst = buildShiftInstance(def("06:00", "14:00"), "2025-01-08", "Europe/Berlin");
    expect(inst.durationMinutes).toBe(480);
    expect(inst.crossesMidnight).toBe(false);
    expect(inst.dstTransition).toBe(false);
  });

  it("scenario 6: returns local times per member country", () => {
    const oslo = buildShiftInstance(def("06:00", "14:00"), "2025-01-08", getTimezoneForCountry("NO"));
    const warsaw = buildShiftInstance(def("06:00", "14:00"), "2025-01-08", getTimezoneForCountry("PL"));
    expect(oslo.timezone).toBe("Europe/Oslo");
    expect(warsaw.timezone).toBe("Europe/Warsaw");
    // Same wall-clock 06:00 in different zones => same local string but different UTC
    expect(oslo.startLocal.startsWith("2025-01-08T06:00:00")).toBe(true);
    expect(warsaw.startLocal.startsWith("2025-01-08T06:00:00")).toBe(true);
  });

  it("scenario 3: spring-forward DST week — 8h local shift = 8h elapsed (clocks forward but shift not crossing 02→03)", () => {
    // 2025-03-30 is the European DST spring-forward Sunday. A 06:00–14:00 shift
    // starts after the transition so duration stays 8h.
    const inst = buildShiftInstance(def("06:00", "14:00"), "2025-03-30", "Europe/Berlin");
    expect(inst.durationMinutes).toBe(480);
  });

  it("scenario 3: shift spanning DST gap loses an hour as expected (1am→6am Berlin spring forward)", () => {
    // Wall-clock 01:00 → 06:00 on spring-forward day passes through the missing
    // 02:00–03:00 hour, so elapsed UTC time is only 4h not 5h.
    const inst = buildShiftInstance(def("01:00", "06:00"), "2025-03-30", "Europe/Berlin");
    expect(inst.durationMinutes).toBe(240);
    expect(inst.dstTransition).toBe(true);
  });

  it("handles overnight shift crossing midnight", () => {
    const inst = buildShiftInstance(def("22:00", "06:00"), "2025-01-08", "Europe/Berlin");
    expect(inst.crossesMidnight).toBe(true);
    expect(inst.durationMinutes).toBe(480);
  });
});