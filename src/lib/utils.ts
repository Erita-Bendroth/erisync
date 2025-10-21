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
