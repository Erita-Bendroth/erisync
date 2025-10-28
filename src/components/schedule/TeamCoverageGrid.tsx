import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addDays, endOfWeek, getWeek, getYear } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { groupTeamsByHierarchy } from "@/lib/teamHierarchyUtils";

interface TeamCoverageGridProps {
  teamIds: string[];
  currentDate: Date;
  showHolidays: boolean;
}

interface TeamMemberAssignment {
  userId: string;
  initials: string;
  fullName: string;
  countryCode: string;
  shiftType: string;
  shiftTime: string;
}

interface DayCoverageCell {
  date: string;
  teamId: string;
  teamName: string;
  members: TeamMemberAssignment[];
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  required: number;
  actual: number;
  isGap: boolean;
}

interface Team {
  id: string;
  name: string;
  parent_team_id: string | null;
}

interface Holiday {
  date: string;
  name: string;
}

// Local helper function for displaying member names with country codes
const formatMemberDisplay = (
  firstName: string,
  lastName: string | null,
  initials: string | null,
  countryCode: string | null
): string => {
  const name = initials || firstName;
  
  if (countryCode && countryCode.trim() !== '') {
    return `${name} (${countryCode.toUpperCase()})`;
  }
  
  return name;
};

const getCellColor = (
  members: TeamMemberAssignment[],
  isWeekend: boolean,
  isHoliday: boolean,
  isGap: boolean
) => {
  if (isGap) return 'bg-red-100 dark:bg-red-950/30 border-red-400 border-2';
  if (isWeekend || isHoliday) return 'bg-teal-100 dark:bg-teal-950/30';
  
  const hasEarly = members.some(m => m.shiftType === 'early');
  const hasLate = members.some(m => m.shiftType === 'late');
  
  if (hasEarly && hasLate) return 'bg-yellow-100 dark:bg-yellow-950/30';
  if (hasLate) return 'bg-orange-100 dark:bg-orange-950/30';
  return 'bg-green-100 dark:bg-green-950/30';
};

export function TeamCoverageGrid({ teamIds, currentDate, showHolidays }: TeamCoverageGridProps) {
  const [coverage, setCoverage] = useState<Record<string, Record<string, DayCoverageCell>>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (teamIds.length > 0) {
      fetchCoverageData();
    }
  }, [teamIds, currentDate]);

  const fetchCoverageData = async () => {
    setLoading(true);
    setError(null);
    console.log('Coverage Grid - Fetching data for teams:', teamIds);
    try {
      // Fetch teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name, parent_team_id')
        .in('id', teamIds);

      if (teamsData) {
        console.log('Coverage Grid - Teams fetched:', teamsData);
        setTeams(teamsData);
      } else {
        console.warn('Coverage Grid - No teams data returned');
      }

      // Fetch team members with country codes
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select(`
          user_id,
          team_id,
          profiles:user_id (
            first_name,
            last_name,
            initials,
            country_code
          )
        `)
        .in('team_id', teamIds);

      // Fetch schedule entries
      const { data: scheduleEntries } = await supabase
        .from('schedule_entries')
        .select('*')
        .in('team_id', teamIds)
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('activity_type', 'work');

      // Fetch shift definitions
      const { data: shiftDefs } = await supabase
        .from('shift_time_definitions')
        .select('*')
        .or(`team_id.in.(${teamIds.join(',')}),team_id.is.null`);

      // Fetch holidays
      const { data: holidays } = await supabase
        .from('holidays')
        .select('date, name')
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .eq('is_public', true);

      // Fetch capacity configs
      const { data: capacityConfigs } = await supabase
        .from('team_capacity_config')
        .select('*')
        .in('team_id', teamIds);

      // Build coverage data
      const holidayMap = new Map<string, Holiday>();
      holidays?.forEach(h => holidayMap.set(h.date, h));

      const capacityMap = new Map<string, any>();
      capacityConfigs?.forEach(c => capacityMap.set(c.team_id, c));

      const coverageData: Record<string, Record<string, DayCoverageCell>> = {};

      weekDays.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        const holiday = holidayMap.get(dateStr);

        coverageData[dateStr] = {};

        teamIds.forEach(teamId => {
          const team = teamsData?.find(t => t.id === teamId);
          const capacity = capacityMap.get(teamId);
          const required = isWeekend && capacity?.applies_to_weekends
            ? capacity.min_staff_required
            : capacity?.min_staff_required || 1;

          // Get members working this day on this team
          const workingMembers: TeamMemberAssignment[] = [];
          
          scheduleEntries?.forEach(entry => {
            if (entry.date === dateStr && entry.team_id === teamId) {
              const member = teamMembers?.find(tm => 
                tm.user_id === entry.user_id && tm.team_id === teamId
              );
              
              if (member?.profiles) {
                const profile = member.profiles as any;
                
                // Ensure profile has required fields
                if (!profile.first_name) {
                  console.warn('Profile missing first_name for user:', entry.user_id);
                  return;
                }
                
                const shiftDef = shiftDefs?.find(
                  sd => sd.shift_type === entry.shift_type && 
                  (sd.team_id === teamId || sd.team_id === null)
                );

                const shiftTime = shiftDef 
                  ? `${shiftDef.start_time.substring(0, 5)}-${shiftDef.end_time.substring(0, 5)}`
                  : getDefaultShiftTime(entry.shift_type);

                workingMembers.push({
                  userId: entry.user_id,
                  initials: profile.initials || profile.first_name,
                  fullName: `${profile.first_name} ${profile.last_name || ''}`.trim(),
                  countryCode: profile.country_code || '',
                  shiftType: entry.shift_type,
                  shiftTime
                });
              }
            }
          });

          const actual = workingMembers.length;
          const isGap = actual < required;

          coverageData[dateStr][teamId] = {
            date: dateStr,
            teamId,
            teamName: team?.name || '',
            members: workingMembers,
            isWeekend: isWeekend && showHolidays,
            isHoliday: !!holiday && showHolidays,
            holidayName: holiday?.name,
            required,
            actual,
            isGap
          };
        });
      });

      console.log('Coverage Grid - Coverage data built:', {
        dates: Object.keys(coverageData),
        teams: Object.keys(coverageData[Object.keys(coverageData)[0]] || {})
      });
      setCoverage(coverageData);
    } catch (error) {
      console.error('Coverage Grid - Error fetching coverage data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load coverage data');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultShiftTime = (shiftType: string): string => {
    const defaults: Record<string, string> = {
      early: '06:00-14:00',
      late: '14:00-22:00',
      weekend: '08:00-16:00',
      normal: '08:00-16:00'
    };
    return defaults[shiftType] || '08:00-16:00';
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-destructive mb-2">Error loading coverage grid</div>
          <div className="text-sm text-muted-foreground">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (teamIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Select teams to view coverage grid
        </CardContent>
      </Card>
    );
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No team data available
        </CardContent>
      </Card>
    );
  }

  console.log('Coverage Grid - Rendering with teams:', teams);
  const hierarchicalTeams = groupTeamsByHierarchy(teams);
  console.log('Coverage Grid - Hierarchical teams:', hierarchicalTeams);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs border rounded-lg p-3 bg-muted/30">
        <div className="font-semibold">Color coding:</div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-100 dark:bg-green-950/30 border" />
          <span>Early shift (Mon-Fri)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-100 dark:bg-orange-950/30 border" />
          <span>Late shift (Mon-Fri)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-teal-100 dark:bg-teal-950/30 border" />
          <span>Weekend/Holiday</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-100 dark:bg-yellow-950/30 border" />
          <span>Mixed shifts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-100 dark:bg-red-950/30 border-2 border-red-400" />
          <span>⚠️ Coverage gap</span>
        </div>
      </div>

      {/* Coverage Grid */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-semibold sticky left-0 bg-muted/50 z-10 min-w-[120px]">
                Date / Day
              </th>
              {hierarchicalTeams.topLevel.map(team => {
                const children = hierarchicalTeams.childrenMap.get(team.id) || [];
                const colSpan = children.length || 1;
                
                return (
                  <th
                    key={team.id}
                    colSpan={colSpan}
                    className="p-3 text-center font-semibold border-l"
                  >
                    {team.name}
                  </th>
                );
              })}
            </tr>
            {/* Sub-header for child teams */}
            <tr className="border-b bg-muted/30">
              <th className="p-2 text-xs text-left sticky left-0 bg-muted/30 z-10">
                
              </th>
              {hierarchicalTeams.topLevel.map(parentTeam => {
                const children = hierarchicalTeams.childrenMap.get(parentTeam.id) || [];
                
                if (children.length > 0) {
                  return children.map(child => (
                    <th key={child.id} className="p-2 text-xs text-center border-l">
                      {child.name.replace(parentTeam.name, '').replace('-', '').trim()}
                    </th>
                  ));
                } else {
                  return (
                    <th key={parentTeam.id} className="p-2 text-xs text-center border-l">
                      All members
                    </th>
                  );
                }
              })}
            </tr>
          </thead>
          <tbody>
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayName = format(day, 'EEE');
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;

              return (
                <tr key={dateStr} className="border-b hover:bg-muted/20">
                  <td className="p-3 sticky left-0 bg-background z-10 font-medium border-r">
                    <div className="flex flex-col">
                      <span className="font-semibold">{format(day, 'dd MMM')}</span>
                      <span className="text-xs text-muted-foreground">{dayName}</span>
                    </div>
                  </td>
                  {hierarchicalTeams.topLevel.map(parentTeam => {
                    const children = hierarchicalTeams.childrenMap.get(parentTeam.id) || [];
                    const teamsToShow = children.length > 0 ? children : [parentTeam];

                    return teamsToShow.map(team => {
                      const cell = coverage[dateStr]?.[team.id];

                      if (!cell) {
                        return (
                          <td key={team.id} className="p-2 border-l text-center text-muted-foreground">
                            -
                          </td>
                        );
                      }

                      const colorClass = getCellColor(
                        cell.members,
                        cell.isWeekend,
                        cell.isHoliday,
                        cell.isGap
                      );

                      return (
                        <td key={team.id} className={`p-2 min-h-[80px] border-l ${colorClass}`}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-help">
                                  {cell.isGap && (
                                    <div className="text-red-600 dark:text-red-400 font-bold text-xs mb-1">
                                      ⚠️ {cell.actual}/{cell.required}
                                    </div>
                                  )}
                                  <div className="flex flex-col gap-0.5">
                                    {cell.members.map(member => (
                                      <div key={member.userId} className="text-xs font-medium">
                                        {formatMemberDisplay(
                                          member.fullName.split(' ')[0],
                                          member.fullName.split(' ')[1] || null,
                                          member.initials,
                                          member.countryCode
                                        )}
                                      </div>
                                    ))}
                                    {cell.members.length === 0 && (
                                      <div className="text-muted-foreground text-xs">No coverage</div>
                                    )}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <div className="space-y-1">
                                  <div className="font-bold">{format(day, 'EEEE, MMM d')}</div>
                                  <div className="text-sm">{cell.teamName}</div>
                                  {cell.isHoliday && (
                                    <div className="text-purple-600 dark:text-purple-400 text-xs">
                                      🎉 {cell.holidayName}
                                    </div>
                                  )}
                                  <div className="border-t pt-1 mt-1">
                                    {cell.members.map(member => (
                                      <div key={member.userId} className="text-xs">
                                        <span className="font-medium">{member.fullName}</span>
                                        {member.countryCode && (
                                          <span className="text-muted-foreground"> ({member.countryCode})</span>
                                        )}
                                        <span className="text-muted-foreground"> • {member.shiftTime}</span>
                                      </div>
                                    ))}
                                  </div>
                                  {cell.isGap && (
                                    <div className="text-red-600 dark:text-red-400 text-xs mt-1">
                                      ⚠️ Gap: {cell.required - cell.actual} more needed
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      );
                    });
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
