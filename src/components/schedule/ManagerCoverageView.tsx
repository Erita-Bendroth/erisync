import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays, getISOWeek, getYear } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ManagerCoverageViewProps {
  selectedWeek: Date;
  onWeekChange: (date: Date) => void;
}

interface DutyAssignment {
  date: string;
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string | null;
  team_id: string;
  team_name: string;
  shift_type: string;
  activity_type: string;
}

export function ManagerCoverageView({ selectedWeek, onWeekChange }: ManagerCoverageViewProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekendDuty, setWeekendDuty] = useState<DutyAssignment[]>([]);
  const [lateShifts, setLateShifts] = useState<DutyAssignment[]>([]);
  const [earlyShifts, setEarlyShifts] = useState<DutyAssignment[]>([]);
  const [accessibleTeams, setAccessibleTeams] = useState<any[]>([]);

  useEffect(() => {
    fetchCoverageData();
  }, [selectedWeek]);

  const fetchCoverageData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get accessible teams
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (teamsError) throw teamsError;
      if (!teams || teams.length === 0) {
        setError("No accessible teams found");
        setLoading(false);
        return;
      }

      setAccessibleTeams(teams);
      const teamIds = teams.map(t => t.id);

      // Calculate week range
      const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      // Fetch schedule entries for the week
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule_entries')
        .select('date, user_id, team_id, shift_type, activity_type')
        .in('team_id', teamIds)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('activity_type', 'work');

      if (scheduleError) throw scheduleError;

      // Get unique user IDs and fetch profile data
      const userIds = [...new Set(scheduleData?.map(e => e.user_id) || [])];
      
      const { data: profilesData } = await supabase
        .rpc('get_multiple_basic_profile_info', {
          _user_ids: userIds
        });

      // Create lookup maps
      const profileMap = new Map(
        profilesData?.map(p => [p.user_id, p]) || []
      );
      
      const teamMap = new Map(
        teams.map(t => [t.id, t.name])
      );

      // Process and categorize the data
      const weekend: DutyAssignment[] = [];
      const late: DutyAssignment[] = [];
      const early: DutyAssignment[] = [];

      scheduleData?.forEach((entry: any) => {
        const date = new Date(entry.date);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const profile = profileMap.get(entry.user_id);

        const assignment: DutyAssignment = {
          date: entry.date,
          user_id: entry.user_id,
          first_name: profile?.first_name || 'Unknown',
          last_name: profile?.last_name || '',
          initials: profile?.initials || null,
          team_id: entry.team_id,
          team_name: teamMap.get(entry.team_id) || 'Unknown Team',
          shift_type: entry.shift_type,
          activity_type: entry.activity_type,
        };

        // Categorize by shift type and weekend
        if (isWeekend) {
          weekend.push(assignment);
        }
        
        if (entry.shift_type === 'late') {
          late.push(assignment);
        }
        
        if (entry.shift_type === 'early') {
          early.push(assignment);
        }
      });

      setWeekendDuty(weekend);
      setLateShifts(late);
      setEarlyShifts(early);
    } catch (err) {
      console.error('Error fetching coverage data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load coverage data');
    } finally {
      setLoading(false);
    }
  };

  const formatUserName = (assignment: DutyAssignment) => {
    if (assignment.initials) {
      return assignment.initials;
    }
    return `${assignment.first_name} ${assignment.last_name}`;
  };

  const groupByDate = (assignments: DutyAssignment[]) => {
    const grouped = new Map<string, Map<string, DutyAssignment[]>>();
    
    assignments.forEach(assignment => {
      if (!grouped.has(assignment.date)) {
        grouped.set(assignment.date, new Map());
      }
      const dateGroup = grouped.get(assignment.date)!;
      if (!dateGroup.has(assignment.team_id)) {
        dateGroup.set(assignment.team_id, []);
      }
      dateGroup.get(assignment.team_id)!.push(assignment);
    });

    return grouped;
  };

  const renderCoverageTable = (title: string, assignments: DutyAssignment[], icon: string) => {
    if (assignments.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{icon}</span>
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No assignments for this week</p>
          </CardContent>
        </Card>
      );
    }

    const groupedByDate = groupByDate(assignments);
    const sortedDates = Array.from(groupedByDate.keys()).sort();

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>{icon}</span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-semibold">Date</th>
                  {accessibleTeams.map(team => (
                    <th key={team.id} className="text-left p-2 font-semibold">{team.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDates.map(date => {
                  const dateObj = new Date(date);
                  const dateGroup = groupedByDate.get(date)!;
                  
                  return (
                    <tr key={date} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">
                        {format(dateObj, 'EEE, MMM d')}
                      </td>
                      {accessibleTeams.map(team => {
                        const teamAssignments = dateGroup.get(team.id) || [];
                        return (
                          <td key={team.id} className="p-2">
                            {teamAssignments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {teamAssignments.map((assignment, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {formatUserName(assignment)}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekNumber = getISOWeek(weekStart);
  const year = getYear(weekStart);

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onWeekChange(addDays(selectedWeek, -7))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="text-center">
              <h2 className="text-2xl font-bold">Week {weekNumber}, {year}</h2>
              <p className="text-sm text-muted-foreground">
                {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onWeekChange(addDays(selectedWeek, 7))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Weekend/Public Holiday Duty */}
          {renderCoverageTable("Weekend/Public Holiday Duty", weekendDuty, "📅")}

          {/* Late Shift */}
          {renderCoverageTable("Late Shift (14:00-20:00)", lateShifts, "🌙")}

          {/* Early Shift */}
          {renderCoverageTable("Early Shift (06:00-14:00)", earlyShifts, "🌅")}
        </div>
      )}
    </div>
  );
}
