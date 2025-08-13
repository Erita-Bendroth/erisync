import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface UserRole {
  role: string;
}

const ScheduleView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (user) {
      fetchUserRoles();
      fetchScheduleEntries();
    }
  }, [user, currentWeek]);

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

  const fetchScheduleEntries = async () => {
    try {
      setLoading(true);
      const weekEnd = addDays(weekStart, 6);
      
      const { data, error } = await supabase
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
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("date");

      if (error) throw error;
      
      // Transform the data to ensure proper typing
      const transformedData = data?.map(item => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles || { first_name: "Unknown", last_name: "User" },
        teams: Array.isArray(item.teams) ? item.teams[0] : item.teams || { name: "Unknown Team" }
      })) || [];
      
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
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Schedule View</h2>
          <p className="text-muted-foreground">
            Week of {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </p>
        </div>
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

      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day, index) => {
          const dayEntries = getEntriesForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card key={index} className={isToday ? "ring-2 ring-primary" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {format(day, "EEE")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {format(day, "MMM d")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dayEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No entries</p>
                ) : (
                  dayEntries.map((entry) => (
                    <div key={entry.id} className="space-y-1">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${getActivityColor(entry)}`}
                      >
                        {getActivityDisplay(entry)}
                      </Badge>
                      <div className="text-xs">
                        <p className="font-medium">
                          {entry.profiles.first_name} {entry.profiles.last_name}
                        </p>
                        <p className="text-muted-foreground">
                          {entry.teams.name}
                        </p>
                        {(isManager() || isPlanner()) && entry.shift_type !== "normal" && (
                          <p className="text-muted-foreground">
                            {entry.shift_type} shift
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Legend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    Sick
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                    Hotline Support
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleView;