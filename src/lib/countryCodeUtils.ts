/**
 * Country code normalization utilities
 * Handles variations like UK/GB to ensure proper matching
 */

/**
 * Maps common country code variations to their ISO 3166-1 alpha-2 standard codes
 */
const COUNTRY_CODE_MAP: Record<string, string> = {
  // UK variations → GB (official ISO code)
  'UK': 'GB',
  'GB': 'GB',
  
  // Keep standard ISO codes as-is
  'AT': 'AT', 'BE': 'BE', 'CH': 'CH', 'DE': 'DE',
  'DK': 'DK', 'ES': 'ES', 'FI': 'FI', 'FR': 'FR',
  'IE': 'IE', 'IT': 'IT', 'NL': 'NL', 'NO': 'NO',
  'PL': 'PL', 'PT': 'PT', 'SE': 'SE',
};

/**
 * Normalizes a country code to its ISO 3166-1 alpha-2 standard
 * @param code - Country code (e.g., 'UK', 'GB', 'NL')
 * @returns Normalized ISO code (e.g., 'GB', 'NL') or original if not mapped
 */
export function normalizeCountryCode(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  const upperCode = code.toUpperCase().trim();
  return COUNTRY_CODE_MAP[upperCode] || upperCode;
}

/**
 * Checks if a country code matches any code in a list, with normalization
 * @param userCode - User's country code (e.g., 'GB')
 * @param shiftCodes - Array of country codes from shift definition (e.g., ['UK', 'IE', 'NO'])
 * @returns true if normalized codes match
 */
export function matchesCountryCode(
  userCode: string | undefined | null,
  shiftCodes: string[] | null | undefined
): boolean {
  if (!userCode || !shiftCodes || shiftCodes.length === 0) {
    return false;
  }
  
  const normalizedUserCode = normalizeCountryCode(userCode);
  if (!normalizedUserCode) return false;
  
  // Normalize all shift codes and check for match
  const normalizedShiftCodes = shiftCodes.map(code => normalizeCountryCode(code));
  return normalizedShiftCodes.includes(normalizedUserCode);
}
