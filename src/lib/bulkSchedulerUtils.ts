import { format, eachDayOfInterval, isWeekend as isWeekendDate } from 'date-fns';
import { BulkSchedulerConfig } from '@/hooks/useBulkSchedulerState';
import { Database } from '@/integrations/supabase/types';
import { detectHolidays, findBestShiftForDate, HolidayInfo } from './holidayDetection';

type ShiftType = Database['public']['Enums']['shift_type'];
type ActivityType = Database['public']['Enums']['activity_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];

export interface ScheduleEntryDraft {
  user_id: string;
  team_id: string;
  date: string;
  shift_type: ShiftType;
  shift_time_definition_id?: string | null;
  activity_type: ActivityType;
  availability_status: AvailabilityStatus;
  created_by: string;
  notes?: string;
}

export const calculateBulkEntries = async (
  config: BulkSchedulerConfig,
  allTeamMembers: Array<{ user_id: string }>,
  userId: string,
  supabase: any
): Promise<ScheduleEntryDraft[]> => {
  if (!config.dateRange.start || !config.dateRange.end || !config.teamId) {
    return [];
  }

  console.log('🔍 BULK SCHEDULER START:', {
    dateRange: `${format(config.dateRange.start, 'yyyy-MM-dd')} - ${format(config.dateRange.end, 'yyyy-MM-dd')}`,
    selectedShiftId: config.shiftType,
    autoDetectWeekends: config.autoDetectWeekends,
    teamId: config.teamId,
    mode: config.mode
  });

  const entries: ScheduleEntryDraft[] = [];
  const days = eachDayOfInterval({
    start: config.dateRange.start,
    end: config.dateRange.end,
  });

  // Determine which users to include
  let targetUsers: string[] = [];
  if (config.mode === 'team') {
    targetUsers = allTeamMembers.map(m => m.user_id);
  } else {
    targetUsers = config.selectedUserIds;
  }

  // Detect holidays if enabled
  let holidayMap: Map<string, Map<string, HolidayInfo>> | null = null;
  if (config.autoDetectWeekends || config.autoDetectHolidays) {
    holidayMap = await detectHolidays(days, targetUsers, config.teamId);
  }

  // Generate entries
  for (const day of days) {
    const dayOfWeek = day.getDay();
    const dateStr = format(day, 'yyyy-MM-dd');
    
    // Check if this day should use weekend/holiday shift
    const isWeekend = isWeekendDate(day);
    const dateHolidayInfo = holidayMap?.get(dateStr);
    const hasAnyHoliday = dateHolidayInfo && Array.from(dateHolidayInfo.values()).some(
      info => info.isPublicHoliday || info.isWeekend
    );
    
    // Determine if we should include this day:
    // - Always include if autoDetectWeekends is ON and it's a weekend
    // - Always include if autoDetectHolidays is ON and there's a holiday
    // - Otherwise, respect excludedDays list
    const shouldIncludeDay = 
      (config.autoDetectWeekends && isWeekend) ||
      (config.autoDetectHolidays && hasAnyHoliday) ||
      !config.excludedDays.includes(dayOfWeek);
    
    if (!shouldIncludeDay) {
      continue;
    }

    if (config.mode === 'rotation' && config.advanced.rotationEnabled) {
      // Rotation mode: assign one user per day in sequence
      const dayIndex = days.indexOf(day);
      const userIndex = dayIndex % targetUsers.length;
      const rotationUserId = targetUsers[userIndex];
      
      // Check if this user has a holiday
      const userHolidayInfo = dateHolidayInfo?.get(rotationUserId);
      if (config.skipUsersWithHolidays && userHolidayInfo?.userHasHoliday) {
        console.log(`Skipping ${rotationUserId} on ${dateStr} - user has personal holiday`);
        continue;
      }
      
      // Determine shift to use
      const shouldUseWeekendShift = 
        (config.autoDetectWeekends && isWeekend) || 
        (config.autoDetectHolidays && userHolidayInfo?.isPublicHoliday);
      
      const shiftIdToUse = await findBestShiftForDate(
        day,
        shouldUseWeekendShift,
        config.teamId,
        config.shiftType,
        config.weekendShiftOverride || null
      );
      
      // Resolve shift type
      let resolvedShiftType: ShiftType = 'normal';
      if (shiftIdToUse && shiftIdToUse !== 'custom') {
        const { data: shiftDef } = await supabase
          .from('shift_time_definitions')
          .select('shift_type')
          .eq('id', shiftIdToUse)
          .maybeSingle();
        if (shiftDef) resolvedShiftType = shiftDef.shift_type;
      }

      const notes = shouldUseWeekendShift 
        ? `Bulk generated (rotation) - ${userHolidayInfo?.holidayName || 'Weekend'}`
        : 'Bulk generated (rotation)';

      console.log(`📝 Creating entry for ${rotationUserId} on ${dateStr}: shift_id=${shiftIdToUse}, shift_type=${resolvedShiftType}`);

      entries.push({
        user_id: rotationUserId,
        team_id: config.teamId,
        date: dateStr,
        shift_type: resolvedShiftType,
        shift_time_definition_id: shiftIdToUse && shiftIdToUse !== 'custom' ? shiftIdToUse : null,
        activity_type: 'work' as ActivityType,
        availability_status: 'available' as AvailabilityStatus,
        created_by: userId,
        notes,
      });
    } else {
      // Regular mode: assign to all selected users
      for (const targetUserId of targetUsers) {
        // Check if this user has a holiday
        const userHolidayInfo = dateHolidayInfo?.get(targetUserId);
        if (config.skipUsersWithHolidays && userHolidayInfo?.userHasHoliday) {
          console.log(`Skipping ${targetUserId} on ${dateStr} - user has personal holiday`);
          continue;
        }
        
        // Determine shift to use
        const shouldUseWeekendShift = 
          (config.autoDetectWeekends && isWeekend) || 
          (config.autoDetectHolidays && userHolidayInfo?.isPublicHoliday);
        
        const shiftIdToUse = await findBestShiftForDate(
          day,
          shouldUseWeekendShift,
          config.teamId,
          config.shiftType,
          config.weekendShiftOverride || null
        );
        
        // Resolve shift type
        let resolvedShiftType: ShiftType = 'normal';
        if (shiftIdToUse && shiftIdToUse !== 'custom') {
          const { data: shiftDef } = await supabase
            .from('shift_time_definitions')
            .select('shift_type')
            .eq('id', shiftIdToUse)
            .maybeSingle();
          if (shiftDef) resolvedShiftType = shiftDef.shift_type;
        }

        const notes = shouldUseWeekendShift 
          ? `Bulk generated - ${userHolidayInfo?.holidayName || 'Weekend'}`
          : 'Bulk generated';

        console.log(`📝 Creating entry for ${targetUserId} on ${dateStr}: shift_id=${shiftIdToUse}, shift_type=${resolvedShiftType}`);

        entries.push({
          user_id: targetUserId,
          team_id: config.teamId,
          date: dateStr,
          shift_type: resolvedShiftType,
          shift_time_definition_id: shiftIdToUse && shiftIdToUse !== 'custom' ? shiftIdToUse : null,
          activity_type: 'work' as ActivityType,
          availability_status: 'available' as AvailabilityStatus,
          created_by: userId,
          notes,
        });
      }
    }
  }

  return entries;
};

export const getThisWeek = () => {
  const now = new Date();
  return {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end: endOfWeek(now, { weekStartsOn: 1 }),
  };
};

export const getNextWeek = () => {
  const now = new Date();
  const nextWeek = addWeeks(now, 1);
  return {
    start: startOfWeek(nextWeek, { weekStartsOn: 1 }),
    end: endOfWeek(nextWeek, { weekStartsOn: 1 }),
  };
};

export const getThisMonth = () => {
  const now = new Date();
  return {
    start: startOfMonth(now),
    end: endOfMonth(now),
  };
};

function startOfWeek(date: Date, options: { weekStartsOn: number }): Date {
  const day = date.getDay();
  const diff = (day < options.weekStartsOn ? 7 : 0) + day - options.weekStartsOn;
  const result = new Date(date);
  result.setDate(date.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfWeek(date: Date, options: { weekStartsOn: number }): Date {
  const start = startOfWeek(date, options);
  const result = new Date(start);
  result.setDate(start.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function addWeeks(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(date.getDate() + amount * 7);
  return result;
}

function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfMonth(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}
