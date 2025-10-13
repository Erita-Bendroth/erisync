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
import { Plus, ChevronLeft, ChevronRight, Check, ChevronDown, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { EditScheduleModal } from './EditScheduleModal';
import { TimeBlockDisplay } from './TimeBlockDisplay';
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
}

interface Team {
  id: string;
  name: string;
}

interface UserRole {
  role: string;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  country_code: string;
  is_public: boolean;
}

interface ScheduleViewProps {
  initialTeamId?: string;
}

const ScheduleView = ({ initialTeamId }: ScheduleViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleEntry[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState<string>("my-schedule");
  const [employees, setEmployees] = useState<Employee[]>([]);
const [holidays, setHolidays] = useState<Holiday[]>([]);
const [loading, setLoading] = useState(true);
const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
const [showEditModal, setShowEditModal] = useState(false);
const [selectedMonthValue, setSelectedMonthValue] = useState<string>("current");
// Managed users visibility cache
const [managedUsersSet, setManagedUsersSet] = useState<Set<string>>(new Set());
const [managedCacheLoading, setManagedCacheLoading] = useState(false);

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
      // 1) Get teams current user manages
      const { data: mgrTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('is_manager', true);

      const teamIds = (mgrTeams || []).map(t => t.team_id);
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
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .limit(10000)
        .order('name');

      if (error) throw error;
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
          console.log('Selected specific team:', selectedTeam);
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
          console.log('Target user IDs for team:', targetUserIds);
        } else {
          console.log('All teams view: fetching ALL team members across ALL teams');
          
          // CRITICAL FIX: When "All Teams" is selected, we need to fetch ALL users from ALL teams
          // First get all teams that the user has permission to see
          let allTeamsQuery;
          
          if (isPlanner()) {
            // Planners can see all teams
            allTeamsQuery = supabase.from('teams').select('id').limit(10000);
          } else if (isManager()) {
            // Managers can see teams they manage + all teams for viewing (UI will restrict editing)
            allTeamsQuery = supabase.from('teams').select('id').limit(10000);
          }
          
          const { data: allTeams, error: allTeamsError } = await allTeamsQuery;
          
          if (allTeamsError) {
            console.error('Error fetching teams:', allTeamsError);
            setEmployees([]);
            return;
          }
          
          const teamIds = (allTeams || []).map(t => t.id);
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

        const transformedEmployees = (profiles || []).map((emp: any) => ({
          id: emp.user_id,
          user_id: emp.user_id,
          first_name: emp.first_name ?? '',
          last_name: emp.last_name ?? '',
          initials: emp.initials ?? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`,
          displayName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
        }));

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

        const transformedEmployees = (profiles || []).map((emp: any) => ({
          id: emp.user_id,
          user_id: emp.user_id,
          first_name: emp.first_name ?? '',
          last_name: emp.last_name ?? '',
          initials: emp.initials ?? `${emp.first_name?.[0] ?? ''}${emp.last_name?.[0] ?? ''}`,
          displayName: `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
        }));

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
      // Fetch entries for full week (Monday-Sunday)
      const weekEnd = addDays(weekStart, 6); // Sunday
      
      console.log('=== fetchScheduleEntries START ===');
      console.log('Fetching schedule entries for work week:', {
        weekStart: format(weekStart, "yyyy-MM-dd"),
        weekEnd: format(weekEnd, "yyyy-MM-dd"),
        userId: user?.id,
        userRoles: userRoles.map(r => r.role),
        isManager: isManager(),
        isPlanner: isPlanner(),
        selectedTeam: selectedTeam
      });

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
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(addDays(weekStart, 6), "yyyy-MM-dd"))
        .order("date");

      // Apply filtering based on user roles and permissions
      if (isManager() || isPlanner()) {
        console.log('User has manager/planner role');
        
        if (selectedTeam !== "all") {
          console.log('Filtering by selected team:', selectedTeam);
          // Both managers and planners can fetch entries for any team
          // UI will handle display restrictions based on management rights
          query = query.eq("team_id", selectedTeam);
        } else {
          console.log('All teams view: explicitly fetching entries from all teams');
          // CRITICAL FIX: Explicitly fetch all team IDs and query for entries from all teams
          // This ensures we get ALL entries across all teams, avoiding RLS complications
          let allTeamsQuery;
          
          if (isPlanner()) {
            // Planners can see all teams
            allTeamsQuery = supabase.from('teams').select('id').limit(10000);
          } else if (isManager()) {
            // Managers can see all teams for viewing
            allTeamsQuery = supabase.from('teams').select('id').limit(10000);
          }
          
          const { data: allTeams } = await allTeamsQuery;
          
          if (allTeams && allTeams.length > 0) {
            const teamIds = allTeams.map(t => t.id);
            console.log('Fetching entries for team IDs:', teamIds);
            query = query.in("team_id", teamIds);
          } else {
            console.log('No teams found for All Teams view');
          }
        }
      } else if (isTeamMember()) {
        console.log('User is regular team member');
        
        if (viewMode === "my-schedule") {
          // Team members only see their own entries
          query = query.eq("user_id", user!.id);
          console.log('Filtering to only show user\'s own entries');
        } else if (viewMode === "my-team") {
          // Team members see their team's entries
          const { data: userTeams } = await supabase
            .from('team_members')
            .select('team_id')
            .eq('user_id', user!.id);
          
          if (userTeams && userTeams.length > 0) {
            const teamIds = userTeams.map(ut => ut.team_id);
            query = query.in("team_id", teamIds);
            console.log('Filtering to show team entries for teams:', teamIds);
          }
        }
      } else {
        // Default: show only own entries
        query = query.eq("user_id", user!.id);
      }

      // Ensure we fetch enough rows for All Teams view
      query = query.limit(10000);

      const { data, error } = await query;

      console.log('Raw query result:', {
        totalEntries: data?.length || 0,
        sampleDates: data?.slice(0, 10).map(entry => entry.date) || [],
        allDates: [...new Set(data?.map(entry => entry.date) || [])].sort()
      });

      if (error) {
        console.error('Schedule query error:', error);
        throw error;
      }
      
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
      
      console.log('Transformed schedule data:', transformedData.length, 'entries');
      setScheduleEntries(transformedData);

      // Ensure the row list includes EVERY user that has schedule entries (e.g. legacy entries not present in team_members)
      try {
        const existingEmployeeIds = new Set((employees || []).map(e => e.user_id));
        const missingUserIds = (userIds || []).filter(id => !existingEmployeeIds.has(id));

        if (missingUserIds.length > 0) {
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
          // Create minimal placeholders for any users not returned due to RLS restrictions
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

          const toAdd = [...fetchedEmployees, ...placeholderEmployees];
          if (toAdd.length > 0) {
            setEmployees(prev => {
              const map = new Map(prev.map(e => [e.user_id, e]));
              toAdd.forEach(e => { if (!map.has(e.user_id)) map.set(e.user_id, e); });
              return Array.from(map.values());
            });
          }
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
      
      // First get the user's country
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('country_code')
        .eq('user_id', user!.id)
        .single();

      if (profileError || !profileData?.country_code) {
        console.log('No country set for user, not fetching holidays');
        setHolidays([]);
        return;
      }

      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .eq('country_code', profileData.country_code)
        .gte('date', format(weekStart, "yyyy-MM-dd"))
        .lte('date', format(weekEnd, "yyyy-MM-dd"))
        .eq('is_public', true);

      if (error) {
        console.error('Error fetching holidays:', error);
        return;
      }
      
      console.log(`Fetched ${data?.length || 0} holidays for country ${profileData.country_code}`);
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const getEntriesForEmployeeAndDay = (employeeId: string, date: Date) => {
    // Return all entries for that user/day since weekends no longer have auto-generated entries
    return scheduleEntries.filter(entry => 
      entry.user_id === employeeId && isSameDay(new Date(entry.date), date)
    );
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
      case "other":
      case "sick": return "Other";
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
          <h2 className="text-2xl font-bold">Weekly Schedule</h2>
          <p className="text-muted-foreground">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")} (Full Week)
          </p>
          {userTeams.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Your teams: {userTeams.map(team => team.name).join(", ")}
            </p>
          )}
        </div>
        
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          {/* View Mode Filter - For team members - Removed problematic My Team Schedule option */}
          {isTeamMember() && !isManager() && !isPlanner() && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">View:</label>
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-48 bg-background">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="my-schedule">My Schedule</SelectItem>
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
                    className="w-48 justify-between"
                  >
                    {selectedTeam === "all" 
                      ? "All Teams"
                      : teams.find((team) => team.id === selectedTeam)?.name || "Select team..."
                    }
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-0 bg-background border z-50">
                  <Command>
                    <CommandInput placeholder="Search teams..." />
                    <CommandEmpty>No team found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => {
                          setSelectedTeam("all");
                          setTeamDropdownOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedTeam === "all" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        All Teams
                      </CommandItem>
                      {teams.map((team) => (
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
            {/* Date Picker for easy navigation */}
            <DatePicker 
              date={currentWeek}
              onDateChange={(date) => {
                if (date) {
                  setCurrentWeek(startOfWeek(date, { weekStartsOn: 1 }));
                }
              }}
              placeholder="Select date"
            />
            
            {/* Week Navigation */}
            <div className="flex items-center gap-1">
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
      </div>

      {/* Table-based Schedule View */}
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
                      const dayHolidays = getHolidaysForDay(day);
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

      {/* Edit Modal */}
      <EditScheduleModal
        entry={editingEntry}
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onSave={handleSaveEditModal}
      />
    </div>
  );
};

export default ScheduleView;