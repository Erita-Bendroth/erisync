import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from "date-fns";

interface ScheduleEntry {
  id: string;
  user_id: string;
  date: string;
  shift_type: string;
  activity_type: string;
  availability_status: string;
  notes?: string;
  profiles: {
    first_name: string;
    last_name: string;
  };
  teams: {
    name: string;
  };
}

interface Team {
  id: string;
  name: string;
}

interface UserRole {
  role: string;
}

const ScheduleView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  const totalDays = 28; // 4 weeks = 28 days
  const allDays = Array.from({ length: totalDays }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (user) {
      fetchUserRoles();
    }
  }, [user]);

  useEffect(() => {
    if (user && userRoles.length > 0) {
      fetchTeams();
      fetchScheduleEntries();
    }
  }, [user, currentWeek, userRoles]);

  useEffect(() => {
    // Refetch entries when team selection changes
    if (user && userRoles.length > 0) {
      fetchScheduleEntries();
    }
  }, [selectedTeam]);

  const fetchUserRoles = async () => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      
      setUserRoles(data || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchScheduleEntries = async () => {
    try {
      setLoading(true);
      const fourWeeksEnd = addDays(weekStart, totalDays - 1); // 4 weeks total
      
      console.log('Fetching schedule entries for 4 weeks:', {
        weekStart: format(weekStart, "yyyy-MM-dd"),
        fourWeeksEnd: format(fourWeeksEnd, "yyyy-MM-dd"),
        userId: user?.id,
        userRoles: userRoles.map(r => r.role)
      });
      
      // Build query based on user roles
      let query = supabase
        .from("schedule_entries")
        .select(`
          id,
          user_id,
          team_id,
          date,
          shift_type,
          activity_type,
          availability_status,
          notes,
          created_by,
          created_at,
          updated_at,
          profiles!schedule_entries_user_id_fkey (first_name, last_name),
          teams (name)
        `)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(fourWeeksEnd, "yyyy-MM-dd"))
        .order("date");

      // Apply filtering based on user roles and team selection
      if (isTeamMember() && !isManager() && !isPlanner()) {
        // Team members only see their own entries
        query = query.eq("user_id", user!.id);
        console.log('Filtering to only show user\'s own entries');
      } else if (selectedTeam !== "all") {
        // For planners/managers, apply team filter if specific team is selected
        query = query.eq("team_id", selectedTeam);
        console.log('Filtering by team:', selectedTeam);
      } else {
        // Planners/managers viewing "All Teams" - show all entries
        console.log('Showing all entries for all teams (planners/managers view)');
      }

      const { data, error } = await query;

      console.log('Schedule entries query result:', { data: data?.length, error });

      if (error) throw error;
      
      // Transform the data to ensure proper typing
      const transformedData = data?.map(item => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles || { first_name: "Unknown", last_name: "User" },
        teams: Array.isArray(item.teams) ? item.teams[0] : item.teams || { name: "Unknown Team" }
      })) || [];
      
      console.log('Transformed schedule data:', transformedData.length, 'entries');
      setScheduleEntries(transformedData);
    } catch (error) {
      console.error("Error fetching schedule entries:", error);
      toast({
        title: "Error",
        description: "Failed to load schedule entries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEntriesForDay = (date: Date) => {
    return scheduleEntries.filter(entry => 
      isSameDay(new Date(entry.date), date)
    );
  };

  const isPlanner = () => userRoles.some(role => role.role === "planner");
  const isManager = () => userRoles.some(role => role.role === "manager");
  const isTeamMember = () => userRoles.some(role => role.role === "teammember");

  const getActivityDisplay = (entry: ScheduleEntry) => {
    // Team members only see availability status
    if (isTeamMember() && !isManager() && !isPlanner()) {
      return entry.availability_status === "available" ? "Available" : "Unavailable";
    }
    
    // Managers and planners see full details
    return entry.activity_type.replace("_", " ");
  };

  const getActivityColor = (entry: ScheduleEntry) => {
    if (isTeamMember() && !isManager() && !isPlanner()) {
      return entry.availability_status === "available" 
        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    }

    switch (entry.activity_type) {
      case "work":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "vacation":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "sick":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "hotline_support":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "out_of_office":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      case "training":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300";
      case "flextime":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
      case "working_from_home":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getShiftColor = (shiftType: string) => {
    switch (shiftType) {
      case "early":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "late":
        return "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300";
      case "normal":
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300";
    }
  };

  const getActivityDisplayName = (activityType: string) => {
    switch (activityType) {
      case "work": return "Work";
      case "vacation": return "Vacation";
      case "sick": return "Sick Leave";
      case "hotline_support": return "Hotline Support";
      case "out_of_office": return "Out of Office";
      case "training": return "Training";
      case "flextime": return "Flextime";
      case "working_from_home": return "Working from Home";
      default: return activityType;
    }
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeek(prev => direction === "next" ? addWeeks(prev, 1) : subWeeks(prev, 1));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading schedule...</h2>
          <p className="text-muted-foreground">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">4-Week Schedule Overview</h2>
          <p className="text-muted-foreground">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, totalDays - 1), "MMM d, yyyy")}
          </p>
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          {/* Team Filter - Only show for planners and managers */}
          {(isManager() || isPlanner()) && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Team:</label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-48 bg-background">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {(isManager() || isPlanner()) && (
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Entry
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Weeks Grid with Week Headers */}
      <div className="space-y-6">
        {Array.from({ length: 4 }, (_, weekIndex) => {
          const weekStartDate = addDays(weekStart, weekIndex * 7);
          const weekDays = Array.from({ length: 7 }, (_, dayIndex) => addDays(weekStartDate, dayIndex));
          
          return (
            <div key={weekIndex} className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">
                Week {weekIndex + 1}: {format(weekStartDate, "MMM d")} - {format(addDays(weekStartDate, 6), "MMM d, yyyy")}
              </h3>
              
              <div className="grid grid-cols-7 gap-4">
                {weekDays.map((day, dayIndex) => {
                  const dayEntries = getEntriesForDay(day);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <Card key={dayIndex} className={isToday ? "ring-2 ring-primary" : ""}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          {format(day, "EEE")}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {format(day, "MMM d")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                        {dayEntries.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No entries</p>
                        ) : (
                          dayEntries.map((entry) => (
                            <div key={entry.id} className="space-y-1 p-2 rounded border-l-2 border-l-primary/20">
                              <div className="flex flex-col gap-1">
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${getShiftColor(entry.shift_type)}`}
                                >
                                  {entry.shift_type === "early" ? "Early" : 
                                   entry.shift_type === "late" ? "Late" : "Normal"}
                                </Badge>
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${getActivityColor(entry)}`}
                                >
                                  {getActivityDisplay(entry)}
                                </Badge>
                              </div>
                              <div className="text-xs">
                                <p className="font-medium">
                                  {entry.profiles.first_name} {entry.profiles.last_name}
                                </p>
                                <p className="text-muted-foreground">
                                  {entry.teams.name}
                                </p>
                                {entry.notes && (
                                  <p className="text-muted-foreground text-xs">
                                    {entry.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Legend
          </CardTitle>
          <CardDescription>
            Color coding for schedule activities and shift types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Activity Types Legend */}
            <div>
              <h4 className="font-medium mb-3">Activity Types</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {!isTeamMember() || isManager() || isPlanner() ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        Work
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                        Vacation
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                        Sick Leave
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                        Hotline Support
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">
                        Out of Office
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">
                        Training
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300">
                        Flextime
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300">
                        Working from Home
                      </Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Available
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                        Unavailable
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Shift Types Legend */}
            <div>
              <h4 className="font-medium mb-3">Shift Types</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                    Early Shift
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    Normal Shift
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300">
                    Late Shift
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleView;