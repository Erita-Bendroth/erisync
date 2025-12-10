import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CoverageImpactWarning {
  date: string;
  shiftType: string;
  currentStaff: number;
  requiredStaff: number;
  remainingStaff: number;
  percentage: number;
  isCritical: boolean;
}

export interface CoverageImpactResult {
  hasImpact: boolean;
  hasCriticalImpact: boolean;
  warnings: CoverageImpactWarning[];
  loading: boolean;
  error: string | null;
}

export function useCoverageImpact() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoverageImpactResult>({
    hasImpact: false,
    hasCriticalImpact: false,
    warnings: [],
    loading: false,
    error: null,
  });

  const analyzeImpact = useCallback(
    async (
      userId: string,
      teamId: string,
      dates: string[],
      shiftType?: string
    ): Promise<CoverageImpactResult> => {
      setLoading(true);

      try {
        // First, find if this team is part of any partnership
        const { data: partnerships, error: pError } = await supabase
          .from('team_planning_partners')
          .select('id, partnership_name, team_ids')
          .contains('team_ids', [teamId]);

        if (pError) throw pError;

        if (!partnerships || partnerships.length === 0) {
          // No partnership, no requirements to check
          const noImpactResult: CoverageImpactResult = {
            hasImpact: false,
            hasCriticalImpact: false,
            warnings: [],
            loading: false,
            error: null,
          };
          setResult(noImpactResult);
          setLoading(false);
          return noImpactResult;
        }

        const partnershipId = partnerships[0].id;
        const partnerTeamIds = partnerships[0].team_ids;

        // Fetch shift requirements for the partnership
        const { data: requirements, error: reqError } = await supabase
          .from('partnership_shift_requirements')
          .select('shift_type, staff_required')
          .eq('partnership_id', partnershipId);

        if (reqError) throw reqError;

        if (!requirements || requirements.length === 0) {
          const noReqResult: CoverageImpactResult = {
            hasImpact: false,
            hasCriticalImpact: false,
            warnings: [],
            loading: false,
            error: null,
          };
          setResult(noReqResult);
          setLoading(false);
          return noReqResult;
        }

        const warnings: CoverageImpactWarning[] = [];

        // For each date, check the current coverage
        for (const date of dates) {
          // Get current schedule entries for this date across partnership teams
          const { data: currentEntries, error: entriesError } = await supabase
            .from('schedule_entries')
            .select('user_id, shift_type, activity_type')
            .in('team_id', partnerTeamIds)
            .eq('date', date)
            .in('activity_type', ['work', 'working_from_home', 'hotline_support']);

          if (entriesError) throw entriesError;

          // Determine what shift type the user is covering
          const userEntry = currentEntries?.find((e) => e.user_id === userId);
          const userShiftType = shiftType || userEntry?.shift_type || 'normal';

          // Find the requirement for this shift type
          const req = requirements.find((r) => r.shift_type === userShiftType);
          if (!req) continue; // No requirement for this shift type

          // Count current staff for this shift type (excluding the user)
          const currentStaff = currentEntries?.filter(
            (e) => e.shift_type === userShiftType
          ).length || 0;

          const remainingStaff = currentStaff - 1; // Minus the user being removed
          const percentage = Math.round((remainingStaff / req.staff_required) * 100);
          const isCritical = remainingStaff < req.staff_required;

          if (remainingStaff < req.staff_required) {
            warnings.push({
              date,
              shiftType: userShiftType,
              currentStaff,
              requiredStaff: req.staff_required,
              remainingStaff,
              percentage,
              isCritical,
            });
          }
        }

        const impactResult: CoverageImpactResult = {
          hasImpact: warnings.length > 0,
          hasCriticalImpact: warnings.some((w) => w.isCritical),
          warnings,
          loading: false,
          error: null,
        };

        setResult(impactResult);
        setLoading(false);
        return impactResult;
      } catch (error: any) {
        console.error('Error analyzing coverage impact:', error);
        const errorResult: CoverageImpactResult = {
          hasImpact: false,
          hasCriticalImpact: false,
          warnings: [],
          loading: false,
          error: error.message,
        };
        setResult(errorResult);
        setLoading(false);
        return errorResult;
      }
    },
    []
  );

  return {
    ...result,
    loading,
    analyzeImpact,
  };
}
