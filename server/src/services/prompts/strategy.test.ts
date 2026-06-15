import { describe, it, expect } from 'vitest';
import { STRATEGY_BLUEPRINT_PROMPT } from './strategy';

const profile = { name: 'Jane Doe', professionalSummary: 'Operator.', skills: {} } as any;
const achievements = [
  { id: 'ach-1', title: 'Cut costs', metric: '20%' },
  { id: 'ach-2', title: 'Led migration', metric: null },
];

describe('STRATEGY_BLUEPRINT_PROMPT — confirmed-achievement coverage guarantee', () => {
  it('forces a proofPoint for EVERY achievement when the user confirmed them', () => {
    const out = STRATEGY_BLUEPRINT_PROMPT('JD', profile, achievements, 'RESUME', null, true);
    expect(out).toContain('EXPLICITLY CONFIRMED');
    expect(out).toContain('MUST create a proofPoint entry for EVERY one');
    // The drop-filter language must NOT be present in confirmed mode.
    expect(out).not.toContain('decide whether it warrants a proofPoint entry');
  });

  it('keeps the JD-relevance filter when achievements were not user-confirmed', () => {
    const out = STRATEGY_BLUEPRINT_PROMPT('JD', profile, achievements, 'RESUME', null, false);
    expect(out).toContain('decide whether it warrants a proofPoint entry');
    expect(out).not.toContain('EXPLICITLY CONFIRMED');
  });

  it('defaults to the filter behaviour when the flag is omitted (back-compat)', () => {
    const out = STRATEGY_BLUEPRINT_PROMPT('JD', profile, achievements, 'RESUME');
    expect(out).toContain('decide whether it warrants a proofPoint entry');
  });
});
