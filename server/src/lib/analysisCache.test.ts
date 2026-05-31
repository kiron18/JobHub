import { describe, it, expect } from 'vitest';
import { readAnalysisCache, writeAnalysisCache } from './analysisCache';

const TTL = 1000;

describe('readAnalysisCache', () => {
  it('returns the analysis on a fresh hit', () => {
    const cache = { h1: { analysis: { pct: 60 }, at: 100 } };
    expect(readAnalysisCache(cache, 'h1', 200, TTL)).toEqual({ pct: 60 });
  });
  it('returns null on miss', () => {
    expect(readAnalysisCache({ h1: { analysis: {}, at: 100 } }, 'nope', 200, TTL)).toBeNull();
  });
  it('returns null when expired', () => {
    expect(readAnalysisCache({ h1: { analysis: {}, at: 100 } }, 'h1', 100 + TTL + 1, TTL)).toBeNull();
  });
  it('returns null for non-object cache', () => {
    expect(readAnalysisCache(null, 'h1', 0, TTL)).toBeNull();
    expect(readAnalysisCache(undefined, 'h1', 0, TTL)).toBeNull();
  });
});

describe('writeAnalysisCache', () => {
  it('adds an entry', () => {
    const next = writeAnalysisCache({}, 'h1', { pct: 40 }, 100);
    expect(next.h1).toEqual({ analysis: { pct: 40 }, at: 100 });
  });
  it('bounds to the most recent N entries', () => {
    let cache: any = {};
    for (let i = 0; i < 15; i++) cache = writeAnalysisCache(cache, `h${i}`, { i }, i);
    expect(Object.keys(cache).length).toBe(10);
    // newest kept, oldest evicted
    expect(cache['h14']).toBeDefined();
    expect(cache['h0']).toBeUndefined();
  });
  it('does not mutate the input object', () => {
    const input = { h1: { analysis: {}, at: 1 } };
    writeAnalysisCache(input, 'h2', {}, 2);
    expect(Object.keys(input)).toEqual(['h1']);
  });
});
