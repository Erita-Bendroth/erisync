import { fromZonedTime, toZonedTime, format as formatTz } from "date-fns-tz";
import { addDays } from "date-fns";
import type { ShiftDefinitionRow } from "./shiftResolver";

export interface ShiftInstance {
  startUtc: Date;
  endUtc: Date;
  startLocal: string; // ISO local wall-clock "yyyy-MM-dd'T'HH:mm:ssXXX"
  endLocal: string;
  durationMinutes: number;
  timezone: string;
  crossesMidnight: boolean;
  dstTransition: boolean; // true if start/end straddle a DST change
}

function normalizeTime(t: string): string {
  // Accept "HH:mm" or "HH:mm:ss"
  const parts = t.split(":");
  const hh = parts[0]?.padStart(2, "0") ?? "00";
  const mm = parts[1]?.padStart(2, "0") ?? "00";
  const ss = parts[2]?.padStart(2, "0") ?? "00";
  return `${hh}:${mm}:${ss}`;
}

function ymd(date: Date): string {
  // Use UTC parts so the input date string ("2025-03-30") maps to that calendar day
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build a concrete shift occurrence from a definition + date + timezone.
 * - Wall-clock times are interpreted in the supplied IANA timezone
 * - End <= start → end rolls to next calendar day (overnight shift)
 * - Duration is computed from UTC instants so DST gaps/overlaps are correct
 */
export function buildShiftInstance(
  definition: Pick<ShiftDefinitionRow, "start_time" | "end_time">,
  date: Date | string,
  timezone: string
): ShiftInstance {
  const baseDate = typeof date === "string" ? new Date(date) : date;
  const startTime = normalizeTime(definition.start_time);
  const endTime = normalizeTime(definition.end_time);

  const startDay = ymd(baseDate);
  const crossesMidnight = endTime <= startTime;
  const endDay = crossesMidnight ? ymd(addDays(baseDate, 1)) : startDay;

  const startUtc = fromZonedTime(`${startDay}T${startTime}`, timezone);
  const endUtc = fromZonedTime(`${endDay}T${endTime}`, timezone);

  const durationMinutes = Math.round(
    (endUtc.getTime() - startUtc.getTime()) / 60000
  );

  // DST detection: compare UTC offset at start vs end
  const fmt = "XXX";
  const startOffset = formatTz(toZonedTime(startUtc, timezone), fmt, { timeZone: timezone });
  const endOffset = formatTz(toZonedTime(endUtc, timezone), fmt, { timeZone: timezone });
  const dstTransition = startOffset !== endOffset;

  return {
    startUtc,
    endUtc,
    startLocal: formatTz(toZonedTime(startUtc, timezone), "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: timezone }),
    endLocal: formatTz(toZonedTime(endUtc, timezone), "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: timezone }),
    durationMinutes,
    timezone,
    crossesMidnight,
    dstTransition,
  };
}