import { useState, useEffect, useCallback, useMemo } from 'react';
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
  // Optional pre-fetched data to avoid duplicate queries
  scheduleData?: any[];
  teamsData?: Array<{ id: string; name: string }>;
  holidaysData?: any[];
  capacityData?: any[];
}

export function useCoverageAnalysis({
  teamIds,
  startDate,
  endDate,
  threshold = 90,
  scheduleData,
  teamsData,
  holidaysData,
  capacityData,
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

  const analyzeCoverage = useCallback(async () => {

    try {
      setAnalysis((prev) => ({ ...prev, isLoading: true }));

      // Use provided data if available, otherwise fetch
      let teams = teamsData;
      if (!teams) {
        const { data, error: teamsError } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds);
        if (teamsError) throw teamsError;
        teams = data || [];
      }

      let scheduleEntries = scheduleData;
      if (!scheduleEntries) {
        const { data, error: scheduleError } = await supabase
          .from('schedule_entries')
          .select('*')
          .in('team_id', teamIds)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0])
          .in('activity_type', ['work']);
        if (scheduleError) throw scheduleError;
        scheduleEntries = data || [];
      }

      let holidays = holidaysData;
      if (!holidays) {
        const { data, error: holidaysError } = await supabase
          .from('holidays')
          .select('*')
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);
        if (holidaysError) throw holidaysError;
        holidays = data || [];
      }

      // Use provided capacity data or fetch it
      let capacityConfigs = capacityData;
      if (!capacityConfigs) {
        const { data, error: capacityError } = await supabase
          .from('team_capacity_config')
          .select('*')
          .in('team_id', teamIds);
        if (capacityError) throw capacityError;
        capacityConfigs = data || [];
      }

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
          
          // Default to 1 required staff if no capacity config exists
          if (!capacity) {
            console.warn(`Team ${teamId} (${teamMap.get(teamId)}) has no capacity configuration. Using default of 1 required staff.`);
          }

          // Determine required staff
          let required = capacity?.min_staff_required || 1;
          if (isWeekend && capacity?.applies_to_weekends) {
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
  }, [teamIds, startDate, endDate, threshold, scheduleData, teamsData, holidaysData, capacityData]);

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
  }, [teamIds, startDate, endDate, threshold, scheduleData, teamsData, holidaysData, capacityData, analyzeCoverage]);

  return analysis;
}
