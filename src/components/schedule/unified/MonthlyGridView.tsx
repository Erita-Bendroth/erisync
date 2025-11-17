import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScheduleEntry } from '@/hooks/useSchedulerState';
import { ShiftTypeOption } from '@/hooks/useShiftTypes';
import { ShiftTypeCounterRow } from './ShiftTypeCounterRow';

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

const getTeamColor = (color: string): string => {
  const colorMap: Record<string, string> = {
    'blue': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300',
    'green': 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300',
    'purple': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300',
    'orange': 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300',
    'red': 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300',
    'yellow': 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300',
    'pink': 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-950 dark:text-pink-300',
    'indigo': 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300',
  };
  return colorMap[color] || 'bg-muted text-muted-foreground border-border';
};

export const MonthlyGridView: React.FC<MonthlyGridViewProps> = ({
  teamSections,
  dates,
  scheduleEntries,
  shiftTypes,
}) => {
  const monthGroups = groupByMonth(dates);

  const getEntriesForDate = (dateStr: string): ScheduleEntry[] => {
    return scheduleEntries.filter(e => e.date === dateStr && e.activity_type === 'work');
  };

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

              <AccordionContent className="pt-0">
                {/* Shift Type Counter */}
                <ShiftTypeCounterRow
                  dates={monthDates}
                  scheduleEntries={scheduleEntries.filter(e => monthDates.includes(e.date))}
                  shiftTypes={shiftTypes}
                />
                
                {/* Calendar Grid */}
                <div className="px-4 pb-4 pt-4">
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

                      const dayEntries = getEntriesForDate(dateStr);
                      const displayEntries = dayEntries.slice(0, 3);
                      const remainingCount = dayEntries.length - 3;

                      return (
                        <div
                          key={dateStr}
                          data-date={dateStr}
                          className={`aspect-square border rounded-lg p-1.5 ${
                            isInRange
                              ? isWeekend
                                ? 'bg-muted/50 border-border'
                                : 'bg-card border-border'
                              : 'bg-muted/20 border-border/50'
                          }`}
                        >
                          <div className="flex flex-col h-full gap-0.5">
                            <div className={`text-xs font-medium ${isInRange ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {format(day, 'd')}
                            </div>
                            {isInRange && dayEntries.length > 0 && (
                              <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                                 {displayEntries.map(entry => {
                                  const team = teamSections.find(t => 
                                    t.members.some(m => m.user_id === entry.user_id)
                                  );
                                  const member = team?.members.find(m => m.user_id === entry.user_id);
                                  
                                  return (
                                    <div key={entry.id} className="flex items-center gap-0.5 text-[9px] leading-tight">
                                      {/* Person initials with team color background */}
                                      <Badge 
                                        variant="outline" 
                                        className={`px-1 h-3.5 min-w-[20px] text-center font-semibold ${getTeamColor(team?.color || '')}`}
                                      >
                                        {member?.initials || '??'}
                                      </Badge>
                                      {/* Shift type indicator */}
                                      {entry.shift_type && (
                                        <Badge 
                                          variant="outline"
                                          className={`px-0.5 h-3.5 min-w-[12px] text-center ${getShiftColor(entry.shift_type)}`}
                                        >
                                          {entry.shift_type.charAt(0).toUpperCase()}
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                })}
                                {remainingCount > 0 && (
                                  <div className="text-[9px] text-muted-foreground font-medium">
                                    +{remainingCount} more
                                  </div>
                                )}
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
