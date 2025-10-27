import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Clock, Users, Zap, User, CheckCircle2, Repeat, X, TrendingUp, Moon, PartyPopper, RefreshCw } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, subMonths, getDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { cn, formatUserName, doesShiftCrossMidnight } from "@/lib/utils";
import { useShiftCounts, ShiftCounts } from "@/hooks/useShiftCounts";
import { ShiftCountsDisplay } from "./ShiftCountsDisplay";
import { FairnessAnalysis } from "./FairnessAnalysis";
import { TimeSelect } from "@/components/ui/time-select";
import { BulkSchedulePreviewModal } from "./BulkSchedulePreviewModal";
import { FairnessParameters } from "./FairnessParameters";
import { useCoverageAnalysis } from "@/hooks/useCoverageAnalysis";

interface Team {
  id: string;
  name: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  initials?: string;
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
  perDateTimes?: { [dateStr: string]: { startTime: string; endTime: string } }; // For rotation mode with different times per date
}

interface RotationPattern {
  intervalWeeks: number;
  cycles: number;
}

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
  const [shiftTemplate, setShiftTemplate] = useState<string>('custom');
  const [customStartTime, setCustomStartTime] = useState<string>('08:00');
  const [customEndTime, setCustomEndTime] = useState<string>('16:30');
  const [rangeStartDate, setRangeStartDate] = useState<Date>();
  const [rangeEndDate, setRangeEndDate] = useState<Date>();
  const [shiftConfigurations, setShiftConfigurations] = useState<ShiftConfiguration[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([
    { id: 'custom', name: 'Custom Shift', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
  ]);
  
  // Rotation mode states
  const [selectedUsersForRotation, setSelectedUsersForRotation] = useState<string[]>([]);
  const [enableRecurring, setEnableRecurring] = useState(false);
  const [excludeHolidays, setExcludeHolidays] = useState(true); // Default to excluding holidays
  const [includeWeekends, setIncludeWeekends] = useState(false); // For non-standard shifts
  const [rotationPattern, setRotationPattern] = useState<RotationPattern>({
    intervalWeeks: 4,
    cycles: 1
  });
  const [perDateTimes, setPerDateTimes] = useState<{ [dateStr: string]: { startTime: string; endTime: string } }>({});
  
  // Fairness mode states
  const [fairnessMode, setFairnessMode] = useState(false);
  const [showDistributionSummary, setShowDistributionSummary] = useState(false);
  const [countsDateRange, setCountsDateRange] = useState<number>(6); // months
  const [countsRefreshKey, setCountsRefreshKey] = useState(0);
  
  // Preview mode states
  const [showPreview, setShowPreview] = useState(false);
  const [previewEntries, setPreviewEntries] = useState<any[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  // Adjustable fairness parameters
  const [fairnessWeight, setFairnessWeight] = useState(50); // 0-100%
  const [historicalWindow, setHistoricalWindow] = useState(6); // months
  const [avoidConsecutiveWeekends, setAvoidConsecutiveWeekends] = useState(true);
  const [balanceHolidayShifts, setBalanceHolidayShifts] = useState(true);
  
  // Fetch shift counts for fairness mode
  const effectiveUserIds = bulkMode === "users" ? selectedUsers : 
                           bulkMode === "rotation" ? selectedUsersForRotation :
                           [];
  
  const fairnessAnalysisUserIds = bulkMode === "team" ? undefined : effectiveUserIds;
  
  const { shiftCounts, loading: countsLoading } = useShiftCounts({
    userIds: selectedTeam && (bulkMode === "team" || effectiveUserIds.length > 0) ? 
             (bulkMode === "team" ? [] : effectiveUserIds) : [], // Empty array will fetch all team members in effect
    teamIds: selectedTeam ? [selectedTeam] : undefined,
    startDate: subMonths(new Date(), countsDateRange).toISOString().split('T')[0],
    enabled: (bulkMode === "team" || bulkMode === "users" || bulkMode === "rotation") && !!selectedTeam && fairnessMode,
  });
  
  // Detect what type of shift is being scheduled to show relevant counts
  const getRelevantShiftType = (): 'night' | 'weekend' | 'holiday' | 'all' => {
    if (!rangeStartDate || !rangeEndDate) return 'all';
    
    const dateRange = getDateRangeArray();
    if (dateRange.length === 0) return 'all';
    
    // Check if any dates are weekends (Saturday=6, Sunday=0)
    const hasWeekends = dateRange.some(date => {
      const day = getDay(date);
      return day === 0 || day === 6;
    });
    
    // Check if times indicate night shift (crosses midnight or starts after 18:00 or ends before 08:00)
    let isNightShift = false;
    if (bulkMode === 'rotation' && Object.keys(perDateTimes).length > 0) {
      isNightShift = Object.values(perDateTimes).some(times => 
        doesShiftCrossMidnight(times.startTime, times.endTime) || 
        times.startTime >= '18:00' ||
        times.endTime <= '08:00'
      );
    } else if (shiftTemplate !== 'custom') {
      isNightShift = doesShiftCrossMidnight(customStartTime, customEndTime) ||
                     customStartTime >= '18:00' ||
                     customEndTime <= '08:00';
    }
    
    if (hasWeekends) return 'weekend';
    if (isNightShift) return 'night';
    return 'all';
  };
  
  const refreshCounts = () => {
    setCountsRefreshKey(prev => prev + 1);
  };

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
    fetchShiftDefinitions();
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
          profiles!inner(first_name, last_name, email, initials)
        `)
        .eq('team_id', selectedTeam) as any;

      if (error) throw error;

      const usersData = data?.map((member: any) => ({
        id: member.user_id,
        first_name: member.profiles.first_name,
        last_name: member.profiles.last_name,
        initials: member.profiles.initials,
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

  const fetchShiftDefinitions = async () => {
    try {
      // Fetch all shift definitions
      const { data, error } = await supabase
        .from('shift_time_definitions')
        .select('*')
        .order('shift_type');

      if (error) {
        console.error('Error fetching shift definitions:', error);
        throw error;
      }

      // Filter based on selected team
      let filtered = data || [];
      if (selectedTeam) {
        filtered = data?.filter(def => {
          // Global definitions (both fields null)
          const isGlobal = def.team_ids === null && def.team_id === null;
          
          // Team-specific definitions
          const matchesTeamIds = def.team_ids && def.team_ids.includes(selectedTeam);
          const matchesTeamId = def.team_id === selectedTeam;
          
          return isGlobal || matchesTeamIds || matchesTeamId;
        }) || [];
      } else {
        // Only global definitions when no team selected
        filtered = data?.filter(def => def.team_ids === null && def.team_id === null) || [];
      }

      console.log('Filtered shift definitions:', filtered);

      const templates: ShiftTemplate[] = [];

      // Create a template for each unique shift definition
      if (filtered && filtered.length > 0) {
        for (const def of filtered) {
          const shiftType = def.shift_type;
          const displayName = shiftType === 'normal' ? 'Normal' :
                             shiftType === 'weekend' ? 'Weekend / National Holiday' :
                             shiftType.charAt(0).toUpperCase() + shiftType.slice(1);
          
          // Use description if available, otherwise use generic name
          const name = def.description 
            ? `${def.description} (${def.start_time.substring(0, 5)}-${def.end_time.substring(0, 5)})`
            : `${displayName} Shift (${def.start_time.substring(0, 5)}-${def.end_time.substring(0, 5)})`;
          
          templates.push({
            id: def.id, // Use the definition ID as the template ID
            name: name,
            startTime: def.start_time.substring(0, 5), // Remove seconds
            endTime: def.end_time.substring(0, 5), // Remove seconds
            days: shiftType === 'weekend' ? [0, 6] : [1, 2, 3, 4, 5]
          });
        }
      }

      // Always add custom option
      templates.push({
        id: 'custom',
        name: 'Custom Shift',
        startTime: '08:00',
        endTime: '16:30',
        days: [1, 2, 3, 4, 5]
      });

      console.log('Final templates:', templates);

      // If we got templates from database, use them; otherwise use defaults
      if (templates.length > 1) { // More than just 'custom'
        setShiftTemplates(templates);
        // Set default to first non-custom template if current selection is 'custom' or doesn't exist
        if (shiftTemplate === 'custom' || !templates.find(t => t.id === shiftTemplate)) {
          const firstNonCustom = templates.find(t => t.id !== 'custom');
          if (firstNonCustom) {
            setShiftTemplate(firstNonCustom.id);
            setCustomStartTime(firstNonCustom.startTime);
            setCustomEndTime(firstNonCustom.endTime);
          }
        }
      } else {
        // Fallback to defaults if no definitions found
        console.log('Using fallback templates - no definitions found');
        setShiftTemplates([
          { id: 'normal', name: 'Normal Shift (08:00-16:30)', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
          { id: 'early', name: 'Early Shift (06:00-14:30)', startTime: '06:00', endTime: '14:30', days: [1, 2, 3, 4, 5] },
          { id: 'late', name: 'Late Shift (13:00-21:30)', startTime: '13:00', endTime: '21:30', days: [1, 2, 3, 4, 5] },
          { id: 'weekend', name: 'Weekend / National Holiday (08:00-16:00)', startTime: '08:00', endTime: '16:00', days: [0, 6] },
          { id: 'custom', name: 'Custom Shift', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
        ]);
      }
    } catch (error) {
      console.error('Error fetching shift definitions:', error);
      // Use fallback on error
      setShiftTemplates([
        { id: 'normal', name: 'Normal Shift (08:00-16:30)', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
        { id: 'early', name: 'Early Shift (06:00-14:30)', startTime: '06:00', endTime: '14:30', days: [1, 2, 3, 4, 5] },
        { id: 'late', name: 'Late Shift (13:00-21:30)', startTime: '13:00', endTime: '21:30', days: [1, 2, 3, 4, 5] },
        { id: 'weekend', name: 'Weekend / National Holiday (08:00-16:00)', startTime: '08:00', endTime: '16:00', days: [0, 6] },
        { id: 'custom', name: 'Custom Shift', startTime: '08:00', endTime: '16:30', days: [1, 2, 3, 4, 5] },
      ]);
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
    return shiftTemplates.find(t => t.id === shiftTemplate) || shiftTemplates[0];
  };

  const getDateRangeArray = (): Date[] => {
    if (!rangeStartDate || !rangeEndDate) return [];
    
    const allDates = eachDayOfInterval({ start: rangeStartDate, end: rangeEndDate });
    
    // For rotation mode or custom shifts with includeWeekends enabled, include all days
    // For predefined shifts or when includeWeekends is false, exclude weekends
    if ((bulkMode === 'rotation' || shiftTemplate === 'custom') && includeWeekends) {
      return allDates; // Include all days including weekends
    }
    
    return allDates.filter(date => !isWeekend(date)); // Only weekdays
  };

  // Update per-date times when date range changes (rotation mode only)
  useEffect(() => {
    if (bulkMode === 'rotation' && rangeStartDate && rangeEndDate) {
      const dateRange = getDateRangeArray();
      
      // Check max 7 days for rotation mode
      if (dateRange.length > 7) {
        toast({
          title: "Date Range Too Long",
          description: "Rotation schedule mode supports a maximum of 7 days",
          variant: "destructive",
        });
        setRangeEndDate(undefined);
        return;
      }
      
      // Initialize times for each date if not already set
      const newPerDateTimes: { [dateStr: string]: { startTime: string; endTime: string } } = {};
      dateRange.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (perDateTimes[dateStr]) {
          newPerDateTimes[dateStr] = perDateTimes[dateStr];
        } else {
          newPerDateTimes[dateStr] = {
            startTime: customStartTime || '08:00',
            endTime: customEndTime || '16:30'
          };
        }
      });
      setPerDateTimes(newPerDateTimes);
    }
  }, [rangeStartDate, rangeEndDate, bulkMode, includeWeekends]);

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

    // For rotation mode, validate per-date times
    if (bulkMode === 'rotation') {
      for (const date of dateRange) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const times = perDateTimes[dateStr];
        if (!times || !times.startTime || !times.endTime) {
          toast({
            title: "Error",
            description: `Please set start and end times for ${format(date, 'PPP')}`,
            variant: "destructive",
          });
          return;
        }
        // Allow night shifts that cross midnight (e.g., 21:00 to 06:00)
        if (times.startTime === times.endTime) {
          toast({
            title: "Error",
            description: `Start and end time cannot be the same for ${format(date, 'PPP')}`,
            variant: "destructive",
          });
          return;
        }
      }
    } else if (shiftTemplate === 'custom') {
      if (!customStartTime || !customEndTime) {
        toast({
          title: "Error",
          description: "Please set start and end times",
          variant: "destructive",
        });
        return;
      }

      // Allow night shifts that cross midnight (e.g., 21:00 to 06:00)
      if (customStartTime === customEndTime) {
        toast({
          title: "Error",
          description: "Start and end time cannot be the same",
          variant: "destructive",
        });
        return;
      }
    }

    const template = shiftTemplates.find(t => t.id === shiftTemplate);
    
    // For rotation mode, create separate configs for each selected user
    if (bulkMode === 'rotation') {
      const newConfigs = selectedUsersForRotation.map(userId => {
        const selectedUser = users.find(u => u.id === userId);
        return {
          id: `shift-${Date.now()}-${userId}`,
          shiftType: shiftTemplate,
          shiftName: template?.name || 'Custom',
          dates: [...dateRange],
          startTime: shiftTemplate === 'custom' ? customStartTime : template?.startTime || '08:00',
          endTime: shiftTemplate === 'custom' ? customEndTime : template?.endTime || '16:30',
          userId: userId,
          perDateTimes: { ...perDateTimes } // Store individual times per date
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
        startTime: shiftTemplate === 'custom' ? customStartTime : template?.startTime || '08:00',
        endTime: shiftTemplate === 'custom' ? customEndTime : template?.endTime || '16:30',
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
    setIncludeWeekends(false);
    setPerDateTimes({});
    if (bulkMode === 'rotation') {
      setSelectedUsersForRotation([]);
    }
  };

  const removeShiftConfiguration = (id: string) => {
    setShiftConfigurations(prev => prev.filter(config => config.id !== id));
  };

  const getShiftTimes = () => {
    if (shiftTemplate === 'custom') {
      return { start: customStartTime, end: customEndTime };
    }
    const template = shiftTemplates.find(t => t.id === shiftTemplate);
    return { start: template?.startTime || '08:00', end: template?.endTime || '16:30' };
  };

  const generateSchedulesPreview = async () => {
    // First, generate schedules in memory (preview mode)
    const entries = await generateSchedulesInMemory();
    if (!entries || entries.length === 0) return;
    
    // Calculate coverage and fairness on preview
    const analysis = await calculatePreviewMetrics(entries);
    
    setPreviewEntries(entries);
    setPreviewData(analysis);
    setShowPreview(true);
  };

  const confirmAndSaveSchedules = async () => {
    if (!previewEntries || previewEntries.length === 0) return;
    
    setConfirmLoading(true);
    try {
      // Save all entries to database
      for (const entry of previewEntries) {
        const { error } = await supabase
          .from('schedule_entries')
          .upsert({
            user_id: entry.user_id,
            team_id: entry.team_id,
            date: entry.date,
            shift_type: entry.shift_type,
            activity_type: entry.activity_type,
            availability_status: entry.availability_status,
            notes: entry.notes,
            created_by: user!.id,
          }, {
            onConflict: 'user_id,date,team_id',
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Generated ${previewEntries.length} shifts successfully`,
      });

      // Clear state and close modal
      setShowPreview(false);
      setPreviewEntries([]);
      setPreviewData(null);
      setShiftConfigurations([]);
      setEnableRecurring(false);
      setRotationPattern({ intervalWeeks: 4, cycles: 1 });

      // Notify parent to refresh
      onScheduleGenerated?.();
    } catch (error: any) {
      console.error('Error saving schedules:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save schedules",
        variant: "destructive",
      });
    } finally {
      setConfirmLoading(false);
    }
  };

  const generateSchedulesInMemory = async (): Promise<any[]> => {
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
    
    console.log(`🚀 Starting bulk schedule preview generation:`, {
      bulkMode,
      selectedTeam,
      excludeHolidays,
      configurationsCount: shiftConfigurations.length,
      cycles: enableRecurring ? rotationPattern.cycles : 1,
      fairnessWeight,
      historicalWindow
    });
    
    const entries: any[] = [];
    
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

      let totalSkippedHolidays = 0;
      const cycles = enableRecurring ? rotationPattern.cycles : 1;
      const userLastWeekendMap = new Map<string, string>(); // Track last weekend shift per user
      
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

          // Apply fairness sorting with weighted scoring
          if (fairnessMode && (bulkMode === "team" || bulkMode === "users") && shiftCounts.length > 0) {
            const countsMap = new Map(shiftCounts.map(c => [c.user_id, c]));
            targetUsers = [...targetUsers].sort((a, b) => {
              const aCounts = countsMap.get(a);
              const bCounts = countsMap.get(b);
              if (!aCounts && !bCounts) return 0;
              if (!aCounts) return 1;
              if (!bCounts) return -1;
              
              // Weighted fairness calculation
              const holidayWeight = balanceHolidayShifts ? 3 : 2;
              const aScore = (aCounts.weekend_shifts_count * 1.5) + 
                           (aCounts.night_shifts_count * 2) + 
                           (aCounts.holiday_shifts_count * holidayWeight);
              const bScore = (bCounts.weekend_shifts_count * 1.5) + 
                           (bCounts.night_shifts_count * 2) + 
                           (bCounts.holiday_shifts_count * holidayWeight);
              
              // Apply fairness weight: lower score = prioritize for shifts
              const weightedA = aScore * (fairnessWeight / 100);
              const weightedB = bScore * (fairnessWeight / 100);
              
              return weightedA - weightedB;
            });
            
            console.log(`✨ Fairness mode: Sorted ${targetUsers.length} users (weight: ${fairnessWeight}%)`);
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
                continue;
              }

              // Check for consecutive weekend shifts if rule is enabled
              const dayOfWeek = date.getDay();
              const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
              if (avoidConsecutiveWeekends && isWeekendDay) {
                const lastWeekend = userLastWeekendMap.get(userId);
                if (lastWeekend) {
                  const lastDate = new Date(lastWeekend);
                  const daysDiff = Math.abs((date.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                  if (daysDiff <= 7) {
                    console.log(`⏭️ Skipping consecutive weekend for user ${userId.substring(0,8)}`);
                    continue;
                  }
                }
                userLastWeekendMap.set(userId, dateStr);
              }


              // Determine shift type based on shift name
              let shiftType: 'early' | 'late' | 'normal' = 'normal';
              if (config.shiftName.toLowerCase().includes('early')) {
                shiftType = 'early';
              } else if (config.shiftName.toLowerCase().includes('late')) {
                shiftType = 'late';
              }

              // Get times for this specific date (if per-date times exist)
              const dateTimes = config.perDateTimes?.[dateStr] || {
                startTime: config.startTime,
                endTime: config.endTime
              };

              // Format notes with time block data for proper display
              const timeBlockData = [{
                activity_type: 'work',
                start_time: dateTimes.startTime,
                end_time: dateTimes.endTime
              }];
              const cycleInfo = cycles > 1 ? ` (Cycle ${cycle + 1}/${cycles})` : '';
              const notes = `Times: ${JSON.stringify(timeBlockData)}\nAuto-generated ${config.shiftName}${cycleInfo}`;

              // Create entry object (in-memory for preview)
              entries.push({
                user_id: userId,
                team_id: selectedTeam,
                date: dateStr,
                shift_type: shiftType,
                activity_type: 'work',
                availability_status: 'available',
                notes: notes,
                user_name: `User ${userId.substring(0, 8)}`, // Will be enriched later
              });
            }
          }
        }
      }
      
      console.log(`✅ Preview generation complete: ${entries.length} entries`);
      return entries;

    } catch (error: any) {
      console.error('Error generating preview:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate preview",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const calculatePreviewMetrics = async (entries: any[]) => {
    // Calculate coverage and fairness metrics
    const totalDays = new Set(entries.map(e => e.date)).size;
    const threshold = 90;
    
    // Simple coverage calculation (can be enhanced)
    const coveragePercentage = Math.min(100, Math.round((entries.length / (totalDays * 2)) * 100));
    
    // Count shift types
    const weekendShifts = entries.filter(e => {
      const day = new Date(e.date).getDay();
      return day === 0 || day === 6;
    }).length;
    
    const nightShifts = entries.filter(e => 
      e.shift_type === 'early' || e.shift_type === 'late'
    ).length;
    
    // Fetch holidays to count holiday shifts
    const { data: holidays } = await supabase
      .from('holidays')
      .select('date')
      .eq('is_public', true);
    
    const holidayDates = new Set(holidays?.map(h => h.date) || []);
    const holidayShifts = entries.filter(e => holidayDates.has(e.date)).length;
    
    // Simple fairness score calculation
    const userShiftCounts = new Map<string, number>();
    entries.forEach(e => {
      userShiftCounts.set(e.user_id, (userShiftCounts.get(e.user_id) || 0) + 1);
    });
    
    const counts = Array.from(userShiftCounts.values());
    const avgShifts = counts.reduce((sum, c) => sum + c, 0) / counts.length;
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - avgShifts, 2), 0) / counts.length;
    const fairnessScore = Math.max(0, 100 - (variance * 5)); // Lower variance = higher fairness
    
    return {
      entries,
      coveragePercentage,
      gaps: [], // Would need team capacity config to calculate
      fairnessScore,
      totalDays,
      coveredDays: totalDays,
      threshold,
      weekendShifts,
      nightShifts,
      holidayShifts,
    };
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
    <>
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
                    {formatUserName(usr.first_name, usr.last_name, usr.initials)}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shift Template Selection - Only for non-rotation modes */}
        {bulkMode !== 'rotation' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Shift Type</label>
            <Select value={shiftTemplate} onValueChange={(value) => {
              setShiftTemplate(value);
              const template = shiftTemplates.find(t => t.id === value);
              if (template) {
                setCustomStartTime(template.startTime);
                setCustomEndTime(template.endTime);
              }
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shiftTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Time Selection for Custom shifts - Only for non-rotation modes */}
        {bulkMode !== 'rotation' && shiftTemplate === 'custom' && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/20">
            <Label className="text-sm font-medium">Shift Times</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time" className="text-xs text-muted-foreground">Start Time (24h)</Label>
                <TimeSelect
                  value={customStartTime}
                  onValueChange={setCustomStartTime}
                  placeholder="Select start time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time" className="text-xs text-muted-foreground">End Time (24h)</Label>
                <TimeSelect
                  value={customEndTime}
                  onValueChange={setCustomEndTime}
                  placeholder="Select end time"
                />
              </div>
            </div>
          </div>
        )}

        {/* Include Weekends Option - Only for custom shifts in non-rotation modes */}
        {bulkMode !== 'rotation' && shiftTemplate === 'custom' && (
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Include Weekends</Label>
              <p className="text-xs text-muted-foreground">
                Schedule shifts on Saturdays and Sundays for this shift type
              </p>
            </div>
            <Checkbox
              checked={includeWeekends}
              onCheckedChange={(checked) => setIncludeWeekends(checked === true)}
            />
          </div>
        )}

        {/* Include Weekends Option for Rotation Mode */}
        {bulkMode === 'rotation' && (
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/10">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Include Weekends</Label>
              <p className="text-xs text-muted-foreground">
                Include Saturdays and Sundays in the rotation schedule
              </p>
            </div>
            <Checkbox
              checked={includeWeekends}
              onCheckedChange={(checked) => setIncludeWeekends(checked === true)}
            />
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
              {getDateRangeArray().length} {(bulkMode === 'rotation' || shiftTemplate === 'custom') && includeWeekends ? 'days' : 'weekdays'} selected ({format(rangeStartDate, "MMM d")} - {format(rangeEndDate, "MMM d, yyyy")})
            </div>
          )}
        </div>

        {/* Per-Date Time Configuration for Rotation Mode */}
        {bulkMode === 'rotation' && rangeStartDate && rangeEndDate && getDateRangeArray().length > 0 && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/10">
            <Label className="text-sm font-medium">Shift Times for Each Date</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Configure different shift times for each date in the selected range
            </p>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {getDateRangeArray().map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const times = perDateTimes[dateStr] || { startTime: '08:00', endTime: '16:30' };
                return (
                  <div key={dateStr} className="p-3 border rounded-md bg-background space-y-2">
                    <div className="font-medium text-sm">{format(date, 'EEEE, MMMM d, yyyy')}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`start-${dateStr}`} className="text-xs text-muted-foreground">
                          Start Time (24h)
                        </Label>
                        <TimeSelect
                          value={times.startTime}
                          onValueChange={(value) => {
                            setPerDateTimes(prev => ({
                              ...prev,
                              [dateStr]: { ...prev[dateStr], startTime: value }
                            }));
                          }}
                          placeholder="Select start time"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`end-${dateStr}`} className="text-xs text-muted-foreground">
                          End Time (24h)
                        </Label>
                        <TimeSelect
                          value={times.endTime}
                          onValueChange={(value) => {
                            setPerDateTimes(prev => ({
                              ...prev,
                              [dateStr]: { ...prev[dateStr], endTime: value }
                            }));
                          }}
                          placeholder="Select end time"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Fairness Mode Option - Only for team and users modes */}
        {(bulkMode === "team" || bulkMode === "users") && (
          <div className="space-y-3 p-4 border rounded-lg bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <Label className="text-sm font-semibold">Fairness Mode</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Prioritize employees with fewer weekend, night, and holiday shifts
                </p>
              </div>
              <Checkbox
                checked={fairnessMode}
                onCheckedChange={(checked) => {
                  setFairnessMode(checked === true);
                  if (checked) setShowDistributionSummary(true);
                }}
              />
            </div>
            
            {fairnessMode && (
              <div className="pt-3 border-t space-y-3">
                {/* Date Range Selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Count Shifts From</Label>
                  <Select 
                    value={countsDateRange.toString()} 
                    onValueChange={(value) => {
                      setCountsDateRange(parseInt(value));
                      refreshCounts();
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Past 1 Month</SelectItem>
                      <SelectItem value="3">Past 3 Months</SelectItem>
                      <SelectItem value="6">Past 6 Months</SelectItem>
                      <SelectItem value="12">Past 12 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDistributionSummary(!showDistributionSummary)}
                    className="flex-1"
                  >
                    {showDistributionSummary ? "Hide" : "Show"} Distribution Summary
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshCounts}
                    disabled={countsLoading}
                    className="px-3"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", countsLoading && "animate-spin")} />
                  </Button>
                </div>
                
                {showDistributionSummary && (
                  <div className="space-y-2 p-3 bg-background rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-muted-foreground">
                        Current Shift Distribution (Last {countsDateRange} {countsDateRange === 1 ? 'Month' : 'Months'})
                      </div>
                      {rangeStartDate && rangeEndDate && getRelevantShiftType() !== 'all' && (
                        <Badge variant="secondary" className="text-xs">
                          {getRelevantShiftType() === 'night' && '🌙 Night Shifts'}
                          {getRelevantShiftType() === 'weekend' && '📅 Weekend Shifts'}
                          {getRelevantShiftType() === 'holiday' && '🎉 Holiday Shifts'}
                        </Badge>
                      )}
                    </div>
                    {countsLoading ? (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        Loading distribution data...
                      </div>
                    ) : shiftCounts.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No shift data available. Select team/users and configure shift times above.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {shiftCounts
                          .sort((a, b) => {
                            const relevantType = getRelevantShiftType();
                            let aValue = 0, bValue = 0;
                            
                            if (relevantType === 'night') {
                              aValue = a.night_shifts_count;
                              bValue = b.night_shifts_count;
                            } else if (relevantType === 'weekend') {
                              aValue = a.weekend_shifts_count;
                              bValue = b.weekend_shifts_count;
                            } else if (relevantType === 'holiday') {
                              aValue = a.holiday_shifts_count;
                              bValue = b.holiday_shifts_count;
                            } else {
                              // Sort by total unfair shifts
                              aValue = a.weekend_shifts_count + a.night_shifts_count + a.holiday_shifts_count;
                              bValue = b.weekend_shifts_count + b.night_shifts_count + b.holiday_shifts_count;
                            }
                            
                            return aValue - bValue;
                          })
                          .map((counts) => {
                            const user = users.find(u => u.id === counts.user_id);
                            if (!user) return null;
                            
                            const relevantType = getRelevantShiftType();
                            const totalUnfair = counts.weekend_shifts_count + counts.night_shifts_count + counts.holiday_shifts_count;
                            
                            return (
                              <div key={counts.user_id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                                <div className="flex-1">
                                  <div className="text-sm font-medium">
                                    {formatUserName(user.first_name, user.last_name, user.initials)}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1">
                                    {(relevantType === 'all' || relevantType === 'weekend') && (
                                      <div className={cn(
                                        "flex items-center gap-1 text-xs",
                                        relevantType === 'weekend' ? "text-foreground font-semibold" : "text-muted-foreground"
                                      )}>
                                        <CalendarIcon className="h-3 w-3" />
                                        {counts.weekend_shifts_count}
                                      </div>
                                    )}
                                    {(relevantType === 'all' || relevantType === 'night') && (
                                      <div className={cn(
                                        "flex items-center gap-1 text-xs",
                                        relevantType === 'night' ? "text-foreground font-semibold" : "text-muted-foreground"
                                      )}>
                                        <Moon className="h-3 w-3" />
                                        {counts.night_shifts_count}
                                      </div>
                                    )}
                                    {(relevantType === 'all' || relevantType === 'holiday') && (
                                      <div className={cn(
                                        "flex items-center gap-1 text-xs",
                                        relevantType === 'holiday' ? "text-foreground font-semibold" : "text-muted-foreground"
                                      )}>
                                        <PartyPopper className="h-3 w-3" />
                                        {counts.holiday_shifts_count}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Badge variant={totalUnfair === 0 ? "secondary" : totalUnfair < 5 ? "outline" : "default"}>
                                  {relevantType === 'night' && `${counts.night_shifts_count} night`}
                                  {relevantType === 'weekend' && `${counts.weekend_shifts_count} weekend`}
                                  {relevantType === 'holiday' && `${counts.holiday_shifts_count} holiday`}
                                  {relevantType === 'all' && `${totalUnfair} total`}
                                </Badge>
                              </div>
                            );
                          })}
                      </div>
                    )}
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground italic">
                        ℹ️ When Fairness Mode is enabled, employees with fewer difficult shifts will be prioritized. Managers can override the generated schedule.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Comprehensive Fairness Analysis */}
                {selectedTeam && (
                  <div className="pt-4">
                    <FairnessAnalysis 
                      teamId={selectedTeam}
                      userIds={fairnessAnalysisUserIds}
                      historicalMonths={countsDateRange}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                              {formatUserName(assignedUser.first_name, assignedUser.last_name, assignedUser.initials)}
                            </Badge>
                          )}
                        </div>
                      <div className="text-xs text-muted-foreground">
                        {config.perDateTimes ? (
                          'Custom times per date'
                        ) : (
                          <>
                            {config.startTime} - {config.endTime}
                            {doesShiftCrossMidnight(config.startTime, config.endTime) && (
                              <span className="ml-1 text-orange-500" title="This shift continues into the next day">
                                → Next day
                              </span>
                            )}
                          </>
                        )}
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
                        {formatUserName(usr.first_name, usr.last_name, usr.initials)}
                      </Label>
                      {selectedUsers.includes(usr.id) && (
                        <CheckCircle2 className="w-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
        
        {/* Fairness Parameters (when fairness mode is enabled) */}
        {fairnessMode && (bulkMode === "team" || bulkMode === "users") && (
          <FairnessParameters
            fairnessWeight={fairnessWeight}
            onFairnessWeightChange={setFairnessWeight}
            historicalWindow={historicalWindow}
            onHistoricalWindowChange={(value) => {
              setHistoricalWindow(value);
              setCountsDateRange(value);
            }}
            avoidConsecutiveWeekends={avoidConsecutiveWeekends}
            onAvoidConsecutiveWeekendsChange={setAvoidConsecutiveWeekends}
            balanceHolidayShifts={balanceHolidayShifts}
            onBalanceHolidayShiftsChange={setBalanceHolidayShifts}
          />
        )}

        <Button 
          onClick={generateSchedulesPreview} 
          disabled={loading || 
            (bulkMode === "team" && (!selectedTeam || selectedTeam === "")) ||
            (bulkMode === "rotation" && (!selectedTeam || selectedTeam === "")) ||
            (bulkMode === "users" && selectedUsers.length === 0) ||
            shiftConfigurations.length === 0}
          className="w-full"
        >
          <Zap className="w-4 h-4 mr-2" />
          {loading ? "Generating Preview..." : `Preview & Generate ${bulkMode === 'rotation' && enableRecurring ? `Rotation (${rotationPattern.cycles} cycle${rotationPattern.cycles > 1 ? 's' : ''})` : `Shifts`} (${shiftConfigurations.length} config${shiftConfigurations.length !== 1 ? 's' : ''})`}
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

    {/* Preview Modal */}
    <BulkSchedulePreviewModal
      open={showPreview}
      onClose={() => setShowPreview(false)}
      onConfirm={confirmAndSaveSchedules}
      onRegenerate={() => {
        setShowPreview(false);
        setTimeout(() => generateSchedulesPreview(), 100);
      }}
      previewData={previewData}
      loading={confirmLoading}
    />
    </>
  );
};

export default BulkScheduleGenerator;