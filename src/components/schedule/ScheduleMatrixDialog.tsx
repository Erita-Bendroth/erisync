import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  eachDayOfInterval,
} from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOffshoreScheduleCoverage } from '@/hooks/useOffshoreScheduleCoverage';
import { cn } from '@/lib/utils';

interface ScheduleEntry {
  id: string;
  user_id: string;
  team_id: string;
  date: string;
  shift_type: string;
  activity_type: string;
  availability_status: string;
  notes?: string;
}

interface Employee {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

type RangeMode = '4weeks' | 'month' | 'year';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workDays: Date[];
  employees: Employee[];
  scheduleEntries: ScheduleEntry[];
  teamIds: string[];
  teamNames: Map<string, string>;
  getActivityColor: (entry: any) => string;
  getActivityDisplayName: (activityType: string) => string;
  getShiftTimes: (entry: any) => { start: string; end: string };
  renderEmployeeName: (employee: Employee) => React.ReactNode;
  onCellClick: (employee: Employee, day: Date) => void;
  cellClickTitle: (employee: Employee) => string;
}

const SHIFT_LABELS: Record<string, string> = {
  early: 'E',
  late: 'L',
  night: 'N',
  normal: '',
  weekend: 'W',
};

const PAGE_SIZE = 1000;

// Matrix sizing favors employee visibility first. Large teams fill the full
// dialog width with compact fixed side columns instead of uniformly shrinking
// every part of the table.
const DATE_COL_W = 110;
const DATE_COL_COMPACT_W = 54;
const COVERAGE_COL_W = 150;
const COVERAGE_COL_COMPACT_W = 62;
const EMP_COMFORT_W = 112;
const EMP_LARGE_W = 58;

export const ScheduleMatrixDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  workDays,
  employees,
  scheduleEntries,
  teamIds,
  teamNames,
  getActivityColor,
  getActivityDisplayName,
  getShiftTimes,
  renderEmployeeName,
  onCellClick,
  cellClickTitle,
}) => {
  const [rangeMode, setRangeMode] = useState<RangeMode>('4weeks');
  const [extendedEntries, setExtendedEntries] = useState<ScheduleEntry[]>([]);
  const [loadingExtended, setLoadingExtended] = useState(false);

  // Measure the scroll container so employee columns can auto-fit the width
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return Math.max(320, Math.floor(window.innerWidth * 0.96 - 34));
  });
  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      const el = scrollRef.current;
      const measuredWidth = el?.getBoundingClientRect().width ?? 0;
      const viewportFallback = typeof window === 'undefined'
        ? 0
        : Math.max(320, Math.floor(window.innerWidth * 0.96 - 34));
      const nextWidth = Math.floor(measuredWidth || viewportFallback);
      if (nextWidth > 0) {
        setContainerWidth((current) => (Math.abs(current - nextWidth) > 1 ? nextWidth : current));
      }
    };

    measure();
    const frame = window.requestAnimationFrame(measure);
    const settleTimer = window.setTimeout(measure, 80);
    const lateSettleTimer = window.setTimeout(measure, 250);
    const ro = typeof ResizeObserver !== 'undefined' && scrollRef.current
      ? new ResizeObserver(measure)
      : null;
    if (ro && scrollRef.current) {
      ro.observe(scrollRef.current);
    }
    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.clearTimeout(lateSettleTimer);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  const matrixLayout = useMemo(() => {
    const availableWidth = Math.max(320, containerWidth - 2);
    const employeeCount = Math.max(1, employees.length);
    const isLargeTeam = employeeCount >= 12;
    const isVeryLargeTeam = employeeCount >= 24;
    const preferredEmployeeWidth = isVeryLargeTeam ? EMP_LARGE_W : EMP_COMFORT_W;
    const preferredDateWidth = isVeryLargeTeam ? 68 : DATE_COL_W;
    const preferredCoverageWidth = isVeryLargeTeam ? 82 : COVERAGE_COL_W;
    const preferredWidth = preferredDateWidth + preferredCoverageWidth + employeeCount * preferredEmployeeWidth;
    const fillAvailableWidth = isLargeTeam || preferredWidth > availableWidth;

    if (!fillAvailableWidth) {
      const employeeWidth = Math.min(EMP_COMFORT_W, Math.max(76, preferredEmployeeWidth));
      const width = DATE_COL_W + COVERAGE_COL_W + employeeCount * employeeWidth;
      return {
        width,
        dateWidth: DATE_COL_W,
        coverageWidth: COVERAGE_COL_W,
        employeeWidth,
        fillAvailableWidth,
        dense: false,
        veryDense: false,
      };
    }

    const dateWidth = isVeryLargeTeam ? DATE_COL_COMPACT_W : Math.max(64, Math.min(DATE_COL_W, availableWidth * 0.08));
    const coverageWidth = isVeryLargeTeam ? COVERAGE_COL_COMPACT_W : Math.max(76, Math.min(COVERAGE_COL_W, availableWidth * 0.1));
    const employeeWidth = Math.max(22, (availableWidth - dateWidth - coverageWidth) / employeeCount);

    return {
      width: availableWidth,
      dateWidth,
      coverageWidth,
      employeeWidth,
      fillAvailableWidth,
      dense: employeeWidth < 52,
      veryDense: employeeWidth < 36,
    };
  }, [containerWidth, employees.length]);

  const { width: matrixWidth, dateWidth: dateColWidth, coverageWidth: coverageColWidth, employeeWidth: empColWidth, fillAvailableWidth, dense, veryDense } = matrixLayout;
  const densityScale = Math.min(1, Math.max(0.65, empColWidth / EMP_LARGE_W));
  const headerAvatarSize = dense ? Math.max(20, Math.min(24, empColWidth - 4)) : Math.min(30, Math.max(24, empColWidth * 0.42));
  const headerAvatarWidth = dense ? Math.max(headerAvatarSize, empColWidth - 4) : headerAvatarSize;
  const headerFontSize = dense ? 8 : Math.max(9, Math.min(11, empColWidth * 0.18));
  const cellFontSize = veryDense ? 7 : Math.max(8, Math.min(10, empColWidth * 0.18));
  const sideFontSize = dense ? 8 : 11;
  const cellPaddingX = Math.max(1, Math.min(4, empColWidth * 0.08));
  const cellPaddingY = Math.max(1, Math.min(4, 4 * densityScale));
  const sidePaddingX = dense ? 4 : 10;
  const sidePaddingY = dense ? 4 : 8;
  const coverageCompact = coverageColWidth < 90;
  const coverageBadgeFontSize = coverageCompact ? 8 : 10;
  const columnWidthStyle = (width: number): React.CSSProperties => (
    fillAvailableWidth ? { width: `${(width / matrixWidth) * 100}%` } : { width }
  );

  const anchor = workDays[0] ?? new Date();
  // Monday of the currently viewed week (week starts on Monday)
  const rangeAnchor = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor],
  );

  // All days to display for the selected range
  const days = useMemo(() => {
    if (rangeMode === '4weeks') {
      return eachDayOfInterval({ start: rangeAnchor, end: addDays(rangeAnchor, 27) });
    }
    if (rangeMode === 'month') {
      return eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
    }
    // year: ~52 weeks starting at the current week's Monday
    return eachDayOfInterval({ start: rangeAnchor, end: addDays(rangeAnchor, 364) });
  }, [rangeMode, workDays, anchor, rangeAnchor]);

  const rangeStart = days[0] ?? null;
  const rangeEnd = days[days.length - 1] ?? null;

  // Offshore E/L/N minimum requirements across the whole displayed range
  const { requirements, isOffshore } = useOffshoreScheduleCoverage(
    open ? teamIds : [],
    rangeStart,
    rangeEnd,
  );

  // Fetch entries ourselves for all ranges (prop only covers the currently-viewed week)
  useEffect(() => {
    if (!open || teamIds.length === 0 || !rangeStart || !rangeEnd) {
      setExtendedEntries([]);
      return;
    }
    let cancelled = false;
    setLoadingExtended(true);
    (async () => {
      const all: ScheduleEntry[] = [];
      let from = 0;
      for (let i = 0; i < 200; i++) {
        const { data, error } = await supabase
          .from('schedule_entries')
          .select('id, user_id, team_id, date, shift_type, activity_type, availability_status, notes')
          .in('team_id', teamIds)
          .gte('date', format(rangeStart, 'yyyy-MM-dd'))
          .lte('date', format(rangeEnd, 'yyyy-MM-dd'))
          .range(from, from + PAGE_SIZE - 1);
        if (cancelled) return;
        if (error) {
          console.error('ScheduleMatrixDialog: failed to load entries', error);
          break;
        }
        const rows = (data || []) as ScheduleEntry[];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      if (!cancelled) {
        setExtendedEntries(all);
        setLoadingExtended(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rangeMode, teamIds.join(','), rangeStart?.getTime(), rangeEnd?.getTime()]);

  // Always use fetched entries — prop data only covers the currently-viewed week
  const effectiveEntries = extendedEntries;

  // Non-offshore fallback: team capacity minimum staff
  const [teamMinStaff, setTeamMinStaff] = useState<number>(0);
  useEffect(() => {
    if (!open || isOffshore || teamIds.length === 0) {
      setTeamMinStaff(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('team_capacity_config')
        .select('team_id, min_staff_required')
        .in('team_id', teamIds);
      if (cancelled) return;
      const min = (data || []).reduce(
        (acc: number, row: any) => acc + (row.min_staff_required ?? 0),
        0,
      );
      setTeamMinStaff(min);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isOffshore, teamIds.join(',')]);

  // Group visible entries by date + employee, sorted by start time
  const cellMap = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    const visibleUserIds = new Set(employees.map((e) => e.user_id));
    effectiveEntries.forEach((entry) => {
      if (!visibleUserIds.has(entry.user_id)) return;
      const key = `${entry.date}|${entry.user_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(key, [entry]);
      }
    });
    map.forEach((entries) => {
      entries.sort((a, b) => {
        const ta = getShiftTimes(a).start;
        const tb = getShiftTimes(b).start;
        if (ta !== tb) return ta.localeCompare(tb);
        return a.id.localeCompare(b.id);
      });
    });
    return map;
  }, [effectiveEntries, employees, getShiftTimes]);

  // Per-day coverage counts (working entries of displayed employees)
  const dayCoverage = useMemo(() => {
    const visibleUserIds = new Set(employees.map((e) => e.user_id));
    const map = new Map<string, Map<string, number>>();
    effectiveEntries.forEach((entry) => {
      if (!visibleUserIds.has(entry.user_id)) return;
      if (entry.availability_status !== 'available') return;
      if (!['work', 'hotline_support', 'working_from_home'].includes(entry.activity_type)) return;
      let shifts = map.get(entry.date);
      if (!shifts) {
        shifts = new Map();
        map.set(entry.date, shifts);
      }
      const key = entry.shift_type || 'normal';
      shifts.set(key, (shifts.get(key) ?? 0) + 1);
    });
    return map;
  }, [effectiveEntries, employees]);

  const renderCoverage = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const counts = dayCoverage.get(dateStr);
    const total = counts ? Array.from(counts.values()).reduce((a, b) => a + b, 0) : 0;

    if (isOffshore) {
      const parts = (['early', 'late', 'night'] as const).map((shift) => {
        const required = requirements[shift] ?? 1;
        const actual = counts?.get(shift) ?? 0;
        const short = actual < required;
        return (
          <span
            key={shift}
            className={cn(
              'inline-flex items-center rounded font-medium leading-none',
              coverageCompact ? 'gap-0.5 px-1 py-0.5' : 'gap-0.5 px-1.5 py-0.5',
              short
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            )}
            style={{ fontSize: coverageBadgeFontSize }}
            title={`${shift} ${actual}/${required}`}
          >
            {short && !coverageCompact && <AlertTriangle className="h-2.5 w-2.5" />}
            {SHIFT_LABELS[shift]}{coverageCompact ? '' : ' '}{actual}/{required}
          </span>
        );
      });
      return <div className={cn('flex flex-wrap', coverageCompact ? 'gap-0.5' : 'gap-1')}>{parts}</div>;
    }

    if (teamMinStaff > 0) {
      const short = total < teamMinStaff;
      return (
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 font-medium leading-none',
            short
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
          )}
          style={{ fontSize: coverageBadgeFontSize }}
        >
          {short && !coverageCompact && <AlertTriangle className="h-2.5 w-2.5" />}
          {total}/{teamMinStaff}{coverageCompact ? '' : ' working'}
        </span>
      );
    }

    if (!counts || total === 0) {
      return <span className="text-muted-foreground" style={{ fontSize: coverageBadgeFontSize }}>—</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {Array.from(counts.entries()).map(([shift, count]) => (
          <span
            key={shift}
            className="rounded bg-muted px-1.5 py-0.5 font-medium leading-none"
            style={{ fontSize: coverageBadgeFontSize }}
          >
            {SHIFT_LABELS[shift] || shift.charAt(0).toUpperCase()}{coverageCompact ? '' : ' '}{count}
          </span>
        ))}
      </div>
    );
  };

  const rangeLabel = useMemo(() => {
    if (rangeStart && rangeEnd) {
      return `${format(rangeStart, 'MMM d')} – ${format(rangeEnd, 'MMM d, yyyy')}`;
    }
    return '';
  }, [rangeStart, rangeEnd]);

  const RANGE_OPTIONS: { mode: RangeMode; label: string }[] = [
    { mode: '4weeks', label: '4 Weeks' },
    { mode: 'month', label: 'Month' },
    { mode: 'year', label: 'Year' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] flex flex-col p-4 gap-2">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            Schedule Matrix
            <span className="text-sm font-normal text-muted-foreground">{rangeLabel}</span>
            {isOffshore && (
              <Badge variant="outline" className="text-xs">
                Min E/L/N coverage
              </Badge>
            )}
            {loadingExtended && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </span>
            )}
            <div className="ml-auto flex items-center gap-1 border rounded-md p-0.5">
              {RANGE_OPTIONS.map(({ mode, label }) => (
                <Button
                  key={mode}
                  variant={rangeMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setRangeMode(mode)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden border rounded-md">
          <table
            className="border-collapse text-xs table-fixed"
            style={{ width: matrixWidth }}
          >
            <colgroup>
              <col style={{ width: dateColWidth }} />
              {employees.map((employee) => (
                <col key={employee.user_id} style={{ width: empColWidth }} />
              ))}
              <col style={{ width: coverageColWidth }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-background shadow-sm">
              <tr>
                <th
                  className="sticky left-0 z-30 bg-background border-b border-r text-left"
                  style={{ padding: `${Math.max(2, 8 * matrixScale)}px`, fontSize: Math.max(7, 12 * matrixScale) }}
                >
                  Date
                </th>
                {employees.map((employee) => (
                  <th
                    key={employee.user_id}
                    className="border-b border-r text-center overflow-hidden"
                    style={{ padding: `${Math.max(2, 8 * matrixScale)}px ${cellPaddingX}px` }}
                    title={`${employee.first_name} ${employee.last_name}`.trim() || employee.initials}
                  >
                    <div className="flex min-w-0 flex-col items-center" style={{ gap: Math.max(1, 4 * matrixScale) }}>
                      <div
                        className="rounded-full bg-primary/10 text-primary flex shrink-0 items-center justify-center font-bold whitespace-nowrap"
                        style={{
                          width: headerAvatarSize,
                          height: headerAvatarSize,
                          fontSize: Math.min(headerFontSize, (headerAvatarSize * 1.5) / Math.max(1, (employee.initials || '??').length)),
                          lineHeight: 1,
                        }}
                      >
                        {employee.initials || '??'}
                      </div>
                      <div className="truncate font-semibold w-full" style={{ fontSize: headerFontSize, lineHeight: 1.1 }}>
                        {renderEmployeeName(employee)}
                      </div>
                    </div>
                  </th>
                ))}
                <th
                  className="sticky right-0 z-30 bg-background border-b border-l text-left overflow-hidden"
                  style={{ padding: `${Math.max(2, 8 * matrixScale)}px ${Math.max(2, 12 * matrixScale)}px`, fontSize: Math.max(7, 12 * matrixScale) }}
                >
                  Coverage
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const today = isSameDay(day, new Date());
                return (
                  <tr key={dateStr} className={cn(today && 'bg-primary/5')}>
                    <td
                      className={cn(
                        'sticky left-0 z-10 border-b border-r font-medium whitespace-nowrap overflow-hidden',
                        today ? 'bg-primary/10' : 'bg-background',
                      )}
                      style={{ padding: `${Math.max(2, 8 * matrixScale)}px ${Math.max(2, 12 * matrixScale)}px`, fontSize: Math.max(7, 12 * matrixScale) }}
                    >
                      <div>{format(day, 'EEE')}</div>
                      <div className="text-muted-foreground font-normal">
                        {format(day, 'MMM d')}
                      </div>
                    </td>
                    {employees.map((employee) => {
                      const entries = cellMap.get(`${dateStr}|${employee.user_id}`) || [];
                      return (
                        <td
                          key={employee.user_id}
                          className="border-b border-r align-top cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden"
                          style={{ padding: `${cellPaddingY}px ${cellPaddingX}px`, fontSize: cellFontSize }}
                          onClick={() => onCellClick(employee, day)}
                          title={cellClickTitle(employee)}
                        >
                          <div className="flex flex-col min-w-0" style={{ gap: Math.max(1, 4 * matrixScale), minHeight: Math.max(16, 32 * matrixScale) }}>
                            {entries.map((entry) => {
                              const times = getShiftTimes(entry);
                              const shiftLabel = SHIFT_LABELS[entry.shift_type];
                              return (
                                <div
                                  key={entry.id}
                                  className={cn(
                                    'rounded leading-tight overflow-hidden',
                                    getActivityColor(entry),
                                  )}
                                  style={{ padding: `${Math.max(1, 2 * matrixScale)}px ${cellPaddingX}px`, fontSize: cellFontSize }}
                                >
                                  <div className="font-medium truncate">
                                    {shiftLabel && (
                                      <span className="mr-1 font-bold">{shiftLabel}</span>
                                    )}
                                    {getActivityDisplayName(entry.activity_type)}
                                  </div>
                                  <div className="opacity-80">
                                    {times.start}–{times.end}
                                  </div>
                                </div>
                              );
                            })}
                            {entries.length === 0 && (
                              <div className="text-center text-muted-foreground/40">+</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        'sticky right-0 z-10 border-b border-l align-top overflow-hidden',
                        today ? 'bg-primary/10' : 'bg-background',
                      )}
                      style={{ padding: `${Math.max(2, 8 * matrixScale)}px ${Math.max(2, 12 * matrixScale)}px`, fontSize: cellFontSize }}
                    >
                      {renderCoverage(day)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex-shrink-0 text-[11px] text-muted-foreground">
          {employees.length} employees · {teamIds.map((id) => teamNames.get(id)).filter(Boolean).join(', ') || 'All teams'}
          {teamMinStaff > 0 && !isOffshore && ` · minimum ${teamMinStaff} working/day`}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleMatrixDialog;
