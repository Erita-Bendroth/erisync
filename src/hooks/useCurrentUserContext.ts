import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  initials?: string;
  country_code?: string | null;
  region_code?: string | null;
}

interface UserTeam {
  id: string;
  name: string;
  description?: string;
}

interface CurrentUserContext {
  profile: UserProfile | null;
  roles: string[];
  teams: UserTeam[];
  loading: boolean;
  highestRole: string | null;
  isManagerOrPlanner: boolean;
  refetch: () => void;
}

const ROLE_PRIORITY = ['admin', 'planner', 'manager', 'teammember'];

export function useCurrentUserContext(): CurrentUserContext {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setRoles([]);
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fire all three queries in parallel — no timeouts
      const [profileRes, rolesRes, teamsRes] = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('first_name, last_name, email, initials, country_code, region_code')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id),
        supabase
          .from('team_members')
          .select('teams (id, name, description)')
          .eq('user_id', user.id),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.data) {
        setProfile(profileRes.value.data);
      }

      if (rolesRes.status === 'fulfilled' && rolesRes.value.data) {
        setRoles(rolesRes.value.data.map((r: { role: string }) => r.role));
      }

      if (teamsRes.status === 'fulfilled' && teamsRes.value.data) {
        const parsed = (teamsRes.value.data as any[])
          .map((item) => item.teams)
          .filter(Boolean);
        setTeams(parsed);
      }
    } catch (error) {
      console.error('Error fetching user context:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const sortedRoles = roles.slice().sort(
    (a, b) => ROLE_PRIORITY.indexOf(a) - ROLE_PRIORITY.indexOf(b)
  );
  const highestRole = sortedRoles.length > 0 ? sortedRoles[0] : null;
  const isManagerOrPlanner =
    roles.includes('admin') || roles.includes('planner') || roles.includes('manager');

  return {
    profile,
    roles,
    teams,
    loading,
    highestRole,
    isManagerOrPlanner,
    refetch: fetchAll,
  };
}
