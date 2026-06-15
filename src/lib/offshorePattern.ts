import { addDays, format, parseISO } from "date-fns";

/**
 * Detects whether a partnership should be treated as an offshore partnership
 * based on the names of its teams (any team containing "Offshore").
 */
export function isOffshoreByTeamNames(teamNames: Array<string | null | undefined>): boolean {
  return teamNames.some((n) => !!n && /offshore/i.test(n));
}

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
  longBlockBefore?: number;
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
 *   E  – Early   (no automatic WO for a standalone shift)
 *   L  – Late    (no automatic WO for a standalone shift)
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
    recovery_rule: {
      longBlockBefore: 1,
      longBlockAfter: 1,
      longBlockThreshold: 6,
    },
    sort_order: 1,
  },
  {
    code: "L",
    label: "Late",
    color: "#eab308",
    is_working: true,
    shift_type: "late",
    recovery_rule: {
      longBlockBefore: 1,
      longBlockAfter: 1,
      longBlockThreshold: 6,
    },
    sort_order: 2,
  },
  {
    code: "N",
    label: "Night",
    color: "#3b82f6",
    is_working: true,
    shift_type: "night",
    recovery_rule: {
      before: 0,
      after: 1,
      longBlockBefore: 1,
      longBlockAfter: 2,
      longBlockThreshold: 6,
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

function effectiveRecoveryRule(shift: ShiftCode): RecoveryRule {
  // Canonical offshore rules. We override stored values for the well-known
  // E/L/N codes so that legacy rosters seeded with older presets behave
  // correctly without requiring a data migration.
  const code = shift.code.trim().toUpperCase();
  if (code === "E" || code === "L") {
    return {
      before: 0,
      after: 0,
      longBlockBefore: 1,
      longBlockAfter: 1,
      longBlockThreshold: 6,
    };
  }
  if (code === "N") {
    return {
      before: 0,
      after: 1,
      longBlockBefore: 1,
      longBlockAfter: 2,
      longBlockThreshold: 6,
    };
  }
  return shift.recovery_rule || {};
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

  const wo = findWoCode(allCodes);
  if (!wo) return Array.from(map.values());

  Array.from(map.entries()).forEach(([key, assignment]) => {
    if (assignment.generated_by === "auto-recovery") map.delete(key);
  });

  const anchors = Array.from(map.values())
    .filter((a) => a.is_anchor)
    .sort((a, b) => (a.work_date < b.work_date ? -1 : 1));

  // Group consecutive anchors of the same shift code (no date gaps) into blocks
  // and paint recovery only at block boundaries.
  const blocks: Array<{ shift: ShiftCode; start: Date; len: number }> = [];
  for (const a of anchors) {
    const shift = allCodes.find((c) => c.id === a.shift_code_id);
    if (!shift?.is_working) continue;
    const d = parseISO(a.work_date);
    const last = blocks[blocks.length - 1];
    if (
      last &&
      last.shift.id === shift.id &&
      dateKey(addDays(last.start, last.len)) === a.work_date
    ) {
      last.len++;
    } else {
      blocks.push({ shift, start: d, len: 1 });
    }
  }

  const paintWo = (d: string) => {
    const existing = map.get(d);
    if (existing?.is_anchor || existing?.generated_by === "manual") return;
    map.set(d, {
      roster_id: rosterId,
      user_id: userId,
      work_date: d,
      shift_code_id: wo.id,
      is_recovery: true,
      is_anchor: false,
      generated_by: "auto-recovery",
    });
  };

  blocks.forEach(({ shift, start, len }) => {
    const rule = effectiveRecoveryRule(shift);
    const isLong =
      !!rule.longBlockThreshold && len >= rule.longBlockThreshold;
    const beforeCount = isLong
      ? rule.longBlockBefore ?? rule.before ?? 0
      : rule.before ?? 0;
    const afterCount = isLong
      ? rule.longBlockAfter ?? rule.after ?? 0
      : rule.after ?? 0;

    for (let i = 1; i <= beforeCount; i++) {
      paintWo(dateKey(addDays(start, -i)));
    }
    for (let i = 0; i < afterCount; i++) {
      paintWo(dateKey(addDays(start, len + i)));
    }
  });

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

  // Build consecutive same-shift blocks across anchors.
  const anchors = sorted.filter((a) => a.is_anchor);
  const blocks: Array<{ code: ShiftCode; start: Date; len: number; startDate: string }> = [];
  for (const a of anchors) {
    const code = codes.find((c) => c.id === a.shift_code_id);
    if (!code || !code.is_working) continue;
    const d = parseISO(a.work_date);
    const last = blocks[blocks.length - 1];
    if (
      last &&
      last.code.id === code.id &&
      dateKey(addDays(last.start, last.len)) === a.work_date
    ) {
      last.len++;
    } else {
      blocks.push({ code, start: d, len: 1, startDate: a.work_date });
    }
  }

  for (const { code, start, len, startDate } of blocks) {
    const rule = effectiveRecoveryRule(code);
    const isLong = !!rule.longBlockThreshold && len >= rule.longBlockThreshold;
    const beforeCount = isLong
      ? rule.longBlockBefore ?? rule.before ?? 0
      : rule.before ?? 0;
    const afterCount = isLong
      ? rule.longBlockAfter ?? rule.after ?? 0
      : rule.after ?? 0;

    for (let i = 1; i <= beforeCount; i++) {
      const d = dateKey(addDays(start, -i));
      const x = byDate.get(d);
      if (!x || x.shift_code_id !== wo.id) {
        warnings.push(
          `${startDate}: ${code.label} block of ${len} requires ${beforeCount} WO day(s) before`,
        );
        break;
      }
    }
    for (let i = 0; i < afterCount; i++) {
      const d = dateKey(addDays(start, len + i));
      const x = byDate.get(d);
      if (!x || x.shift_code_id !== wo.id) {
        warnings.push(
          `${startDate}: ${code.label} block of ${len} requires ${afterCount} WO day(s) after`,
        );
        break;
      }
    }
  }

  return warnings;
}