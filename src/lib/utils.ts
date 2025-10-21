import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a user's name for display
 * - If last_name is empty, treats first_name as initials and returns as-is
 * - Otherwise, returns "first_name last_name"
 * This ensures compatibility with both initials-only users and full-name users
 */
export function formatUserName(firstName: string, lastName?: string | null): string {
  if (!lastName || lastName.trim() === '') {
    // For initials-only users, first_name contains the initials
    return firstName;
  }
  // For users with full names
  return `${firstName} ${lastName}`.trim();
}
