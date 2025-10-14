import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Clock, Users, Zap, User, CheckCircle2 } from "lucide-react";
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
  email: string;
}

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: number[]; // 0-6 (Sunday-Saturday)
}

const SHIFT_TEMPLATES: ShiftTemplate[] = [
  { id: 'standard', name: 'Standard Shift (Mon-Fri 08:00-16:30)', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
  { id: 'early', name: 'Early Shift', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
  { id: 'late', name: 'Late Shift', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
  { id: 'custom', name: 'Custom Shift', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
];

const DAYS_OF_WEEK = [
  { id: 1, name: 'Mon', label: 'Monday' },
  { id: 2, name: 'Tue', label: 'Tuesday' },
  { id: 3, name: 'Wed', label: 'Wednesday' },
  { id: 4, name: 'Thu', label: 'Thursday' },
  { id: 5, name: 'Fri', label: 'Friday' },
  { id: 6, name: 'Sat', label: 'Saturday' },
  { id: 0, name: 'Sun', label: 'Sunday' },
];

const BulkScheduleGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<"team" | "users">("team");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [generationResults, setGenerationResults] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [shiftTemplate, setShiftTemplate] = useState<string>('standard');
  const [customStartTime, setCustomStartTime] = useState<string>('08:00');
  const [customEndTime, setCustomEndTime] = useState<string>('16:30');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Default Mon-Fri

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
    if (!selectedTeam || bulkMode !== 'users') {
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

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    setSelectedUsers(users.map(u => u.id));
  };

  const deselectAllUsers = () => {
    setSelectedUsers([]);
  };

  const getSelectedTemplate = () => {
    return SHIFT_TEMPLATES.find(t => t.id === shiftTemplate) || SHIFT_TEMPLATES[0];
  };

  const toggleDaySelection = (dayId: number) => {
    setSelectedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(id => id !== dayId)
        : [...prev, dayId].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    );
  };

  const getShiftDays = () => {
    // Standard shift always uses Mon-Fri
    if (shiftTemplate === 'standard') {
      return [1, 2, 3, 4, 5];
    }
    // For other shifts, use selected days
    return selectedDays;
  };

  const getShiftTimes = () => {
    // Standard shift has fixed times
    if (shiftTemplate === 'standard') {
      return { start: '08:00', end: '16:30' };
    }
    // For other shifts, use custom times
    return { start: customStartTime, end: customEndTime };
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

    if (bulkMode === "users" && selectedUsers.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one user",
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

    // Validate shift configuration for non-standard shifts
    if (shiftTemplate !== 'standard') {
      if (selectedDays.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one day of the week",
          variant: "destructive",
        });
        return;
      }

      if (!customStartTime || !customEndTime) {
        toast({
          title: "Error",
          description: "Please set start and end times",
          variant: "destructive",
        });
        return;
      }

      if (customStartTime >= customEndTime) {
        toast({
          title: "Error",
          description: "Start time must be before end time",
          variant: "destructive",
        });
        return;
      }
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

      const times = getShiftTimes();
      const shiftNote = `Auto-generated shift (${times.start}-${times.end})`;
      const allowedDays = getShiftDays();

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
        // Generate for selected users with custom template
        let totalGenerated = 0;
        
        for (const userId of selectedUsers) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('country_code, region_code')
            .eq('user_id', userId)
            .maybeSingle();
          if (profileError) throw profileError;

          const { data, error } = await (supabase as any).rpc('create_default_schedule_with_holidays_v2', {
            _user_id: userId,
            _team_id: selectedTeam,
            _start_date: format(startDate, 'yyyy-MM-dd'),
            _end_date: format(endDate, 'yyyy-MM-dd'),
            _created_by: user.id,
            _country_code: profile?.country_code || 'US',
            _region_code: profile?.region_code || null
          });

          if (error) throw error;
          totalGenerated += data || 0;
        }
        
        toast({
          title: "Success",
          description: `Generated ${totalGenerated} shifts for ${selectedUsers.length} user(s)`,
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
          Generate shifts with custom templates and times, excluding holidays
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bulk mode selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Generation Mode</label>
          <Select value={bulkMode} onValueChange={(value: "team" | "users") => {
            setBulkMode(value);
            setSelectedUsers([]);
          }}>
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
              <SelectItem value="users">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Select Multiple Users
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Shift Template Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Shift Type</label>
          <Select value={shiftTemplate} onValueChange={(value) => {
            setShiftTemplate(value);
            // Reset to default days when changing shift type
            if (value === 'standard') {
              setSelectedDays([1, 2, 3, 4, 5]);
            }
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIFT_TEMPLATES.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time and Day Selection for non-Standard shifts */}
        {shiftTemplate !== 'standard' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
            {/* Time Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Shift Times</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time" className="text-xs text-muted-foreground">Start Time</Label>
                  <input
                    id="start-time"
                    type="time"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time" className="text-xs text-muted-foreground">End Time</Label>
                  <input
                    id="end-time"
                    type="time"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Day Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.id}
                    type="button"
                    variant={selectedDays.includes(day.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDaySelection(day.id)}
                    className="w-14 h-9"
                  >
                    {day.name}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedDays.length === 0 
                  ? 'Select at least one day' 
                  : `${selectedDays.length} day${selectedDays.length !== 1 ? 's' : ''} selected`
                }
              </p>
            </div>
          </div>
        )}

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
              <Select value={selectedTeam} onValueChange={(value) => {
                setSelectedTeam(value);
                setSelectedUsers([]);
              }}>
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Users ({selectedUsers.length} selected)
                </label>
                {users.length > 0 && (
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      onClick={selectAllUsers}
                      className="h-7 text-xs"
                    >
                      Select All
                    </Button>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      onClick={deselectAllUsers}
                      className="h-7 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
              {!selectedTeam ? (
                <div className="text-sm text-muted-foreground p-4 border rounded-md text-center">
                  Select a team first to see users
                </div>
              ) : users.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 border rounded-md text-center">
                  No users found in this team
                </div>
              ) : (
                <div className="border rounded-md max-h-60 overflow-y-auto">
                  {users.map((usr) => (
                    <div
                      key={usr.id}
                      className="flex items-center space-x-2 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                      onClick={() => toggleUserSelection(usr.id)}
                    >
                      <Checkbox 
                        checked={selectedUsers.includes(usr.id)}
                        onCheckedChange={() => toggleUserSelection(usr.id)}
                      />
                      <Label className="flex-1 cursor-pointer">
                        {usr.first_name} {usr.last_name}
                      </Label>
                      {selectedUsers.includes(usr.id) && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        
        <Button 
          onClick={generateSchedules} 
          disabled={loading || 
            (bulkMode === "team" && (!selectedTeam || selectedTeam === "")) ||
            (bulkMode === "users" && selectedUsers.length === 0) ||
            !startDate || !endDate}
          className="w-full"
        >
          <Zap className="w-4 h-4 mr-2" />
          {loading ? "Generating..." : `Generate ${bulkMode === 'team' ? 'Team' : `${selectedUsers.length} User`} Shifts`}
        </Button>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              {shiftTemplate === 'standard' 
                ? 'Standard: Mon-Fri, 08:00-16:30'
                : `${getSelectedTemplate().name}: ${customStartTime}-${customEndTime}, ${
                    selectedDays.length === 7 ? 'All days' :
                    selectedDays.length === 0 ? 'No days selected' :
                    DAYS_OF_WEEK.filter(d => selectedDays.includes(d.id)).map(d => d.name).join(', ')
                  }`
              }
            </span>
          </div>
          <div>Automatically excludes holidays based on user country</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BulkScheduleGenerator;