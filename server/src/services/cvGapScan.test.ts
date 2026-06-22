import { describe, it, expect } from 'vitest';
import { deriveScanMetrics } from './cvGapScan';

describe('deriveScanMetrics', () => {
  const signals = { bulletCount: 14, quantificationRatio: 0.3, dutyOpeningCount: 10 };

  it('passes through signals, ats, and keyword counts', () => {
    const m = deriveScanMetrics(
      signals,
      { risk: true, reasons: ['Built in text boxes'] },
      ['agile', 'stakeholder', 'sql', 'python'],
      ['agile', 'sql'],
    );
    expect(m.atsRisk).toBe(true);
    expect(m.atsReasons).toEqual(['Built in text boxes']);
    expect(m.dutyBullets).toBe(10);
    expect(m.totalBullets).toBe(14);
    expect(m.keywordsExpected).toBe(4);
    expect(m.keywordsPresent).toBe(2);
    expect(m.keywordsMissing).toEqual(['stakeholder', 'python']);
  });

  it('defaults ats to no-risk when undefined', () => {
    const m = deriveScanMetrics(signals, undefined, [], []);
    expect(m.atsRisk).toBe(false);
    expect(m.atsReasons).toEqual([]);
    expect(m.keywordsMissing).toEqual([]);
  });
});
