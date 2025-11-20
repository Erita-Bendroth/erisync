import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

interface DashboardStats {
  todayScheduleCount: number;
  teamMembersCount: number;
  availableNowCount: number;
  pendingActionsCount: number;
}

export const useDashboardStats = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];

      // Get user's teams first
      const { data: teamMemberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      const userTeamIds = teamMemberships?.map(tm => tm.team_id) || [];

      // 1. Today's schedule count for current user
      const { count: todayScheduleCount } = await supabase
        .from('schedule_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', today);

      // 2. Team members count (all unique members from user's teams)
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id')
        .in('team_id', userTeamIds);

      const uniqueTeamMembers = new Set(teamMembers?.map(tm => tm.user_id) || []);
      const teamMembersCount = uniqueTeamMembers.size;

      // 3. Available now (team members not on vacation/unavailable today)
      const { data: unavailableToday } = await supabase
        .from('schedule_entries')
        .select('user_id')
        .in('user_id', Array.from(uniqueTeamMembers))
        .eq('date', today)
        .in('activity_type', ['vacation', 'out_of_office', 'other']);

      const unavailableUserIds = new Set(unavailableToday?.map(se => se.user_id) || []);
      const availableNowCount = teamMembersCount - unavailableUserIds.size;

      // 4. Pending actions (for managers/planners only)
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const roles = userRoles?.map(r => r.role) || [];
      const isManagerOrPlanner = roles.includes('manager') || roles.includes('planner') || roles.includes('admin');

      let pendingActionsCount = 0;

      if (isManagerOrPlanner) {
        // Count pending vacation requests
        const { count: pendingVacations } = await supabase
          .from('vacation_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Count pending swap requests
        const { count: pendingSwaps } = await supabase
          .from('shift_swap_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        pendingActionsCount = (pendingVacations || 0) + (pendingSwaps || 0);
      }

      return {
        todayScheduleCount: todayScheduleCount || 0,
        teamMembersCount,
        availableNowCount: Math.max(0, availableNowCount),
        pendingActionsCount,
      };
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};
