import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { prisma } from '../index';
import type { RawJob } from './jobFeed';

// ─── Constants ───────────────────────────────────────────────────────────────
export const SEEK_HOST = 'https://au.seek.com';
export const SEEK_CANONICAL_HOST = 'https://www.seek.com.au';
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
export const SEEK_REQUEST_TIMEOUT = 15_000;
export const SEEK_DETAIL_TIMEOUT = 12_000;
export const MAX_PAGES = 3;
export const DETAIL_CONCURRENCY = 4;

export const ENTRY_LEVEL_QUALIFIERS = 'entry level graduate junior starter';

export function buildEntryLevelSearchTerm(roles: string[]): string {
  const cleaned = roles.map((r) => r.trim()).filter((r) => r.length > 0);
  return `${ENTRY_LEVEL_QUALIFIERS} ${cleaned.join(' ')}`.trim();
}

export function stripEntryLevelQualifiers(role: string): string {
  const prefix = `${ENTRY_LEVEL_QUALIFIERS} `;
  if (role.toLowerCase().startsWith(prefix)) return role.slice(prefix.length).trim();
  return role.trim();
}

export interface SeekHtmlClusterKey {
  role: string;
  city: string;
  industry: string;
  hash: string;
}

export function buildSeekSearchUrl(role: string, city: string, dateRange?: number): string {
  const cleanRole = stripEntryLevelQualifiers(role);
  const roleSlug = cleanRole
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const citySlug = city
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('-');
  const dr = dateRange ?? 7;
  return `${SEEK_HOST}/${roleSlug}-jobs/in-${citySlug}?daterange=${dr}`;
}

export function buildSeekClusterKey(
  targetRole: string,
  targetCity: string,
  industry: string | null,
): SeekHtmlClusterKey {
  const role = targetRole.trim();
  const city = targetCity.trim().split(',')[0].trim().toLowerCase();
  const ind = (industry ?? '').trim().toLowerCase();
  const raw = `seek-html|${role.toLowerCase()}|${city}|${ind}`;
  return {
    role,
    city,
    industry: industry ?? '',
    hash: createHash('sha256').update(raw).digest('hex'),
  };
}

// ─── Relative date parsing ─────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

export function parseRelativeDate(text: string | null, now: Date = new Date()): Date | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\btoday\b/.test(t)) return now;
  if (/\byesterday\b/.test(t)) return new Date(now.getTime() - DAY_MS);
  const m = t.match(/(\d+)\s*\+?\s*(months?|mo|weeks?|w|days?|d|hours?|h|minutes?|min|m)\b/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  let ms = 0;
  if (unit.startsWith('mo') || unit.startsWith('month')) ms = n * 30 * DAY_MS;
  else if (unit.startsWith('w')) ms = n * 7 * DAY_MS;
  else if (unit.startsWith('d')) ms = n * DAY_MS;
  else if (unit.startsWith('h')) ms = n * 3_600_000;
  else if (unit === 'm' || unit.startsWith('min')) ms = n * 60_000;
  return ms ? new Date(now.getTime() - ms) : null;
}
