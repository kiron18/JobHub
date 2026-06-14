import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import {
  ENTRY_LEVEL_QUALIFIERS,
  buildEntryLevelSearchTerm,
  stripEntryLevelQualifiers,
  buildSeekSearchUrl,
  buildSeekClusterKey,
  parseRelativeDate,
  parseSearchResultsPage,
  extractPageInfo,
} from './seekHtmlScraper';

const searchHtml = readFileSync(join(__dirname, '__fixtures__/seek-search.html'), 'utf8');

describe('qualifier helpers', () => {
  it('builds the entry-level search term', () => {
    expect(buildEntryLevelSearchTerm(['Laboratory Technician'])).toBe(
      'entry level graduate junior starter Laboratory Technician',
    );
  });
  it('strips the qualifier prefix back off', () => {
    const term = buildEntryLevelSearchTerm(['Laboratory Technician']);
    expect(stripEntryLevelQualifiers(term)).toBe('Laboratory Technician');
  });
  it('leaves a clean role untouched', () => {
    expect(stripEntryLevelQualifiers('Laboratory Technician')).toBe('Laboratory Technician');
  });
});

describe('buildSeekSearchUrl', () => {
  it('produces a clean au.seek.com slug from a qualifier-prefixed role', () => {
    const term = buildEntryLevelSearchTerm(['Laboratory Technician']);
    expect(buildSeekSearchUrl(term, 'sydney')).toBe(
      'https://au.seek.com/laboratory-technician-jobs/in-Sydney?daterange=7',
    );
  });
  it('honours a custom date range', () => {
    expect(buildSeekSearchUrl('Nurse', 'Melbourne', 14)).toBe(
      'https://au.seek.com/nurse-jobs/in-Melbourne?daterange=14',
    );
  });
});

describe('buildSeekClusterKey', () => {
  it('trims, lowercases the city, and is deterministic', () => {
    const a = buildSeekClusterKey('  Engineer  ', 'Melbourne, VIC', 'Tech');
    const b = buildSeekClusterKey('Engineer', 'Melbourne', 'Tech');
    expect(a.city).toBe('melbourne');
    expect(a.hash).toBe(b.hash);
  });
  it('differs by role', () => {
    expect(buildSeekClusterKey('A', 'Sydney', null).hash).not.toBe(
      buildSeekClusterKey('B', 'Sydney', null).hash,
    );
  });
});

describe('parseRelativeDate', () => {
  const NOW = new Date('2026-06-14T00:00:00.000Z');
  it('parses "6d ago" to 6 days before now', () => {
    const d = parseRelativeDate('6d ago', NOW)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-08');
  });
  it('parses "Posted 3d ago"', () => {
    const d = parseRelativeDate('Posted 3d ago', NOW)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-11');
  });
  it('parses "Today" as now', () => {
    expect(parseRelativeDate('Today', NOW)!.toISOString()).toBe(NOW.toISOString());
  });
  it('parses "30+ days ago"', () => {
    const d = parseRelativeDate('30+ days ago', NOW)!;
    expect(d.toISOString().slice(0, 10)).toBe('2026-05-15');
  });
  it('returns null for "Featured" and empty input', () => {
    expect(parseRelativeDate('Featured', NOW)).toBeNull();
    expect(parseRelativeDate(null, NOW)).toBeNull();
  });
});

describe('parseSearchResultsPage (fixture)', () => {
  const cards = parseSearchResultsPage(searchHtml);
  it('extracts all 32 cards', () => {
    expect(cards.length).toBe(32);
  });
  it('extracts the first card fields', () => {
    const c = cards[0];
    expect(c.jobId).toBe('92646985');
    expect(c.title).toBe('Product Technologist - Gummies Development and Manufacturing');
    expect(c.company).toBe('Essence Group');
  });
  it('dedupes the doubled location text', () => {
    expect(cards[0].location).toBe('Sydney NSW'); // not "Sydney NSW, Sydney NSW"
  });
  it('keeps a parseable relative date and nulls "Featured"', () => {
    const dated = cards.find((c) => c.jobId === '92578601')!;
    expect(dated.relativeDate).toMatch(/ago/i);
    expect(cards[0].relativeDate).toBeNull(); // first card is Featured
  });
  it('builds the au.seek.com fetch url and www canonical sourceUrl', () => {
    expect(cards[0].searchUrl).toBe('https://au.seek.com/job/92646985');
    expect(cards[0].sourceUrl).toBe('https://www.seek.com.au/job/92646985');
  });
});

describe('extractPageInfo (fixture)', () => {
  it('reads totalCount/pageSize and computes 3 pages', () => {
    const info = extractPageInfo(searchHtml);
    expect(info.pageSize).toBe(32);
    expect(info.totalPages).toBe(3);
  });
});
