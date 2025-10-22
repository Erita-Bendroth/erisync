import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';

export interface AnalyticsFilters {
  teamIds: string[];
  startDate: Date;
  endDate: Date;
  metrics?: string[];
}

export interface CapacityMetrics {
  team_id: string;
  total_members: number;
  total_days: number;
  work_days: number;
  available_days: number;
  vacation_days: number;
  sick_days: number;
  other_days: number;
  utilization_rate: number;
  trend?: {
    value: number;
    isPositive: boolean;
    hasPreviousData: boolean;
  };
}

export interface EfficiencyMetrics {
  shift_distribution: Record<string, number>;
  activity_distribution: Record<string, number>;
  total_changes: number;
}

export interface CoverageGap {
  date: string;
  scheduled_count: number;
  gap: number;
}

export interface CoverageMetrics {
  team_id: string;
  gaps: CoverageGap[];
}

export interface VacationMetrics {
  team_id: string;
  total_requests: number;
  approved: number;
  pending: number;
  rejected: number;
  monthly_patterns: Record<string, number>;
}

export const useAnalytics = (filters: AnalyticsFilters) => {
  const { teamIds, startDate, endDate, metrics = ['capacity', 'efficiency', 'coverage', 'vacation'] } = filters;

  return useQuery({
    queryKey: ['analytics', teamIds, startDate.toISOString(), endDate.toISOString(), metrics],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('calculate-analytics', {
        body: {
          team_ids: teamIds,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          metrics,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: teamIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

// Hook to fetch capacity metrics for a single team
export const useTeamCapacity = (teamId: string, days: number = 30) => {
  const startDate = subDays(new Date(), days);
  const endDate = new Date();

  return useQuery({
    queryKey: ['team-capacity', teamId, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_capacity_metrics', {
        _team_id: teamId,
        _start_date: startDate.toISOString().split('T')[0],
        _end_date: endDate.toISOString().split('T')[0],
      });

      if (error) throw error;
      return data as unknown as CapacityMetrics;
    },
    enabled: !!teamId,
  });
};

// Hook to fetch coverage gaps
export const useCoverageGaps = (teamId: string, futureDays: number = 60) => {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + futureDays);

  return useQuery({
    queryKey: ['coverage-gaps', teamId, futureDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('identify_coverage_gaps', {
        _team_id: teamId,
        _start_date: startDate.toISOString().split('T')[0],
        _end_date: endDate.toISOString().split('T')[0],
        _min_coverage: 1,
      });

      if (error) throw error;
      return data as unknown as CoverageMetrics;
    },
    enabled: !!teamId,
  });
};

// Hook to fetch vacation patterns
export const useVacationPatterns = (teamId: string, lookbackMonths: number = 6) => {
  return useQuery({
    queryKey: ['vacation-patterns', teamId, lookbackMonths],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('analyze_vacation_patterns', {
        _team_id: teamId,
        _lookback_months: lookbackMonths,
      });

      if (error) throw error;
      return data as unknown as VacationMetrics;
    },
    enabled: !!teamId,
  });
};
