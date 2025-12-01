import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a user's name for display
 * - If initials exist (separate field), returns them
 * - Otherwise if last_name is empty, treats first_name as initials and returns as-is
 * - Otherwise, returns "first_name last_name"
 * This ensures compatibility with both initials-only users and full-name users
 */
export function formatUserName(firstName: string, lastName?: string | null, initials?: string | null): string {
  // If we have both first and last name, show full name (not initials)
  if (lastName && lastName.trim() !== '') {
    return `${firstName} ${lastName}`.trim();
  }
  
  // If we only have initials field and no last name, use initials
  if (initials && initials.trim() !== '') {
    return initials;
  }
  
  // Fallback to first_name (which might be initials)
  return firstName || '';
}

/**
 * Extract time from notes or use default shift times
 */
export function getShiftTimes(
  notes: string | null | undefined, 
  shiftType: string,
  shiftDefinitionTimes?: { startTime: string; endTime: string } | null
): { start: string; end: string } {
  // Priority 1: Use shift definition times if provided
  if (shiftDefinitionTimes) {
    return { start: shiftDefinitionTimes.startTime, end: shiftDefinitionTimes.endTime };
  }
  
  // Priority 2: Try to extract from JSON format in notes
  if (notes) {
    const timeSplitPattern = /Times:\s*(.+)/;
    const match = notes.match(timeSplitPattern);
    
    if (match) {
      try {
        const timesData = JSON.parse(match[1]);
        if (Array.isArray(timesData) && timesData.length > 0) {
          return { start: timesData[0].start_time, end: timesData[0].end_time };
        }
      } catch (e) {
        // Continue to old format
      }
    }
    
    // Try old format: (HH:MM-HH:MM)
    const oldTimePattern = /\((\d{2}:\d{2})-(\d{2}:\d{2})\)/;
    const oldMatch = notes.match(oldTimePattern);
    if (oldMatch) {
      return { start: oldMatch[1], end: oldMatch[2] };
    }
  }
  
  // Priority 3: Default shift times as fallback
  switch (shiftType) {
    case 'early':
      return { start: '06:00', end: '14:30' };
    case 'late':
      return { start: '13:00', end: '21:30' };
    default:
      return { start: '08:00', end: '16:30' };
  }
}

/**
 * Check if a shift crosses midnight or ends in early morning
 * Examples: 
 * - 22:00 to 06:00 (crosses midnight)
 * - 23:00 to 07:30 (crosses midnight)
 * - 01:00 to 09:00 (early morning shift, does NOT cross midnight)
 */
export function doesShiftCrossMidnight(startTime: string, endTime: string): boolean {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Shift crosses midnight if end time is earlier than start time in clock terms
  // This catches shifts like 21:00 -> 06:00, 23:00 -> 07:30, etc.
  return endMinutes < startMinutes;
}

/**
 * Check if a time falls within the "continuation" period (morning hours)
 * This is used to determine if we should show the end portion of a night shift
 */
export function isInContinuationPeriod(time: string): boolean {
  const [hour] = time.split(':').map(Number);
  return hour >= 0 && hour < 12; // Consider anything before noon as potential continuation
}
