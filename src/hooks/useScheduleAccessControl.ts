import { useAuth } from '@/components/auth/AuthProvider';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseScheduleAccessControlProps {
  viewMode: 'standard' | 'multi-team';
}

/**
 * Hook to control visibility of activity details based on view mode
 * 
 * Standard view: Managers only see full details for directly managed team members
 * Multi-team view: Managers see full details for all accessible teams (including parent team access)
 */
export function useScheduleAccessControl({ viewMode }: UseScheduleAccessControlProps) {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [directlyManagedUsers, setDirectlyManagedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    
    const fetchUserData = async () => {
      // Fetch user roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      if (roles) {
        setUserRoles(roles.map(r => r.role));
      }

      // Fetch directly managed team members (not through parent teams)
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select(`
          team_id,
          teams!inner (
            id,
            parent_team_id
          )
        `)
        .eq('user_id', user.id)
        .eq('is_manager', true);

      if (teamMembers) {
        // Get IDs of teams user directly manages (not parent teams)
        const directTeamIds = teamMembers
          .filter((tm: any) => tm.teams && !tm.teams.parent_team_id)
          .map((tm: any) => tm.team_id);

        // Fetch all users in these directly managed teams
        if (directTeamIds.length > 0) {
          const { data: members } = await supabase
            .from('team_members')
            .select('user_id')
            .in('team_id', directTeamIds);

          if (members) {
            setDirectlyManagedUsers(new Set(members.map(m => m.user_id)));
          }
        }
      }
    };

    fetchUserData();
  }, [user]);

  const isPlanner = userRoles.includes('planner');
  const isAdmin = userRoles.includes('admin');
  const isManager = userRoles.includes('manager');

  /**
   * Determines if the current user can view full activity details for a specific user
   */
  const canViewActivityDetails = (targetUserId: string): boolean => {
    // Admins and planners always have full access
    if (isAdmin || isPlanner) return true;

    // User can always see their own details
    if (user?.id === targetUserId) return true;

    // Non-managers have limited access
    if (!isManager) return false;

    // View mode determines access level for managers
    if (viewMode === 'multi-team') {
      // Multi-team view: Show all details for all accessible teams
      // RLS policies handle what teams they can access
      return true;
    } else {
      // Standard view: Only show details for directly managed team members
      return directlyManagedUsers.has(targetUserId);
    }
  };

  return {
    canViewActivityDetails,
    isAdmin,
    isPlanner,
    isManager,
  };
}
