/**
 * Location normalization utilities for job ingestion.
 * Fixes common typos in Australian state abbreviations and normalizes formats.
 */

// Common state typos and their corrections
const STATE_TYPO_MAP: Record<string, string> = {
  'nsq': 'NSW',
  'nsw': 'NSW',
  'vci': 'VIC',
  'vic': 'VIC',
  'qla': 'QLD',
  'qld': 'QLD',
  'wa': 'WA',
  'sa': 'SA',
  'tas': 'TAS',
  'act': 'ACT',
  'nt': 'NT',
};

const STATE_FULL_NAMES: Record<string, string> = {
  'new south wales': 'NSW',
  'victoria': 'VIC',
  'queensland': 'QLD',
  'western australia': 'WA',
  'south australia': 'SA',
  'tasmania': 'TAS',
  'australian capital territory': 'ACT',
  'northern territory': 'NT',
};

/**
 * Normalize a location string, fixing common state typos.
 * Examples:
 *   - "Griffith, NSQ" -> "Griffith, NSW"
 *   - "Sydney, nsw" -> "Sydney, NSW"
 *   - "Melbourne VIC" -> "Melbourne, VIC"
 */
export function normalizeLocation(location: string | null | undefined): string {
  if (!location) return '';

  let normalized = location.trim();

  // Extract potential state (last word after comma or space)
  const stateMatch = normalized.match(/[,\s]+([a-zA-Z]+)$/);
  if (stateMatch) {
    const potentialState = stateMatch[1].toLowerCase();
    const correctedState = STATE_TYPO_MAP[potentialState] || STATE_FULL_NAMES[potentialState];

    if (correctedState) {
      // Replace the typo with the correct state
      normalized = normalized.slice(0, -stateMatch[1].length) + correctedState;
    }
  }

  // Normalize whatever separator precedes the state (space, comma, or both) to exactly ", ".
  normalized = normalized.replace(/[,\s]+([A-Z]{2,3})$/, ', $1');

  return normalized;
}

/**
 * Extract city name from a location string.
 */
export function extractCity(location: string | null | undefined): string {
  if (!location) return '';
  return location.split(',')[0].trim();
}

/**
 * Extract state abbreviation from a location string.
 * Returns uppercase state code or empty string.
 */
export function extractState(location: string | null | undefined): string {
  if (!location) return '';
  const parts = location.split(',');
  if (parts.length < 2) return '';

  const potentialState = parts[parts.length - 1].trim().toLowerCase();
  return STATE_TYPO_MAP[potentialState] || STATE_FULL_NAMES[potentialState] || '';
}

/**
 * Check if a location string has a valid Australian state.
 */
export function hasValidState(location: string | null | undefined): boolean {
  if (!location) return false;
  const state = extractState(location);
  return !!state;
}
