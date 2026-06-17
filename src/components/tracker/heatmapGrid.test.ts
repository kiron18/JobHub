import { describe, it, expect } from 'vitest';
import { intensityLevel } from './heatmapGrid';

describe('intensityLevel', () => {
  it('maps counts to 0..4 with goal as the top bucket', () => {
    expect(intensityLevel(0)).toBe(0);
    expect(intensityLevel(1)).toBe(1);
    expect(intensityLevel(2)).toBe(1);
    expect(intensityLevel(3)).toBe(2);
    expect(intensityLevel(4)).toBe(3);
    expect(intensityLevel(5)).toBe(4);
    expect(intensityLevel(9)).toBe(4); // goal met/exceeded = darkest
  });
});
