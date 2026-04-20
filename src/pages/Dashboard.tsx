import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Users, LogOut, Mail, TrendingUp, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDesktopNotifications } from "@/hooks/useDesktopNotifications";
import { TimeBlockDisplay } from "@/components/schedule/TimeBlockDisplay";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { formatUserName, cn } from "@/lib/utils";
import { PendingRequestsCard } from "@/components/dashboard/PendingRequestsCard";
import { LocationSetupModal } from "@/components/profile/LocationSetupModal";
import { useCurrentUserContext } from "@/hooks/useCurrentUserContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useScheduleEntries } from "@/hooks/useScheduleEntries";
import { UnifiedDashboardBody } from "@/pages/UnifiedDashboard";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showScheduleChangeNotification } = useDesktopNotifications();
  const { profile, roles, teams, loading: contextLoading, refetch } = useCurrentUserContext();
  const [showLocationSetup, setShowLocationSetup] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("view") === "team-overview" ? "team-overview" : "my-schedule";

  // Shared hook — single source of truth for schedule_entries fetching.
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const { data: weeklySchedule = [], refetch: refetchWeekly } = useScheduleEntries({
    userIds: user?.id ? [user.id] : [],
    startDate: weekStart,
    endDate: weekEnd,
    enabled: !!user?.id,
  });
  const todaySchedule = (weeklySchedule as any[]).filter((e: any) => e.date === today);

  useEffect(() => {
    if (profile) {
      setShowLocationSetup(!profile.country_code || profile.country_code === 'US');
    }
  }, [profile]);

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
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const entry = payload.new as any;
            showScheduleChangeNotification({
              employeeName: profile?.first_name ? formatUserName(profile.first_name, profile.last_name) : 'Your',
              date: format(new Date(entry.date), 'MMM dd, yyyy'),
              changeType: payload.eventType === 'INSERT' ? 'added' : 'updated',
            });
          }
          refetchWeekly();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, showScheduleChangeNotification, refetchWeekly]);

  const getActivityDisplayName = (activityType: string) => {
    switch (activityType) {
      case 'work': return 'Work';
      case 'vacation': return 'Vacation';
      case 'other': return 'Other';
      case 'training': return 'Training';
      case 'hotline_support': return 'Hotline Support';
      case 'meeting': return 'Meeting';
      default: return activityType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "planner": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "manager": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "teammember": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  // Only show full-page loading if we have absolutely nothing yet
  if (contextLoading && !profile && roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Getting your dashboard ready</p>
        </div>
      </div>
    );
  }

  const welcomeName =
    profile ? formatUserName(profile.first_name, profile.last_name) : user?.email?.split('@')[0] || 'there';

  const userRoles = roles.map(r => ({ role: r }));

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {welcomeName}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          if (v === "team-overview") next.set("view", "team-overview");
          else next.delete("view");
          setSearchParams(next, { replace: true });
        }}
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="my-schedule">My Schedule</TabsTrigger>
          <TabsTrigger value="team-overview">Team Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="my-schedule" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Roles</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {contextLoading && roles.length === 0 ? (
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {roles.length > 0 ? (
                    roles.map((role, index) => (
                      <Badge
                        key={index}
                        className={getRoleColor(role)}
                        variant="secondary"
                      >
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No roles assigned</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Teams</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {contextLoading && teams.length === 0 ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ) : (
                <div className="space-y-2">
                  {teams.length > 0 ? (
                    teams.map((team) => (
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
              )}
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
                      const timeSplitPattern = /Times:\s*(.+)/;
                      const match = entry.notes?.match(timeSplitPattern);
                      let timeBlocks = [];
                      
                      if (match) {
                        try {
                          timeBlocks = JSON.parse(match[1]);
                        } catch (e) {
                          timeBlocks = [{
                            start_time: entry.shift_type === 'early' ? '06:00' : entry.shift_type === 'late' ? '13:00' : '08:00',
                            end_time: entry.shift_type === 'early' ? '14:30' : entry.shift_type === 'late' ? '21:30' : '16:30',
                            activity: entry.activity_type
                          }];
                        }
                      } else {
                        timeBlocks = [{
                          start_time: entry.shift_type === 'early' ? '06:00' : entry.shift_type === 'late' ? '13:00' : '08:00',
                          end_time: entry.shift_type === 'early' ? '14:30' : entry.shift_type === 'late' ? '21:30' : '16:30',
                          activity: entry.activity_type
                        }];
                      }

                      return (
                        <div key={index} className="space-y-3 p-4 border rounded-lg bg-card">
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

                          <TimeBlockDisplay entry={entry} />

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
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
                    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                    
                    const isMobile = window.innerWidth < 768;
                    const filteredDays = isMobile ? days.filter(day => day >= today) : days;
                    
                    return filteredDays.map((day) => {
                      const daySchedule = weeklySchedule.filter(
                        entry => entry.date === format(day, 'yyyy-MM-dd')
                      );
                      const isToday = format(day, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
                      const isPast = day < today;
                      
                      return (
                        <div key={format(day, 'yyyy-MM-dd')} className={cn(
                          "flex items-center justify-between p-2 rounded",
                          isToday && 'bg-primary/10 border border-primary/20',
                          isPast && 'opacity-60'
                        )}>
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
                  if (teams.length > 0) {
                    navigate(`/schedule?tab=schedule&team=${teams[0].id}`);
                  } else {
                    navigate('/schedule?tab=schedule');
                    toast({
                      title: "No team assigned",
                      description: "You are not assigned to any team yet",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={teams.length === 0}
              >
                <Users className="w-4 h-4 mr-2" />
                View Team Availability
              </Button>
            </CardContent>
          </Card>
        </div>
        </TabsContent>

        <TabsContent value="team-overview" className="space-y-6">
          <UnifiedDashboardBody />
        </TabsContent>
      </Tabs>

      <LocationSetupModal
        open={showLocationSetup}
        onComplete={() => {
          setShowLocationSetup(false);
          refetch();
        }}
      />
    </div>
  );
};

export default Dashboard;
