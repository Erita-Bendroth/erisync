import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, getDay } from "date-fns";
import { Phone, CheckCircle2, XCircle } from "lucide-react";
import { cn, formatUserName } from "@/lib/utils";

interface MonthlyScheduleEntry {
  user_id: string;
  date: string;
  availability_status: string;
  activity_type: string;
  shift_type: string;
  notes?: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface MonthlyScheduleViewProps {
  currentMonth: Date;
  teamId: string;
  userId: string;
}

export function MonthlyScheduleView({ currentMonth, teamId, userId }: MonthlyScheduleViewProps) {
  const [scheduleData, setScheduleData] = useState<MonthlyScheduleEntry[]>([]);
  const [allTeamMembers, setAllTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  useEffect(() => {
    fetchMonthlySchedule();
  }, [currentMonth, teamId, userId]);

  const fetchMonthlySchedule = async () => {
    try {
      setLoading(true);

      // Get team members
      const { data: teamMembers, error: membersError } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId);

      if (membersError) throw membersError;

      const memberIds = [...new Set(teamMembers?.map(m => m.user_id) || [])];

      // Get schedule entries for all team members for the entire month - include notes for time blocks
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("schedule_entries")
        .select("user_id, date, availability_status, activity_type, shift_type, notes")
        .in("user_id", memberIds)
        .gte("date", format(monthStart, "yyyy-MM-dd"))
        .lte("date", format(monthEnd, "yyyy-MM-dd"));

      if (scheduleError) throw scheduleError;

      // Get profiles for team members
      const { data: profiles, error: profilesError } = await supabase
        .rpc("get_multiple_basic_profile_info", { _user_ids: memberIds });

      if (profilesError) throw profilesError;

      // Store all team members
      setAllTeamMembers(profiles || []);

      // Combine schedule data with profile info
      const combined = (scheduleData || []).map(entry => {
        const profile = profiles?.find(p => p.user_id === entry.user_id);
        return {
          ...entry,
          first_name: profile?.first_name || "Unknown",
          last_name: profile?.last_name || "",
          initials: profile?.initials || "?",
        };
      });

      setScheduleData(combined);
    } catch (error) {
      console.error("Error fetching monthly schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEntriesForUserAndDay = (userId: string, day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return scheduleData.filter(entry => {
      // Normalize the entry date to YYYY-MM-DD format
      const entryDate = typeof entry.date === 'string' 
        ? entry.date.split('T')[0] 
        : format(new Date(entry.date), "yyyy-MM-dd");
      return entry.user_id === userId && entryDate === dateStr;
    });
  };

  // Helper to check if entry has hotline support (either as main activity or in time blocks)
  const hasHotlineSupport = (entry: MonthlyScheduleEntry): boolean => {
    // Check main activity type
    if (entry.activity_type === "hotline_support") {
      return true;
    }
    
    // Check time blocks in notes
    if (entry.notes) {
      const timeSplitPattern = /Times:\s*(.+)/;
      const match = entry.notes.match(timeSplitPattern);
      if (match) {
        try {
          const timesData = JSON.parse(match[1]);
          if (Array.isArray(timesData)) {
            return timesData.some(block => block.activity_type === "hotline_support");
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    return false;
  };

  const getHotlinePersonForDay = (day: Date): MonthlyScheduleEntry | null => {
    const dateStr = format(day, "yyyy-MM-dd");
    return (
      scheduleData.find(entry => {
        const entryDate = typeof entry.date === 'string' 
          ? entry.date.split('T')[0] 
          : format(new Date(entry.date), "yyyy-MM-dd");
        return entryDate === dateStr && hasHotlineSupport(entry);
      }) || null
    );
  };

  // Get unique users from all team members
  const uniqueUsers = allTeamMembers
    .map(profile => ({
      user_id: profile.user_id,
      first_name: profile.first_name || "Unknown",
      last_name: profile.last_name || "",
      initials: profile.initials || "?",
    }))
    .sort((a, b) => a.first_name.localeCompare(b.first_name));

  // Group days by week for better display
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  allDays.forEach((day, index) => {
    const dayOfWeek = getDay(day);
    
    // Start new week on Monday (1)
    if (dayOfWeek === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    
    currentWeek.push(day);
    
    // Last day - push remaining week
    if (index === allDays.length - 1) {
      weeks.push(currentWeek);
    }
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading monthly schedule...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hotline Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-purple-500" />
            Monthly Hotline Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-2">
                {week.map((day, dayIndex) => {
                  const hotlinePerson = getHotlinePersonForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isWeekendDay = isWeekend(day);

                  return (
                    <div
                      key={dayIndex}
                      className={cn(
                        "p-2 border rounded text-center",
                        isToday && "border-primary bg-primary/5",
                        isWeekendDay && "bg-muted/30"
                      )}
                    >
                      <div className="text-xs font-semibold">
                        {format(day, "EEE")}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {format(day, "MMM d")}
                      </div>
                      {hotlinePerson ? (
                        <div className="text-center">
                          <div className="w-6 h-6 mx-auto rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-semibold">
                            {hotlinePerson.initials}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">-</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Availability - {format(currentMonth, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48 font-semibold sticky left-0 bg-background z-10">
                    Team Member
                  </TableHead>
                  {allDays.map((day, index) => {
                    const isToday = isSameDay(day, new Date());
                    const isWeekendDay = isWeekend(day);
                    return (
                      <TableHead
                        key={index}
                        className={cn(
                          "text-center font-semibold min-w-[60px]",
                          isToday && "bg-primary/5",
                          isWeekendDay && "bg-muted/30"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs">{format(day, "EEE")}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {format(day, "d")}
                          </span>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueUsers.map((user) => {
                  const isCurrentUser = user.user_id === userId;
                  return (
                    <TableRow 
                      key={user.user_id}
                      className={cn(
                        isCurrentUser && "bg-primary/5 border-l-4 border-l-primary"
                      )}
                    >
                      <TableCell className={cn(
                        "font-medium sticky left-0 z-10",
                        isCurrentUser ? "bg-primary/5" : "bg-background"
                      )}>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                            isCurrentUser ? "bg-primary text-primary-foreground" : "bg-primary/10"
                          )}>
                            {user.initials}
                          </div>
                          <span className={cn(
                            "text-sm",
                            isCurrentUser && "font-bold"
                          )}>
                            {formatUserName(user.first_name, user.last_name)}
                          </span>
                        </div>
                      </TableCell>
                      {allDays.map((day, dayIndex) => {
                        const entries = getEntriesForUserAndDay(user.user_id, day);
                        const isAvailable = entries.some(
                          e => e.availability_status === "available"
                        );
                        const isHotline = entries.some(e => hasHotlineSupport(e));
                        const isToday = isSameDay(day, new Date());
                        const isWeekendDay = isWeekend(day);

                        return (
                          <TableCell
                            key={dayIndex}
                            className={cn(
                              "text-center p-1",
                              isCurrentUser && "bg-primary/5",
                              isToday && !isCurrentUser && "bg-primary/5",
                              isWeekendDay && !isCurrentUser && "bg-muted/30"
                            )}
                          >
                          {entries.length > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              {isHotline ? (
                                <Phone className="h-4 w-4 text-purple-500" />
                              ) : isAvailable ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                {uniqueUsers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={allDays.length + 1}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No team members found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
