import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, LogOut, Mail, TrendingUp, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";
import ScheduleEntryForm from "@/components/schedule/ScheduleEntryForm";
import { TimeBlockDisplay } from "@/components/schedule/TimeBlockDisplay";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { formatUserName } from "@/lib/utils";
import { PendingRequestsCard } from "@/components/dashboard/PendingRequestsCard";
import { LocationSetupModal } from "@/components/profile/LocationSetupModal";

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
  initials?: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showScheduleChangeNotification } = useDesktopNotifications();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [showLocationSetup, setShowLocationSetup] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  // Set up real-time updates for schedule entries
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('schedule-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'schedule_entries',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Schedule update received:', payload);
          
          // Show desktop notification for schedule changes
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const entry = payload.new as any;
            showScheduleChangeNotification({
              employeeName: profile?.first_name ? formatUserName(profile.first_name, profile.last_name) : 'Your',
              date: format(new Date(entry.date), 'MMM dd, yyyy'),
              changeType: payload.eventType === 'INSERT' ? 'added' : 'updated',
            });
          }
          
          // Refresh today's schedule and weekly overview when any changes occur
          fetchTodaySchedule();
          fetchWeeklySchedule();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, showScheduleChangeNotification]);

  const fetchUserData = async () => {
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, initials, country_code")
        .eq("user_id", user!.id)
        .single() as any;

      if (profileData) {
        setProfile(profileData);
        
        // Check if user needs to set location (new users or default location)
        if (!profileData.country_code || profileData.country_code === 'US') {
          setShowLocationSetup(true);
        }
      }

      // Fetch user roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (rolesData) {
        setUserRoles(rolesData);
      }

      // Fetch user teams
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

      // Fetch today's schedule and weekly overview
      await fetchTodaySchedule();
      await fetchWeeklySchedule();
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

  const fetchTodaySchedule = async () => {
    if (!user) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: scheduleData, error } = await supabase
        .from("schedule_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching today's schedule:", error);
        return;
      }

      setTodaySchedule(scheduleData || []);
    } catch (error) {
      console.error("Error fetching today's schedule:", error);
    }
  };

  const fetchWeeklySchedule = async () => {
    if (!user) return;
    
    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
      
      console.log('Dashboard fetchWeeklySchedule:', {
        userId: user.id,
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(weekEnd, 'yyyy-MM-dd')
      });
      
      // Dashboard should always show only the current user's own schedule
      const { data: scheduleData, error } = await supabase
        .from("schedule_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", format(weekStart, 'yyyy-MM-dd'))
        .lte("date", format(weekEnd, 'yyyy-MM-dd'))
        .order("date", { ascending: true });

      console.log('Dashboard schedule data:', {
        totalEntries: scheduleData?.length || 0,
        entries: scheduleData?.map(entry => ({
          date: entry.date,
          activity_type: entry.activity_type,
          user_id: entry.user_id,
          team_id: entry.team_id,
          id: entry.id
        })) || [],
        fullEntries: scheduleData || []
      });

      if (error) {
        console.error("Error fetching weekly schedule:", error);
        return;
      }

      setWeeklySchedule(scheduleData || []);
    } catch (error) {
      console.error("Error fetching weekly schedule:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getActivityDisplayName = (activityType: string) => {
    switch (activityType) {
      case 'work':
        return 'Work';
      case 'vacation':
        return 'Vacation';
      case 'other':
        return 'Other';
      case 'training':
        return 'Training';
      case 'hotline_support':
        return 'Hotline Support';
      case 'meeting':
        return 'Meeting';
      default:
        return activityType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
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
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile ? formatUserName(profile.first_name, profile.last_name) : 'Loading...'}
        </p>
      </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

          <PendingRequestsCard />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Schedule</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {todaySchedule.length > 0 ? (
                  <div className="space-y-3">
                    {todaySchedule.map((entry, index) => {
                      // Parse time data from entry notes
                      const timeSplitPattern = /Times:\s*(.+)/;
                      const match = entry.notes?.match(timeSplitPattern);
                      let timeBlocks = [];
                      
                      if (match) {
                        try {
                          timeBlocks = JSON.parse(match[1]);
                        } catch (e) {
                          // Fallback to default times
                          timeBlocks = [{
                            start_time: entry.shift_type === 'early' ? '06:00' : entry.shift_type === 'late' ? '13:00' : '08:00',
                            end_time: entry.shift_type === 'early' ? '14:30' : entry.shift_type === 'late' ? '21:30' : '16:30',
                            activity: entry.activity_type
                          }];
                        }
                      } else {
                        // Default time blocks
                        timeBlocks = [{
                          start_time: entry.shift_type === 'early' ? '06:00' : entry.shift_type === 'late' ? '13:00' : '08:00',
                          end_time: entry.shift_type === 'early' ? '14:30' : entry.shift_type === 'late' ? '21:30' : '16:30',
                          activity: entry.activity_type
                        }];
                      }

                      return (
                        <div key={index} className="space-y-3 p-4 border rounded-lg bg-card">
                          {/* Header with main activity type */}
                          <div className="flex items-center justify-between">
                            <Badge variant={
                              entry.activity_type === 'work' ? 'default' :
                              entry.activity_type === 'hotline_support' ? 'secondary' :
                              entry.activity_type === 'vacation' ? 'outline' :
                              entry.activity_type === 'other' ? 'destructive' :
                              entry.activity_type === 'training' ? 'outline' :
                              'default'
                            } className="font-semibold">
                              {getActivityDisplayName(entry.activity_type)}
                            </Badge>
                            <span className="text-xs text-muted-foreground capitalize">
                              {entry.shift_type} shift
                            </span>
                          </div>

                          {/* Reuse shared time-block renderer to match legends */}
                          <TimeBlockDisplay entry={entry} />

                          {/* Update time */}
                          {entry.updated_at && (
                            <div className="flex items-center justify-end text-xs">
                              <span className="text-muted-foreground">
                                Updated: {format(new Date(entry.updated_at), 'HH:mm')}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No schedule entries for today</p>
                  </div>
                )}
              </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>This Week's Schedule</CardTitle>
              <CardDescription>Your schedule overview for the current week</CardDescription>
            </CardHeader>
            <CardContent>
              {weeklySchedule.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const now = new Date();
                    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
                    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                    
                    return days.map((day) => {
                      const daySchedule = weeklySchedule.filter(
                        entry => entry.date === format(day, 'yyyy-MM-dd')
                      );
                      const isToday = format(day, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
                      
                      return (
                        <div key={format(day, 'yyyy-MM-dd')} className={`flex items-center justify-between p-2 rounded ${isToday ? 'bg-primary/10 border border-primary/20' : ''}`}>
                          <div className="flex items-center space-x-3">
                            <span className={`text-sm font-medium min-w-[50px] ${isToday ? 'text-primary' : ''}`}>
                              {format(day, 'EEE')}
                            </span>
                            <span className={`text-xs ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                              {format(day, 'MMM d')}
                            </span>
                          </div>
                          <div className="flex space-x-1">
                            {daySchedule.length > 0 ? (
                              daySchedule.map((entry, idx) => (
                                <Badge 
                                  key={idx} 
                                  variant={
                                    entry.activity_type === 'work' ? 'default' :
                                    entry.activity_type === 'vacation' ? 'outline' :
                                    entry.activity_type === 'other' ? 'destructive' :
                                    'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {getActivityDisplayName(entry.activity_type)}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">No schedule</span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No schedule entries this week</p>
                </div>
              )}
            </CardContent>
          </Card>

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
              
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => navigate("/schedule?tab=settings")}
              >
                <Users className="w-4 h-4 mr-2" />
                User Settings
              </Button>

              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => navigate("/manual")}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                View Manual
              </Button>

              {(userRoles.some(role => ['admin', 'planner', 'manager'].includes(role.role))) && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate("/analytics")}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analytics Dashboard
                </Button>
              )}
              
              {userRoles.some(role => role.role === "planner") && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate("/schedule?tab=admin")}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Admin Settings
                </Button>
              )}

              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => {
                  if (userTeams.length > 0) {
                    navigate(`/schedule?tab=schedule&team=${userTeams[0].id}`);
                  } else {
                    navigate('/schedule?tab=schedule');
                    toast({
                      title: "No team assigned",
                      description: "You are not assigned to any team yet",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={userTeams.length === 0}
              >
                <Users className="w-4 h-4 mr-2" />
                View Team Availability
              </Button>
            </CardContent>
          </Card>
        </div>

      <LocationSetupModal
        open={showLocationSetup}
        onComplete={() => {
          setShowLocationSetup(false);
          fetchUserData(); // Refresh to update country in profile state
        }}
      />
    </div>
  );
};

export default Dashboard;
