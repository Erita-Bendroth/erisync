import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScheduleEntry } from '@/hooks/useSchedulerState';
import { ShiftTypeOption } from '@/hooks/useShiftTypes';

interface TeamMember {
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface TeamSectionData {
  teamId: string;
  teamName: string;
  members: TeamMember[];
  color: string;
}

interface MonthlyGridViewProps {
  teamSections: TeamSectionData[];
  dates: string[];
  scheduleEntries: ScheduleEntry[];
  shiftTypes: ShiftTypeOption[];
  showHolidays: boolean;
}

const groupByMonth = (dates: string[]): Map<string, string[]> => {
  const months = new Map<string, string[]>();
  dates.forEach(date => {
    const monthKey = date.substring(0, 7); // "2025-11"
    if (!months.has(monthKey)) months.set(monthKey, []);
    months.get(monthKey)!.push(date);
  });
  return months;
};

const getMonthStats = (dates: string[], entries: ScheduleEntry[]) => {
  const uniqueUsers = new Set(
    entries.filter(e => dates.includes(e.date) && e.activity_type === 'work').map(e => e.user_id)
  );
  return uniqueUsers.size;
};

const countShiftTypesForDate = (date: string, entries: ScheduleEntry[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  entries
    .filter(e => e.date === date && e.shift_type && e.activity_type === 'work')
    .forEach(e => {
      counts[e.shift_type!] = (counts[e.shift_type!] || 0) + 1;
    });
  return counts;
};

const countTeamDaysInMonth = (
  team: TeamSectionData,
  monthDates: string[],
  entries: ScheduleEntry[]
) => {
  return entries.filter(e =>
    monthDates.includes(e.date) &&
    team.members.some(m => m.user_id === e.user_id) &&
    e.activity_type === 'work'
  ).length;
};

const getShiftColor = (shiftType: string): string => {
  switch (shiftType) {
    case 'early':
      return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300';
    case 'late':
      return 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300';
    case 'normal':
      return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300';
    case 'weekend':
      return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export const MonthlyGridView: React.FC<MonthlyGridViewProps> = ({
  teamSections,
  dates,
  scheduleEntries,
  shiftTypes,
}) => {
  const monthGroups = groupByMonth(dates);

  return (
    <div className="p-4">
      <Accordion type="multiple" className="space-y-4" defaultValue={Array.from(monthGroups.keys())}>
        {Array.from(monthGroups.entries()).map(([monthKey, monthDates]) => {
          const firstDate = new Date(monthDates[0]);
          const monthStart = startOfMonth(firstDate);
          const monthEnd = endOfMonth(firstDate);
          const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
          const startDay = getDay(monthStart);

          return (
            <AccordionItem key={monthKey} value={monthKey} className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 bg-muted hover:bg-muted/80 rounded-t-lg">
                <div className="flex items-center justify-between w-full pr-4">
                  <h3 className="font-semibold text-foreground">
                    {format(firstDate, 'MMMM yyyy')}
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {getMonthStats(monthDates, scheduleEntries)} people scheduled
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="pt-4">
                {/* Calendar Grid */}
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-7 gap-2">
                    {/* Day headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}

                    {/* Empty cells for days before month starts */}
                    {Array.from({ length: startDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {/* Calendar days */}
                    {allDaysInMonth.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const isInRange = monthDates.includes(dateStr);
                      const shiftCounts = isInRange ? countShiftTypesForDate(dateStr, scheduleEntries) : {};
                      const totalScheduled = Object.values(shiftCounts).reduce((a, b) => a + b, 0);
                      const isWeekend = getDay(day) === 0 || getDay(day) === 6;

                      return (
                        <div
                          key={dateStr}
                          className={`aspect-square border rounded-lg p-2 ${
                            isInRange
                              ? isWeekend
                                ? 'bg-muted/50 border-border'
                                : 'bg-card border-border'
                              : 'bg-muted/20 border-border/50'
                          }`}
                        >
                          <div className="flex flex-col h-full">
                            <div className={`text-xs font-medium ${isInRange ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {format(day, 'd')}
                            </div>
                            {isInRange && totalScheduled > 0 && (
                              <div className="flex-1 flex flex-col gap-0.5 mt-1">
                                <div className="text-xs font-semibold text-foreground">
                                  {totalScheduled} staff
                                </div>
                                <div className="flex flex-wrap gap-0.5">
                                  {shiftTypes.map(shift =>
                                    shiftCounts[shift.type] > 0 ? (
                                      <Badge
                                        key={shift.type}
                                        variant="outline"
                                        className={`text-[10px] px-1 py-0 h-4 ${getShiftColor(shift.type)}`}
                                      >
                                        {shift.label.charAt(0)}{shiftCounts[shift.type]}
                                      </Badge>
                                    ) : null
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team breakdown */}
                <div className="border-t px-4 py-4 bg-muted/30">
                  <h4 className="font-semibold text-foreground mb-3">Team Breakdown</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {teamSections.map(team => {
                      const scheduledDays = countTeamDaysInMonth(team, monthDates, scheduleEntries);
                      return (
                        <div key={team.teamId} className="flex items-center justify-between p-2 rounded bg-card border border-border">
                          <span className="font-medium text-sm text-foreground">{team.teamName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {scheduledDays} scheduled days
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};
