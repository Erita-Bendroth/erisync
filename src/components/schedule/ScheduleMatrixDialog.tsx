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

// Preferred column sizing at normal scale. Large teams proportionally scale the
// whole matrix below these values instead of falling back to horizontal scroll.
const DATE_COL_W = 110;
const COVERAGE_COL_W = 150;
const EMP_MIN_W = 64;

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
    ro?.observe(scrollRef.current);
    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.clearTimeout(lateSettleTimer);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open]);

  const matrixScale = useMemo(() => {
    if (!containerWidth || !employees.length) return 1;
    const preferredWidth = DATE_COL_W + COVERAGE_COL_W + employees.length * EMP_MIN_W;
    return Math.min(1, Math.max(1, containerWidth - 2) / preferredWidth);
  }, [containerWidth, employees.length]);

  const dateColWidth = DATE_COL_W * matrixScale;
  const coverageColWidth = COVERAGE_COL_W * matrixScale;
  const empColWidth = EMP_MIN_W * matrixScale;
  const matrixWidth = dateColWidth + coverageColWidth + employees.length * empColWidth;
  const headerAvatarSize = Math.max(12, Math.min(28 * matrixScale, empColWidth - 2));
  const headerFontSize = Math.max(7, 10 * matrixScale);
  const cellFontSize = Math.max(6, 10 * matrixScale);
  const cellPaddingX = Math.max(1, 4 * matrixScale);
  const cellPaddingY = Math.max(1, 4 * matrixScale);

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
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
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
      if (!map.has(entry.date)) map.set(entry.date, new Map());
      const shifts = map.get(entry.date)!;
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
              'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium',
              short
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
            )}
          >
            {short && <AlertTriangle className="h-2.5 w-2.5" />}
            {SHIFT_LABELS[shift]} {actual}/{required}
          </span>
        );
      });
      return <div className="flex flex-wrap gap-1">{parts}</div>;
    }

    if (teamMinStaff > 0) {
      const short = total < teamMinStaff;
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
            short
              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
          )}
        >
          {short && <AlertTriangle className="h-2.5 w-2.5" />}
          {total}/{teamMinStaff} working
        </span>
      );
    }

    if (!counts || total === 0) {
      return <span className="text-[10px] text-muted-foreground">—</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {Array.from(counts.entries()).map(([shift, count]) => (
          <span
            key={shift}
            className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium"
          >
            {SHIFT_LABELS[shift] || shift.charAt(0).toUpperCase()} {count}
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
            className="w-full border-collapse text-xs table-fixed"
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
