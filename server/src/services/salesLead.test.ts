/**
 * The stage is derived rather than dragged, so these rules are the board.
 */
import { describe, it, expect } from 'vitest';
import { deriveStage } from './salesLead';

const T = new Date('2026-08-13T00:00:00Z');

describe('deriveStage', () => {
  it('starts at Lead with nothing known', () => {
    expect(deriveStage({})).toBe('Lead');
  });

  it('advances through the funnel as signals arrive', () => {
    expect(deriveStage({ registeredAt: T })).toBe('Registered');
    expect(deriveStage({ registeredAt: T, attendedAt: T })).toBe('Attended');
    expect(deriveStage({ registeredAt: T, attendedAt: T, reportSentAt: T })).toBe('Pitched');
  });

  it('keeps a paying client at Client even when they register again', () => {
    // The bug this replaces: booking a call used to demote paying clients out
    // of the pipeline. Highest reached wins, never most recent.
    expect(deriveStage({ paidAt: T, registeredAt: T })).toBe('Client');
  });

  it('reports Client on payment even with no earlier signals', () => {
    // Cold buyers pay through a payment link having never registered.
    expect(deriveStage({ paidAt: T })).toBe('Client');
  });

  it('reports Attended for someone who claimed but never registered on file', () => {
    expect(deriveStage({ attendedAt: T })).toBe('Attended');
  });
});
