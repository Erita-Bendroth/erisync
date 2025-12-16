import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DatePicker } from '@/components/ui/date-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useHolidayRefetch } from '@/hooks/useHolidayRefetch';
import { format, addDays, subDays, startOfWeek, isSameDay, isWeekend, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, subMonths as dateFnsSubMonths, parseISO } from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Check, ChevronDown, Calendar, FileText, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useLocation } from 'react-router-dom';
import { EditScheduleModal } from './EditScheduleModal';
import { TimeBlockDisplay } from './TimeBlockDisplay';
import { TeamHierarchyInfo } from './TeamHierarchyInfo';
import { VacationRequestModal } from './VacationRequestModal';
import { MyRequestsDialog } from './MyRequestsDialog';
import { TeamAvailabilityView } from './TeamAvailabilityView';
import { MonthlyScheduleView } from './MonthlyScheduleView';
import { PersonalMonthlyCalendar } from './PersonalMonthlyCalendar';
import { TeamFavoritesManager } from './TeamFavoritesManager';
import { TeamFavoritesQuickAccess } from './TeamFavoritesQuickAccess';
import { BulkEditShiftsModal } from './BulkEditShiftsModal';
import { TimeEntryDialog } from './TimeEntryDialog';
import { FlexTimeSummaryCard } from './FlexTimeSummaryCard';
import { useTeamFavorites } from '@/hooks/useTeamFavorites';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { cn, formatUserName, doesShiftCrossMidnight } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useShiftCounts } from '@/hooks/useShiftCounts';
import { ShiftCountsDisplay } from './ShiftCountsDisplay';
import { useScheduleAccessControl } from '@/hooks/useScheduleAccessControl';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileScheduleCard } from '@/components/mobile/MobileScheduleCard';
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet';
import { hoursToTimeString } from '@/lib/flexTimeUtils';

interface ScheduleEntry {
  id: string;
  user_id: string;
  team_id: string;
  date: string;
  shift_type: string;
  activity_type: string;
  availability_status: string;
  notes?: string;
  shift_time_definition_id?: string | null;
  profiles: {
    first_name: string;
    last_name: string;
    initials?: string;
  };
  teams: {
    name: string;
  };
}

interface Employee {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  initials: string;
  country_code?: string;
  region_code?: string;
}

interface Team {
  id: string;
  name: string;
  parent_team_id?: string;
}

interface UserRole {
  role: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  country_code: string;
  region_code?: string;
  is_public: boolean;
}

interface ScheduleViewProps {
  initialTeamId?: string;
  refreshTrigger?: number;
}

const ScheduleView = ({ initialTeamId, refreshTrigger }: ScheduleViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { favorites } = useTeamFavorites('schedule');
  const holidayRefetchTrigger = useHolidayRefetch();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  // Initialize with initialTeamId if provided, otherwise default to "all"
  const [selectedTeams, setSelectedTeams] = useState<string[]>(
    initialTeamId && initialTeamId !== '' ? [initialTeamId] : ["all"]
  );
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<string>(
    initialTeamId && initialTeamId !== '' ? "team-availability" : "my-schedule"
  );
  const [timeView, setTimeView] = useState<"weekly" | "monthly">("weekly");
  const [employees, setEmployees] = useState<Employee[]>([]);
const [holidays, setHolidays] = useState<Holiday[]>([]);
const [loading, setLoading] = useState(true);
const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
const [showEditModal, setShowEditModal] = useState(false);
const [selectedMonthValue, setSelectedMonthValue] = useState<string>("current");
// Managed users visibility cache
const [managedUsersSet, setManagedUsersSet] = useState<Set<string>>(new Set());
  // Multi-select mode state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [managedCacheLoading, setManagedCacheLoading] = useState(false);
  // Vacation request modal
  const [vacationModalOpen, setVacationModalOpen] = useState(false);
  const [showVacationRequests, setShowVacationRequests] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingSwapRequestsCount, setPendingSwapRequestsCount] = useState(0);
  const [editingVacationRequest, setEditingVacationRequest] = useState<any>(null);
  const [shiftTimeDefinitions, setShiftTimeDefinitions] = useState<any[]>([]);
  const [dutyAssignments, setDutyAssignments] = useState<any[]>([]);
  const [pendingVacationRequests, setPendingVacationRequests] = useState<{
    id: string;
    user_id: string;
    requested_date: string;
    is_full_day: boolean;
    start_time: string | null;
    end_time: string | null;
    notes: string | null;
  }[]>([]);

  // Time entry dialog state (for FlexTime recording)
  const [timeEntryDialogOpen, setTimeEntryDialogOpen] = useState(false);
  const [timeEntryDate, setTimeEntryDate] = useState<Date | null>(null);

  // FlexTime entries hook - use current week's Monday for the month
  const {
    entries: timeEntries,
    monthlySummary,
    previousBalance,
    currentMonthDelta,
    currentBalance,
    carryoverLimit,
    userName,
    loading: timeEntriesLoading,
    saveEntry: saveTimeEntry,
    deleteEntry: deleteTimeEntry,
    getEntryForDate,
    saveCarryoverLimit,
    refresh: refreshTimeEntries
  } = useTimeEntries(currentWeek);
  const {
    canViewActivityDetails,
    canEditTeam,
    isAdmin: isAdminRole,
    isPlanner: isPlannerRole,
    isManager: isManagerRole,
    directlyManagedUsers,
  } = useScheduleAccessControl({ viewMode: 'standard' });

const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
const weekEnd = addDays(weekStart, 6); // Sunday end
// Show Monday through Sunday (full week)
const workDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)); // Mon-Sun

  const handleEditShift = (entry: ScheduleEntry) => {
    if (!isManager() && !isPlanner()) return;
    
    // Check if manager can edit this team
    if (!canEditTeam(entry.team_id)) {
      toast({ 
        title: "Edit Not Allowed", 
        description: "You can only edit schedules for teams you directly manage", 
        variant: "destructive" 
      });
      return;
    }
    
    setEditingEntry(entry);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingEntry(null);
  };

  const handleSaveEditModal = () => {
    // Refresh the schedule data after saving
    fetchScheduleEntries();
  };

  // Helper function to clean notes from system-generated messages
  const getCleanNotesForDisplay = (notes: string | null | undefined): string => {
    if (!notes) return "";
    
    // Remove system-generated notes and JSON artifacts
    let cleanNotes = notes
      .replace(/Times:\s*\[.*?\]/g, "")                           // Remove JSON time data
      .replace(/Shift:\s*.+?(?:\n|$)/g, "")                      // Remove shift name
      .replace(/Auto-generated.*?\)/g, "")                       // Remove auto-generated text
      .replace(/Bulk assigned/gi, "")                            // Remove "Bulk assigned"
      .replace(/Bulk generated.*?(?:\n|$)/gi, "")                // Remove "Bulk generated" and variations
      .replace(/Shift swapped via approved request on.*?(?:\n|$)/gi, "")  // Remove swap notes
      .replace(/^\s*\n+/g, "")                                   // Remove leading newlines
      .trim();
    
    return cleanNotes;
  };

  const handleDateClick = async (userId: string, date: Date) => {
    if (!isManager() && !isPlanner()) return;
    
    try {
      const existingEntry = scheduleEntries.find(entry => 
        entry.user_id === userId && isSameDay(new Date(entry.date), date)
      );
      if (existingEntry) {
        handleEditShift(existingEntry);
        return;
      }

      // Resolve the target user's team for this entry
      const { data: userTeamData, error: teamError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

      if (teamError || !userTeamData?.team_id) {
        toast({ title: "Error", description: "User is not assigned to any team", variant: "destructive" });
        return;
      }
      
      // Check if manager can edit this team
      if (!canEditTeam(userTeamData.team_id)) {
        toast({ 
          title: "Edit Not Allowed", 
          description: "You can only edit schedules for teams you directly manage", 
          variant: "destructive" 
        });
        return;
      }

      // Get team name for UI context
      const { data: teamInfo } = await supabase
        .from('teams')
        .select('name')
        .eq('id', userTeamData.team_id)
        .maybeSingle();

      // Get employee name for UI context
      const emp = employees.find(e => e.user_id === userId);

      // Open the editor in create mode (no immediate DB write)
      const tempEntry: ScheduleEntry = {
        id: `temp-${Date.now()}`,
        user_id: userId,
        team_id: userTeamData.team_id,
        date: format(date, 'yyyy-MM-dd'),
        shift_type: 'normal',
        activity_type: 'work',
        availability_status: 'available',
        notes: '',
        profiles: {
          first_name: emp?.first_name || 'User',
          last_name: emp?.last_name || ''
        },
        teams: { name: teamInfo?.name || 'Team' }
      };

      setEditingEntry(tempEntry);
      setShowEditModal(true);
    } catch (error) {
      console.error('Error preparing schedule entry creation:', error);
      toast({ title: "Error", description: "Could not open create entry dialog", variant: "destructive" });
    }
  };

  // Validate initial team exists once teams are loaded
  // Check for showRequests URL parameter and auto-open sheet
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('showRequests') === 'true') {
      setShowVacationRequests(true);
      // Clear the param from URL without navigation
      params.delete('showRequests');
      const newSearch = params.toString();
      const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [location.search]);

  // Handle favorite from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const favoriteId = params.get('favorite');
    
    if (favoriteId && favorites.length > 0 && teams.length > 0) {
      const favorite = favorites.find(f => f.id === favoriteId);
      if (favorite) {
        // Apply the favorite's team selection
        setSelectedTeams(favorite.team_ids);
        // Switch to team-availability view to show the filtered team(s)
        setViewMode('team-availability');
        
        toast({
          title: "Favorite Loaded",
          description: `Showing teams for "${favorite.name}"`,
        });
        
        // Clean up URL parameter
        params.delete('favorite');
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
        window.history.replaceState({}, '', newUrl);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, favorites, teams]);

  useEffect(() => {
    if (initialTeamId && initialTeamId !== '' && teams.length > 0) {
      const teamExists = teams.find(team => team.id === initialTeamId);
      if (!teamExists) {
        // If team doesn't exist, reset to "all"
        setSelectedTeams(["all"]);
        setViewMode("my-schedule");
      }
    }
  }, [initialTeamId, teams]);

  useEffect(() => {
    if (user) {
      console.log('✅ User authenticated, fetching roles...');
      fetchUserRoles();
      fetchUserTeams();
    } else {
      console.log('❌ No authenticated user');
      setLoading(false);
    }
  }, [user]);

  // Consolidated useEffect with debouncing to prevent redundant fetches
  useEffect(() => {
    if (!user || userRoles.length === 0) return;
    
    const timer = setTimeout(() => {
      fetchTeams();
      fetchEmployees();
      fetchScheduleEntries();
      fetchHolidays();
      fetchShiftTimeDefinitions();
      fetchDutyAssignments();
      fetchPendingRequestsCount();
      fetchPendingSwapRequestsCount();
      fetchPendingVacationRequestsForSchedule();
    }, 150); // Debounce 150ms
    
    return () => clearTimeout(timer);
  }, [user, currentWeek, userRoles, selectedTeams, viewMode, refreshTrigger, holidayRefetchTrigger]);

// Pre-populate managed users set for performance and deterministic rendering
useEffect(() => {
  const populateManagedUsersSet = async () => {
    if (!(isManager() && !isPlanner()) || !user) return;
    try {
      setManagedCacheLoading(true);
      console.log('🔄 Building managed users cache with hierarchical teams');
      
      // 1) Get all accessible teams (managed teams + sub-teams) using hierarchical function
      const { data: accessibleTeamIds, error: rpcError } = await supabase
        .rpc('get_manager_accessible_teams', { _manager_id: user.id });

      if (rpcError) {
        console.error('Error fetching accessible teams:', rpcError);
        setManagedUsersSet(new Set([user.id]));
        return;
      }

      const teamIds = accessibleTeamIds || [];
      console.log(`✅ Manager has access to ${teamIds.length} teams (including sub-teams)`);
      
      if (teamIds.length === 0) {
        setManagedUsersSet(new Set([user.id]));
        return;
      }

      // 2) Get all users in those teams
      const { data: teamUsers } = await supabase
        .from('team_members')
        .select('user_id')
        .in('team_id', teamIds)
        .limit(10000);

      const ids = new Set<string>((teamUsers || []).map(tu => tu.user_id));
      // Always include self
      ids.add(user.id);
      console.log(`✅ Managed users cache built: ${ids.size} users accessible`);
      setManagedUsersSet(ids);
    } catch (e) {
      console.error('Error populating managed users set:', e);
      // Fallback: at least include self
      setManagedUsersSet(new Set([user!.id]));
    } finally {
      setManagedCacheLoading(false);
    }
  };

  populateManagedUsersSet();
}, [user, userRoles, selectedTeams, viewMode]);

// Fetch pending vacation requests count for notification badge
const fetchPendingRequestsCount = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('vacation_requests')
      .select('id, request_group_id, status, user_id');

    // For managers/planners, fetch all pending requests
    if (isManager() || isPlanner()) {
      query = query.eq('status', 'pending');
    } else {
      // For regular users, fetch only their pending requests
      query = query.eq('user_id', user.id).eq('status', 'pending');
    }

    const { data: requests } = await query;
    
    if (requests) {
      // Group by request_group_id to count multi-day requests as one
      const groupIds = new Set<string>();
      let individualCount = 0;
      
      requests.forEach(request => {
        if (request.request_group_id) {
          groupIds.add(request.request_group_id);
        } else {
          individualCount++;
        }
      });
      
      const totalCount = groupIds.size + individualCount;
      setPendingRequestsCount(totalCount);
    } else {
      setPendingRequestsCount(0);
    }
  } catch (error) {
    console.error('Error fetching pending requests count:', error);
  }
};

// Fetch pending shift swap requests count for notification badge
const fetchPendingSwapRequestsCount = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // For managers/planners, count all pending swap requests
    if (isManager() || isPlanner()) {
      const { count } = await supabase
        .from('shift_swap_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      setPendingSwapRequestsCount(count || 0);
    } else {
      // For regular users, count their pending swap requests (as requester or target)
      const { data: requests } = await supabase
        .from('shift_swap_requests')
        .select('id')
        .eq('status', 'pending')
        .or(`requesting_user_id.eq.${user.id},target_user_id.eq.${user.id}`);
      
      setPendingSwapRequestsCount(requests?.length || 0);
    }
  } catch (error) {
    console.error('Error fetching pending swap requests count:', error);
  }
};

// Fetch pending vacation requests for schedule display (managers/planners only)
const fetchPendingVacationRequestsForSchedule = async () => {
  try {
    if (!user || (!isManager() && !isPlanner())) {
      setPendingVacationRequests([]);
      return;
    }

    const startDate = format(weekStart, 'yyyy-MM-dd');
    const endDate = format(weekEnd, 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('vacation_requests')
      .select('id, user_id, requested_date, is_full_day, start_time, end_time, notes')
      .eq('status', 'pending')
      .gte('requested_date', startDate)
      .lte('requested_date', endDate);

    if (error) {
      console.error('Error fetching pending vacation requests:', error);
      return;
    }

    setPendingVacationRequests(data || []);
  } catch (error) {
    console.error('Error fetching pending vacation requests:', error);
  }
};

// Get pending vacation requests for a specific employee and day
const getPendingVacationForEmployeeAndDay = (employeeId: string, date: Date) => {
  const dayStr = format(date, 'yyyy-MM-dd');
  return pendingVacationRequests.filter(
    req => req.user_id === employeeId && req.requested_date === dayStr
  );
};

// Subscribe to vacation request changes for real-time badge updates (all users)
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel('vacation-requests-badge')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'vacation_requests',
      },
      () => {
        fetchPendingRequestsCount();
        fetchPendingSwapRequestsCount();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user, userRoles]);

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
      console.log('🔍 Fetching teams with hierarchy information');
      
      // Fetch all teams first
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, parent_team_id')
        .limit(10000)
        .order('name');

      if (error) throw error;
      
      console.log(`✅ Fetched ${data?.length || 0} total teams`);
      const hierarchyLog = data?.filter(t => t.parent_team_id).map(t => ({
        team: t.name,
        parent: data.find(p => p.id === t.parent_team_id)?.name || 'Unknown'
      }));
      console.log('📊 Team hierarchy relationships:', hierarchyLog);
      
      // For managers, log accessible teams with hierarchy context
      if (isManager() && !isPlanner()) {
        const { data: accessibleTeamIds, error: rpcError } = await supabase
          .rpc('get_manager_accessible_teams', { _manager_id: user!.id });
        
        if (rpcError) {
          console.error('❌ Error fetching accessible teams:', rpcError);
        } else {
          console.log(`✅ Manager accessible teams (including sub-teams): ${accessibleTeamIds?.length || 0} teams`);
          
          // Log diagnostic information about access
          const accessibleTeams = data?.filter(t => accessibleTeamIds?.includes(t.id)) || [];
          console.log('🔓 HIERARCHICAL ACCESS DIAGNOSTIC:');
          accessibleTeams.forEach(team => {
            const parent = data?.find(p => p.id === team.parent_team_id);
            const children = data?.filter(t => t.parent_team_id === team.id);
            console.log(`  • ${team.name}`, {
              reason: team.parent_team_id 
                ? `Access granted via parent: ${parent?.name || 'Unknown'}` 
                : 'Direct team assignment',
              hasChildren: children.length > 0,
              childTeams: children.map(c => c.name)
            });
          });
        }
      }
      
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchUserTeams = async () => {
    try {
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
    } catch (error) {
      console.error("Error fetching user teams:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      console.log('=== fetchEmployees START ===');
      console.log('userRoles:', userRoles.map(r => r.role));
      console.log('isManager():', isManager());
      console.log('isPlanner():', isPlanner());
      console.log('selectedTeams:', selectedTeams);

      // For managers/planners, fetch employees via team_members (do NOT depend on schedule entries)
      if (isManager() || isPlanner()) {
        console.log('Manager/planner: fetching employees via team_members');

        let targetUserIds: string[] = [];

        const isAllTeams = selectedTeams.includes("all");
        
        if (!isAllTeams && selectedTeams.length > 0) {
          console.log('🎯 Selected specific teams:', selectedTeams);
          
          // Get members from all selected teams
          const { data: teamMembersRes, error: teamMembersError } = await supabase
            .from('team_members')
            .select('user_id')
            .in('team_id', selectedTeams)
            .limit(10000);

          if (teamMembersError) {
            console.error('Error fetching team members:', teamMembersError);
            setEmployees([]);
            return;
          }

          targetUserIds = [...new Set((teamMembersRes || []).map((tm: any) => tm.user_id))];
          console.log(`📊 Viewing ${selectedTeams.length} team(s) with ${targetUserIds.length} users`);
          console.log('Target user IDs for teams:', targetUserIds);
        } else {
          console.log('All teams view: fetching ALL team members across ALL accessible teams');
          
          // CRITICAL: For managers, use hierarchical team access (managed teams + sub-teams)
          // For planners, fetch all teams
          let teamIds: string[] = [];
          
          if (isPlanner()) {
            // Planners can see all teams
            const { data: allTeams, error: allTeamsError } = await supabase
              .from('teams')
              .select('id')
              .limit(10000);
            
            if (allTeamsError) {
              console.error('Error fetching teams:', allTeamsError);
              setEmployees([]);
              return;
            }
            
            teamIds = (allTeams || []).map(t => t.id);
            console.log(`📊 Planner viewing all teams: ${teamIds.length} teams`);
          } else if (isManager()) {
            // Managers can see teams they manage + all sub-teams
            const { data: accessibleTeamIds, error: rpcError } = await supabase
              .rpc('get_manager_accessible_teams', { _manager_id: user!.id });
            
            if (rpcError) {
              console.error('Error fetching manager accessible teams:', rpcError);
              setEmployees([]);
              return;
            }
            
            teamIds = accessibleTeamIds || [];
            console.log(`🔓 HIERARCHICAL ACCESS: Manager can view ${teamIds.length} teams (including sub-teams)`);
          }
          
          console.log('All team IDs for "All Teams" view:', teamIds);
          
          if (teamIds.length === 0) {
            console.log('No teams found');
            setEmployees([]);
            return;
          }
          
          // Get all members from all teams
          const { data: allMembers, error: allMembersError } = await supabase
            .from('team_members')
            .select('user_id')
            .in('team_id', teamIds)
            .limit(10000);

          if (allMembersError) {
            console.error('Error fetching all team members:', allMembersError);
            setEmployees([]);
            return;
          }

          targetUserIds = [...new Set((allMembers || []).map((tm: any) => tm.user_id))];
          console.log('All teams target user IDs count:', targetUserIds.length, 'unique users');
        }

        if (targetUserIds.length === 0) {
          console.log('No team members found for selection');
          setEmployees([]);
          return;
        }

        // Fetch profiles for those user IDs - use secure function for basic info
        const { data: profiles, error: profilesError } = await supabase
          .rpc('get_multiple_basic_profile_info', { _user_ids: targetUserIds });

        if (profilesError) {
          console.error('Error fetching profiles for team members:', profilesError);
          setEmployees([]);
          return;
        }

        // Also fetch location data (country_code, region_code) separately
        const { data: locationData } = await supabase
          .from('profiles')
          .select('user_id, country_code, region_code')
          .in('user_id', targetUserIds);

        // Create a map of user_id to location data
        const locationMap = new Map(
          (locationData || []).map(loc => [loc.user_id, { country_code: loc.country_code, region_code: loc.region_code }])
        );

        const transformedEmployees = (profiles || []).map((emp: any) => {
          const location = locationMap.get(emp.user_id);
          return {
            id: emp.user_id,
            user_id: emp.user_id,
            first_name: emp.first_name ?? '',
            last_name: emp.last_name ?? '',
            initials: emp.initials ?? (emp.last_name ? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}` : emp.first_name),
            displayName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim(),
            country_code: location?.country_code,
            region_code: location?.region_code
          };
        });

        console.log('Transformed employees (team_members based):', transformedEmployees.length);
        setEmployees(transformedEmployees);

      } else if (isTeamMember()) {
        console.log('User is regular team member');

        let targetUserIds: string[] = [];

        if (viewMode === "my-schedule") {
          console.log('Showing only current user');
          targetUserIds = [user!.id];
        } else {
          console.log('Showing team members from user teams');
          // Show users from the current user's team(s)
          const { data: userTeams, error: teamsError } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', user!.id);

          if (userTeams && userTeams.length > 0) {
            const teamIds = userTeams.map((ut: any) => ut.team_id);

            const { data: teamMembers, error: membersError } = await supabase
              .from('team_members')
              .select('user_id')
              .in('team_id', teamIds)
              .limit(10000);

            if (teamMembers && teamMembers.length > 0) {
              targetUserIds = teamMembers.map((tm: any) => tm.user_id);
            } else {
              targetUserIds = [user!.id];
            }
          } else {
            targetUserIds = [user!.id];
          }
        }

        // Fetch profiles for team members - use secure function
        const { data: profiles, error: profilesError } = await supabase
          .rpc('get_multiple_basic_profile_info', { _user_ids: targetUserIds });

        if (profilesError) {
          console.error('Error fetching team member profiles:', profilesError);
          setEmployees([]);
          return;
        }

        // Also fetch location data
        const { data: locationData } = await supabase
          .from('profiles')
          .select('user_id, country_code, region_code')
          .in('user_id', targetUserIds);

        const locationMap = new Map(
          (locationData || []).map(loc => [loc.user_id, { country_code: loc.country_code, region_code: loc.region_code }])
        );

        const transformedEmployees = (profiles || []).map((emp: any) => {
          const location = locationMap.get(emp.user_id);
          return {
            id: emp.user_id,
            user_id: emp.user_id,
            first_name: emp.first_name ?? '',
            last_name: emp.last_name ?? '',
            initials: emp.initials ?? (emp.last_name ? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}` : emp.first_name),
            displayName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim(),
            country_code: location?.country_code,
            region_code: location?.region_code
          };
        });

        setEmployees(transformedEmployees);
      } else {
        console.log('No specific role found, showing only current user');
        
        // Fetch current user's profile - use secure function
        const { data: profiles, error: profilesError } = await supabase
          .rpc('get_basic_profile_info', { _user_id: user!.id });

        if (profilesError) {
          console.error('Error fetching user profile:', profilesError);
          setEmployees([]);
          return;
        }

        // Convert single user result to array for consistency
        const profilesArray = Array.isArray(profiles) ? profiles : [profiles];
        
        const transformedEmployees = profilesArray.map((emp: any) => ({
          id: emp.user_id,
          user_id: emp.user_id,
          first_name: emp.first_name ?? '',
          last_name: emp.last_name ?? '',
          initials: emp.initials ?? (emp.last_name ? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}` : emp.first_name),
          displayName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
        }));

        setEmployees(transformedEmployees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchShiftTimeDefinitions = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_time_definitions')
        .select('*');
      
      if (error) {
        console.error('Error fetching shift time definitions:', error);
      } else {
        setShiftTimeDefinitions(data || []);
      }
    } catch (error) {
      console.error('Error fetching shift time definitions:', error);
    }
  };

  const getShiftTimesFromDefinition = (entry: ScheduleEntry, employee?: Employee): { startTime: string; endTime: string } | null => {
    // Priority 1: Use shift_time_definition_id if available
    if (entry.shift_time_definition_id) {
      const def = shiftTimeDefinitions.find(d => d.id === entry.shift_time_definition_id);
      if (def) {
        return {
          startTime: def.start_time.substring(0, 5),
          endTime: def.end_time.substring(0, 5)
        };
      }
    }
    
    // Priority 2: Look up by team/country/day (smart lookup)
    if (entry.shift_type && entry.team_id) {
      const date = new Date(entry.date);
      const dayOfWeek = date.getDay();
      
      const applicableDef = shiftTimeDefinitions.find(def => {
        // Match shift type
        if (def.shift_type !== entry.shift_type) return false;
        
        // Match team
        const teamMatch = (def.team_ids?.includes(entry.team_id)) || (def.team_id === entry.team_id);
        if (!teamMatch) return false;
        
        // Match country (if employee provided)
        const countryMatch = employee?.country_code && 
          def.country_codes?.includes(employee.country_code);
        
        // Match day of week
        const dayMatch = def.day_of_week?.includes(dayOfWeek);
        
        // Priority matching: team+country+day > team+country > team+day > team
        if (countryMatch && dayMatch) return true;
        if (countryMatch && (!def.day_of_week || def.day_of_week.length === 0)) return true;
        if (dayMatch) return true;
        if (!def.day_of_week || def.day_of_week.length === 0) return true;
        
        return false;
      });
      
      if (applicableDef) {
        return {
          startTime: applicableDef.start_time.substring(0, 5),
          endTime: applicableDef.end_time.substring(0, 5)
        };
      }
    }
    
    return null;
  };

  const getShiftDescription = (entry: ScheduleEntry, employeeData?: Employee): string => {
    if (entry.activity_type !== 'work') return '';
    
    // Priority 0: Use stored shift_time_definition_id if available (most reliable)
    if (entry.shift_time_definition_id) {
      const storedDef = shiftTimeDefinitions.find(d => d.id === entry.shift_time_definition_id);
      if (storedDef?.description) {
        return storedDef.description;
      }
    }
    
    // Second, check if shift name is stored in notes (from bulk generator)
    if (entry.notes) {
      // NEW FORMAT: "Shift: {name}"
      const newFormatMatch = entry.notes.match(/Shift:\s*(.+?)(?:\n|$)/);
      if (newFormatMatch && newFormatMatch[1]) {
        // Remove times in parentheses at the end if present, since they're shown separately
        return newFormatMatch[1].trim().replace(/\s*\(\d{2}:\d{2}-\d{2}:\d{2}\)\s*$/, '');
      }
      
      // OLD FORMAT: "Auto-generated {name} shift" or "Auto-generated {name}"
      const oldFormatMatch = entry.notes.match(/Auto-generated\s+(.+?)(?:\s+shift|\s+\(|\n|$)/);
      if (oldFormatMatch && oldFormatMatch[1]) {
        // Extract the full name including times in parentheses if present
        const fullNameMatch = entry.notes.match(/Auto-generated\s+(.+?)(?:\n|$)/);
        if (fullNameMatch && fullNameMatch[1]) {
          // Remove times in parentheses at the end if present, since they're shown separately
          return fullNameMatch[1].trim().replace(/\s*\(\d{2}:\d{2}-\d{2}:\d{2}\)\s*$/, '');
        }
      }
    }
    
    // Find applicable shift time definition using country_code (not region_code)
    const teamId = entry.team_id;
    const countryCode = employeeData?.country_code;
    const date = new Date(entry.date);
    const dayOfWeek = date.getDay(); // Use JavaScript format (0=Sunday, 1=Monday, etc.) - matches database storage
    
    // Priority matching using country_code
    const applicableDef = shiftTimeDefinitions.find(def => {
      if (def.shift_type !== entry.shift_type) return false;
      
      // Check team match (team_ids array or old team_id)
      const teamMatch = (def.team_ids && def.team_ids.includes(teamId)) || 
                        (def.team_id === teamId);
      const noTeam = !def.team_ids && !def.team_id;
      
      // Check country match (using country_codes array)
      const hasCountryCodes = def.country_codes && Array.isArray(def.country_codes) && def.country_codes.length > 0;
      const countryMatch = hasCountryCodes && countryCode && def.country_codes!.includes(countryCode);
      const noCountry = !hasCountryCodes;
      
      // Check day match
      const dayMatch = def.day_of_week && Array.isArray(def.day_of_week) && 
                      def.day_of_week.includes(dayOfWeek);
      const noDay = !def.day_of_week || (Array.isArray(def.day_of_week) && def.day_of_week.length === 0);
      
      // Priority 1: Team + country + day
      if (teamMatch && countryMatch && dayMatch) return true;
      // Priority 2: Team + country (no day)
      if (teamMatch && countryMatch && noDay) return true;
      // Priority 3: Team only + day (but only if no country specified OR country matches)
      if (teamMatch && (noCountry || countryMatch) && dayMatch) return true;
      // Priority 4: Team only (no country, no day)
      if (teamMatch && noCountry && noDay) return true;
      // Priority 5: Country only (no team, no day)
      if (noTeam && countryMatch && noDay) return true;
      // Priority 6: Global (no team, no country, no day)
      if (noTeam && noCountry && noDay) return true;
      
      return false;
    });
    
    return applicableDef?.description || '';
  };

  const fetchDutyAssignments = async () => {
    try {
      const weekEnd = addDays(weekStart, 6);
      const dateStart = format(weekStart, "yyyy-MM-dd");
      const dateEnd = format(weekEnd, "yyyy-MM-dd");
      
      let teamIds: string[] = [];
      const isAllTeams = selectedTeams.includes("all");
      
      if (isAllTeams) {
        if (isPlanner()) {
          const { data: allTeams } = await supabase
            .from('teams')
            .select('id')
            .limit(10000);
          teamIds = allTeams?.map(t => t.id) || [];
        } else if (isManager()) {
          const { data: accessibleTeamIds } = await supabase
            .rpc('get_manager_accessible_teams', { _manager_id: user!.id });
          teamIds = accessibleTeamIds || [];
        }
      } else if (selectedTeams.length > 0) {
        teamIds = selectedTeams;
      }
      
      if (teamIds.length === 0) {
        setDutyAssignments([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('duty_assignments')
        .select('*')
        .eq('duty_type', 'hotline')
        .gte('date', dateStart)
        .lte('date', dateEnd)
        .in('team_id', teamIds);
      
      if (!error && data) {
        setDutyAssignments(data);
      } else {
        setDutyAssignments([]);
      }
    } catch (error) {
      console.error('Error fetching duty assignments:', error);
      setDutyAssignments([]);
    }
  };

  const fetchScheduleEntries = async (silent: boolean = false) => {
    try {
      console.log('🚀 fetchScheduleEntries START');
      if (!silent) {
        setLoading(true);
      }
      const weekEnd = addDays(weekStart, 6);
      const dateStart = format(weekStart, "yyyy-MM-dd");
      const dateEnd = format(weekEnd, "yyyy-MM-dd");
      console.log(`📅 Date range: ${dateStart} to ${dateEnd}`);

      // For "All Teams", fetch in batches to avoid .in() limitations and RLS issues
      let allData: any[] = [];

      const isAllTeams = selectedTeams.includes("all");
      
      if ((isManager() || isPlanner()) && isAllTeams) {
        // Get team IDs based on role: planners see all, managers see managed + sub-teams
        let teamIds: string[] = [];
        
        if (isPlanner()) {
          const { data: allTeams } = await supabase
            .from('teams')
            .select('id')
            .limit(10000);
          
          teamIds = allTeams?.map(t => t.id) || [];
          console.log(`📊 Planner All Teams fetch: ${teamIds.length} teams total`);
        } else if (isManager()) {
          console.log('🔍 Calling get_manager_accessible_teams RPC...');
          const { data: accessibleTeamIds, error: rpcError } = await supabase
            .rpc('get_manager_accessible_teams', { _manager_id: user!.id });
          
          if (rpcError) {
            console.error('❌ Error fetching manager accessible teams:', rpcError);
            toast({
              title: "Error Loading Teams",
              description: `Failed to fetch accessible teams: ${rpcError.message}`,
              variant: "destructive",
            });
            teamIds = [];
          } else {
            console.log('✅ get_manager_accessible_teams returned successfully');
            teamIds = accessibleTeamIds || [];
            console.log(`📊 Manager All Teams fetch (including sub-teams): ${teamIds.length} teams`);
            console.log('Accessible team IDs:', teamIds);
          }
        }
        
        console.log(`📅 Fetching schedules for date range: ${dateStart} to ${dateEnd}`);

        // Batch fetch by team with optimized batch size
        const BATCH_SIZE = 50; // Optimized for performance
        let batchNumber = 0;
        
        for (let i = 0; i < teamIds.length; i += BATCH_SIZE) {
          batchNumber++;
          const batchTeamIds = teamIds.slice(i, i + BATCH_SIZE);
          
          const { data: batchData, error: batchError } = await supabase
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
              shift_time_definition_id,
              created_by,
              created_at,
              updated_at
            `)
            .gte("date", dateStart)
            .lte("date", dateEnd)
            .in("team_id", batchTeamIds)
            .order("date")
            .limit(5000);
          
          if (batchError) {
            console.error('Batch error:', batchError);
            throw batchError;
          }
          
          // Log batch details
          const batchEntriesPerDate = (batchData || []).reduce((acc, e) => {
            const dateKey = typeof e.date === 'string' ? e.date.split('T')[0] : e.date;
            acc[dateKey] = (acc[dateKey] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          console.log(`📦 Batch ${batchNumber}/${Math.ceil(teamIds.length / BATCH_SIZE)}:`, {
            teamsInBatch: batchTeamIds.length,
            entriesInBatch: batchData?.length || 0,
            entriesPerDate: batchEntriesPerDate,
            accumulatedTotal: allData.length + (batchData?.length || 0)
          });
          
          // Direct push for better performance
          if (batchData) allData.push(...batchData);
        }
        
        // Log final accumulated data before transformation
        const finalEntriesPerDate = allData.reduce((acc, e) => {
          const dateKey = typeof e.date === 'string' ? e.date.split('T')[0] : e.date;
          acc[dateKey] = (acc[dateKey] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log('🎯 All batches merged:', {
          totalEntries: allData.length,
          entriesPerDate: finalEntriesPerDate
        });
        
      } else {
        // Single team, multiple specific teams, or specific view mode
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
            shift_time_definition_id,
            created_by,
            created_at,
            updated_at
          `)
          .gte("date", dateStart)
          .lte("date", dateEnd)
          .order("date");

        // Handle multiple specific teams selection
        if (!isAllTeams && selectedTeams.length > 0) {
          query = query.in("team_id", selectedTeams);
        } else if (isTeamMember()) {
          if (viewMode === "my-schedule") {
            query = query.eq("user_id", user!.id);
          } else if (viewMode === "my-team") {
            const { data: userTeams } = await supabase
              .from('team_members')
              .select('team_id')
              .eq('user_id', user!.id);
            
            if (userTeams && userTeams.length > 0) {
              const teamIds = userTeams.map(ut => ut.team_id);
              query = query.in("team_id", teamIds);
            }
          }
        } else {
          query = query.eq("user_id", user!.id);
        }

        const { data, error } = await query;
        
        if (error) {
          console.error('Query error:', error);
          throw error;
        }
        
        allData = data || [];
      }

      const data = allData;
      const error = null;

      // Fetch user profiles for the entries (assignees AND creators)
      const userIds = [...new Set(data?.map(entry => entry.user_id) || [])];
      const creatorIds = [...new Set(data?.map(entry => entry.created_by).filter(Boolean) || [])];
      const allUserIds = [...new Set([...userIds, ...creatorIds])];
      const teamIds = [...new Set(data?.map(entry => entry.team_id) || [])];
      
      console.log('🔍 Fetching profiles and teams for entries...');
      const [profilesResult, teamsResult] = await Promise.all([
        supabase.rpc('get_multiple_basic_profile_info', { _user_ids: allUserIds }),
        supabase.from('teams').select('id, name').in('id', teamIds)
      ]);
      
      if (profilesResult.error) {
        console.error('❌ Error fetching profiles:', profilesResult.error);
        throw profilesResult.error;
      }
      if (teamsResult.error) {
        console.error('❌ Error fetching teams:', teamsResult.error);
        throw teamsResult.error;
      }
      console.log('✅ Profiles and teams fetched successfully');
      
      const profilesMap = new Map((profilesResult.data || []).map(p => [p.user_id, p]));
      const teamsMap = new Map((teamsResult.data || []).map(t => [t.id, t]));
      
        const transformedData = data?.map(item => {
          const profile = profilesMap.get(item.user_id) || { first_name: 'Unknown', last_name: 'User' };
          const creatorProfile = profilesMap.get(item.created_by);
          const team = teamsMap.get(item.team_id) || { name: 'Unknown Team' };
          
          return {
            ...item,
            profiles: profile,
            teams: team,
            created_by: item.created_by,
            creator_name: creatorProfile?.first_name || item.created_by || 'Unknown'
          };
        }) || [];
      
      console.log('✅ Final merged dataset:', {
        totalEntries: transformedData.length,
        uniqueUsers: userIds.length,
        dates: [...new Set(transformedData.map(e => e.date))].sort(),
        entriesPerDate: transformedData.reduce((acc, e) => {
          const dateKey = typeof e.date === 'string' ? e.date.split('T')[0] : e.date;
          acc[dateKey] = (acc[dateKey] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        sampleEntries: transformedData.slice(0, 3).map(e => ({
          userId: e.user_id.substring(0, 8),
          date: e.date,
          dateType: typeof e.date
        }))
      });
      
      setScheduleEntries(transformedData);

      // CRITICAL FIX: Ensure the employee list includes ALL users who have schedule entries
      // This is especially important for "All Teams" view where entries may exist for users
      // not initially loaded in the employee list
      try {
        // Get current employees to check for missing ones
        const currentEmployees = employees || [];
        const existingEmployeeIds = new Set(currentEmployees.map(e => e.user_id));
        const missingUserIds = userIds.filter(id => !existingEmployeeIds.has(id));
        
        if (missingUserIds.length > 0) {
          // Fetch profiles for missing users
          const { data: missingProfiles } = await supabase
            .rpc('get_multiple_basic_profile_info', { _user_ids: missingUserIds });

          const fetchedEmployees = (missingProfiles || []).map((emp: any) => ({
            id: emp.user_id,
            user_id: emp.user_id,
            first_name: emp.first_name ?? '',
            last_name: emp.last_name ?? '',
            initials: emp.initials ?? (emp.last_name ? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}` : emp.first_name),
            displayName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
          }));

          const returnedIds = new Set(fetchedEmployees.map(e => e.user_id));
          const placeholderEmployees = missingUserIds
            .filter(id => !returnedIds.has(id))
            .map(id => ({
              id,
              user_id: id,
              first_name: 'User',
              last_name: '',
              initials: 'U',
              displayName: 'User'
            }));

          const allNewEmployees = [...fetchedEmployees, ...placeholderEmployees];
          
          // Merge with existing employees using functional update to avoid race conditions
          setEmployees(prevEmployees => {
            const mergedMap = new Map(prevEmployees.map(e => [e.user_id, e]));
            allNewEmployees.forEach(e => {
              if (!mergedMap.has(e.user_id)) {
                mergedMap.set(e.user_id, e);
              }
            });
            return Array.from(mergedMap.values());
          });
        }
      } catch (mergeErr) {
        console.error('Error merging employees with schedule users:', mergeErr);
      }
    } catch (error) {
      console.error("Error fetching schedule entries:", error);
      toast({
        title: "Error",
        description: "Failed to load schedule entries",
        variant: "destructive",
      });
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const getEntriesForDay = (date: Date) => {
    return scheduleEntries.filter(entry => 
      isSameDay(new Date(entry.date), date)
    );
  };

  const fetchHolidays = async () => {
    try {
      const weekEnd = addDays(weekStart, 4); // Friday
      
      // Get all unique countries and regions from employees in current view
      const employeeIds = employees.map(e => e.id);
      
      if (employeeIds.length === 0) {
        console.log('No employees to fetch holidays for');
        setHolidays([]);
        return;
      }

      // Fetch profiles for all employees to get their countries and regions
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, country_code, region_code')
        .in('user_id', employeeIds);

      if (profileError) {
        console.error('Error fetching employee profiles:', profileError);
        setHolidays([]);
        return;
      }

      if (!profiles || profiles.length === 0) {
        console.log('No profiles found for employees');
        setHolidays([]);
        return;
      }

      // Get unique country-region combinations
      const locationSet = new Set(profiles.map(p => `${p.country_code}|${p.region_code || ''}`));
      console.log(`🔍 Fetching holidays for ${locationSet.size} unique location(s):`, Array.from(locationSet));

      // Fetch holidays for all country-region combinations
      const allHolidays: any[] = [];
      
      for (const location of locationSet) {
        const [country_code, region_code] = location.split('|');
        
        if (!country_code) continue;

        // Fetch all holidays for this country (centrally managed)
        const { data: countryHolidays, error } = await supabase
          .from('holidays')
          .select('*')
          .eq('country_code', country_code)
          .is('user_id', null) // Only centrally managed holidays
          .gte('date', format(weekStart, "yyyy-MM-dd"))
          .lte('date', format(weekEnd, "yyyy-MM-dd"))
          .eq('is_public', true);

        if (error) {
          console.error(`Error fetching holidays for ${country_code}:`, error);
          continue;
        }

        // Filter holidays based on region
        let applicableHolidays = countryHolidays || [];
        if (country_code === 'DE' && region_code) {
          // For Germany with region: prefer regional holidays, fallback to national
          const regionalHolidays = applicableHolidays.filter(h => h.region_code === region_code);
          const nationalHolidays = applicableHolidays.filter(h => !h.region_code);
          
          // For each date, prefer regional version over national if both exist
          const holidaysByDate = new Map();
          [...regionalHolidays, ...nationalHolidays].forEach(h => {
            const dateKey = h.date;
            if (!holidaysByDate.has(dateKey)) {
              holidaysByDate.set(dateKey, h);
            }
          });
          
          applicableHolidays = Array.from(holidaysByDate.values());
        } else {
          // For other countries or no region: only national holidays
          applicableHolidays = applicableHolidays.filter(h => !h.region_code);
        }

        console.log(`📅 ${country_code}${region_code ? '-'+region_code : ''}: ${applicableHolidays.length} holidays`);
        allHolidays.push(...applicableHolidays);
      }

      // Remove duplicates by holiday id
      const uniqueHolidays = Array.from(
        new Map(allHolidays.map(h => [h.id, h])).values()
      );
      
      console.log(`✅ Total unique holidays fetched: ${uniqueHolidays.length}`);
      setHolidays(uniqueHolidays);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const getEntriesForEmployeeAndDay = (employeeId: string, date: Date) => {
    // Use date-fns format to ensure consistent YYYY-MM-DD string regardless of timezone
    const normalizedDateStr = format(date, "yyyy-MM-dd");
    
    // Filter entries by matching normalized date strings
    const matchingEntries = scheduleEntries.filter(entry => {
      // Normalize entry date (from DB it's already YYYY-MM-DD string)
      const entryDateStr = typeof entry.date === 'string' 
        ? entry.date.split('T')[0] // Handle potential ISO timestamp, take date part only
        : format(new Date(entry.date), "yyyy-MM-dd");
      
      return entry.user_id === employeeId && entryDateStr === normalizedDateStr;
    });
    
    return matchingEntries;
  };

  const getContinuationEntriesForDay = (employeeId: string, date: Date) => {
    // Check previous day for shifts that continue into this day
    const previousDay = subDays(date, 1);
    const previousDayStr = format(previousDay, "yyyy-MM-dd");
    
    const continuationEntries = scheduleEntries.filter(entry => {
      const entryDateStr = typeof entry.date === 'string' 
        ? entry.date.split('T')[0]
        : format(new Date(entry.date), "yyyy-MM-dd");
      
      if (entry.user_id !== employeeId || entryDateStr !== previousDayStr) {
        return false;
      }
      
      // Extract times and check if shift crosses midnight
      const times = getShiftTimesFromEntry(entry);
      return doesShiftCrossMidnight(times.start, times.end);
    });
    
    return continuationEntries;
  };

  const getShiftTimesFromEntry = (entry: ScheduleEntry) => {
    // Try to extract from JSON format first
    if (entry.notes) {
      const timeSplitPattern = /Times:\s*(.+)/;
      const match = entry.notes.match(timeSplitPattern);
      
      if (match) {
        try {
          const timesData = JSON.parse(match[1]);
          if (Array.isArray(timesData) && timesData.length > 0) {
            return { start: timesData[0].start_time, end: timesData[0].end_time };
          }
        } catch (e) {
          // Continue to old format
        }
      }
      
      // Try old format
      const oldTimePattern = /\((\d{2}:\d{2})-(\d{2}:\d{2})\)/;
      const oldMatch = entry.notes.match(oldTimePattern);
      if (oldMatch) {
        return { start: oldMatch[1], end: oldMatch[2] };
      }
    }
    
    // Default times
    switch (entry.shift_type) {
      case 'early':
        return { start: '06:00', end: '14:30' };
      case 'late':
        return { start: '10:00', end: '18:00' };
      default:
        return { start: '08:00', end: '16:30' };
    }
  };

  const isPlanner = () => userRoles.some(role => role.role === "planner");
  const isManager = () => userRoles.some(role => role.role === "manager");
  const isAdmin = () => userRoles.some(role => role.role === "admin");
  const isTeamMember = () => userRoles.some(role => role.role === "teammember");
  
  // Shift counts for managers (last 6 months) - must be after isManager/isPlanner definitions
  const { shiftCounts } = useShiftCounts({
    userIds: employees.map(e => e.user_id),
    startDate: dateFnsSubMonths(new Date(), 6).toISOString().split('T')[0],
    enabled: (isManager() || isPlanner()) && employees.length > 0 && timeView === "weekly",
  });

// Helper: simplified display for non-managed users (only show Available/Unavailable)
const getSimplifiedDisplay = (userId: string, day: Date) => {
  const dayStr = format(day, 'yyyy-MM-dd');
  const hasAnyEntry = scheduleEntries.some(
    entry => entry.user_id === userId && entry.date === dayStr
  );
  
  return hasAnyEntry
    ? { status: 'Available', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' }
    : { status: 'Unavailable', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' };
};

  // Render employee name - show full name if available, otherwise nothing (initials are in the avatar)
  const renderEmployeeName = (employee: Employee) => {
    // If last_name exists and is not empty, show full name
    // If last_name is empty, first_name contains initials (already shown in avatar), so don't duplicate
    if (employee.last_name && employee.last_name.trim() !== '') {
      return (
        <p className="font-medium">{formatUserName(employee.first_name, employee.last_name, employee.initials)}</p>
      );
    }
    // For initials-only users, don't show anything (initials are already in the avatar bubble)
    return null;
  };

const getActivityDisplay = (entry: ScheduleEntry) => {
  // Team members only see availability status
  if (isTeamMember() && !isManager() && !isPlanner()) {
    return getAvailabilityStatus(entry.activity_type);
  }
  
  // For managers in standard view, check if they directly manage this user
  if (isManager() && !isPlanner()) {
    const canView = canViewActivityDetails(entry.user_id);
    if (!canView) {
      // Manager doesn't directly manage this user - show availability only
      return getAvailabilityStatus(entry.activity_type);
    } else {
      // Manager directly manages this user - show full details
      return getActivityDisplayName(entry.activity_type);
    }
  }
  
  // Planners and admins see full details
  return getActivityDisplayName(entry.activity_type);
};

const getAvailabilityStatus = (activityType: string) => {
  // work, hotline_support = Available (as per user requirements)
  // all others = Not Available  
  const availableTypes = ['work', 'hotline_support'];
  return availableTypes.includes(activityType) ? "Available" : "Not Available";
};

  const getHolidaysForEmployeeAndDay = (employeeId: string, date: Date) => {
    // Get the employee's profile to know their country and region
    const employee = employees.find(e => e.id === employeeId);
    if (!employee || !employee.country_code) return [];

    // Filter holidays for this specific date
    const dayHolidays = holidays.filter(holiday => 
      isSameDay(new Date(holiday.date), date)
    );

    // Filter holidays by employee's country and region
    let applicableHolidays = dayHolidays.filter(holiday => {
      // Must match country
      if (holiday.country_code !== employee.country_code) return false;

      // Check region filtering
      if (employee.country_code === 'DE' && employee.region_code) {
        // For Germany with region: show national holidays (no region) or holidays for employee's specific region
        return !holiday.region_code || holiday.region_code === employee.region_code;
      } else {
        // For other countries or no region: only show national holidays
        return !holiday.region_code;
      }
    });

    // For German users with regions: if both national and regional version exist for same date/name, keep only regional
    if (employee.country_code === 'DE' && employee.region_code) {
      const holidayMap = new Map();
      applicableHolidays.forEach(h => {
        const key = `${h.name}_${h.date}`;
        const existing = holidayMap.get(key);
        // Prefer regional over national (regional has region_code, national doesn't)
        if (!existing || (!existing.region_code && h.region_code)) {
          holidayMap.set(key, h);
        }
      });
      applicableHolidays = Array.from(holidayMap.values());
    }

    return applicableHolidays;
  };

  const getHolidaysForDay = (date: Date) => {
    return holidays.filter(holiday => 
      isSameDay(new Date(holiday.date), date)
    );
  };

const getActivityColor = (entry: ScheduleEntry) => {
  // Team members see availability colors only
  if (isTeamMember() && !isManager() && !isPlanner()) {
    const availableTypes = ['work', 'hotline_support'];
    return availableTypes.includes(entry.activity_type)
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
  }

  // For managers in standard view, check if they can view full details
  if (isManager() && !isPlanner()) {
    const canViewFull = canViewActivityDetails(entry.user_id);
    if (!canViewFull) {
      // Show availability colors only (work and hotline_support = available)
      const availableTypes = ['work', 'hotline_support'];
      return availableTypes.includes(entry.activity_type)
        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    }
  }

    // Full activity type colors for managers (with full access) and planners
    switch (entry.activity_type) {
      case "work":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "vacation":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "other":
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
      case "other": return "Other";
      case "hotline_support": return "Hotline Support";
      case "out_of_office": return "Out of Office";
      case "training": return "Training";
      case "flextime": return "Flextime";
      case "working_from_home": return "Working from Home";
      default: return activityType;
    }
  };

  const navigateWeek = (direction: "prev" | "next") => {
    if (timeView === "monthly") {
      setCurrentMonth(prev => direction === "next" ? addMonths(prev, 1) : subMonths(prev, 1));
    } else {
      setCurrentWeek(prev => direction === "next" ? addWeeks(prev, 1) : subWeeks(prev, 1));
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentWeek(prev => {
      const newMonth = direction === "next" ? addMonths(prev, 1) : subMonths(prev, 1);
      return startOfWeek(newMonth, { weekStartsOn: 1 });
    });
  };

  const goToMonth = (monthOffset: number) => {
    const now = new Date();
    const targetMonth = addMonths(now, monthOffset);
    const firstOfMonth = startOfMonth(targetMonth);
    setCurrentWeek(startOfWeek(firstOfMonth, { weekStartsOn: 1 }));
    
    // Update the selected month value for the dropdown
    if (monthOffset === 0) setSelectedMonthValue("current");
    else if (monthOffset === 1) setSelectedMonthValue("next");
    else if (monthOffset === 2) setSelectedMonthValue("next2");
    else if (monthOffset === 3) setSelectedMonthValue("next3");
    else if (monthOffset === 4) setSelectedMonthValue("next4");
    else if (monthOffset === 5) setSelectedMonthValue("next5");
    else if (monthOffset === 6) setSelectedMonthValue("next6");
    else if (monthOffset === 7) setSelectedMonthValue("next7");
    else if (monthOffset === 8) setSelectedMonthValue("next8");
    else if (monthOffset === 9) setSelectedMonthValue("next9");
    else if (monthOffset === 10) setSelectedMonthValue("next10");
    else if (monthOffset === 11) setSelectedMonthValue("next11");
    else if (monthOffset === -1) setSelectedMonthValue("prev");
    else if (monthOffset === -2) setSelectedMonthValue("prev2");
  };

  const toggleMultiSelectMode = () => {
    setMultiSelectMode(!multiSelectMode);
    setSelectedShiftIds([]); // Clear selections when toggling mode
  };

  const toggleShiftSelection = (shiftId: string) => {
    setSelectedShiftIds(prev => 
      prev.includes(shiftId) 
        ? prev.filter(id => id !== shiftId)
        : [...prev, shiftId]
    );
  };

  const handleBulkEdit = () => {
    if (selectedShiftIds.length === 0) {
      toast({
        title: 'No Shifts Selected',
        description: 'Please select at least one shift to edit.',
        variant: 'destructive',
      });
      return;
    }
    setShowBulkEditModal(true);
  };

  const handleBulkEditSuccess = () => {
    setSelectedShiftIds([]);
    setMultiSelectMode(false);
    fetchScheduleEntries();
  };

  const isCacheReady = !(isManager() && !isPlanner()) || !managedCacheLoading;

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground">Please sign in to view the schedule</p>
        </div>
      </div>
    );
  }

  if (loading || !isCacheReady) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{loading ? 'Loading schedule...' : 'Preparing schedule view...'}</h2>
          <p className="text-muted-foreground">Please wait</p>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-view-container space-y-6">
      {/* Availability-Only Mode Warning */}
      {!userRoles.some(r => r.role === 'admin') && 
       !userRoles.some(r => r.role === 'planner') && 
       userRoles.some(r => r.role === 'manager') && 
       selectedTeams.length > 0 && 
       !selectedTeams.includes("all") &&
       managedUsersSet.size === 0 && (
        <Alert className="border-muted-foreground/20">
          <AlertDescription>
            You are viewing availability only for this team. Full schedule details are restricted to your managed teams.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {timeView === "monthly" ? "Monthly Schedule" : "Weekly Schedule"}
          </h2>
          <p className="text-muted-foreground">
            {timeView === "monthly" 
              ? format(currentMonth, "MMMM yyyy")
              : `${format(weekStart, "MMM d")} - ${format(addDays(weekStart, 6), "MMM d, yyyy")} (Full Week)`
            }
          </p>
          {userTeams.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Your teams: {userTeams.map(team => team.name).join(", ")}
            </p>
          )}
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          {/* Vacation Request Button - Primary Action */}
          <Button
            onClick={() => setVacationModalOpen(true)}
            size="default"
            className="gap-2 shadow-sm"
          >
            <Calendar className="h-4 w-4" />
            Request Time Off
          </Button>

          {/* Vacation Requests Toggle - For all authenticated users */}
          <Button
            onClick={() => setShowVacationRequests(true)}
            variant={(pendingRequestsCount + pendingSwapRequestsCount) > 0 ? "destructive" : "outline"}
            size="default"
            className="gap-2 relative"
          >
            <FileText className="h-4 w-4" />
            {(isManager() || isPlanner()) ? 'Show Requests' : 'My Requests'}
            {(pendingRequestsCount + pendingSwapRequestsCount) > 0 && (
              <Badge 
                variant="secondary" 
                className="ml-2 bg-white text-destructive font-bold px-2"
              >
                {pendingRequestsCount + pendingSwapRequestsCount}
              </Badge>
            )}
          </Button>

          {/* Multi-Select Mode Toggle - For Managers/Planners */}
          {(isManager() || isPlanner()) && timeView === "weekly" && (
            <Button
              onClick={toggleMultiSelectMode}
              variant={multiSelectMode ? "default" : "outline"}
              size="default"
              className="gap-2"
            >
              {multiSelectMode ? "Cancel Selection" : "Edit Multiple"}
            </Button>
          )}

          {/* Bulk Edit Button - Only shown when shifts are selected */}
          {multiSelectMode && selectedShiftIds.length > 0 && (
            <Button
              onClick={handleBulkEdit}
              size="default"
              className="gap-2"
            >
              Edit {selectedShiftIds.length} Shift{selectedShiftIds.length !== 1 ? 's' : ''}
            </Button>
          )}

          <div className="flex-1" />

          {/* View Mode Filter - For team members */}
          {isTeamMember() && !isManager() && !isPlanner() && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">View:</label>
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-56 bg-background">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="my-schedule">My Schedule</SelectItem>
                  <SelectItem value="team-availability">Team Availability</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Team Filter - Only show for planners and managers */}
          {(isManager() || isPlanner()) && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">Team:</label>
              <Popover open={teamDropdownOpen} onOpenChange={setTeamDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={teamDropdownOpen}
                    className="w-56 justify-between shadow-sm"
                  >
                    <span className="truncate">
                      {selectedTeams.includes("all")
                        ? "All Teams"
                        : selectedTeams.length === 1
                        ? teams.find((team) => team.id === selectedTeams[0])?.name || "Select team..."
                        : `${selectedTeams.length} Teams Selected`
                      }
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-background border z-50" align="end">
                  <Command>
                    <CommandInput placeholder="Search teams..." className="h-10" />
                    <CommandEmpty>No team found.</CommandEmpty>
                    <CommandGroup className="max-h-[400px] overflow-y-auto">
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedTeams(["all"]);
                          setTeamDropdownOpen(false);
                        }}
                        className="py-3"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTeams.includes("all") ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-medium">All Teams</span>
                      </CommandItem>
                      
                      {/* Hierarchical team list */}
                      {teams
                        .filter(team => !team.parent_team_id)
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((topLevelTeam) => {
                          const midLevelTeams = teams.filter(t => t.parent_team_id === topLevelTeam.id);
                          
                          return (
                            <React.Fragment key={topLevelTeam.id}>
                              <CommandItem
                                value={topLevelTeam.name}
                                onSelect={() => {
                                  setSelectedTeams([topLevelTeam.id]);
                                  setTeamDropdownOpen(false);
                                }}
                                className="py-3 font-semibold text-primary"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedTeams.includes(topLevelTeam.id) ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-red-500" />
                                  {topLevelTeam.name}
                                </div>
                              </CommandItem>
                              
                              {/* Mid-level teams */}
                              {midLevelTeams.sort((a, b) => a.name.localeCompare(b.name)).map((midTeam) => {
                                const lowerLevelTeams = teams.filter(t => t.parent_team_id === midTeam.id);
                                
                                return (
                                  <React.Fragment key={midTeam.id}>
                                    <CommandItem
                                      value={midTeam.name}
                                      onSelect={() => {
                                        setSelectedTeams([midTeam.id]);
                                        setTeamDropdownOpen(false);
                                      }}
                                      className="py-3 pl-8 font-medium"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedTeams.includes(midTeam.id) ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                        {midTeam.name}
                                      </div>
                                    </CommandItem>
                                    
                                    {/* Lower-level teams */}
                                    {lowerLevelTeams.sort((a, b) => a.name.localeCompare(b.name)).map((lowerTeam) => (
                                      <CommandItem
                                        key={lowerTeam.id}
                                        value={lowerTeam.name}
                                        onSelect={() => {
                                          setSelectedTeams([lowerTeam.id]);
                                          setTeamDropdownOpen(false);
                                        }}
                                        className="pl-12 text-sm"
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedTeams.includes(lowerTeam.id) ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        └─ {lowerTeam.name}
                                      </CommandItem>
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      
                      {/* Show orphan teams (teams without parents that aren't in the parent list) */}
                      {teams
                        .filter(team => team.parent_team_id && !teams.find(t => t.id === team.parent_team_id))
                        .map((team) => (
                          <CommandItem
                            key={team.id}
                            value={team.name}
                            onSelect={() => {
                              setSelectedTeams([team.id]);
                              setTeamDropdownOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTeams.includes(team.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {team.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Team Favorites Manager */}
              <TeamFavoritesManager
                currentSelectedTeamIds={selectedTeams.filter(id => id !== "all")}
                teams={teams}
                onApplyFavorite={(teamIds, name) => {
                  setSelectedTeams(teamIds);
                  toast({
                    title: 'Favorite Applied',
                    description: `Viewing teams from "${name}"`,
                  });
                }}
                viewContext="schedule"
              />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {/* View Toggle - Weekly/Monthly */}
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={timeView === "weekly" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeView("weekly")}
                className="h-8"
              >
                Weekly
              </Button>
              <Button
                variant={timeView === "monthly" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeView("monthly")}
                className="h-8"
              >
                Monthly
              </Button>
            </div>

            {/* Date Picker for easy navigation */}
            <DatePicker 
              date={timeView === "monthly" ? currentMonth : currentWeek}
              onDateChange={(date) => {
                if (date) {
                  if (timeView === "monthly") {
                    setCurrentMonth(startOfMonth(date));
                  } else {
                    setCurrentWeek(startOfWeek(date, { weekStartsOn: 1 }));
                  }
                }
              }}
              placeholder="Select date"
            />
            
            {/* Week/Month Navigation */}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (timeView === "monthly") {
                    setCurrentMonth(new Date());
                  } else {
                    setCurrentWeek(new Date());
                  }
                }}
              >
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Favorites Bar */}
      {(isManager() || isPlanner()) && favorites.length > 0 && (
        <TeamFavoritesQuickAccess
          favorites={favorites}
          currentSelectedTeamIds={selectedTeams.filter(id => id !== "all")}
          onApplyFavorite={(teamIds, name) => {
            setSelectedTeams(teamIds);
            toast({
              title: 'Favorite Applied',
              description: `Switched to "${name}"`,
            });
          }}
        />
      )}

      {/* Hierarchical Team Information */}
      {(isManager() || isPlanner()) && !selectedTeams.includes("all") && selectedTeams.length === 1 && (
        <TeamHierarchyInfo selectedTeamId={selectedTeams[0]} teams={teams} />
      )}

      {/* FlexTime Summary Card for Team Members in Weekly View */}
      {isTeamMember() && !isManager() && !isPlanner() && timeView === "weekly" && viewMode === "my-schedule" && (
        <FlexTimeSummaryCard
          previousBalance={previousBalance}
          currentMonthDelta={currentMonthDelta}
          currentBalance={currentBalance}
          carryoverLimit={carryoverLimit}
          entries={timeEntries}
          monthlySummary={monthlySummary}
          monthDate={currentWeek}
          userName={userName}
          onSaveCarryoverLimit={saveCarryoverLimit}
          loading={timeEntriesLoading}
        />
      )}

      {/* Team Availability View for Team Members */}
      {isTeamMember() && !isManager() && !isPlanner() && viewMode === "team-availability" && timeView === "weekly" && (
        <TeamAvailabilityView workDays={workDays} userId={user!.id} />
      )}

      {/* Monthly Schedule View */}
      {timeView === "monthly" && (
        <>
          {/* For team members, show personal calendar */}
          {isTeamMember() && !isManager() && !isPlanner() && (
            <PersonalMonthlyCalendar />
          )}
          
          {/* For managers/planners, require team selection */}
          {(isManager() || isPlanner()) && !selectedTeams.includes("all") && selectedTeams.length === 1 && (
            <MonthlyScheduleView 
              currentMonth={currentMonth}
              teamId={selectedTeams[0]}
              userId={user!.id}
            />
          )}

          {/* Message when monthly view is selected with "All Teams" or multiple teams for managers/planners */}
          {(isManager() || isPlanner()) && (selectedTeams.includes("all") || selectedTeams.length !== 1) && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  Please select a single team to view the monthly schedule.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Message for team members without teams */}
          {isTeamMember() && !isManager() && !isPlanner() && userTeams.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  You are not assigned to any team yet.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Mobile Card View or Desktop Table View */}
      {timeView === "weekly" && !(isTeamMember() && !isManager() && !isPlanner() && viewMode === "team-availability") && (
        isMobile ? (
          <div className="space-y-3 pb-20">
            {(() => {
              const now = new Date();
              const isCurrentWeek = workDays.some(day => 
                isSameDay(day, now)
              );
              
              return (
                <>
                  {/* Current Date Display */}
                  <Card className="sticky top-0 z-10 bg-background shadow-md">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-base">
                            {format(now, 'EEEE, MMMM d, yyyy')}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Week {format(currentWeek, 'w')} • {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
                          </p>
                        </div>
                        {!isCurrentWeek && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setCurrentWeek(new Date())}
                          >
                            Today
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* If not viewing current week, show notice */}
                  {!isCurrentWeek && (
                    <Card className="p-6 text-center border-warning">
                      <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-4">
                        You're viewing past week of {format(weekStart, 'MMM d')}
                      </p>
                      <Button 
                        variant="default" 
                        onClick={() => setCurrentWeek(new Date())}
                      >
                        Go to Current Week
                      </Button>
                    </Card>
                  )}

                  {/* Schedule Entries */}
                  {(() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const employeeEntries = employees.flatMap((employee) => {
                      const entries = scheduleEntries.filter(
                        e => e.user_id === employee.user_id && 
                        workDays.some(day => isSameDay(new Date(e.date), day)) &&
                        new Date(e.date) >= today
                      );
                      
                      return entries.map((entry) => (
                        <MobileScheduleCard
                          key={entry.id}
                          entry={entry}
                          onEdit={() => handleEditShift(entry)}
                          canEdit={(isManager() || isPlanner()) && canEditTeam(entry.team_id)}
                        />
                      ));
                    });
                    
                    const todayEntries = employeeEntries.filter(e => 
                      isSameDay(new Date(e.props.entry.date), today)
                    );
                    
                    if (employeeEntries.length === 0) {
                      return (
                        <Card className="p-6 text-center">
                          <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                          <p className="text-sm font-semibold mb-1">
                            {todayEntries.length === 0 ? 'No schedule for today' : 'No schedule entries for this week'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(today, 'EEEE, MMMM d')}
                          </p>
                        </Card>
                      );
                    }
                    
                    return employeeEntries;
                  })()}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <Table className="table-auto w-full">
                  <TableHeader>
                    <TableRow>
                      {multiSelectMode && <TableHead className="w-12"></TableHead>}
                      <TableHead className="w-40 font-semibold">
                        <div className="flex items-center justify-between gap-2">
                          <span>Employee</span>
                          {!userRoles.some(r => r.role === 'admin') && 
                           !userRoles.some(r => r.role === 'planner') && 
                           userRoles.some(r => r.role === 'manager') && 
                           selectedTeams.length > 0 && 
                           !selectedTeams.includes("all") && (
                            <Badge variant="outline" className="text-xs">
                              {managedUsersSet.size > 0 ? 'Mixed View' : 'Availability Only'}
                            </Badge>
                          )}
                        </div>
                      </TableHead>
                      {workDays.map((day, index) => (
                        <TableHead key={index} className="text-center font-semibold">
                          <div className="flex flex-col">
                            <span>{format(day, "EEE")}</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {format(day, "MMM d")}
                            </span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.user_id}>
                        {multiSelectMode && (
                          <TableCell className="w-12">
                            {/* Checkbox column - empty for employee row */}
                          </TableCell>
                        )}
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                              {formatUserName(employee.first_name, employee.last_name, employee.initials)}
                            </div>
                            <div className="flex-1">
                              {/* Show full name or initials based on management rights */}
                              {renderEmployeeName(employee)}
                              {/* Show shift counters for managers/planners */}
                              {(isManager() || isPlanner()) && shiftCounts.length > 0 && (
                                <ShiftCountsDisplay
                                  shiftCounts={shiftCounts.find(c => c.user_id === employee.user_id) || {
                                    user_id: employee.user_id,
                                    weekend_shifts_count: 0,
                                    night_shifts_count: 0,
                                    holiday_shifts_count: 0,
                                    total_shifts_count: 0,
                                  }}
                                  variant="inline"
                                  className="mt-1"
                                />
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {workDays.map((day, dayIndex) => {
                          const dayEntries = getEntriesForEmployeeAndDay(employee.user_id, day);
                          const continuationEntries = getContinuationEntriesForDay(employee.user_id, day);
                          const dayHolidays = getHolidaysForEmployeeAndDay(employee.user_id, day);
                          const pendingVacations = getPendingVacationForEmployeeAndDay(employee.user_id, day);
                          const isToday = isSameDay(day, new Date());
                          
                          // Get hotline assignment for this user and day
                          const dayStr = format(day, 'yyyy-MM-dd');
                          const hotlineAssignment = dutyAssignments.find(
                            da => da.user_id === employee.user_id && da.date === dayStr
                          );
                          
                          // Get time entry for this day (for team members viewing their own schedule)
                          const isOwnCell = employee.user_id === user?.id;
                          const timeEntry = isOwnCell ? getEntryForDate(dayStr) : null;
                          
                          // Handler for clicking cells - own cells open time entry, others open schedule edit
                          const handleCellClick = () => {
                            if (multiSelectMode) return;
                            
                            // Any user clicking their OWN cell opens flex time dialog
                            // This allows all users (including managers) to record their own working hours
                            if (isOwnCell) {
                              setTimeEntryDate(day);
                              setTimeEntryDialogOpen(true);
                              return;
                            }
                            
                            // Managers/planners can edit OTHER people's schedule entries
                            if (isManager() || isPlanner()) {
                              handleDateClick(employee.user_id, day);
                            }
                          };
                          
                          return (
                            <TableCell
                              key={dayIndex} 
                              className={`text-center ${isToday ? 'bg-primary/5' : ''} ${!multiSelectMode && (isManager() || isPlanner() || isOwnCell) ? 'cursor-pointer hover:bg-muted/50' : ''} transition-colors min-w-0 max-w-[120px]`}
                              onClick={handleCellClick}
                              title={!multiSelectMode && isOwnCell && !isManager() && !isPlanner() ? "Click to record working hours" : (!multiSelectMode && dayEntries.length === 0 && dayHolidays.length === 0 && continuationEntries.length === 0 ? "Click to add entry" : "")}
                            >
                              <div className="space-y-1 min-h-16 flex flex-col justify-center">
                                {/* Show time entry indicator for team members viewing their own schedule */}
                                {isOwnCell && timeEntry && !isManager() && !isPlanner() && (
                                  <TooltipProvider>
                                    <Tooltip delayDuration={200}>
                                      <TooltipTrigger asChild>
                                        <div className="w-full cursor-pointer">
                                          <Badge
                                            variant="outline"
                                            className={`text-xs max-w-full block pointer-events-auto ${
                                              timeEntry.flextime_delta && timeEntry.flextime_delta > 0
                                                ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700'
                                                : timeEntry.flextime_delta && timeEntry.flextime_delta < 0
                                                ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                                                : 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                                            }`}
                                          >
                                            <span className="truncate flex items-center justify-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              {timeEntry.flextime_delta !== null && timeEntry.flextime_delta !== undefined
                                                ? hoursToTimeString(timeEntry.flextime_delta)
                                                : '0:00'}
                                            </span>
                                          </Badge>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="z-[100]" side="top">
                                        <p className="font-medium">FlexTime Recorded</p>
                                        <p className="text-xs text-muted-foreground">
                                          {timeEntry.work_start_time && timeEntry.work_end_time
                                            ? `${timeEntry.work_start_time} - ${timeEntry.work_end_time}`
                                            : 'No times recorded'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          Actual: {timeEntry.actual_hours_worked?.toFixed(2) || 0}h / Target: {timeEntry.target_hours?.toFixed(2) || 0}h
                                        </p>
                                        <p className="text-xs font-medium mt-1">
                                          Click to edit
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {/* Show pending vacation request indicator for managers/planners */}
                                {pendingVacations.length > 0 && (isManager() || isPlanner()) && (
                                  <TooltipProvider>
                                    <Tooltip delayDuration={200}>
                                      <TooltipTrigger asChild>
                                        <div className="w-full cursor-help">
                                          <Badge
                                            variant="outline"
                                            className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700 max-w-full block pointer-events-auto"
                                          >
                                            <span className="truncate flex items-center justify-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              Pending
                                            </span>
                                          </Badge>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="z-[100]" side="top">
                                        <p className="font-medium">Vacation request pending approval</p>
                                        <p className="text-xs text-muted-foreground">
                                          {pendingVacations[0].is_full_day ? 'Full Day' : `${pendingVacations[0].start_time} - ${pendingVacations[0].end_time}`}
                                        </p>
                                        {pendingVacations[0].notes && (
                                          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                                            Note: {pendingVacations[0].notes}
                                          </p>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {/* Show continuation from previous day first */}
                                {continuationEntries.map((entry) => {
                                  const times = getShiftTimesFromEntry(entry);
                                  const canView = canViewActivityDetails(entry.user_id);
                                  
                                  return (
                                    <div key={`continuation-${entry.id}`} className="space-y-1">
                                       {canView ? (
                                        <TimeBlockDisplay
                                          entry={entry}
                                          userRole={userRoles.length > 0 ? userRoles[0].role : ""}
                                          showNotes={false}
                                          isContinuation={true}
                                          originalStartTime={times.start}
                                          shiftDescription={getShiftDescription(entry, employee)}
                                          shiftDefinitionTimes={getShiftTimesFromDefinition(entry, employee)}
                                          onClick={(e) => {
                                            e?.stopPropagation();
                                            // Team member clicking their own cell opens flex time dialog
                                            if (isOwnCell && !isManager() && !isPlanner()) {
                                              setTimeEntryDate(day);
                                              setTimeEntryDialogOpen(true);
                                              return;
                                            }
                                            if (!multiSelectMode && (isManager() || isPlanner()) && canView) {
                                              handleEditShift(entry);
                                            }
                                          }}
                                        />
                                      ) : null}
                                    </div>
                                  );
                                })}
                                
                                {/* Show holidays */}
                                <TooltipProvider>
                                  {dayHolidays.map((holiday) => (
                                    <Tooltip key={holiday.id} delayDuration={200}>
                                      <TooltipTrigger asChild>
                                        <div className="w-full cursor-help">
                                          <Badge
                                            variant="outline"
                                            className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 max-w-full block pointer-events-auto"
                                          >
                                            <span className="truncate block">
                                              🎉 {holiday.name}
                                            </span>
                                          </Badge>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="z-[100]" side="top">
                                        <p className="max-w-xs">🎉 {holiday.name}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </TooltipProvider>
                                
                                {/* Show work entries */}
                                  {dayEntries.length === 0 && continuationEntries.length === 0 && !hotlineAssignment ? (
                                    <span className="text-xs text-muted-foreground">
                                      {(isManager() || isPlanner()) && !multiSelectMode ? "+" : "-"}
                                    </span>
                                  ) : (
                                  <>
                                    {dayEntries.map((entry) => {
                                      const canView = canViewActivityDetails(entry.user_id);
                                      
                                      return (
                                        <div key={entry.id} className="space-y-1">
                                          {multiSelectMode && canView && (
                                            <div className="flex items-center justify-center mb-1" onClick={(e) => e.stopPropagation()}>
                                              <Checkbox
                                                checked={selectedShiftIds.includes(entry.id)}
                                                onCheckedChange={() => toggleShiftSelection(entry.id)}
                                              />
                                            </div>
                                          )}
                                          {canView ? (
                                            <TimeBlockDisplay
                                              entry={entry}
                                              userRole={userRoles.length > 0 ? userRoles[0].role : ""}
                                              showNotes={isTeamMember() && !isManager() && !isPlanner()}
                                              shiftDescription={getShiftDescription(entry, employee)}
                                              shiftDefinitionTimes={getShiftTimesFromDefinition(entry, employee)}
                                              onClick={(e) => {
                                                e?.stopPropagation();
                                                // Team member clicking their own cell opens flex time dialog
                                                if (isOwnCell && !isManager() && !isPlanner()) {
                                                  setTimeEntryDate(day);
                                                  setTimeEntryDialogOpen(true);
                                                  return;
                                                }
                                                if (!multiSelectMode && (isManager() || isPlanner()) && canView) {
                                                  // Check if manager can edit this team before opening edit modal
                                                  if (canEditTeam(entry.team_id)) {
                                                    handleEditShift(entry);
                                                  } else {
                                                    toast({ 
                                                      title: "View Only", 
                                                      description: "You can view this schedule but cannot edit it", 
                                                      variant: "default" 
                                                    });
                                                  }
                                                }
                                              }}
                                            />
                                          ) : (
                                            <Badge
                                              variant="secondary"
                                              className={`${getActivityColor(entry)} block text-xs pointer-events-none`}
                                            >
                                              <div className="flex flex-col items-center py-1">
                                                <span className="font-medium">{getActivityDisplay(entry)}</span>
                                              </div>
                                            </Badge>
                                          )}

                                          {(() => {
                                            const cleanNotes = getCleanNotesForDisplay(entry.notes);
                                            return canView && cleanNotes && (
                                              <p className="text-xs text-muted-foreground truncate" title={cleanNotes}>
                                                {cleanNotes.length > 20 ? `${cleanNotes.substring(0, 20)}...` : cleanNotes}
                                              </p>
                                            );
                                          })()}
                                        </div>
                                      );
                                    })}
                                  </>
                                  )}
                              </div>
                            </TableCell>
                          );
                         })}
                      </TableRow>
                    ))}
                    {employees.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No employees found for the selected team
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )
      )}

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
                        Other
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
        </CardContent>
      </Card>

      {/* My Requests Sheet */}
      <Sheet open={showVacationRequests} onOpenChange={setShowVacationRequests}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
          <div className="p-6 border-b">
            <SheetHeader>
              <SheetTitle>
                {(isManager() || isPlanner()) ? 'All Requests' : 'My Requests'}
              </SheetTitle>
              <SheetDescription>
                {(isManager() || isPlanner()) 
                  ? 'Review and manage vacation requests and shift swap requests from your team members.'
                  : 'View and manage your vacation requests and shift swap requests.'}
              </SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <MyRequestsDialog
              isPlanner={isPlanner()}
              isManager={isManager()}
              isAdmin={isAdmin()}
              onRequestProcessed={() => {
                // Silent refresh to preserve view - don't show loading screen
                fetchScheduleEntries(true);
                fetchPendingRequestsCount();
                fetchPendingSwapRequestsCount();
              }}
              onEditRequest={(request) => {
                setEditingVacationRequest(request);
                setVacationModalOpen(true);
                setShowVacationRequests(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Modal */}
      <EditScheduleModal
        entry={editingEntry}
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onSave={handleSaveEditModal}
      />

      {/* Vacation Request Modal */}
      <VacationRequestModal
        open={vacationModalOpen}
        onOpenChange={(open) => {
          setVacationModalOpen(open);
          if (!open) setEditingVacationRequest(null);
        }}
        onRequestSubmitted={() => {
          fetchScheduleEntries();
          setEditingVacationRequest(null);
        }}
        editRequest={editingVacationRequest}
      />

      {/* Bulk Edit Shifts Modal */}
      <BulkEditShiftsModal
        open={showBulkEditModal}
        onOpenChange={setShowBulkEditModal}
        selectedShiftIds={selectedShiftIds}
        onSuccess={handleBulkEditSuccess}
      />

      {/* Time Entry Dialog for FlexTime Recording (Team Members) */}
      {timeEntryDate && (
        <TimeEntryDialog
          open={timeEntryDialogOpen}
          onOpenChange={setTimeEntryDialogOpen}
          date={timeEntryDate}
          existingEntry={timeEntryDate ? getEntryForDate(format(timeEntryDate, 'yyyy-MM-dd')) : undefined}
          currentBalance={currentBalance}
          onSave={async (data) => {
            try {
              await saveTimeEntry(data);
              refreshTimeEntries();
              return true;
            } catch {
              return false;
            }
          }}
          onDelete={async (entryDate) => {
            try {
              await deleteTimeEntry(entryDate);
              refreshTimeEntries();
              return true;
            } catch {
              return false;
            }
          }}
        />
      )}
    </div>
  );
};

export default ScheduleView;