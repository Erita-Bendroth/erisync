/**
 * Country (ISO 3166-1 alpha-2) → IANA timezone mapping.
 * Covers all countries currently supported in countryCodeUtils.
 * Uses the canonical "primary" timezone for each country.
 */
import { normalizeCountryCode } from "./countryCodeUtils";

const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  AT: "Europe/Vienna",
  BE: "Europe/Brussels",
  CH: "Europe/Zurich",
  DE: "Europe/Berlin",
  DK: "Europe/Copenhagen",
  ES: "Europe/Madrid",
  FI: "Europe/Helsinki",
  FR: "Europe/Paris",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  IT: "Europe/Rome",
  NL: "Europe/Amsterdam",
  NO: "Europe/Oslo",
  PL: "Europe/Warsaw",
  PT: "Europe/Lisbon",
  SE: "Europe/Stockholm",
};

export const DEFAULT_TIMEZONE = "Europe/Berlin";

export function getTimezoneForCountry(
  code: string | null | undefined
): string {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return DEFAULT_TIMEZONE;
  return COUNTRY_TIMEZONE_MAP[normalized] ?? DEFAULT_TIMEZONE;
}

export function listSupportedCountries(): string[] {
  return Object.keys(COUNTRY_TIMEZONE_MAP);
}