import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ScheduleEntryForm from "@/components/schedule/ScheduleEntryForm";

interface UserRole {
  role: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
}

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [allUserSchedules, setAllUserSchedules] = useState<any[]>([]); // 👈 New state

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchAllUserSchedules(); // 👈 Fetch team schedule
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", user!.id)
        .single();

      if (profileData) setProfile(profileData);

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (rolesData) setUserRoles(rolesData);

      const { data: teamsData } = await supabase
        .from("team_members")
        .select(`
          teams (
            id,
            name,
            description
          )
        `)
        .eq("user_id", user!.id);

      if (teamsData) {
        const teams = teamsData.map((item: any) => item.teams).filter(Boolean);
        setUserTeams(teams);
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: scheduleData } = await supabase
        .from("schedule_entries")
        .select("*")
        .eq("user_id", user!.id)
        .eq("date", today);

      if (scheduleData) setTodaySchedule(scheduleData);
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUserSchedules = async () => {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("schedule_entries")
      .select(`
        activity,
        start_time,
        end_time,
        date,
        user_id,
        profiles (
          first_name,
          last_name
        )
      `)
      .eq("date", today);

    if (error) {
      console.error("Error fetching all user schedules:", error);
      toast({
        title: "Error",
        description: "Failed to load team schedules",
        variant: "destructive",
      });
    } else {
      setAllUserSchedules(data);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "planner":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "manager":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "teammember":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Getting your dashboard ready</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Scheduler Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.first_name} {profile?.last_name}
            </p>
          </div>
          <Button onClick={handleSignOut} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Your Roles */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Roles</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {userRoles.length > 0 ? (
                  userRoles.map((roleObj, index) => (
                    <Badge
                      key={index}
                      className={getRoleColor(roleObj.role)}
                      variant="secondary"
                    >
                      {roleObj.role}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No roles assigned</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Your Teams */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Teams</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {userTeams.length > 0 ? (
                  userTeams.map((team) => (
                    <div key={team.id} className="text-sm">
                      <p className="font-medium">{team.name}</p>
                      {team.description && (
                        <p className="text-muted-foreground text-xs">{team.description}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No teams assigned</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Your Schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Schedule</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {todaySchedule.length > 0 ? (
                <div className="space-y-2">
                  {todaySchedule.map((entry, index) => (
                    <div key={index} className="text-sm">
                      <p className="font-medium">{entry.activity}</p>
                      <p className="text-muted-foreground">
                        {entry.start_time || 'All day'} - {entry.end_time || ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No schedule entries for today</p>
              )}
            </CardContent>
          </Card>

          {/* Team Schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Schedule Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {allUserSchedules.length > 0 ? (
                <div className="space-y-4">
                  {allUserSchedules.map((entry, index) => (
                    <div key={index} className="text-sm">
                      <p className="font-medium">
                        {entry.profiles?.first_name} {entry.profiles?.last_name}: {entry.activity}
                      </p>
                      <p className="text-muted-foreground">
                        {entry.start_time || 'All day'} - {entry.end_time || ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No team schedule entries for today</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common scheduling tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => navigate("/schedule?tab=schedule")}
              >
                <Calendar className="w-4 h-4 mr-2" />
                View Schedule
              </Button>
              {userRoles.some(role => role.role === "planner" || role.role === "manager") && (
                <ScheduleEntryForm onSuccess={() => {
                  fetchUserData();
                  fetchAllUserSchedules();
                  toast({
                    title: "Success",
                    description: "Schedule entry added successfully",
                  });
                }}>
                  <Button 
                    className="w-full justify-start" 
                    variant="outline"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Add Schedule Entry
                  </Button>
                </ScheduleEntryForm>
              )}
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => navigate("/schedule?tab=schedule")}
              >
                <Users className="w-4 h-4 mr-2" />
                View Team Availability
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest schedule updates</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
