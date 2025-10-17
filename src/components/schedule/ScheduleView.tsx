import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, subDays, startOfWeek, isSameDay, isWeekend, addWeeks, subWeeks, addMonths, subMonths, startOfMonth } from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Check, ChevronDown, Calendar, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { EditScheduleModal } from './EditScheduleModal';
import { TimeBlockDisplay } from './TimeBlockDisplay';
import { TeamHierarchyInfo } from './TeamHierarchyInfo';
import { VacationRequestModal } from './VacationRequestModal';
import { VacationRequestsList } from './VacationRequestsList';
import { TeamAvailabilityView } from './TeamAvailabilityView';
import { MonthlyScheduleView } from './MonthlyScheduleView';
import { cn } from '@/lib/utils';

interface ScheduleEntry {
  id: string;
  user_id: string;
  team_id: string;
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
}

const ScheduleView = ({ initialTeamId }: ScheduleViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<string>("my-schedule");
  const [timeView, setTimeView] = useState<"weekly" | "monthly">("weekly");
  const [employees, setEmployees] = useState<Employee[]>([]);
const [holidays, setHolidays] = useState<Holiday[]>([]);
const [loading, setLoading] = useState(true);
const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
const [showEditModal, setShowEditModal] = useState(false);
const [selectedMonthValue, setSelectedMonthValue] = useState<string>("current");
// Managed users visibility cache
const [managedUsersSet, setManagedUsersSet] = useState<Set<string>>(new Set());
const [managedCacheLoading, setManagedCacheLoading] = useState(false);
// Vacation request modal
const [vacationModalOpen, setVacationModalOpen] = useState(false);
const [showVacationRequests, setShowVacationRequests] = useState(false);

const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday start
// Show Monday through Sunday (full week)
const workDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)); // Mon-Sun

  const handleEditShift = (entry: ScheduleEntry) => {
    if (!isManager() && !isPlanner()) return;
    
    // Managers can only edit entries for users in their managed teams
    if (isManager() && !isPlanner() && !canViewFullDetailsSync(entry.user_id)) {
      toast({ title: "Access Denied", description: "You can only edit schedules for users in teams you manage", variant: "destructive" });
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

  const handleDateClick = async (userId: string, date: Date) => {
    if (!isManager() && !isPlanner()) return;
    
    // Managers can only edit entries for users in their managed teams
    if (isManager() && !isPlanner() && !canViewFullDetailsSync(userId)) {
      toast({ title: "Access Denied", description: "You can only edit schedules for users in teams you manage", variant: "destructive" });
      return;
    }
    
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

  // Set initial team from prop
  useEffect(() => {
    if (initialTeamId && initialTeamId !== '' && teams.length > 0) {
      const teamExists = teams.find(team => team.id === initialTeamId);
      if (teamExists) {
        setSelectedTeam(initialTeamId);
      }
    }
  }, [initialTeamId, teams]);

  useEffect(() => {
    if (user) {
      fetchUserRoles();
      fetchUserTeams();
    }
  }, [user]);

  useEffect(() => {
    if (user && userRoles.length > 0) {
      fetchTeams();
      fetchEmployees();
      fetchScheduleEntries();
      fetchHolidays();
    }
  }, [user, currentWeek, userRoles]);

  useEffect(() => {
    // Refetch entries when team selection or view mode changes
    if (user && userRoles.length > 0) {
      fetchEmployees();
      fetchScheduleEntries();
      fetchHolidays();
    }
  }, [selectedTeam, viewMode]);

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
}, [user, userRoles, selectedTeam, viewMode]);

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
      console.log('selectedTeam:', selectedTeam);

      // For managers/planners, fetch employees via team_members (do NOT depend on schedule entries)
      if (isManager() || isPlanner()) {
        console.log('Manager/planner: fetching employees via team_members');

        let targetUserIds: string[] = [];

        if (selectedTeam !== "all") {
          console.log('🎯 Selected specific team:', selectedTeam);
          
          // Get the selected team's info for diagnostics
          const { data: selectedTeamData } = await supabase
            .from('teams')
            .select('name, parent_team_id')
            .eq('id', selectedTeam)
            .single();
          
          // FIXED: When a specific team is selected, show ONLY that team's members (no hierarchy)
          // This applies to both managers and planners
          const { data: teamMembersRes, error: teamMembersError } = await supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', selectedTeam)
            .limit(10000);

          if (teamMembersError) {
            console.error('Error fetching team members:', teamMembersError);
            setEmployees([]);
            return;
          }

          targetUserIds = [...new Set((teamMembersRes || []).map((tm: any) => tm.user_id))];
          console.log(`📊 Viewing single team: "${selectedTeamData?.name}" with ${targetUserIds.length} users (no hierarchy)`);
          console.log('Target user IDs for team:', targetUserIds);
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
            initials: emp.initials ?? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`,
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
            initials: emp.initials ?? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`,
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
          initials: emp.initials ?? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`,
          displayName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
        }));

        setEmployees(transformedEmployees);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchScheduleEntries = async () => {
    try {
      setLoading(true);
      const weekEnd = addDays(weekStart, 6);
      const dateStart = format(weekStart, "yyyy-MM-dd");
      const dateEnd = format(weekEnd, "yyyy-MM-dd");

      // For "All Teams", fetch in batches to avoid .in() limitations and RLS issues
      let allData: any[] = [];

      if ((isManager() || isPlanner()) && selectedTeam === "all") {
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
          const { data: accessibleTeamIds, error: rpcError } = await supabase
            .rpc('get_manager_accessible_teams', { _manager_id: user!.id });
          
          if (rpcError) {
            console.error('Error fetching manager accessible teams:', rpcError);
            teamIds = [];
          } else {
            teamIds = accessibleTeamIds || [];
            console.log(`📊 Manager All Teams fetch (including sub-teams): ${teamIds.length} teams`);
            console.log('Accessible team IDs:', teamIds);
          }
        }
        
        console.log(`📅 Fetching schedules for date range: ${dateStart} to ${dateEnd}`);

        // Batch fetch by team with smaller batch size to avoid hitting limits
        const BATCH_SIZE = 10; // Reduced from 25 to ensure all dates get fetched
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
              created_by,
              created_at,
              updated_at
            `)
            .gte("date", dateStart)
            .lte("date", dateEnd)
            .in("team_id", batchTeamIds)
            .order("date")
            .limit(10000);
          
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
          
          allData = [...allData, ...(batchData || [])];
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
        // Single team or specific view mode
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
            updated_at
          `)
          .gte("date", dateStart)
          .lte("date", dateEnd)
          .order("date");

        if (selectedTeam !== "all") {
          query = query.eq("team_id", selectedTeam);
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

      // Fetch user profiles for the entries
      const userIds = [...new Set(data?.map(entry => entry.user_id) || [])];
      const teamIds = [...new Set(data?.map(entry => entry.team_id) || [])];
      
      const [profilesResult, teamsResult] = await Promise.all([
        supabase.rpc('get_multiple_basic_profile_info', { _user_ids: userIds }),
        supabase.from('teams').select('id, name').in('id', teamIds)
      ]);
      
      const profilesMap = new Map((profilesResult.data || []).map(p => [p.user_id, p]));
      const teamsMap = new Map((teamsResult.data || []).map(t => [t.id, t]));
      
      const transformedData = data?.map(item => {
        const profile = profilesMap.get(item.user_id) || { first_name: 'Unknown', last_name: 'User' };
        const team = teamsMap.get(item.team_id) || { name: 'Unknown Team' };
        
        return {
          ...item,
          profiles: profile,
          teams: team
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
            initials: emp.initials ?? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`,
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
      setLoading(false);
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

  const isPlanner = () => userRoles.some(role => role.role === "planner");
  const isManager = () => userRoles.some(role => role.role === "manager");
  const isTeamMember = () => userRoles.some(role => role.role === "teammember");

// Helper: can manager view full details for a user synchronously
const canViewFullDetailsSync = (userId: string) => {
  if (!isManager() || isPlanner()) return true;
  return managedUsersSet.has(userId);
};

  // Render employee name - everyone can see full names since initials are public info
  const renderEmployeeName = (employee: Employee) => {
    return (
      <>
        <p className="font-medium">{employee.first_name} {employee.last_name}</p>
        <p className="text-xs text-muted-foreground">{employee.initials}</p>
      </>
    );
  };

const getActivityDisplay = (entry: ScheduleEntry) => {
  // Team members only see availability status
  if (isTeamMember() && !isManager() && !isPlanner()) {
    return getAvailabilityStatus(entry.activity_type);
  }
  
  // For managers, check if user is in a managed team
  if (isManager() && !isPlanner()) {
    const canViewFull = canViewFullDetailsSync(entry.user_id);
    if (canViewFull === false) {
      // Manager doesn't manage this user's team - show availability only
      return getAvailabilityStatus(entry.activity_type);
    } else {
      // Manager manages this user's team - show full details
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

  // For managers, check if they can view full details
  if (isManager() && !isPlanner()) {
    const canViewFull = canViewFullDetailsSync(entry.user_id);
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

  const isCacheReady = !(isManager() && !isPlanner()) || !managedCacheLoading;

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

          {/* Vacation Requests Toggle - For Managers/Planners */}
          {(isManager() || isPlanner()) && (
            <Button
              onClick={() => setShowVacationRequests(!showVacationRequests)}
              variant={showVacationRequests ? "default" : "outline"}
              size="default"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              {showVacationRequests ? 'Hide' : 'Show'} Requests
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
                      {selectedTeam === "all" 
                        ? "All Teams"
                        : teams.find((team) => team.id === selectedTeam)?.name || "Select team..."
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
                          setSelectedTeam("all");
                          setTeamDropdownOpen(false);
                        }}
                        className="py-3"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTeam === "all" ? "opacity-100" : "opacity-0"
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
                                  setSelectedTeam(topLevelTeam.id);
                                  setTeamDropdownOpen(false);
                                }}
                                className="py-3 font-semibold text-primary"
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedTeam === topLevelTeam.id ? "opacity-100" : "opacity-0"
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
                                        setSelectedTeam(midTeam.id);
                                        setTeamDropdownOpen(false);
                                      }}
                                      className="py-3 pl-8 font-medium"
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          selectedTeam === midTeam.id ? "opacity-100" : "opacity-0"
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
                                          setSelectedTeam(lowerTeam.id);
                                          setTeamDropdownOpen(false);
                                        }}
                                        className="pl-12 text-sm"
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedTeam === lowerTeam.id ? "opacity-100" : "opacity-0"
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
                              setSelectedTeam(team.id);
                              setTeamDropdownOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTeam === team.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {team.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
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
              {(isManager() || isPlanner()) && timeView === "weekly" && (
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
              )}
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

      {/* Hierarchical Team Information */}
      {(isManager() || isPlanner()) && selectedTeam !== "all" && (
        <TeamHierarchyInfo selectedTeamId={selectedTeam} teams={teams} />
      )}

      {/* Team Availability View for Team Members */}
      {isTeamMember() && !isManager() && !isPlanner() && viewMode === "team-availability" && timeView === "weekly" && (
        <TeamAvailabilityView workDays={workDays} userId={user!.id} />
      )}

      {/* Monthly Schedule View */}
      {timeView === "monthly" && (
        <>
          {/* For team members, use their first team */}
          {isTeamMember() && !isManager() && !isPlanner() && userTeams.length > 0 && userTeams[0]?.id && (
            <MonthlyScheduleView 
              currentMonth={currentMonth}
              teamId={userTeams[0]!.id}
              userId={user!.id}
            />
          )}
          
          {/* For managers/planners, require team selection */}
          {(isManager() || isPlanner()) && selectedTeam !== "all" && (
            <MonthlyScheduleView 
              currentMonth={currentMonth}
              teamId={selectedTeam}
              userId={user!.id}
            />
          )}

          {/* Message when monthly view is selected with "All Teams" for managers/planners */}
          {(isManager() || isPlanner()) && selectedTeam === "all" && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">
                  Please select a specific team to view the monthly schedule.
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

      {/* Table-based Schedule View - Only show in weekly view */}
      {timeView === "weekly" && !(isTeamMember() && !isManager() && !isPlanner() && viewMode === "team-availability") && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48 font-semibold">Employee</TableHead>
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
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                          {employee.initials}
                        </div>
                        <div>
                          {/* Show full name or initials based on management rights */}
                          {renderEmployeeName(employee)}
                        </div>
                      </div>
                    </TableCell>
                    {workDays.map((day, dayIndex) => {
                      const dayEntries = getEntriesForEmployeeAndDay(employee.user_id, day);
                      const dayHolidays = getHolidaysForEmployeeAndDay(employee.user_id, day);
                      const isToday = isSameDay(day, new Date());
                      
                      return (
                        <TableCell
                          key={dayIndex} 
                          className={`text-center ${isToday ? 'bg-primary/5' : ''} cursor-pointer hover:bg-muted/50 transition-colors`}
                          onClick={() => (isManager() || isPlanner()) && handleDateClick(employee.user_id, day)}
                          title={dayEntries.length === 0 && dayHolidays.length === 0 ? "Click to add entry" : ""}
                        >
                          <div className="space-y-1 min-h-16 flex flex-col justify-center">
                            {/* Show holidays first */}
                            {dayHolidays.map((holiday) => (
                              <Badge
                                key={holiday.id}
                                variant="outline"
                                className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                                title={`Public Holiday: ${holiday.name}`}
                              >
                                🎉 {holiday.name}
                              </Badge>
                            ))}
                            
                            {/* Show work entries */}
                              {dayEntries.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  {(isManager() || isPlanner()) ? "+" : "-"}
                                </span>
                              ) : (
                              dayEntries.map((entry) => (
                                <div key={entry.id} className="space-y-1">
                                  {(!(isManager() && !isPlanner()) || canViewFullDetailsSync(entry.user_id) === true) ? (
                                    <TimeBlockDisplay
                                      entry={entry}
                                      userRole={userRoles.length > 0 ? userRoles[0].role : ""}
                                      showNotes={isTeamMember() && !isManager() && !isPlanner()}
                                      onClick={(e) => {
                                        e?.stopPropagation();
                                        if (isManager() || isPlanner()) {
                                          // Additional check for managers - they can only edit users in their managed teams
                                          if (!(isManager() && !isPlanner() && !canViewFullDetailsSync(entry.user_id))) {
                                            handleEditShift(entry);
                                          }
                                        }
                                      }}
                                    />
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className={`${getActivityColor(entry)} block cursor-pointer hover:opacity-80 transition-opacity text-xs`}
                                      onClick={(e) => {
                                        e?.stopPropagation();
                                        if (isManager() || isPlanner()) {
                                          // Additional check for managers - they can only edit users in their managed teams
                                          if (!(isManager() && !isPlanner() && !canViewFullDetailsSync(entry.user_id))) {
                                            handleEditShift(entry);
                                          }
                                        }
                                      }}
                                    >
                                      <div className="flex flex-col items-center py-1">
                                        <span className="font-medium">{getActivityDisplay(entry)}</span>
                                      </div>
                                    </Badge>
                                  )}

                                  {(!(isManager() && !isPlanner()) || canViewFullDetailsSync(entry.user_id) === true) && entry.notes && !entry.notes.includes("Auto-generated") && !entry.notes.includes("Times:") && (
                                    <p className="text-xs text-muted-foreground truncate" title={entry.notes}>
                                      {entry.notes.length > 20 ? `${entry.notes.substring(0, 20)}...` : entry.notes}
                                    </p>
                                  )}
                                </div>
                              ))
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

      {/* Vacation Requests List (Conditional) */}
      {showVacationRequests && (isManager() || isPlanner()) && (
        <VacationRequestsList
          isPlanner={isPlanner()}
          onRequestProcessed={() => {
            fetchScheduleEntries();
          }}
        />
      )}

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
        onOpenChange={setVacationModalOpen}
        onRequestSubmitted={() => {
          fetchScheduleEntries();
        }}
      />
    </div>
  );
};

export default ScheduleView;