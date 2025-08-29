import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Clock, Users, Zap, User } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
}

const BulkScheduleGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [bulkMode, setBulkMode] = useState<"team" | "user">("team");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [generationResults, setGenerationResults] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    fetchUserRoles();
  }, [user]);

  useEffect(() => {
    if (hasPermission) {
      fetchTeams();
      // Set default dates to current month
      const now = new Date();
      setStartDate(startOfMonth(now));
      setEndDate(endOfMonth(addMonths(now, 1)));
    }
  }, [hasPermission]);

  useEffect(() => {
    fetchUsers();
  }, [selectedTeam, bulkMode]);

  const fetchUserRoles = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      const roles = data?.map(r => r.role) || [];
      setUserRoles(roles);
      
      // Check if user has permission (planner or manager)
      const canSchedule = roles.includes('planner') || roles.includes('manager') || roles.includes('admin');
      setHasPermission(canSchedule);
      
    } catch (error) {
      console.error("Error fetching user roles:", error);
    }
  };

  const fetchTeams = async () => {
    try {
      const isManager = userRoles.includes('manager') && !userRoles.includes('planner') && !userRoles.includes('admin');
      if (isManager && user) {
        // Managers can only see teams they manage
        const { data, error } = await supabase
          .from('team_members')
          .select(`
            teams (
              id,
              name
            )
          `)
          .eq('user_id', user.id)
          .eq('is_manager', true);
          
        if (error) throw error;
        const managerTeams = data?.map((item: any) => item.teams).filter(Boolean) || [];
        setTeams(managerTeams);
        
        // Auto-select first managed team if available
        if (managerTeams.length > 0 && !selectedTeam) {
          setSelectedTeam(managerTeams[0].id);
        }
      } else {
        // Planners and admins can see all teams
        const { data, error } = await supabase
          .from('teams')
          .select('id, name')
          .order('name');
          
        if (error) throw error;
        setTeams(data || []);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchUsers = async () => {
    if (!selectedTeam || bulkMode !== 'user') {
      setUsers([]);
      return;
    }

    try {
      // Check if current user can manage this team
      const isManager = userRoles.includes('manager') && !userRoles.includes('planner') && !userRoles.includes('admin');
      if (isManager && user) {
        const { data: managerCheck } = await supabase
          .from('team_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('team_id', selectedTeam)
          .eq('is_manager', true)
          .maybeSingle();

        if (!managerCheck) {
          toast({
            title: "Access Denied",
            description: "You can only generate schedules for teams you manage",
            variant: "destructive"
          });
          setUsers([]);
          return;
        }
      }

      const { data, error } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profiles!inner(first_name, last_name, email)
        `)
        .eq('team_id', selectedTeam);

      if (error) throw error;

      const usersData = data?.map((member: any) => ({
        id: member.user_id,
        first_name: member.profiles.first_name,
        last_name: member.profiles.last_name,
        email: member.profiles.email
      })) || [];

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch team members",
        variant: "destructive"
      });
    }
  };

  const generateSchedules = async () => {
    if (bulkMode === "team" && (!selectedTeam || selectedTeam === "")) {
      toast({
        title: "Error",
        description: "Please select a team",
        variant: "destructive",
      });
      return;
    }

    if (bulkMode === "user" && (!selectedUser || selectedUser === "")) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate || !user) {
      toast({
        title: "Error",
        description: "Please select a date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Additional permission check for managers
      const isManager = userRoles.includes('manager') && !userRoles.includes('planner') && !userRoles.includes('admin');
      if (isManager && user) {
        const { data: managerCheck } = await supabase
          .from('team_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('team_id', selectedTeam)
          .eq('is_manager', true)
          .maybeSingle();

        if (!managerCheck) {
          toast({
            title: "Access Denied",
            description: "You can only generate schedules for teams you manage",
            variant: "destructive"
          });
          return;
        }
      }

      if (bulkMode === "team") {
        const { data, error } = await supabase.rpc('create_team_default_schedules_with_holidays', {
          _team_id: selectedTeam,
          _start_date: format(startDate, 'yyyy-MM-dd'),
          _end_date: format(endDate, 'yyyy-MM-dd'),
          _created_by: user.id
        });

        if (error) throw error;

        setGenerationResults(data || []);
        
        const totalShifts = data?.reduce((sum: number, result: any) => sum + result.shifts_created, 0) || 0;
        
        toast({
          title: "Success",
          description: `Generated ${totalShifts} shifts for ${data?.length || 0} team members`,
        });
      } else {
        // Generate for single user
        const { data, error } = await supabase.rpc('create_default_schedule_with_holidays', {
          _user_id: selectedUser,
          _team_id: selectedTeam,
          _start_date: format(startDate, 'yyyy-MM-dd'),
          _end_date: format(endDate, 'yyyy-MM-dd'),
          _created_by: user.id
        });

        if (error) throw error;

        const shiftsCreated = data || 0;
        
        toast({
          title: "Success",
          description: `Generated ${shiftsCreated} shifts for selected user`,
        });
      }

    } catch (error: any) {
      console.error('Error generating schedules:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate schedules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const quickSetMonth = (monthsAhead: number) => {
    const now = new Date();
    const targetMonth = addMonths(now, monthsAhead);
    setStartDate(startOfMonth(targetMonth));
    setEndDate(endOfMonth(targetMonth));
  };

  const quickSetDateRange = (monthsCount: number) => {
    const now = new Date();
    setStartDate(startOfMonth(now));
    setEndDate(endOfMonth(addMonths(now, monthsCount - 1)));
  };

  // Don't render if user doesn't have permission
  if (!hasPermission) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Bulk Schedule Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Only planners and managers can generate bulk schedules.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Zap className="w-5 h-5 mr-2" />
          Bulk Schedule Generator
        </CardTitle>
        <CardDescription>
          Generate Mon-Fri 08:00-16:30 shifts, excluding holidays
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bulk mode selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Generation Mode</label>
          <Select value={bulkMode} onValueChange={(value: "team" | "user") => setBulkMode(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Entire Team
                </div>
              </SelectItem>
              <SelectItem value="user">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Single User
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick date selection */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => quickSetMonth(0)}>
            This Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => quickSetMonth(1)}>
            Next Month
          </Button>
          <Button variant="outline" size="sm" onClick={() => quickSetDateRange(3)}>
            Next 3 Months
          </Button>
          <Button variant="outline" size="sm" onClick={() => quickSetDateRange(6)}>
            Next 6 Months
          </Button>
        </div>
        
        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Team/User selection */}
        {bulkMode === "team" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Team</label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Team</label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team first" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser} disabled={!selectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedTeam ? "Select a user" : "Select team first"} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        
        <Button 
          onClick={generateSchedules} 
          disabled={loading || 
            (bulkMode === "team" && (!selectedTeam || selectedTeam === "")) ||
            (bulkMode === "user" && (!selectedUser || selectedUser === "")) ||
            !startDate || !endDate}
          className="w-full"
        >
          <Zap className="w-4 h-4 mr-2" />
          {loading ? "Generating..." : "Generate Shifts"}
        </Button>

        {/* Info */}
        <div className="text-xs text-muted-foreground">
          Creates Mon-Fri shifts, excludes holidays based on country
        </div>
      </CardContent>
    </Card>
  );
};

export default BulkScheduleGenerator;