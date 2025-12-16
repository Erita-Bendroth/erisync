import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Loader2, Moon, Sun, Calendar as CalendarIcon } from "lucide-react";
import {
  addWeeks,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  getDay,
  addMonths,
  differenceInWeeks,
  isBefore,
  isAfter,
} from "date-fns";

interface Assignment {
  week_number: number;
  day_of_week: number | null;
  user_id: string | null;
  team_id: string;
  shift_type: string | null;
  include_weekends: boolean;
  user_name: string;
  team_name: string;
  initials: string;
}

interface RosterCalendarViewProps {
  rosterId: string;
  startDate: string;
  cycleLength: number;
  partnershipId: string;
}

const SHIFT_ICONS: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  late: { 
    icon: <Moon className="h-3 w-3" />, 
    label: "Late", 
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" 
  },
  early: { 
    icon: <Sun className="h-3 w-3" />, 
    label: "Early", 
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" 
  },
  weekend: { 
    icon: <span className="text-xs">🔴</span>, 
    label: "Weekend", 
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" 
  },
  normal: { 
    icon: null, 
    label: "Normal", 
    className: "bg-muted text-muted-foreground" 
  },
};

const TEAM_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300 dark:border-green-700",
  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700",
  "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-700",
  "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300 border-pink-300 dark:border-pink-700",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700",
];

export function RosterCalendarView({
  rosterId,
  startDate,
  cycleLength,
  partnershipId,
}: RosterCalendarViewProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(startDate));
  const [teamColorMap, setTeamColorMap] = useState<Record<string, string>>({});

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
          day_of_week: assignment.day_of_week,
          user_id: assignment.user_id,
          team_id: assignment.team_id,
          shift_type: assignment.shift_type,
          include_weekends: assignment.include_weekends || false,
          user_name: assignment.profiles
            ? `${assignment.profiles.first_name} ${assignment.profiles.last_name}`
            : "Unknown",
          team_name: assignment.teams?.name || "Unknown Team",
          initials: assignment.profiles?.initials || "?",
        }));

      setAssignments(formattedAssignments);

      // Build team color map
      const uniqueTeams = [...new Set(formattedAssignments.map(a => a.team_id))];
      const colorMap: Record<string, string> = {};
      uniqueTeams.forEach((teamId, index) => {
        colorMap[teamId] = TEAM_COLORS[index % TEAM_COLORS.length];
      });
      setTeamColorMap(colorMap);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const rosterStartDate = useMemo(() => {
    return startOfWeek(new Date(startDate), { weekStartsOn: 1 });
  }, [startDate]);

  // Get assignments for a specific date
  const getAssignmentsForDate = (date: Date) => {
    // Check if date is before roster start
    if (isBefore(date, rosterStartDate)) return [];

    // Calculate which week in the cycle this date falls into
    const weeksSinceStart = differenceInWeeks(date, rosterStartDate);
    const cycleWeek = (weeksSinceStart % cycleLength) + 1;
    const dayOfWeek = getDay(date); // 0 = Sunday, 1 = Monday, etc.
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const result: Assignment[] = [];

    // Find assignments for this week
    const weekAssignments = assignments.filter(a => a.week_number === cycleWeek);

    weekAssignments.forEach(assignment => {
      // Day-by-day assignment
      if (assignment.day_of_week !== null) {
        if (assignment.day_of_week === dayOfWeek) {
          result.push(assignment);
        }
      } else {
        // Week-based assignment (Mon-Fri for the shift type)
        if (!isWeekend) {
          result.push(assignment);
        }
        // If include_weekends is set, also show on weekends
        if (isWeekend && assignment.include_weekends) {
          result.push({
            ...assignment,
            shift_type: "weekend", // Show as weekend shift
          });
        }
      }
    });

    return result;
  };

  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Pad start to align with week
    const startDay = getDay(monthStart);
    const paddingStart = startDay === 0 ? 6 : startDay - 1; // Monday = 0 padding

    return { days, paddingStart };
  }, [currentMonth]);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth(prev => addMonths(prev, direction === "next" ? 1 : -1));
  };

  const jumpToToday = () => {
    setCurrentMonth(new Date());
  };

  const jumpToRosterStart = () => {
    setCurrentMonth(new Date(startDate));
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
        <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">
          No assignments yet. Build your roster in the "Weekly Assignments" tab first.
        </p>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[180px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <Button variant="outline" size="icon" onClick={() => navigateMonth("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={jumpToRosterStart}>
              Roster Start
            </Button>
            <Button variant="outline" size="sm" onClick={jumpToToday}>
              Today
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-sm">
          {Object.entries(SHIFT_ICONS).map(([key, { icon, label, className }]) => (
            <div key={key} className="flex items-center gap-1">
              <Badge variant="secondary" className={`${className} text-xs`}>
                {icon}
                <span className="ml-1">{label}</span>
              </Badge>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <Card className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Padding for start of month */}
            {Array.from({ length: calendarDays.paddingStart }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[80px]" />
            ))}

            {/* Actual days */}
            {calendarDays.days.map(day => {
              const dayAssignments = getAssignmentsForDate(day);
              const isBeforeRoster = isBefore(day, rosterStartDate);
              const dayOfWeek = getDay(day);
              const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div
                  key={day.toISOString()}
                  className={`
                    min-h-[80px] p-1 rounded border
                    ${isToday(day) ? "border-primary bg-primary/5" : "border-border"}
                    ${isBeforeRoster ? "bg-muted/30 opacity-50" : ""}
                    ${isWeekendDay && !isBeforeRoster ? "bg-muted/20" : ""}
                  `}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday(day) ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayAssignments.slice(0, 3).map((assignment, idx) => {
                      const shiftInfo = SHIFT_ICONS[assignment.shift_type || "normal"] || SHIFT_ICONS.normal;
                      return (
                        <Tooltip key={`${assignment.user_id}-${idx}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={`
                                flex items-center gap-0.5 px-1 py-0.5 rounded text-xs truncate cursor-default
                                ${teamColorMap[assignment.team_id] || "bg-muted"}
                              `}
                            >
                              {shiftInfo.icon}
                              <span className="font-medium truncate">{assignment.initials}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                              <p className="font-medium">{assignment.user_name}</p>
                              <p className="text-muted-foreground">{assignment.team_name}</p>
                              <p className="text-muted-foreground capitalize">
                                {shiftInfo.label} Shift
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    {dayAssignments.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayAssignments.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Info Footer */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Cycle length: {cycleLength} weeks (pattern repeats)</p>
          <p>• Roster starts: {format(rosterStartDate, "MMMM d, yyyy")}</p>
          <p>• Dates before roster start are grayed out</p>
        </div>
      </div>
    </TooltipProvider>
  );
}
