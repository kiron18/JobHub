import { describe, it, expect } from 'vitest';
import {
  ENTRY_LEVEL_QUALIFIERS,
  buildEntryLevelSearchTerm,
  stripEntryLevelQualifiers,
  buildSeekSearchUrl,
  buildSeekClusterKey,
} from './seekHtmlScraper';

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
