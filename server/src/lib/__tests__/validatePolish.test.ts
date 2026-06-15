import { describe, it, expect } from 'vitest';
import { PolishPayloadSchema, parsePolishJson } from '../validatePolish';

describe('PolishPayloadSchema — new fields', () => {
  it('accepts targetRoleTitle', () => {
    const result = PolishPayloadSchema.parse({ targetRoleTitle: 'Seed Plant Operator' });
    expect(result.targetRoleTitle).toBe('Seed Plant Operator');
  });

  it('accepts experienceOrder array of strings', () => {
    const result = PolishPayloadSchema.parse({ experienceOrder: ['id1', 'id2'] });
    expect(result.experienceOrder).toEqual(['id1', 'id2']);
  });

  it('accepts pageBudgetWarning boolean', () => {
    const result = PolishPayloadSchema.parse({ pageBudgetWarning: true });
    expect(result.pageBudgetWarning).toBe(true);
  });

  it('accepts display enum on an experience entry', () => {
    const result = PolishPayloadSchema.parse({
      experience: [{ id: 'x', bullets: [], display: 'fold' }],
    });
    expect(result.experience![0].display).toBe('fold');
  });

  it('rejects invalid display value', () => {
    expect(() =>
      PolishPayloadSchema.parse({
        experience: [{ id: 'x', bullets: [], display: 'invisible' }],
      })
    ).toThrow();
  });

  it('accepts tips array on an experience entry', () => {
    const result = PolishPayloadSchema.parse({
      experience: [
        {
          id: 'x',
          bullets: ['Maintained water quality across aquaponics systems'],
          tips: [{ bulletIndex: 0, suggestion: 'Add what % yield improved' }],
        },
      ],
    });
    expect(result.experience![0].tips![0].suggestion).toBe('Add what % yield improved');
  });

  it('strips truly unknown fields (strip() still active)', () => {
    const result = PolishPayloadSchema.parse({ summary: 'ok', unknownField: 'gone' });
    expect((result as any).unknownField).toBeUndefined();
  });

  it('old callers without display or tips still parse', () => {
    const legacy = {
      experience: [{ id: 'x', bullets: ['b'], casual: false, australianLocal: true }],
    };
    expect(() => PolishPayloadSchema.parse(legacy)).not.toThrow();
  });
});

describe('parsePolishJson — backward compatibility', () => {
  it('parses legacy JSON format without new fields', () => {
    const raw = JSON.stringify({
      summary: 'ok',
      experience: [{ id: 'x', bullets: ['b'], casual: false, australianLocal: true }],
    });
    const result = parsePolishJson(raw);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('ok');
  });

  it('returns null for invalid JSON', () => {
    expect(parsePolishJson('not json')).toBeNull();
  });
});
