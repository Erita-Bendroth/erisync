/**
 * German FlexTime Utilities
 * Based on German working hours regulations:
 * - 38 hours/week standard
 * - 8 hours Mon-Thu, 6 hours Friday
 * - Working frame: 6 AM - 8 PM
 */

export interface TimeEntryData {
  workStartTime: string | null;
  workEndTime: string | null;
  breakDurationMinutes: number;
  entryType: string;
  fzaHours?: number | null;
}

export interface FlexTimeCalculation {
  targetHours: number;
  actualHours: number;
  flexDelta: number;
  grossHours: number;
  fzaHours?: number;
}

export type EntryType = 
  | 'work' 
  | 'home_office' 
  | 'sick_leave' 
  | 'team_meeting' 
  | 'training' 
  | 'vacation' 
  | 'public_holiday'
  | 'fza_withdrawal';

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  work: 'Regular Work',
  home_office: 'Home Office',
  sick_leave: 'Sick Leave',
  team_meeting: 'Team Meeting',
  training: 'Training',
  vacation: 'Vacation',
  public_holiday: 'Public Holiday',
  fza_withdrawal: 'FlexTime Withdrawal (FZA)',
};

export const ENTRY_TYPE_CONFIG: Record<EntryType, { 
  countsAsWork: boolean; 
  requiresTimeEntry: boolean;
  defaultTargetHours: 'normal' | 'zero';
  requiresHoursInput?: boolean;
  isWithdrawal?: boolean;
}> = {
  work: { countsAsWork: true, requiresTimeEntry: true, defaultTargetHours: 'normal' },
  home_office: { countsAsWork: true, requiresTimeEntry: true, defaultTargetHours: 'normal' },
  team_meeting: { countsAsWork: true, requiresTimeEntry: true, defaultTargetHours: 'normal' },
  training: { countsAsWork: true, requiresTimeEntry: true, defaultTargetHours: 'normal' },
  sick_leave: { countsAsWork: false, requiresTimeEntry: false, defaultTargetHours: 'zero' },
  vacation: { countsAsWork: false, requiresTimeEntry: false, defaultTargetHours: 'zero' },
  public_holiday: { countsAsWork: false, requiresTimeEntry: false, defaultTargetHours: 'zero' },
  fza_withdrawal: { countsAsWork: false, requiresTimeEntry: false, defaultTargetHours: 'zero', requiresHoursInput: true, isWithdrawal: true },
};

/**
 * Get target hours for a given day based on German standard
 * Mon-Thu: 8 hours, Friday: 6 hours, Weekend: 0 hours
 */
export function getTargetHours(date: Date): number {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  if (dayOfWeek === 0 || dayOfWeek === 6) return 0; // Weekend
  if (dayOfWeek === 5) return 6; // Friday
  return 8; // Mon-Thu
}

/**
 * Parse a time string (HH:mm) to hours as decimal
 */
export function parseTimeToHours(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + (minutes / 60);
}

/**
 * Convert decimal hours to time string (HH:mm)
 */
export function hoursToTimeString(hours: number): string {
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  const sign = hours < 0 ? '-' : '+';
  return `${sign}${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format hours as a display string with sign
 */
export function formatFlexHours(hours: number): string {
  const sign = hours >= 0 ? '+' : '';
  const h = Math.floor(Math.abs(hours));
  const m = Math.round((Math.abs(hours) - h) * 60);
  
  if (hours < 0) {
    return `-${h}:${m.toString().padStart(2, '0')}`;
  }
  return `${sign}${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Format hours as decimal string (e.g., "8.5h")
 */
export function formatDecimalHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

/**
 * Calculate actual hours worked from start/end time and break
 */
export function calculateActualHours(
  startTime: string | null,
  endTime: string | null,
  breakMinutes: number
): number {
  if (!startTime || !endTime) return 0;
  
  const startHours = parseTimeToHours(startTime);
  const endHours = parseTimeToHours(endTime);
  const breakHours = breakMinutes / 60;
  
  const grossHours = endHours - startHours;
  
  // German labor law: No mandatory break for ≤6 hours of work
  // Only deduct break if working more than 6 hours
  const netHours = grossHours <= 6 
    ? grossHours  // No break deduction for 6 hours or less
    : grossHours - breakHours;
  
  return Math.max(0, netHours);
}

/**
 * Calculate flextime delta
 */
export function calculateFlexDelta(
  targetHours: number,
  actualHours: number
): number {
  return actualHours - targetHours;
}

/**
 * Full flextime calculation
 */
export function calculateFlexTime(
  date: Date,
  data: TimeEntryData
): FlexTimeCalculation {
  const entryConfig = ENTRY_TYPE_CONFIG[data.entryType as EntryType] || ENTRY_TYPE_CONFIG.work;
  
  // Special handling for FZA withdrawal - negative flex delta based on hours input
  if (entryConfig.isWithdrawal && data.fzaHours) {
    return {
      targetHours: 0,
      actualHours: 0,
      flexDelta: -Math.abs(data.fzaHours), // Always negative for withdrawals
      grossHours: 0,
      fzaHours: Math.abs(data.fzaHours),
    };
  }
  
  // For non-work entry types (sick, vacation, holiday), target is 0 and no flex impact
  if (!entryConfig.countsAsWork) {
    return {
      targetHours: 0,
      actualHours: 0,
      flexDelta: 0,
      grossHours: 0,
    };
  }
  
  const targetHours = getTargetHours(date);
  const grossHours = data.workStartTime && data.workEndTime
    ? parseTimeToHours(data.workEndTime) - parseTimeToHours(data.workStartTime)
    : 0;
  const actualHours = calculateActualHours(
    data.workStartTime,
    data.workEndTime,
    data.breakDurationMinutes
  );
  const flexDelta = calculateFlexDelta(targetHours, actualHours);
  
  return {
    targetHours,
    actualHours,
    flexDelta,
    grossHours,
  };
}

/**
 * Validate break requirements based on German law
 * - After 6 hours: minimum 30 minutes break
 * - After 9 hours: minimum 45 minutes break
 */
export function validateBreakRequirements(
  actualHours: number,
  breakMinutes: number
): { valid: boolean; message?: string } {
  if (actualHours > 9 && breakMinutes < 45) {
    return {
      valid: false,
      message: 'Minimum 45 min break required when working more than 9 hours',
    };
  }
  if (actualHours > 6 && breakMinutes < 30) {
    return {
      valid: false,
      message: 'Minimum 30 min break required when working more than 6 hours',
    };
  }
  return { valid: true };
}

/**
 * Validate daily working hours limit (max 10 hours)
 */
export function validateDailyLimit(actualHours: number): { valid: boolean; message?: string } {
  if (actualHours > 10) {
    return {
      valid: false,
      message: 'Maximum 10 hours per day allowed by German law',
    };
  }
  return { valid: true };
}

/**
 * Get default start time based on entry type
 */
export function getDefaultStartTime(entryType: EntryType): string {
  switch (entryType) {
    case 'work':
    case 'home_office':
    case 'team_meeting':
    case 'training':
      return '08:00';
    default:
      return '';
  }
}

/**
 * Get default end time based on entry type and day
 */
export function getDefaultEndTime(date: Date, entryType: EntryType): string {
  const isFriday = date.getDay() === 5;
  
  switch (entryType) {
    case 'work':
    case 'home_office':
    case 'team_meeting':
    case 'training':
      return isFriday ? '14:30' : '16:30'; // 8:00 + 8h + 30min break or 8:00 + 6h + 30min break
    default:
      return '';
  }
}
