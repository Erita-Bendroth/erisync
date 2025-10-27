import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, TrendingUp, AlertTriangle, Clock, Activity } from "lucide-react";
import { CoverageHeatmap } from "@/components/schedule/CoverageHeatmap";
import { FairnessAnalysis } from "@/components/schedule/FairnessAnalysis";
import { CoverageAlerts } from "@/components/schedule/CoverageAlerts";
import { useCoverageAnalysis } from "@/hooks/useCoverageAnalysis";
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function UnifiedDashboard() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Fetch user's accessible teams
  const { data: teams = [] } = useQuery({
    queryKey: ["accessible-teams"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = userRoles?.map(r => r.role) || [];
      const isAdmin = roles.includes("admin");
      const isPlanner = roles.includes("planner");

      if (isAdmin || isPlanner) {
        const { data } = await supabase
          .from("teams")
          .select("*")
          .order("name");
        return data || [];
      }

      // For managers, get their accessible teams
      const { data } = await supabase.rpc("get_manager_accessible_teams", {
        _manager_id: user.id,
      });

      if (data && data.length > 0) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .in("id", data)
          .order("name");
        return teamData || [];
      }

      return [];
    },
  });

  // Auto-select first 3 teams
  useEffect(() => {
    if (teams.length > 0 && selectedTeams.length === 0) {
      setSelectedTeams(teams.slice(0, 3).map(t => t.id));
    }
  }, [teams, selectedTeams.length]);

  // Fetch schedule entries for overview
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  const { data: scheduleData = [] } = useQuery({
    queryKey: ["unified-schedule", selectedTeams, weekStart, weekEnd],
    queryFn: async () => {
      if (selectedTeams.length === 0) return [];

      const { data } = await supabase
        .from("schedule_entries")
        .select(`
          *,
          profiles:user_id (first_name, last_name, initials),
          teams:team_id (name)
        `)
        .in("team_id", selectedTeams)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("date");

      return data || [];
    },
    enabled: selectedTeams.length > 0,
  });

  // Fetch recent changes
  const { data: recentChanges = [] } = useQuery({
    queryKey: ["recent-changes", selectedTeams],
    queryFn: async () => {
      if (selectedTeams.length === 0) return [];

      const { data: changes } = await supabase
        .from("schedule_change_log")
        .select("*")
        .in("team_id", selectedTeams)
        .order("changed_at", { ascending: false })
        .limit(10);

      if (!changes || changes.length === 0) return [];

      // Fetch changed_by profiles and teams separately
      const userIds = [...new Set(changes.map(c => c.changed_by))];
      const teamIds = [...new Set(changes.map(c => c.team_id))];

      const [{ data: profiles }, { data: teams }] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds),
        supabase.from("teams").select("id, name").in("id", teamIds),
      ]);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));
      const teamMap = new Map(teams?.map(t => [t.id, t]));

      return changes.map(change => ({
        ...change,
        changed_by_profile: profileMap.get(change.changed_by),
        team: teamMap.get(change.team_id),
      }));
    },
    enabled: selectedTeams.length > 0,
  });

  // Fetch upcoming holidays for selected teams' members
  const { data: upcomingHolidays = [] } = useQuery({
    queryKey: ["upcoming-holidays", selectedTeams],
    queryFn: async () => {
      if (selectedTeams.length === 0) return [];

      // Get all team members from selected teams
      const { data: teamMembers } = await supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", selectedTeams);

      if (!teamMembers || teamMembers.length === 0) return [];

      // Get their profiles to extract country codes
      const userIds = [...new Set(teamMembers.map(tm => tm.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("country_code")
        .in("user_id", userIds);

      if (!profiles || profiles.length === 0) return [];

      // Extract unique country codes
      const countryCodes = [...new Set(
        profiles
          .map(p => p.country_code)
          .filter(code => code !== null && code !== undefined)
      )];

      if (countryCodes.length === 0) return [];

      // Fetch holidays only for those countries
      const { data } = await supabase
        .from("holidays")
        .select("*")
        .gte("date", format(new Date(), "yyyy-MM-dd"))
        .lte("date", format(addWeeks(new Date(), 4), "yyyy-MM-dd"))
        .eq("is_public", true)
        .is("user_id", null)
        .in("country_code", countryCodes)
        .order("date")
        .limit(5);

      return data || [];
    },
    enabled: selectedTeams.length > 0,
  });

  // Calculate quick stats
  const totalShifts = scheduleData.length;
  const workShifts = scheduleData.filter(s => s.activity_type === "work").length;
  const vacationDays = scheduleData.filter(s => s.activity_type === "vacation").length;
  const weekendShifts = scheduleData.filter(s => {
    const date = new Date(s.date);
    const day = date.getDay();
    return (day === 0 || day === 6) && s.activity_type === "work";
  }).length;

  // Use coverage analysis hook for alerts
  const coverageAnalysis = useCoverageAnalysis({
    teamIds: selectedTeams,
    startDate: weekStart,
    endDate: weekEnd,
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Unified Scheduling Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive view of schedules, coverage, and team capacity
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/schedule")}>
            <Calendar className="w-4 h-4 mr-2" />
            Schedule View
          </Button>
          <Button variant="outline" onClick={() => navigate("/analytics")}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Analytics
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShifts}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Work Shifts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workShifts}</div>
            <p className="text-xs text-muted-foreground">
              {totalShifts > 0 ? Math.round((workShifts / totalShifts) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekend Shifts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekendShifts}</div>
            <p className="text-xs text-muted-foreground">Saturday & Sunday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vacation Days</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vacationDays}</div>
            <p className="text-xs text-muted-foreground">Approved time off</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Analysis</TabsTrigger>
          <TabsTrigger value="fairness">Fairness Metrics</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Coverage Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Coverage Alerts
                </CardTitle>
                <CardDescription>
                  Critical coverage gaps and warnings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTeams.length > 0 && !coverageAnalysis.isLoading ? (
                  <CoverageAlerts analysis={coverageAnalysis} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedTeams.length === 0 
                      ? "Select teams to view coverage alerts"
                      : "Loading coverage analysis..."}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Holidays */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Holidays</CardTitle>
                <CardDescription>Next 4 weeks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingHolidays.length > 0 ? (
                    upcomingHolidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex items-center justify-between p-2 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium">{holiday.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(holiday.date), "MMMM d, yyyy")}
                          </p>
                        </div>
                        <Badge variant="outline">{holiday.country_code}</Badge>
                      </div>
                    ))
                  ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedTeams.length === 0 
                      ? "Select teams to view relevant holidays"
                      : "No upcoming holidays for your team members' countries in the next 4 weeks"}
                  </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Teams to Monitor</CardTitle>
              <CardDescription>
                Choose up to 5 teams for the unified view
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {teams.map((team) => (
                  <Badge
                    key={team.id}
                    variant={selectedTeams.includes(team.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedTeams((prev) =>
                        prev.includes(team.id)
                          ? prev.filter((id) => id !== team.id)
                          : prev.length < 5
                          ? [...prev, team.id]
                          : prev
                      );
                    }}
                  >
                    {team.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coverage Heatmap</CardTitle>
              <CardDescription>
                Visual representation of team coverage across the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTeams.length > 0 ? (
                <CoverageHeatmap
                  teamIds={selectedTeams}
                  startDate={weekStart}
                  endDate={weekEnd}
                  teams={teams.filter(t => selectedTeams.includes(t.id))}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select teams to view coverage heatmap
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fairness" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fairness Analysis</CardTitle>
              <CardDescription>
                Workload distribution and fairness metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedTeams.length > 0 ? (
                <FairnessAnalysis
                  teamId={selectedTeams[0]}
                  historicalMonths={6}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select at least one team to view fairness analysis
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Changes</CardTitle>
              <CardDescription>
                Latest schedule modifications and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentChanges.length > 0 ? (
                  recentChanges.map((change) => (
                    <div
                      key={change.id}
                      className="flex items-start justify-between p-3 rounded-lg border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{change.change_type}</Badge>
                          <span className="text-sm font-medium">
                            {change.team?.name}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Modified by {change.changed_by_profile?.first_name}{" "}
                          {change.changed_by_profile?.last_name}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(change.changed_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recent changes to display
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
