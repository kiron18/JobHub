import { describe, it, expect } from 'vitest';
import { beatImage, ALL_SCAN_IMAGES } from './scanImages';

describe('beatImage', () => {
  it('resolves every beat to a slugged png under /images/scan/', () => {
    for (const beat of ['wound', 'stakes', 'relief', 'wall', 'cure'] as const) {
      expect(beatImage(beat)).toMatch(/^\/images\/scan\/scan-[a-z-]+\.png$/);
    }
  });

  it('alternates gender across beats (a mix, not all one)', () => {
    const males = ALL_SCAN_IMAGES.filter(p => p.includes('-male')).length;
    const females = ALL_SCAN_IMAGES.filter(p => p.includes('-female')).length;
    expect(males).toBeGreaterThan(0);
    expect(females).toBeGreaterThan(0);
  });
});
