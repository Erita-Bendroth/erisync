import React, { useEffect, useMemo, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
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
  const weekStart = workDays[0] ?? null;
  const weekEnd = workDays[workDays.length - 1] ?? null;

  // Offshore E/L/N minimum requirements (inactive for non-offshore teams)
  const { requirements, isOffshore } = useOffshoreScheduleCoverage(
    open ? teamIds : [],
    weekStart,
    weekEnd,
  );

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
  }, [open, isOffshore, teamIds.join(',')]);

  // Group visible entries by date + employee, sorted by start time
  const cellMap = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    const visibleUserIds = new Set(employees.map((e) => e.user_id));
    scheduleEntries.forEach((entry) => {
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
  }, [scheduleEntries, employees, getShiftTimes]);

  // Per-day coverage counts (working entries of displayed employees)
  const dayCoverage = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    scheduleEntries.forEach((entry) => {
      if (entry.availability_status !== 'available') return;
      if (!['work', 'hotline_support', 'working_from_home'].includes(entry.activity_type)) return;
      if (!map.has(entry.date)) map.set(entry.date, new Map());
      const shifts = map.get(entry.date)!;
      const key = entry.shift_type || 'normal';
      shifts.set(key, (shifts.get(key) ?? 0) + 1);
    });
    return map;
  }, [scheduleEntries]);

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

    // No minimum configured: plain counts per shift
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] flex flex-col p-4 gap-2">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            Schedule Matrix
            {weekStart && weekEnd && (
              <span className="text-sm font-normal text-muted-foreground">
                {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
              </span>
            )}
            {isOffshore && (
              <Badge variant="outline" className="text-xs">
                Min E/L/N coverage
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-md">
          <table className="border-collapse text-xs w-max min-w-full">
            <thead className="sticky top-0 z-20 bg-background shadow-sm">
              <tr>
                <th className="sticky left-0 z-30 bg-background border-b border-r px-3 py-2 text-left min-w-[110px]">
                  Date
                </th>
                {employees.map((employee) => (
                  <th
                    key={employee.user_id}
                    className="border-b border-r px-2 py-2 text-center min-w-[90px] max-w-[110px]"
                  >
                    <div className="truncate font-semibold">
                      {renderEmployeeName(employee)}
                    </div>
                  </th>
                ))}
                <th className="sticky right-0 z-30 bg-background border-b border-l px-3 py-2 text-left min-w-[150px]">
                  Coverage
                </th>
              </tr>
            </thead>
            <tbody>
              {workDays.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const today = isSameDay(day, new Date());
                return (
                  <tr key={dateStr} className={cn(today && 'bg-primary/5')}>
                    <td
                      className={cn(
                        'sticky left-0 z-10 border-b border-r px-3 py-2 font-medium whitespace-nowrap',
                        today ? 'bg-primary/10' : 'bg-background',
                      )}
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
                          className="border-b border-r px-1 py-1 align-top cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => onCellClick(employee, day)}
                          title={cellClickTitle(employee)}
                        >
                          <div className="flex flex-col gap-1 min-h-[2rem]">
                            {entries.map((entry) => {
                              const times = getShiftTimes(entry);
                              const shiftLabel = SHIFT_LABELS[entry.shift_type];
                              return (
                                <div
                                  key={entry.id}
                                  className={cn(
                                    'rounded px-1 py-0.5 text-[10px] leading-tight',
                                    getActivityColor(entry),
                                  )}
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
                        'sticky right-0 z-10 border-b border-l px-3 py-2 align-top',
                        today ? 'bg-primary/10' : 'bg-background',
                      )}
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
