import { addDays, format, parseISO } from "date-fns";

/**
 * Offshore shift pattern utilities.
 *
 * Each shift code has a recovery rule describing mandatory WO days
 * (work off / recovery) that must surround a working shift.
 *
 * Shape:
 *   before              -> WO days required immediately before this shift
 *   after               -> default WO days required immediately after
 *   longBlockAfter      -> WO days required when the consecutive block of
 *                          this same shift code reaches longBlockThreshold
 *   longBlockThreshold  -> consecutive-shift count that triggers longBlockAfter
 */
export interface RecoveryRule {
  before?: number;
  after?: number;
  longBlockAfter?: number;
  longBlockThreshold?: number;
}

export interface ShiftCode {
  id: string;
  partnership_id: string;
  code: string;
  label: string;
  color: string;
  is_working: boolean;
  shift_type: string | null;
  recovery_rule: RecoveryRule;
  sort_order: number;
}

export interface DayAssignment {
  id?: string;
  roster_id: string;
  user_id: string;
  work_date: string; // yyyy-MM-dd
  shift_code_id: string | null;
  is_recovery: boolean;
  is_anchor: boolean;
  generated_by: "manual" | "auto-recovery" | "cycle-repeat";
}

/**
 * Default offshore preset, mirroring the turbine-troubleshooting roster:
 *   E  – Early   (1 WO after)
 *   L  – Late    (1 WO after)
 *   N  – Night   (1 WO before, 1 WO after; 2 WO after if block >= 5)
 *   D  – Day     (no mandatory recovery)
 *   WO – Recovery / Weekend Off (non-working)
 */
export const OFFSHORE_PRESET: Array<
  Omit<ShiftCode, "id" | "partnership_id">
> = [
  {
    code: "E",
    label: "Early",
    color: "#22c55e",
    is_working: true,
    shift_type: "early",
    recovery_rule: { after: 1 },
    sort_order: 1,
  },
  {
    code: "L",
    label: "Late",
    color: "#eab308",
    is_working: true,
    shift_type: "late",
    recovery_rule: { after: 1 },
    sort_order: 2,
  },
  {
    code: "N",
    label: "Night",
    color: "#3b82f6",
    is_working: true,
    shift_type: "night",
    recovery_rule: {
      before: 1,
      after: 1,
      longBlockAfter: 2,
      longBlockThreshold: 5,
    },
    sort_order: 3,
  },
  {
    code: "D",
    label: "Day",
    color: "#64748b",
    is_working: true,
    shift_type: "normal",
    recovery_rule: {},
    sort_order: 4,
  },
  {
    code: "WO",
    label: "Weekend Off / Recovery",
    color: "#ef4444",
    is_working: false,
    shift_type: null,
    recovery_rule: {},
    sort_order: 5,
  },
];

function findWoCode(codes: ShiftCode[]): ShiftCode | undefined {
  return codes.find((c) => !c.is_working) || codes.find((c) => c.code === "WO");
}

function dateKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/**
 * Apply a shift assignment for a single user on a given date and
 * auto-paint surrounding WO recovery days per the shift's recovery rule.
 * Returns the updated day-assignment list for that user.
 *
 * `existing` is the list of assignments for ONE user (any date range);
 * it is replaced where dates overlap and otherwise preserved.
 */
export function applyShiftWithRecovery(
  rosterId: string,
  userId: string,
  date: string,
  shift: ShiftCode,
  allCodes: ShiftCode[],
  existing: DayAssignment[],
): DayAssignment[] {
  const map = new Map<string, DayAssignment>();
  existing.forEach((a) => map.set(a.work_date, a));

  // Set the anchor shift itself
  map.set(date, {
    roster_id: rosterId,
    user_id: userId,
    work_date: date,
    shift_code_id: shift.id,
    is_recovery: !shift.is_working,
    is_anchor: shift.is_working,
    generated_by: "manual",
  });

  if (!shift.is_working) return Array.from(map.values());

  const wo = findWoCode(allCodes);
  if (!wo) return Array.from(map.values());

  const rule = shift.recovery_rule || {};
  const anchor = parseISO(date);

  // BEFORE
  const beforeCount = rule.before ?? 0;
  for (let i = 1; i <= beforeCount; i++) {
    const d = dateKey(addDays(anchor, -i));
    const existing = map.get(d);
    // Don't overwrite manual shifts placed by the user before today's anchor
    if (existing?.is_anchor) continue;
    map.set(d, {
      roster_id: rosterId,
      user_id: userId,
      work_date: d,
      shift_code_id: wo.id,
      is_recovery: true,
      is_anchor: false,
      generated_by: "auto-recovery",
    });
  }

  // Determine block length (consecutive same-shift starting at anchor, walking forward)
  let blockLen = 1;
  for (let i = 1; i < 30; i++) {
    const d = dateKey(addDays(anchor, i));
    const next = map.get(d);
    if (next?.shift_code_id === shift.id && next.is_anchor) blockLen++;
    else break;
  }

  const afterCount =
    rule.longBlockThreshold && blockLen >= rule.longBlockThreshold
      ? rule.longBlockAfter ?? rule.after ?? 0
      : rule.after ?? 0;

  // AFTER — start after the working block
  const afterStart = blockLen;
  for (let i = 0; i < afterCount; i++) {
    const d = dateKey(addDays(anchor, afterStart + i));
    const existing = map.get(d);
    if (existing?.is_anchor) continue;
    map.set(d, {
      roster_id: rosterId,
      user_id: userId,
      work_date: d,
      shift_code_id: wo.id,
      is_recovery: true,
      is_anchor: false,
      generated_by: "auto-recovery",
    });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.work_date < b.work_date ? -1 : 1,
  );
}

/**
 * Validate that recovery rules are satisfied for a user's assignments.
 * Returns a list of human-readable warnings.
 */
export function validateRecovery(
  assignments: DayAssignment[],
  codes: ShiftCode[],
): string[] {
  const warnings: string[] = [];
  const wo = findWoCode(codes);
  if (!wo) return warnings;
  const sorted = [...assignments].sort((a, b) =>
    a.work_date < b.work_date ? -1 : 1,
  );
  const byDate = new Map(sorted.map((a) => [a.work_date, a]));

  for (const a of sorted) {
    if (!a.is_anchor) continue;
    const code = codes.find((c) => c.id === a.shift_code_id);
    if (!code || !code.is_working) continue;
    const rule = code.recovery_rule || {};
    const anchor = parseISO(a.work_date);

    const beforeCount = rule.before ?? 0;
    for (let i = 1; i <= beforeCount; i++) {
      const d = dateKey(addDays(anchor, -i));
      const x = byDate.get(d);
      if (!x || x.shift_code_id !== wo.id) {
        warnings.push(
          `${a.work_date}: ${code.label} requires ${beforeCount} WO day(s) before`,
        );
        break;
      }
    }

    let blockLen = 1;
    for (let i = 1; i < 30; i++) {
      const d = dateKey(addDays(anchor, i));
      const next = byDate.get(d);
      if (next?.shift_code_id === code.id && next.is_anchor) blockLen++;
      else break;
    }
    const afterCount =
      rule.longBlockThreshold && blockLen >= rule.longBlockThreshold
        ? rule.longBlockAfter ?? rule.after ?? 0
        : rule.after ?? 0;
    for (let i = 0; i < afterCount; i++) {
      const d = dateKey(addDays(anchor, blockLen + i));
      const x = byDate.get(d);
      if (!x || x.shift_code_id !== wo.id) {
        warnings.push(
          `${a.work_date}: ${code.label} requires ${afterCount} WO day(s) after`,
        );
        break;
      }
    }
  }

  return warnings;
}