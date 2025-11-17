import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ShiftType = Database['public']['Enums']['shift_type'];

export interface ShiftTypeOption {
  id: string;
  type: ShiftType;
  label: string;
  description: string | null;
  startTime?: string;
  endTime?: string;
  dayOfWeek?: number[] | null;
}

export const useShiftTypes = (teamIds: string[]) => {
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (teamIds.length === 0) return;
    fetchShiftTypes();
  }, [teamIds.join(',')]);

  const fetchShiftTypes = async () => {
    setLoading(true);
    try {
      // Get shift time definitions for these teams or global ones
      const { data, error } = await supabase
        .from('shift_time_definitions')
        .select('id, shift_type, description, start_time, end_time, day_of_week, team_ids, team_id')
        .or(`team_ids.cs.{${teamIds.join(',')}},team_id.in.(${teamIds.join(',')}),team_id.is.null`);

      if (error) throw error;

      // Transform to ShiftTypeOption[] WITHOUT deduplicating
      const shiftOptions: ShiftTypeOption[] = data?.map((def) => ({
        id: def.id,
        type: def.shift_type,
        label: def.description || formatShiftLabel(def.shift_type),
        description: def.description,
        startTime: def.start_time,
        endTime: def.end_time,
        dayOfWeek: def.day_of_week,
      })) || [];

      // Prioritize team-specific definitions over global
      const teamSpecific = shiftOptions.filter(opt => {
        const def = data?.find(d => d.id === opt.id);
        return def && (
          def.team_ids?.some(id => teamIds.includes(id)) || 
          teamIds.includes(def.team_id || '')
        );
      });

      const global = shiftOptions.filter(opt => {
        const def = data?.find(d => d.id === opt.id);
        return def && !def.team_id && !def.team_ids?.length;
      });

      const allShifts = [...teamSpecific, ...global];

      // If no specific definitions found, add defaults
      if (allShifts.length === 0) {
        const defaults: ShiftTypeOption[] = ['early', 'late', 'normal', 'weekend'].map((type) => ({
          id: `default-${type}`,
          type: type as ShiftType,
          label: formatShiftLabel(type as ShiftType),
          description: null,
        }));
        setShiftTypes(defaults);
      } else {
        setShiftTypes(allShifts);
      }
    } catch (error) {
      console.error('Error fetching shift types:', error);
      // Fallback to defaults
      setShiftTypes([
        { id: 'default-early', type: 'early', label: 'Early Shift', description: null },
        { id: 'default-late', type: 'late', label: 'Late Shift', description: null },
        { id: 'default-normal', type: 'normal', label: 'Day Shift', description: null },
        { id: 'default-weekend', type: 'weekend', label: 'Weekend', description: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return { shiftTypes, loading };
};

const formatShiftLabel = (shiftType: ShiftType): string => {
  const labels: Record<ShiftType, string> = {
    early: 'Early Shift',
    late: 'Late Shift',
    normal: 'Day Shift',
    weekend: 'Weekend',
  };
  return labels[shiftType] || shiftType;
};
