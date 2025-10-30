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
 * 
 * This hook distinguishes between:
 * 1. Direct management: User is manager of a specific team (not through parent team)
 * 2. RLS access: User has access through parent team hierarchy for viewing sibling teams
 */
export function useScheduleAccessControl({ viewMode }: UseScheduleAccessControlProps) {
  const { user } = useAuth();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [directlyManagedUsers, setDirectlyManagedUsers] = useState<Set<string>>(new Set());
  const [directlyManagedTeams, setDirectlyManagedTeams] = useState<Set<string>>(new Set());

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

      // Fetch all teams where user is marked as manager
      const { data: managerTeams } = await supabase
        .from('team_members')
        .select(`
          team_id,
          teams!inner (
            id,
            name,
            parent_team_id
          )
        `)
        .eq('user_id', user.id)
        .eq('is_manager', true);

      if (managerTeams) {
        // ALL teams where user is marked as manager are directly managed
        // The RLS policies handle the hierarchy correctly via get_manager_accessible_teams()
        const directTeamIds = new Set(managerTeams.map((tm: any) => tm.team_id));
        setDirectlyManagedTeams(directTeamIds);
        
        // Fetch ALL users from all accessible teams in the hierarchy
        if (directTeamIds.size > 0) {
          // Use the database function to get all teams in the hierarchy
          const { data: allAccessibleTeams } = await supabase
            .rpc('get_manager_accessible_teams', { _manager_id: user.id });
          
          if (allAccessibleTeams && allAccessibleTeams.length > 0) {
            // Fetch members from ALL accessible teams (including sub-teams)
            const { data: members } = await supabase
              .from('team_members')
              .select('user_id')
              .in('team_id', allAccessibleTeams);

            if (members) {
              setDirectlyManagedUsers(new Set(members.map(m => m.user_id)));
            }
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
    directlyManagedTeams,
    directlyManagedUsers,
  };
}
