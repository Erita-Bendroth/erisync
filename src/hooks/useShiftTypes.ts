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
        .or(`team_ids.cs.{${teamIds.join(',')}},team_id.in.(${teamIds.join(',')}),and(team_id.is.null,team_ids.is.null)`);

      if (error) throw error;

      // Transform to ShiftTypeOption[] WITHOUT deduplicating
      const shiftOptions: ShiftTypeOption[] = data?.map((def) => {
        const dayLabel = formatDayLabel(def.day_of_week);
        const baseLabel = def.description || formatShiftLabel(def.shift_type);
        const label = dayLabel ? `${baseLabel} (${dayLabel})` : baseLabel;
        
        return {
          id: def.id,
          type: def.shift_type,
          label,
          description: def.description,
          startTime: def.start_time,
          endTime: def.end_time,
          dayOfWeek: def.day_of_week,
        };
      }) || [];

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

const formatDayLabel = (dayOfWeek: number[] | null): string => {
  if (!dayOfWeek || dayOfWeek.length === 0) return '';
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Check for common patterns
  const sortedDays = [...dayOfWeek].sort((a, b) => a - b);
  
  // Weekdays (Mon-Fri = 1-5)
  if (sortedDays.length === 5 && sortedDays.join(',') === '1,2,3,4,5') {
    return 'Mon-Fri';
  }
  
  // Weekend (Sat-Sun = 6,0 or 0,6)
  if (sortedDays.length === 2 && 
      ((sortedDays[0] === 0 && sortedDays[1] === 6) || 
       (sortedDays[0] === 6 && sortedDays[1] === 0))) {
    return 'Sat-Sun';
  }
  
  // Consecutive days
  let isConsecutive = true;
  for (let i = 1; i < sortedDays.length; i++) {
    if (sortedDays[i] !== sortedDays[i-1] + 1) {
      isConsecutive = false;
      break;
    }
  }
  
  if (isConsecutive && sortedDays.length > 2) {
    return `${dayNames[sortedDays[0]]}-${dayNames[sortedDays[sortedDays.length - 1]]}`;
  }
  
  // Individual days
  return sortedDays.map(d => dayNames[d]).join(', ');
};
