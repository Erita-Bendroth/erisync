import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type ShiftType = Database['public']['Enums']['shift_type'];

export interface ShiftTypeOption {
  type: ShiftType;
  label: string;
  description: string | null;
  startTime?: string;
  endTime?: string;
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
        .select('shift_type, description, start_time, end_time, team_ids, team_id')
        .or(`team_ids.cs.{${teamIds.join(',')}},team_id.is.null`);

      if (error) throw error;

      // Deduplicate by shift_type and prioritize team-specific over global
      const shiftMap = new Map<ShiftType, ShiftTypeOption>();
      
      data?.forEach((def) => {
        const existing = shiftMap.get(def.shift_type);
        const hasTeamSpecific = def.team_ids?.some(id => teamIds.includes(id)) || teamIds.includes(def.team_id || '');
        
        if (!existing || hasTeamSpecific) {
          shiftMap.set(def.shift_type, {
            type: def.shift_type,
            label: formatShiftLabel(def.shift_type),
            description: def.description,
            startTime: def.start_time,
            endTime: def.end_time,
          });
        }
      });

      // If no specific definitions found, add defaults
      if (shiftMap.size === 0) {
        ['early', 'late', 'normal', 'weekend'].forEach((type) => {
          shiftMap.set(type as ShiftType, {
            type: type as ShiftType,
            label: formatShiftLabel(type as ShiftType),
            description: null,
          });
        });
      }

      setShiftTypes(Array.from(shiftMap.values()));
    } catch (error) {
      console.error('Error fetching shift types:', error);
      // Fallback to defaults
      setShiftTypes([
        { type: 'early', label: 'Early Shift', description: null },
        { type: 'late', label: 'Late Shift', description: null },
        { type: 'normal', label: 'Day Shift', description: null },
        { type: 'weekend', label: 'Weekend', description: null },
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
