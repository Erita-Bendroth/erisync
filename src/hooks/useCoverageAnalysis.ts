import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CoverageGap {
  date: string;
  teamId: string;
  teamName: string;
  required: number;
  actual: number;
  deficit: number;
  isWeekend: boolean;
  isHoliday: boolean;
}

export interface CoverageAnalysis {
  coveragePercentage: number;
  gaps: CoverageGap[];
  belowThreshold: boolean;
  totalDays: number;
  coveredDays: number;
  threshold: number;
  isLoading: boolean;
}

interface UseCoverageAnalysisProps {
  teamIds: string[];
  startDate: Date;
  endDate: Date;
  threshold?: number;
}

export function useCoverageAnalysis({
  teamIds,
  startDate,
  endDate,
  threshold = 90,
}: UseCoverageAnalysisProps): CoverageAnalysis {
  const [analysis, setAnalysis] = useState<CoverageAnalysis>({
    coveragePercentage: 100,
    gaps: [],
    belowThreshold: false,
    totalDays: 0,
    coveredDays: 0,
    threshold,
    isLoading: true,
  });

  useEffect(() => {
    if (teamIds.length === 0) {
      setAnalysis({
        coveragePercentage: 100,
        gaps: [],
        belowThreshold: false,
        totalDays: 0,
        coveredDays: 0,
        threshold,
        isLoading: false,
      });
      return;
    }

    analyzeCoverage();
  }, [teamIds, startDate, endDate, threshold]);

  const analyzeCoverage = async () => {
    try {
      setAnalysis((prev) => ({ ...prev, isLoading: true }));

      // Fetch teams data
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      if (teamsError) throw teamsError;

      // Fetch capacity config for teams
      const { data: capacityConfigs, error: capacityError } = await supabase
        .from('team_capacity_config')
        .select('*')
        .in('team_id', teamIds);

      if (capacityError) throw capacityError;

      // Fetch schedule entries for date range
      const { data: scheduleEntries, error: scheduleError } = await supabase
        .from('schedule_entries')
        .select('*')
        .in('team_id', teamIds)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .in('activity_type', ['work']);

      if (scheduleError) throw scheduleError;

      // Fetch holidays for date range
      const { data: holidays, error: holidaysError } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (holidaysError) throw holidaysError;

      // Build coverage analysis
      const gaps: CoverageGap[] = [];
      let totalDays = 0;
      let coveredDays = 0;

      const teamMap = new Map(teams?.map((t) => [t.id, t.name]) || []);
      const capacityMap = new Map(
        capacityConfigs?.map((c) => [c.team_id, c]) || []
      );
      const holidayDates = new Set(holidays?.map((h) => h.date) || []);

      // Iterate through each day in range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidayDates.has(dateStr);

        for (const teamId of teamIds) {
          const capacity = capacityMap.get(teamId);
          if (!capacity) continue;

          // Determine required staff
          let required = capacity.min_staff_required;
          if (isWeekend && capacity.applies_to_weekends) {
            required = capacity.min_staff_required;
          }

          // Count actual staff scheduled
          const actual = scheduleEntries?.filter(
            (entry) => entry.team_id === teamId && entry.date === dateStr
          ).length || 0;

          totalDays++;

          if (actual >= required) {
            coveredDays++;
          } else {
            gaps.push({
              date: dateStr,
              teamId,
              teamName: teamMap.get(teamId) || 'Unknown',
              required,
              actual,
              deficit: required - actual,
              isWeekend,
              isHoliday,
            });
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const coveragePercentage =
        totalDays > 0 ? Math.round((coveredDays / totalDays) * 100) : 100;

      setAnalysis({
        coveragePercentage,
        gaps: gaps.sort((a, b) => b.deficit - a.deficit),
        belowThreshold: coveragePercentage < threshold,
        totalDays,
        coveredDays,
        threshold,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error analyzing coverage:', error);
      setAnalysis((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return analysis;
}
