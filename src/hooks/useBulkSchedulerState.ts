import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, format } from 'date-fns';

export interface BulkSchedulerConfig {
  mode: 'users' | 'team' | 'rotation';
  teamId: string | null;
  selectedUserIds: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  shiftType: string | null;
  customTimes: {
    start: string;
    end: string;
  };
  skipWeekends: boolean;
  skipHolidays: boolean;
  advanced: {
    fairnessEnabled: boolean;
    fairnessWeight: number;
    recurringEnabled: boolean;
    recurringWeeks: number;
    recurringCycles: number;
    rotationEnabled: boolean;
    rotationPattern: 'sequential' | 'random';
    conflictHandling: 'skip' | 'overwrite' | 'ask';
  };
}

export const useBulkSchedulerState = (userId: string | undefined) => {
  const [config, setConfig] = useState<BulkSchedulerConfig>({
    mode: 'users',
    teamId: null,
    selectedUserIds: [],
    dateRange: {
      start: null,
      end: null,
    },
    shiftType: 'normal',
    customTimes: {
      start: '08:00',
      end: '16:30',
    },
    skipWeekends: true,
    skipHolidays: false,
    advanced: {
      fairnessEnabled: false,
      fairnessWeight: 50,
      recurringEnabled: false,
      recurringWeeks: 2,
      recurringCycles: 4,
      rotationEnabled: false,
      rotationPattern: 'sequential',
      conflictHandling: 'skip',
    },
  });

  // Apply smart defaults on mount
  useEffect(() => {
    const applySmartDefaults = async () => {
      if (!userId) return;

      try {
        // Get user's teams
        const { data: teamMembers } = await supabase
          .from('team_members')
          .select('team_id, teams(name)')
          .eq('user_id', userId)
          .limit(1)
          .single();

        if (teamMembers) {
          setConfig(prev => ({
            ...prev,
            teamId: teamMembers.team_id,
            dateRange: {
              start: startOfWeek(new Date(), { weekStartsOn: 1 }),
              end: endOfWeek(new Date(), { weekStartsOn: 1 }),
            },
          }));
        }
      } catch (error) {
        console.error('Error applying smart defaults:', error);
      }
    };

    applySmartDefaults();
  }, [userId]);

  // Validation
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (!config.teamId) {
      errors.push('Please select a team');
    }

    if (config.mode === 'users' && config.selectedUserIds.length === 0) {
      errors.push('Please select at least one team member');
    }

    if (!config.dateRange.start || !config.dateRange.end) {
      errors.push('Please select a date range');
    }

    if (!config.shiftType) {
      errors.push('Please select a shift type');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [config]);

  // Calculate preview metrics
  const preview = useMemo(() => {
    if (!config.dateRange.start || !config.dateRange.end) {
      return { totalShifts: 0, breakdown: [] };
    }

    const start = config.dateRange.start;
    const end = config.dateRange.end;
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    let workDays = days;
    if (config.skipWeekends) {
      // Rough estimate: 5/7 of days
      workDays = Math.ceil(days * (5 / 7));
    }

    const userCount = config.mode === 'team' 
      ? 0 // Will be calculated when team members are fetched
      : config.selectedUserIds.length;

    const totalShifts = workDays * userCount;

    return {
      totalShifts,
      workDays,
      userCount,
      breakdown: [],
    };
  }, [config]);

  return {
    config,
    setConfig,
    validation,
    preview,
  };
};
