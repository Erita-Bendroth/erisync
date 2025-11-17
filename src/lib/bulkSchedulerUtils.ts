import { format, eachDayOfInterval, isWeekend } from 'date-fns';
import { BulkSchedulerConfig } from '@/hooks/useBulkSchedulerState';
import { Database } from '@/integrations/supabase/types';

type ShiftType = Database['public']['Enums']['shift_type'];
type ActivityType = Database['public']['Enums']['activity_type'];
type AvailabilityStatus = Database['public']['Enums']['availability_status'];

export interface ScheduleEntryDraft {
  user_id: string;
  team_id: string;
  date: string;
  shift_type: ShiftType;
  activity_type: ActivityType;
  availability_status: AvailabilityStatus;
  created_by: string;
  notes?: string;
}

export const calculateBulkEntries = (
  config: BulkSchedulerConfig,
  allTeamMembers: Array<{ user_id: string }>,
  userId: string
): ScheduleEntryDraft[] => {
  if (!config.dateRange.start || !config.dateRange.end || !config.teamId) {
    return [];
  }

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

  // Generate entries
  for (const day of days) {
    // Skip weekends if configured
    if (config.skipWeekends && isWeekend(day)) {
      continue;
    }

    const dateStr = format(day, 'yyyy-MM-dd');

    if (config.mode === 'rotation' && config.advanced.rotationEnabled) {
      // Rotation mode: assign one user per day in sequence
      const dayIndex = days.indexOf(day);
      const userIndex = dayIndex % targetUsers.length;
      const rotationUserId = targetUsers[userIndex];

      entries.push({
        user_id: rotationUserId,
        team_id: config.teamId,
        date: dateStr,
        shift_type: config.shiftType as ShiftType,
        activity_type: 'work' as ActivityType,
        availability_status: 'available' as AvailabilityStatus,
        created_by: userId,
        notes: 'Bulk generated (rotation)',
      });
    } else {
      // Regular mode: assign to all selected users
      for (const targetUserId of targetUsers) {
        entries.push({
          user_id: targetUserId,
          team_id: config.teamId,
          date: dateStr,
          shift_type: config.shiftType as ShiftType,
          activity_type: 'work' as ActivityType,
          availability_status: 'available' as AvailabilityStatus,
          created_by: userId,
          notes: 'Bulk generated',
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
