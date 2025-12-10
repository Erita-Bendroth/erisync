import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShiftRequirement {
  shift_type: string;
  staff_required: number;
  notes: string | null;
}

export interface WeekValidation {
  weekNumber: number;
  shiftType: string;
  required: number;
  assigned: number;
  isValid: boolean;
  assignedUsers: string[];
}

export interface RosterValidationResult {
  isValid: boolean;
  warnings: WeekValidation[];
  totalWarnings: number;
  loading: boolean;
}

export function useRosterValidation(
  rosterId: string | null,
  partnershipId: string,
  cycleLength: number
): RosterValidationResult {
  const [requirements, setRequirements] = useState<ShiftRequirement[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<WeekValidation[]>([]);

  const fetchData = useCallback(async () => {
    if (!rosterId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch shift requirements
      const { data: reqData, error: reqError } = await supabase
        .from('partnership_shift_requirements')
        .select('shift_type, staff_required, notes')
        .eq('partnership_id', partnershipId);

      if (reqError) throw reqError;
      setRequirements(reqData || []);

      // Fetch roster assignments
      const { data: assignData, error: assignError } = await supabase
        .from('roster_week_assignments')
        .select('week_number, shift_type, user_id, day_of_week, include_weekends')
        .eq('roster_id', rosterId);

      if (assignError) throw assignError;
      setAssignments(assignData || []);
    } catch (error) {
      console.error('Error fetching roster validation data:', error);
    } finally {
      setLoading(false);
    }
  }, [rosterId, partnershipId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate warnings
  useEffect(() => {
    if (requirements.length === 0 || !rosterId) {
      setWarnings([]);
      return;
    }

    const newWarnings: WeekValidation[] = [];

    // For each week in the cycle
    for (let week = 1; week <= cycleLength; week++) {
      // Check each shift type requirement
      requirements.forEach((req) => {
        // Count unique users assigned to this shift type in this week
        const weekAssignments = assignments.filter(
          (a) => a.week_number === week && a.shift_type === req.shift_type && a.user_id
        );

        // For week-based (no day_of_week) or day-based, count unique users
        const uniqueUsers = new Set(weekAssignments.map((a) => a.user_id));

        // Also count users with include_weekends for weekend requirement
        if (req.shift_type === 'weekend') {
          const weekendFromInclude = assignments.filter(
            (a) => a.week_number === week && a.include_weekends && a.user_id
          );
          weekendFromInclude.forEach((a) => uniqueUsers.add(a.user_id));
        }

        const assignedCount = uniqueUsers.size;

        if (assignedCount < req.staff_required) {
          newWarnings.push({
            weekNumber: week,
            shiftType: req.shift_type,
            required: req.staff_required,
            assigned: assignedCount,
            isValid: false,
            assignedUsers: Array.from(uniqueUsers),
          });
        }
      });
    }

    setWarnings(newWarnings);
  }, [requirements, assignments, cycleLength, rosterId]);

  return {
    isValid: warnings.length === 0,
    warnings,
    totalWarnings: warnings.length,
    loading,
  };
}
