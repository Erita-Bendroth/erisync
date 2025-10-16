import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Clock, Users, Zap, User, CheckCircle2, Repeat, X } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
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

interface ShiftConfiguration {
  id: string;
  shiftType: string;
  shiftName: string;
  dates: Date[];
  startTime: string;
  endTime: string;
  userId?: string; // For rotation mode
}

interface RotationPattern {
  intervalWeeks: number;
  cycles: number;
}

const SHIFT_TEMPLATES: ShiftTemplate[] = [
  { id: 'standard', name: 'Standard Shift (Mon-Fri 08:00-16:30)', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
  { id: 'early', name: 'Early Shift', startTime: '06:00', endTime: '14:30', days: [1, 2, 3, 4, 5] },
  { id: 'late', name: 'Late Shift', startTime: '13:00', endTime: '21:30', days: [1, 2, 3, 4, 5] },
  { id: 'custom', name: 'Custom Shift', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
];

interface BulkScheduleGeneratorProps {
  onScheduleGenerated?: () => void;
}

const BulkScheduleGenerator = ({ onScheduleGenerated }: BulkScheduleGeneratorProps = {}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<"team" | "users" | "rotation">("team");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [generationResults, setGenerationResults] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const [shiftTemplate, setShiftTemplate] = useState<string>('standard');
  const [customStartTime, setCustomStartTime] = useState<string>('08:00');
  const [customEndTime, setCustomEndTime] = useState<string>('16:30');
  const [rangeStartDate, setRangeStartDate] = useState<Date>();
  const [rangeEndDate, setRangeEndDate] = useState<Date>();
  const [shiftConfigurations, setShiftConfigurations] = useState<ShiftConfiguration[]>([]);
  
  // Rotation mode states
  const [selectedUsersForRotation, setSelectedUsersForRotation] = useState<string[]>([]);
  const [enableRecurring, setEnableRecurring] = useState(false);
  const [excludeHolidays, setExcludeHolidays] = useState(true); // Default to excluding holidays
  const [rotationPattern, setRotationPattern] = useState<RotationPattern>({
    intervalWeeks: 4,
    cycles: 1
  });

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
    if (!selectedTeam || (bulkMode !== 'users' && bulkMode !== 'rotation')) {
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

  const toggleRotationUserSelection = (userId: string) => {
    setSelectedUsersForRotation(prev => 
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

  const getDateRangeArray = (): Date[] => {
    if (!rangeStartDate || !rangeEndDate) return [];
    
    // Generate all weekdays (Mon-Fri) in the range
    const allDates = eachDayOfInterval({ start: rangeStartDate, end: rangeEndDate });
    return allDates.filter(date => !isWeekend(date)); // Only weekdays
  };

  const addShiftConfiguration = () => {
    // Rotation mode validation
    if (bulkMode === 'rotation') {
      if (selectedUsersForRotation.length === 0) {
        toast({
          title: "Error",
          description: "Please select at least one user for this shift",
          variant: "destructive",
        });
        return;
      }
    }

    if (!rangeStartDate || !rangeEndDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }

    if (rangeStartDate > rangeEndDate) {
      toast({
        title: "Error",
        description: "Start date must be before or equal to end date",
        variant: "destructive",
      });
      return;
    }

    const dateRange = getDateRangeArray();
    if (dateRange.length === 0) {
      toast({
        title: "Error",
        description: "No weekdays found in the selected date range",
        variant: "destructive",
      });
      return;
    }

    if (shiftTemplate !== 'standard') {
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

    const template = SHIFT_TEMPLATES.find(t => t.id === shiftTemplate);
    
    // For rotation mode, create separate configs for each selected user
    if (bulkMode === 'rotation') {
      const newConfigs = selectedUsersForRotation.map(userId => {
        const selectedUser = users.find(u => u.id === userId);
        return {
          id: `shift-${Date.now()}-${userId}`,
          shiftType: shiftTemplate,
          shiftName: template?.name || 'Custom',
          dates: [...dateRange],
          startTime: shiftTemplate === 'standard' ? template?.startTime || '08:00' : customStartTime,
          endTime: shiftTemplate === 'standard' ? template?.endTime || '16:30' : customEndTime,
          userId: userId
        };
      });
      
      setShiftConfigurations(prev => [...prev, ...newConfigs]);
      
      toast({
        title: "Shifts Added",
        description: `Added ${template?.name || 'Custom'} for ${selectedUsersForRotation.length} user(s) on ${dateRange.length} date(s)`,
      });
    } else {
      const newConfig: ShiftConfiguration = {
        id: `shift-${Date.now()}`,
        shiftType: shiftTemplate,
        shiftName: template?.name || 'Custom',
        dates: [...dateRange],
        startTime: shiftTemplate === 'standard' ? template?.startTime || '08:00' : customStartTime,
        endTime: shiftTemplate === 'standard' ? template?.endTime || '16:30' : customEndTime,
        userId: undefined
      };

      setShiftConfigurations(prev => [...prev, newConfig]);
      
      toast({
        title: "Shift Added",
        description: `Added ${newConfig.shiftName} for ${newConfig.dates.length} date(s)`,
      });
    }
    
    // Reset form
    setRangeStartDate(undefined);
    setRangeEndDate(undefined);
    setShiftTemplate('standard');
    setCustomStartTime('08:00');
    setCustomEndTime('16:30');
    if (bulkMode === 'rotation') {
      setSelectedUsersForRotation([]);
    }
  };

  const removeShiftConfiguration = (id: string) => {
    setShiftConfigurations(prev => prev.filter(config => config.id !== id));
  };

  const getShiftTimes = () => {
    if (shiftTemplate === 'standard') {
      return { start: '08:00', end: '16:30' };
    }
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

    if (bulkMode === "rotation" && shiftConfigurations.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one user-shift configuration",
        variant: "destructive",
      });
      return;
    }

    if (shiftConfigurations.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one shift configuration",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    console.log(`🚀 Starting bulk schedule generation:`, {
      bulkMode,
      selectedTeam,
      excludeHolidays,
      configurationsCount: shiftConfigurations.length,
      cycles: enableRecurring ? rotationPattern.cycles : 1
    });
    
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

      let totalGenerated = 0;
      let totalSkippedHolidays = 0;
      const cycles = enableRecurring ? rotationPattern.cycles : 1;
      
      console.log(`📊 Processing ${cycles} cycle(s) with ${shiftConfigurations.length} shift configuration(s)`);
      
      // For each cycle (for recurring patterns)
      for (let cycle = 0; cycle < cycles; cycle++) {
        const weekOffset = cycle * rotationPattern.intervalWeeks * 7;
        
        // Generate shifts for all configurations
        for (const config of shiftConfigurations) {
          // Determine target users based on mode
          let targetUsers: string[];
          if (bulkMode === "rotation") {
            // In rotation mode, each config has its own user
            targetUsers = config.userId ? [config.userId] : [];
          } else if (bulkMode === "team") {
            targetUsers = await getTeamMemberIds(selectedTeam);
          } else {
            targetUsers = selectedUsers;
          }

          for (const userId of targetUsers) {
            // Get user's profile for holiday checking
            const { data: profile } = await supabase
              .from('profiles')
              .select('country_code, region_code')
              .eq('user_id', userId)
              .maybeSingle();

            const countryCode = profile?.country_code || 'US';
            const regionCode = profile?.region_code || null;

            console.log(`🔍 Bulk Schedule - User ${userId.substring(0,8)}: country=${countryCode}, region=${regionCode}`);

            // Fetch all holidays for this country (centrally managed only)
            const { data: allHolidays } = await supabase
              .from('holidays')
              .select('date, name, region_code')
              .eq('country_code', countryCode)
              .eq('is_public', true)
              .is('user_id', null); // Only centrally managed holidays

            // Filter holidays based on user's region
            let applicableHolidays = allHolidays || [];
            if (countryCode === 'DE' && regionCode) {
              // For Germany with region: include national holidays (no region) and regional holidays for user's region
              applicableHolidays = applicableHolidays.filter(h => !h.region_code || h.region_code === regionCode);
            } else {
              // For other countries or no region: only national holidays
              applicableHolidays = applicableHolidays.filter(h => !h.region_code);
            }

            const holidayDates = new Set(applicableHolidays.map(h => h.date));
            console.log(`📅 Applicable holidays for user: ${applicableHolidays.map(h => `${h.date}:${h.name}`).join(', ')}`);

            // For each date in the configuration (with cycle offset for recurring)
            for (const baseDate of config.dates) {
              const date = new Date(baseDate);
              date.setDate(date.getDate() + weekOffset);
              const dateStr = format(date, 'yyyy-MM-dd');
              
              // Check if it's a holiday (only if excludeHolidays is enabled)
              let isHoliday = false;
              if (excludeHolidays) {
                isHoliday = holidayDates.has(dateStr);
              }
              
              if (isHoliday) {
                const holiday = applicableHolidays.find(h => h.date === dateStr);
                console.log(`🎉 Skipping holiday: ${dateStr} - ${holiday?.name} (user: ${userId.substring(0,8)})`);
                totalSkippedHolidays++;
                continue; // Skip if it's a holiday
              }


              // Determine shift type based on shift name
              let shiftType: 'early' | 'late' | 'normal' = 'normal';
              if (config.shiftName.toLowerCase().includes('early')) {
                shiftType = 'early';
              } else if (config.shiftName.toLowerCase().includes('late')) {
                shiftType = 'late';
              }

              // Format notes with time block data for proper display
              const timeBlockData = [{
                activity_type: 'work',
                start_time: config.startTime,
                end_time: config.endTime
              }];
              const cycleInfo = cycles > 1 ? ` (Cycle ${cycle + 1}/${cycles})` : '';
              const notes = `Times: ${JSON.stringify(timeBlockData)}\nAuto-generated ${config.shiftName}${cycleInfo}`;

              // Insert or update the schedule entry
              const { error } = await supabase
                .from('schedule_entries')
                .upsert({
                  user_id: userId,
                  team_id: selectedTeam,
                  date: dateStr,
                  shift_type: shiftType,
                  activity_type: 'work',
                  availability_status: 'available',
                  notes: notes,
                  created_by: user.id,
                }, {
                  onConflict: 'user_id,date,team_id',
                });

              if (!error) totalGenerated++;
            }
          }
        }
      }
      
      const cycleMsg = cycles > 1 ? ` across ${cycles} cycle(s)` : '';
      const holidayMsg = totalSkippedHolidays > 0 ? ` (${totalSkippedHolidays} holidays excluded)` : '';
      
      console.log(`✅ Bulk schedule generation complete:`, {
        totalGenerated,
        totalSkippedHolidays,
        cycles
      });
      
      toast({
        title: "Success",
        description: `Generated ${totalGenerated} shifts${cycleMsg}${holidayMsg}`,
      });
      
      // Clear configurations after successful generation
      setShiftConfigurations([]);
      setEnableRecurring(false);
      setRotationPattern({ intervalWeeks: 4, cycles: 1 });
      
      // Notify parent to refresh
      onScheduleGenerated?.();

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

  const getTeamMemberIds = async (teamId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId);
    
    if (error) throw error;
    return data?.map(m => m.user_id) || [];
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
          Configure multiple shift types and dates in one batch operation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bulk mode selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Generation Mode</label>
          <Select value={bulkMode} onValueChange={(value: "team" | "users" | "rotation") => {
            setBulkMode(value);
            setSelectedUsers([]);
            setShiftConfigurations([]);
            setSelectedUsersForRotation([]);
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Entire Team (Same Shifts)
                </div>
              </SelectItem>
              <SelectItem value="users">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Select Multiple Users (Same Shifts)
                </div>
              </SelectItem>
              <SelectItem value="rotation">
                <div className="flex items-center">
                  <Repeat className="w-4 h-4 mr-2" />
                  Rotation Schedule (Different Shifts Per User)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {bulkMode === 'rotation' && (
            <p className="text-xs text-muted-foreground">
              Assign different shifts to different users for specific dates with optional recurring patterns
            </p>
          )}
        </div>

        {/* Team Selection for Rotation Mode - Moved Above User Selection */}
        {bulkMode === 'rotation' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Team</label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Multiple User Selection for Rotation Mode */}
        {bulkMode === 'rotation' && selectedTeam && users.length > 0 && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/10">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Select Users for This Shift</label>
              <div className="text-xs text-muted-foreground">
                {selectedUsersForRotation.length} selected
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {users.map((usr) => (
                <div
                  key={usr.id}
                  className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleRotationUserSelection(usr.id)}
                >
                  <Checkbox
                    checked={selectedUsersForRotation.includes(usr.id)}
                    onCheckedChange={() => toggleRotationUserSelection(usr.id)}
                  />
                  <label className="text-sm cursor-pointer flex-1">
                    {usr.first_name} {usr.last_name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shift Template Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Shift Type</label>
          <Select value={shiftTemplate} onValueChange={(value) => {
            setShiftTemplate(value);
            const template = SHIFT_TEMPLATES.find(t => t.id === value);
            if (template) {
              setCustomStartTime(template.startTime);
              setCustomEndTime(template.endTime);
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

        {/* Time Selection for non-Standard shifts */}
        {shiftTemplate !== 'standard' && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
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
        )}

        {/* Date Range Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Select Date Range for This Shift</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !rangeStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rangeStartDate ? format(rangeStartDate, "PPP") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeStartDate}
                    onSelect={setRangeStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !rangeEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rangeEndDate ? format(rangeEndDate, "PPP") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rangeEndDate}
                    onSelect={setRangeEndDate}
                    disabled={(date) => rangeStartDate ? date < rangeStartDate : false}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {rangeStartDate && rangeEndDate && (
            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
              {getDateRangeArray().length} weekdays selected ({format(rangeStartDate, "MMM d")} - {format(rangeEndDate, "MMM d, yyyy")})
            </div>
          )}
        </div>

        {/* Recurring Pattern Option (Rotation Mode Only) */}
        {bulkMode === 'rotation' && (
          <div className="space-y-3 p-3 border rounded-lg bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable Recurring Pattern</Label>
                <p className="text-xs text-muted-foreground">
                  Repeat this rotation schedule at regular intervals
                </p>
              </div>
              <Checkbox
                checked={enableRecurring}
                onCheckedChange={(checked) => setEnableRecurring(checked === true)}
              />
            </div>
            
            {enableRecurring && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="interval" className="text-xs">Repeat Every (Weeks)</Label>
                  <input
                    id="interval"
                    type="number"
                    min="1"
                    max="52"
                    value={rotationPattern.intervalWeeks}
                    onChange={(e) => setRotationPattern(prev => ({ 
                      ...prev, 
                      intervalWeeks: parseInt(e.target.value) || 1 
                    }))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cycles" className="text-xs">Number of Cycles</Label>
                  <input
                    id="cycles"
                    type="number"
                    min="1"
                    max="12"
                    value={rotationPattern.cycles}
                    onChange={(e) => setRotationPattern(prev => ({ 
                      ...prev, 
                      cycles: parseInt(e.target.value) || 1 
                    }))}
                    className="w-full px-3 py-2 border rounded-md bg-background"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Exclude Holidays Option */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Exclude Public Holidays</Label>
            <p className="text-xs text-muted-foreground">
              Automatically skip public holidays when generating schedules
            </p>
          </div>
          <Checkbox
            checked={excludeHolidays}
            onCheckedChange={(checked) => setExcludeHolidays(checked === true)}
          />
        </div>

        {/* Add Shift Configuration Button */}
        <Button 
          onClick={addShiftConfiguration}
          variant="secondary"
          className="w-full"
          disabled={!rangeStartDate || !rangeEndDate || (bulkMode === 'rotation' && selectedUsersForRotation.length === 0)}
        >
          <Zap className="w-4 h-4 mr-2" />
          Add This Shift Configuration
        </Button>

        {/* Configured Shifts List */}
        {shiftConfigurations.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Configured Shifts ({shiftConfigurations.length})
            </Label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shiftConfigurations.map((config) => {
                const assignedUser = users.find(u => u.id === config.userId);
                return (
                  <div
                    key={config.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-sm">{config.shiftName}</div>
                        {assignedUser && (
                          <Badge variant="outline" className="text-xs">
                            {assignedUser.first_name} {assignedUser.last_name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {config.startTime} - {config.endTime}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {config.dates.slice(0, 3).map((date, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {format(date, 'MMM d')}
                          </Badge>
                        ))}
                        {config.dates.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{config.dates.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeShiftConfiguration(config.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Team/User selection */}
        {bulkMode === "team" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Team</label>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : bulkMode === "users" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Select Multiple Users ({selectedUsers.length} selected)
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
            
            {/* Team Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Team</label>
              <Select value={selectedTeam} onValueChange={(value) => {
                setSelectedTeam(value);
                setSelectedUsers([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team first" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* User Selection */}
            <div className="space-y-2">
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
          </div>
        ) : null}
        
        <Button 
          onClick={generateSchedules} 
          disabled={loading || 
            (bulkMode === "team" && (!selectedTeam || selectedTeam === "")) ||
            (bulkMode === "rotation" && (!selectedTeam || selectedTeam === "")) ||
            (bulkMode === "users" && selectedUsers.length === 0) ||
            shiftConfigurations.length === 0}
          className="w-full"
        >
          <Zap className="w-4 h-4 mr-2" />
          {loading ? "Generating..." : `Generate ${bulkMode === 'rotation' && enableRecurring ? `Rotation (${rotationPattern.cycles} cycle${rotationPattern.cycles > 1 ? 's' : ''})` : `All Shifts`} (${shiftConfigurations.length} config${shiftConfigurations.length !== 1 ? 's' : ''})`}
        </Button>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              {shiftConfigurations.length === 0 
                ? 'Add shift configurations above to get started'
                : bulkMode === 'rotation' && enableRecurring
                  ? `Ready to generate ${shiftConfigurations.reduce((sum, c) => sum + c.dates.length, 0)} shifts per cycle × ${rotationPattern.cycles} cycles = ${shiftConfigurations.reduce((sum, c) => sum + c.dates.length, 0) * rotationPattern.cycles} total shifts`
                  : `Ready to generate ${shiftConfigurations.reduce((sum, c) => sum + c.dates.length, 0)} shift${shiftConfigurations.reduce((sum, c) => sum + c.dates.length, 0) !== 1 ? 's' : ''} across ${shiftConfigurations.length} configuration${shiftConfigurations.length !== 1 ? 's' : ''}`
              }
            </span>
          </div>
          <div>Automatically excludes holidays based on user country</div>
          {bulkMode === 'rotation' && enableRecurring && (
            <div className="flex items-center gap-1 text-primary">
              <Repeat className="w-3 h-3" />
              <span>
                Pattern repeats every {rotationPattern.intervalWeeks} week{rotationPattern.intervalWeeks > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BulkScheduleGenerator;