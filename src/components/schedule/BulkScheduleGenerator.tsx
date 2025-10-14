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

interface ShiftConfiguration {
  id: string;
  shiftType: string;
  shiftName: string;
  dates: Date[];
  startTime: string;
  endTime: string;
}

const SHIFT_TEMPLATES: ShiftTemplate[] = [
  { id: 'standard', name: 'Standard Shift (Mon-Fri 08:00-16:30)', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
  { id: 'early', name: 'Early Shift', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
  { id: 'late', name: 'Late Shift', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
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
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [shiftConfigurations, setShiftConfigurations] = useState<ShiftConfiguration[]>([]);

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

  const toggleDateSelection = (date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDates(prev => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const exists = prev.some(d => format(d, 'yyyy-MM-dd') === dateStr);
      
      if (exists) {
        return prev.filter(d => format(d, 'yyyy-MM-dd') !== dateStr);
      } else {
        return [...prev, date].sort((a, b) => a.getTime() - b.getTime());
      }
    });
  };

  const addShiftConfiguration = () => {
    if (selectedDates.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one date",
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
    const newConfig: ShiftConfiguration = {
      id: `shift-${Date.now()}`,
      shiftType: shiftTemplate,
      shiftName: template?.name || 'Custom',
      dates: [...selectedDates],
      startTime: shiftTemplate === 'standard' ? '08:00' : customStartTime,
      endTime: shiftTemplate === 'standard' ? '16:30' : customEndTime,
    };

    setShiftConfigurations(prev => [...prev, newConfig]);
    
    // Reset form
    setSelectedDates([]);
    setShiftTemplate('standard');
    setCustomStartTime('08:00');
    setCustomEndTime('16:30');

    toast({
      title: "Shift Added",
      description: `Added ${newConfig.shiftName} for ${newConfig.dates.length} date(s)`,
    });
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

      // Generate shifts for all configurations
      let totalGenerated = 0;
      const targetUsers = bulkMode === "team" 
        ? await getTeamMemberIds(selectedTeam)
        : selectedUsers;

      for (const userId of targetUsers) {
        for (const config of shiftConfigurations) {
          // Get user's profile for holiday checking
          const { data: profile } = await supabase
            .from('profiles')
            .select('country_code, region_code')
            .eq('user_id', userId)
            .maybeSingle();

          const countryCode = profile?.country_code || 'US';
          const regionCode = profile?.region_code || null;

          // For each date in the configuration
          for (const date of config.dates) {
            const dateStr = format(date, 'yyyy-MM-dd');
            
            // Check if it's a holiday
            const { data: holidays } = await supabase
              .from('holidays')
              .select('id')
              .eq('date', dateStr)
              .eq('country_code', countryCode)
              .eq('is_public', true)
              .or(`region_code.is.null,region_code.eq.${regionCode}`)
              .limit(1);

            // Skip if it's a holiday
            if (holidays && holidays.length > 0) continue;

            // Insert or update the schedule entry
            const { error } = await supabase
              .from('schedule_entries')
              .upsert({
                user_id: userId,
                team_id: selectedTeam,
                date: dateStr,
                shift_type: 'normal',
                activity_type: 'work',
                availability_status: 'available',
                notes: `Auto-generated ${config.shiftName} (${config.startTime}-${config.endTime})`,
                created_by: user.id,
              }, {
                onConflict: 'user_id,date,team_id',
              });

            if (!error) totalGenerated++;
          }
        }
      }
      
      toast({
        title: "Success",
        description: `Generated ${totalGenerated} shifts across ${shiftConfigurations.length} configuration(s)`,
      });
      
      // Clear configurations after successful generation
      setShiftConfigurations([]);
      
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
            // Reset selected dates when changing shift type
            if (value === 'standard') {
              setSelectedDates([]);
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

        {/* Date Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Select Dates for This Shift</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDates.length === 0 
                  ? 'Pick dates' 
                  : `${selectedDates.length} date${selectedDates.length !== 1 ? 's' : ''} selected`
                }
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates || [])}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {selectedDates.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedDates.map((date, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive/10"
                  onClick={() => toggleDateSelection(date)}
                >
                  {format(date, 'MMM d')}
                  <span className="ml-1">×</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Add Shift Configuration Button */}
        <Button 
          onClick={addShiftConfiguration}
          variant="secondary"
          className="w-full"
          disabled={selectedDates.length === 0}
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
              {shiftConfigurations.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{config.shiftName}</div>
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
                    ×
                  </Button>
                </div>
              ))}
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
            shiftConfigurations.length === 0}
          className="w-full"
        >
          <Zap className="w-4 h-4 mr-2" />
          {loading ? "Generating..." : `Generate All Shifts (${shiftConfigurations.length} config${shiftConfigurations.length !== 1 ? 's' : ''})`}
        </Button>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              {shiftConfigurations.length === 0 
                ? 'Add shift configurations above to get started'
                : `Ready to generate ${shiftConfigurations.reduce((sum, c) => sum + c.dates.length, 0)} shift${shiftConfigurations.reduce((sum, c) => sum + c.dates.length, 0) !== 1 ? 's' : ''} across ${shiftConfigurations.length} configuration${shiftConfigurations.length !== 1 ? 's' : ''}`
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