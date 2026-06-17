import { describe, it, expect } from 'vitest';
import { relevanceScore } from './relevance';

describe('relevanceScore', () => {
  it('scores an exact title match at 1', () => {
    expect(relevanceScore('Marketing Coordinator', 'Marketing Coordinator')).toBeCloseTo(1, 5);
  });
  it('scores a partial overlap between 0 and 1', () => {
    const s = relevanceScore('Marketing Assistant', 'Marketing Coordinator');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
  it('scores an unrelated title low', () => {
    expect(relevanceScore('Content Producer', 'Marketing Coordinator')).toBeLessThan(0.34);
  });
});
