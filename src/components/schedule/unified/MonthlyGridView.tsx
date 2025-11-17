import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ScheduleEntry } from '@/hooks/useSchedulerState';
import { ShiftTypeOption } from '@/hooks/useShiftTypes';
import { ShiftTypeCounterRow } from './ShiftTypeCounterRow';
import { ShiftDistributionPopover } from './ShiftDistributionPopover';
import { Users } from 'lucide-react';

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

const getTeamAbbreviation = (teamName: string): string => {
  // Handle teams with " - " separator (e.g., "Turbine Troubleshooting Central - South" → "TTC-S")
  if (teamName.includes(' - ')) {
    const [main, sub] = teamName.split(' - ');
    const mainAbbr = main.split(' ')
      .filter(word => word.length > 3) // Only significant words
      .map(word => word.charAt(0).toUpperCase())
      .join('');
    const subAbbr = sub.charAt(0).toUpperCase();
    return `${mainAbbr}-${subAbbr}`;
  }
  
  // For simple names, take first letters of significant words
  return teamName.split(' ')
    .filter(word => word.length > 3)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 4); // Max 4 letters
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

  const groupEntriesByTeam = (entries: ScheduleEntry[]) => {
    const grouped = new Map<string, { team: TeamSectionData; entries: ScheduleEntry[] }>();
    
    entries.forEach(entry => {
      const team = teamSections.find(t => 
        t.members.some(m => m.user_id === entry.user_id)
      );
      
      if (team) {
        const key = team.teamId;
        if (!grouped.has(key)) {
          grouped.set(key, { team, entries: [] });
        }
        grouped.get(key)!.entries.push(entry);
      }
    });
    
    return Array.from(grouped.values());
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
                {/* Calendar Grid */}
                <div className="px-4 pb-4 pt-4">
                  <div className="grid grid-cols-7 gap-1">
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
                        <ShiftDistributionPopover
                          key={dateStr}
                          date={dateStr}
                          scheduleEntries={scheduleEntries}
                          shiftTypes={shiftTypes}
                          teamSections={teamSections}
                          showTeamBreakdown={true}
                        >
                          <div
                            data-date={dateStr}
                            className={`aspect-square border rounded-lg p-1 cursor-help hover:ring-2 hover:ring-primary/20 transition-all ${
                              isInRange
                                ? isWeekend
                                  ? 'bg-muted/50 border-border'
                                  : 'bg-card border-border'
                                : 'bg-muted/20 border-border/50'
                            }`}
                          >
                            <div className="flex flex-col h-full gap-0.5">
                              <div className={`text-[10px] font-medium flex items-center justify-between ${isInRange ? 'text-foreground' : 'text-muted-foreground'}`}>
                                <span>{format(day, 'd')}</span>
                                {isInRange && dayEntries.length > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    <Users className="h-2 w-2 text-muted-foreground" />
                                    <span className="text-[8px] text-muted-foreground">{dayEntries.length}</span>
                                  </div>
                                )}
                              </div>
                              {isInRange && dayEntries.length > 0 && (
                                <>
                                  <div className="flex-1 flex flex-col gap-1 overflow-hidden mt-0.5">
                                    {groupEntriesByTeam(dayEntries).map(({ team, entries }) => (
                                      <div key={team.teamId} className="flex flex-col gap-0.5">
                                        {/* Team abbreviation header */}
                                        <div className={`text-[8px] font-bold ${getTeamColor(team.color)} px-0.5 py-0 rounded`}>
                                          {getTeamAbbreviation(team.teamName)}
                                        </div>
                                        
                                        {/* Team members */}
                                        {entries.slice(0, 3).map(entry => {
                                          const member = team.members.find(m => m.user_id === entry.user_id);
                                          
                                          return (
                                            <div key={entry.id} className="flex items-center gap-0.5 text-[8px] leading-tight pl-1">
                                              {/* Person initials */}
                                              <span className="font-medium text-foreground min-w-[22px]">
                                                {member?.initials || '??'}
                                              </span>
                                              {/* Shift type badge */}
                                              {entry.shift_type && (
                                                <Badge 
                                                  variant="outline"
                                                  className={`px-0.5 h-3 min-w-[10px] text-[7px] ${getShiftColor(entry.shift_type)}`}
                                                >
                                                  {entry.shift_type.charAt(0).toUpperCase()}
                                                </Badge>
                                              )}
                                            </div>
                                          );
                                        })}
                                        
                                        {/* Show count if more entries */}
                                        {entries.length > 3 && (
                                          <div className="text-[7px] text-muted-foreground pl-1">
                                            +{entries.length - 3}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {/* Shift counts at bottom of cell */}
                                  {Object.keys(shiftCounts).length > 0 && (
                                    <div className="flex flex-wrap gap-0.5 mt-auto pt-0.5 border-t border-border/50">
                                      {Object.entries(shiftCounts).map(([shiftType, count]) => (
                                        <Badge
                                          key={shiftType}
                                          variant="outline"
                                          className={`px-1 h-3 text-[7px] ${getShiftColor(shiftType)}`}
                                        >
                                          {shiftType.charAt(0).toUpperCase()}: {count}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </ShiftDistributionPopover>
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
