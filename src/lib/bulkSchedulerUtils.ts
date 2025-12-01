import { format, eachDayOfInterval, isWeekend as isWeekendDate } from 'date-fns';
import { BulkSchedulerConfig } from '@/hooks/useBulkSchedulerState';
import { Database } from '@/integrations/supabase/types';
import { detectHolidays, HolidayInfo } from './holidayDetection';
import { getApplicableShiftTimes } from './shiftTimeUtils';

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

interface TeamMemberWithLocation {
  user_id: string;
  country_code?: string;
  region_code?: string | null;
}

export const calculateBulkEntries = async (
  config: BulkSchedulerConfig,
  allTeamMembers: Array<TeamMemberWithLocation>,
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

  // Fetch the selected shift definition to get its actual enum type
  let selectedShiftEnumType: ShiftType = 'normal';
  let shiftDefinitionId: string | null = null;
  
  if (config.shiftType && config.shiftType !== 'custom') {
    shiftDefinitionId = config.shiftType;
    const { data: shiftDef, error: shiftError } = await supabase
      .from('shift_time_definitions')
      .select('id, shift_type, description')
      .eq('id', config.shiftType)
      .maybeSingle();
    
    if (!shiftDef) {
      console.error('❌ Selected shift type not found in database:', config.shiftType);
      throw new Error('Selected shift type not found. Please re-select your shift type.');
    }
    
    selectedShiftEnumType = shiftDef.shift_type;
    console.log(`✅ Resolved shift definition ${config.shiftType} to enum type: ${selectedShiftEnumType}`);
  }

  const entries: ScheduleEntryDraft[] = [];
  const days = eachDayOfInterval({
    start: config.dateRange.start,
    end: config.dateRange.end,
  });

  // Determine which users to include and build country code map
  let targetUsers: string[] = [];
  const userCountryMap = new Map<string, string>();
  const userRegionMap = new Map<string, string | null>();

  if (config.mode === 'team') {
    targetUsers = allTeamMembers.map(m => {
      userCountryMap.set(m.user_id, m.country_code || 'US');
      userRegionMap.set(m.user_id, m.region_code || null);
      return m.user_id;
    });
  } else {
    // For users/rotation mode, fetch country codes
    targetUsers = config.selectedUserIds;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, country_code, region_code')
      .in('user_id', targetUsers);
    
    if (profiles) {
      profiles.forEach((p: any) => {
        userCountryMap.set(p.user_id, p.country_code || 'US');
        userRegionMap.set(p.user_id, p.region_code || null);
      });
    }
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
    
    // Skip days that are in the excluded days list (e.g., weekends)
    // excludedDays takes priority - if user says skip weekends, we skip them
    if (config.excludedDays.includes(dayOfWeek)) {
      continue;
    }
    
    // autoDetectWeekends/autoDetectHolidays only affect WHICH SHIFT TYPE to use,
    // not whether to include the day (that's controlled by excludedDays)

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
      
      // Get user's country code
      const userCountryCode = userCountryMap.get(rotationUserId);
      const userRegionCode = userRegionMap.get(rotationUserId);
      console.log(`🌍 User ${rotationUserId} location: ${userCountryCode}/${userRegionCode}`);
      
      // Determine which shift type to request
      let requestedShiftType: ShiftType = shouldUseWeekendShift ? 'weekend' : selectedShiftEnumType;
      
      // Use country-aware shift selection
      const applicableShift = await getApplicableShiftTimes({
        teamId: config.teamId,
        regionCode: userRegionCode || undefined,
        countryCode: userCountryCode,
        shiftType: requestedShiftType,
        dayOfWeek,
        date: dateStr,
        shiftTimeDefinitionId: shiftDefinitionId || undefined,
      });
      
      if (!applicableShift) {
        console.warn(`⚠️ No applicable shift found for ${dateStr}, skipping`);
        continue;
      }
      
      console.log(`✅ Using shift for ${userCountryCode}: ${applicableShift.description || `${applicableShift.startTime}-${applicableShift.endTime}`}`);
      
      let resolvedShiftType: ShiftType = requestedShiftType;

      // Include shift times in notes so they display correctly
      const shiftTimesJson = JSON.stringify([{
        activity_type: 'work',
        start_time: applicableShift.startTime,
        end_time: applicableShift.endTime
      }]);
      
      const notes = shouldUseWeekendShift 
        ? `Bulk generated (rotation) - ${userHolidayInfo?.holidayName || 'Weekend'}\nShift: ${applicableShift.description}\nTimes: ${shiftTimesJson}`
        : `Bulk generated (rotation)\nShift: ${applicableShift.description}\nTimes: ${shiftTimesJson}`;

      console.log(`📝 Creating entry for ${rotationUserId} on ${dateStr}: shift_type=${resolvedShiftType}`);

      entries.push({
        user_id: rotationUserId,
        team_id: config.teamId,
        date: dateStr,
        shift_type: resolvedShiftType,
        shift_time_definition_id: applicableShift.id.startsWith('default-') ? null : applicableShift.id,
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
        
        // Get user's country code
        const userCountryCode = userCountryMap.get(targetUserId);
        const userRegionCode = userRegionMap.get(targetUserId);
        console.log(`🌍 User ${targetUserId} location: ${userCountryCode}/${userRegionCode}`);
        
        // Determine which shift type to request
        let requestedShiftType: ShiftType = shouldUseWeekendShift ? 'weekend' : selectedShiftEnumType;
        
        // Use country-aware shift selection
        const applicableShift = await getApplicableShiftTimes({
          teamId: config.teamId,
          regionCode: userRegionCode || undefined,
          countryCode: userCountryCode,
          shiftType: requestedShiftType,
          dayOfWeek,
          date: dateStr,
          shiftTimeDefinitionId: shiftDefinitionId || undefined,
        });
        
        if (!applicableShift) {
          console.warn(`⚠️ No applicable shift found for ${targetUserId} on ${dateStr}, skipping`);
          continue;
        }
        
        console.log(`✅ Using shift for ${userCountryCode}: ${applicableShift.description || `${applicableShift.startTime}-${applicableShift.endTime}`}`);
        
        let resolvedShiftType: ShiftType = requestedShiftType;
        
        // Include shift times in notes so they display correctly
        const shiftTimesJson = JSON.stringify([{
          activity_type: 'work',
          start_time: applicableShift.startTime,
          end_time: applicableShift.endTime
        }]);
        
        const notes = shouldUseWeekendShift 
          ? `Bulk generated - ${userHolidayInfo?.holidayName || 'Weekend'}\nShift: ${applicableShift.description}\nTimes: ${shiftTimesJson}`
          : `Bulk generated\nShift: ${applicableShift.description}\nTimes: ${shiftTimesJson}`;

        console.log(`📝 Creating entry for ${targetUserId} on ${dateStr}: shift_type=${resolvedShiftType}`);

        entries.push({
          user_id: targetUserId,
          team_id: config.teamId,
          date: dateStr,
          shift_type: resolvedShiftType,
          shift_time_definition_id: applicableShift.id.startsWith('default-') ? null : applicableShift.id,
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
