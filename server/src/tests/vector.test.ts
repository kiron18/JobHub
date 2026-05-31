import { describe, it, expect, beforeEach, vi } from 'vitest';

// Pinecone rejects null/undefined metadata values. Capture the upsert payload so
// we can assert indexAchievement never sends them. Env + mocks must exist before
// vector.ts is imported (it reads PINECONE_API_KEY and builds the client at load).
const { mockUpsert, mockNamespace, mockIndex } = vi.hoisted(() => {
  process.env.PINECONE_API_KEY = 'test-key';
  const mockUpsert = vi.fn().mockResolvedValue(undefined);
  const mockNamespace = vi.fn(() => ({ upsert: mockUpsert }));
  const mockIndex = vi.fn(() => ({ namespace: mockNamespace }));
  return { mockUpsert, mockNamespace, mockIndex };
});

vi.mock('@pinecone-database/pinecone', () => ({
  Pinecone: class {
    index = mockIndex;
  },
}));

vi.mock('../services/llm', () => ({
  embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

import { indexAchievement } from '../services/vector';

describe('indexAchievement — Pinecone metadata', () => {
  beforeEach(() => {
    mockUpsert.mockClear();
  });

  it('strips null/undefined metadata so a metric-less achievement still indexes', async () => {
    await indexAchievement('user-1', 'ach-1', 'Led PR for festival', {
      metric: null,
      metricType: undefined,
      skills: 'Public Relations',
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const meta = mockUpsert.mock.calls[0][0].records[0].metadata;

    // The bug: null/undefined reached Pinecone and the upsert was rejected.
    expect(meta).not.toHaveProperty('metric');
    expect(meta).not.toHaveProperty('metricType');
    expect(meta.skills).toBe('Public Relations');
    expect(meta.userId).toBe('user-1');
    expect(meta.type).toBe('achievement');

    // No surviving metadata value may be null/undefined.
    for (const value of Object.values(meta)) {
      expect(value).not.toBeNull();
      expect(value).not.toBeUndefined();
    }
  });
});
