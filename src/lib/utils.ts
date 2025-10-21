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
  // Priority 1: Use dedicated initials field if available
  if (initials && initials.trim() !== '') {
    return initials;
  }
  
  // Priority 2: If last_name is empty, first_name might contain initials
  if (!lastName || lastName.trim() === '') {
    return firstName || '';
  }
  
  // Priority 3: For users with full names
  return `${firstName} ${lastName}`.trim();
}

/**
 * Extract time from notes or use default shift times
 */
export function getShiftTimes(notes: string | null | undefined, shiftType: string): { start: string; end: string } {
  // Try to extract from JSON format first
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
  
  // Default shift times
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
 * - 01:00 to 07:30 (night shift ending in morning)
 * - 00:00 to 08:00 (midnight to morning)
 */
export function doesShiftCrossMidnight(startTime: string, endTime: string): boolean {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Shift crosses midnight if end time is earlier than start time
  // OR if shift starts after midnight (00:00-06:00) and ends in early morning
  return endMinutes < startMinutes || (startHour >= 0 && startHour < 6 && endHour >= 0 && endHour < 12);
}

/**
 * Check if a time falls within the "continuation" period (morning hours)
 * This is used to determine if we should show the end portion of a night shift
 */
export function isInContinuationPeriod(time: string): boolean {
  const [hour] = time.split(':').map(Number);
  return hour >= 0 && hour < 12; // Consider anything before noon as potential continuation
}
