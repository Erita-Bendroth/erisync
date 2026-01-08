import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay } from "date-fns";
import { Phone, CheckCircle2, XCircle } from "lucide-react";
import { formatUserName } from "@/lib/utils";

interface TeamAvailabilityEntry {
  user_id: string;
  date: string;
  availability_status: string;
  activity_type: string;
  notes?: string;
  shift_type?: string;
  first_name: string;
  last_name: string;
  initials: string;
}

interface TeamAvailabilityViewProps {
  workDays: Date[];
  userId: string;
}

export function TeamAvailabilityView({ workDays, userId }: TeamAvailabilityViewProps) {
  const [availabilityData, setAvailabilityData] = useState<TeamAvailabilityEntry[]>([]);
  const [allTeamMembers, setAllTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamAvailability();
  }, [workDays, userId]);

  const fetchTeamAvailability = async () => {
    try {
      setLoading(true);

      // Get user's teams
      const { data: userTeams, error: teamsError } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", userId);

      if (teamsError) throw teamsError;

      if (!userTeams || userTeams.length === 0) {
        setAvailabilityData([]);
        return;
      }

      const teamIds = userTeams.map(t => t.team_id);
      const startDate = format(workDays[0], "yyyy-MM-dd");
      const endDate = format(workDays[workDays.length - 1], "yyyy-MM-dd");

      // Get all team members
      const { data: teamMembers, error: membersError } = await supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", teamIds);

      if (membersError) throw membersError;

      const memberIds = [...new Set(teamMembers?.map(m => m.user_id) || [])];

      // Get schedule entries for all team members - include notes for time block parsing
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("schedule_entries")
        .select("user_id, date, availability_status, activity_type, notes, shift_type")
        .in("user_id", memberIds)
        .gte("date", startDate)
        .lte("date", endDate);

      if (scheduleError) throw scheduleError;
      
      console.log('TeamAvailabilityView - Schedule entries:', {
        total: scheduleData?.length || 0,
        dateRange: `${startDate} to ${endDate}`,
      });

      // Get profiles for team members
      const { data: profiles, error: profilesError } = await supabase
        .rpc("get_multiple_basic_profile_info", { _user_ids: memberIds });

      if (profilesError) throw profilesError;

      // Store all team members (profiles)
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

      setAvailabilityData(combined);
    } catch (error) {
      console.error("Error fetching team availability:", error);
    } finally {
      setLoading(false);
    }
  };

  const getEntriesForUserAndDay = (userId: string, day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return availabilityData.filter(entry => {
      // Normalize the entry date to YYYY-MM-DD format (strip time/timezone)
      const entryDate = typeof entry.date === 'string' 
        ? entry.date.split('T')[0] 
        : format(new Date(entry.date), "yyyy-MM-dd");
      return entry.user_id === userId && entryDate === dateStr;
    });
  };

  // Helper to check if entry has hotline support (either as main activity or in time blocks)
  const hasHotlineSupport = (entry: TeamAvailabilityEntry): boolean => {
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

  const getHotlinePersonForDay = (day: Date): TeamAvailabilityEntry | null => {
    const dateStr = format(day, "yyyy-MM-dd");
    const hotlinePerson = availabilityData.find(entry => {
      // Normalize the entry date to YYYY-MM-DD format
      const entryDate = typeof entry.date === 'string' 
        ? entry.date.split('T')[0] 
        : format(new Date(entry.date), "yyyy-MM-dd");
      return entryDate === dateStr && hasHotlineSupport(entry);
    }) || null;
    
    if (dateStr === format(new Date(), "yyyy-MM-dd")) {
      console.log('Hotline check for today:', {
        dateStr,
        found: !!hotlinePerson,
        person: hotlinePerson ? `${hotlinePerson.first_name} ${hotlinePerson.last_name}` : 'none',
        allEntriesForDay: availabilityData.filter(e => {
          const eDate = typeof e.date === 'string' ? e.date.split('T')[0] : format(new Date(e.date), "yyyy-MM-dd");
          return eDate === dateStr;
        }).map(e => ({
          name: `${e.first_name} ${e.last_name}`,
          activity: e.activity_type,
          notes: e.notes?.substring(0, 50)
        }))
      });
    }
    
    return hotlinePerson;
  };

  // Get unique users from all team members (not just those with schedule entries)
  const uniqueUsers = allTeamMembers
    .map(profile => ({
      user_id: profile.user_id,
      first_name: profile.first_name || "Unknown",
      last_name: profile.last_name || "",
      initials: profile.initials || "?",
    }))
    .sort((a, b) => a.first_name.localeCompare(b.first_name));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Loading team availability...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hotline Assignment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-purple-500" />
            Hotline Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {workDays.map((day, index) => {
              const hotlinePerson = getHotlinePersonForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`p-3 border rounded-lg ${
                    isToday ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="text-xs font-semibold mb-1 text-center">
                    {format(day, "EEE")}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2 text-center">
                    {format(day, "MMM d")}
                  </div>
                  {hotlinePerson ? (
                    <div className="text-center">
                      <div className="w-8 h-8 mx-auto rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-sm font-semibold mb-1">
                        {hotlinePerson.initials}
                      </div>
                      <p className="text-xs font-medium">
                        {hotlinePerson.first_name}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">
                      No assignment
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Team Availability Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Availability</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48 font-semibold sticky left-0 bg-background z-10">
                    Team Member
                  </TableHead>
                  {workDays.map((day, index) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <TableHead
                        key={index}
                        className={`text-center font-semibold ${
                          isToday ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{format(day, "EEE")}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {format(day, "MMM d")}
                          </span>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueUsers.map((user) => (
                <TableRow key={user.user_id}>
                    <TableCell className="font-medium sticky left-0 bg-background">
                      <div className="flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                          {user.initials}
                        </div>
                      </div>
                    </TableCell>
                     {workDays.map((day, dayIndex) => {
                      const entries = getEntriesForUserAndDay(user.user_id, day);
                      const isAvailable = entries.some(
                        e => e.availability_status === "available"
                      );
                      const isHotline = entries.some(e => hasHotlineSupport(e));
                      const isToday = isSameDay(day, new Date());

                      return (
                        <TableCell
                          key={dayIndex}
                          className={`text-center ${
                            isToday ? "bg-primary/5" : ""
                          }`}
                        >
                          {entries.length > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              {isHotline ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 text-xs"
                                >
                                  <Phone className="h-3 w-3 mr-1" />
                                  Hotline
                                </Badge>
                              ) : isAvailable ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className="text-xs text-muted-foreground">
                                {isAvailable ? "Available" : "Unavailable"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {uniqueUsers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={workDays.length + 1}
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
