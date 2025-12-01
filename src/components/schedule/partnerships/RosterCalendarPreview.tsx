import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar } from "lucide-react";
import { addWeeks, startOfWeek, format } from "date-fns";

interface Assignment {
  week_number: number;
  user_id: string | null;
  team_id: string;
  user_name: string;
  team_name: string;
  initials: string;
}

interface RosterCalendarPreviewProps {
  rosterId: string;
  startDate: string;
  cycleLength: number;
}

export function RosterCalendarPreview({
  rosterId,
  startDate,
  cycleLength,
}: RosterCalendarPreviewProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();
  }, [rosterId]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from("roster_week_assignments")
        .select(`
          *,
          profiles!roster_week_assignments_user_id_fkey (
            first_name,
            last_name,
            initials
          ),
          teams (
            name
          )
        `)
        .eq("roster_id", rosterId)
        .order("week_number");

      if (error) throw error;

      const formattedAssignments = data
        .filter((a: any) => a.user_id !== null)
        .map((assignment: any) => ({
          week_number: assignment.week_number,
          user_id: assignment.user_id,
          team_id: assignment.team_id,
          user_name: assignment.profiles
            ? `${assignment.profiles.first_name} ${assignment.profiles.last_name}`
            : "Unknown",
          team_name: assignment.teams.name,
          initials: assignment.profiles?.initials || "?",
        }));

      setAssignments(formattedAssignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekDates = (weekNumber: number) => {
    const start = startOfWeek(new Date(startDate), { weekStartsOn: 1 });
    const weekStart = addWeeks(start, weekNumber - 1);
    return format(weekStart, "MMM dd");
  };

  const getTeamColor = (teamId: string) => {
    const colors = [
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
      "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
      "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
      "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    ];
    const hash = teamId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          No assignments yet. Build your roster in the "Build Roster" tab.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: cycleLength }, (_, i) => i + 1).map((weekNumber) => {
          const weekAssignments = assignments.filter(
            (a) => a.week_number === weekNumber
          );
          const isEmptyWeek = weekAssignments.length === 0;

          return (
            <Card
              key={weekNumber}
              className={`p-3 ${isEmptyWeek ? "opacity-50 bg-muted" : ""}`}
            >
              <div className="text-sm font-medium mb-2">
                Week {weekNumber}
              </div>
              <div className="text-xs text-muted-foreground mb-2">
                {getWeekDates(weekNumber)}
              </div>
              {isEmptyWeek ? (
                <div className="text-xs italic text-muted-foreground">
                  No coverage
                </div>
              ) : (
                <div className="space-y-1">
                  {weekAssignments.map((assignment) => (
                    <Badge
                      key={assignment.user_id}
                      variant="secondary"
                      className={`text-xs ${getTeamColor(assignment.team_id)}`}
                    >
                      {assignment.initials}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="text-sm text-muted-foreground space-y-1">
        <p>• Calendar shows the rotation cycle repeating throughout the year</p>
        <p>• Empty weeks indicate no duty coverage scheduled</p>
        <p>• Colors represent different teams in the partnership</p>
      </div>
    </div>
  );
}
