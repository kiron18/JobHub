import type { CoverLetterData } from './coverLetterData';

/**
 * PolishPayload for cover letters — the validated JSON shape from the LLM.
 */
export interface CoverLetterPolishPayload {
  salutation?: string;
  p1?: string;
  p2?: string;
  p3?: string;
  p4?: string;
  signoff?: string;
}

/**
 * applyCoverLetterPolish — merges validated LLM polish JSON into a base
 * CoverLetterData. Uses replace semantics per slot: if the polish provides
 * a value for a slot, it replaces the base value entirely. Null/undefined
 * polish values keep the base value.
 *
 * Returns a new CoverLetterData — the input is never mutated.
 */
export function applyCoverLetterPolish(
  base: CoverLetterData,
  polish: CoverLetterPolishPayload | null
): CoverLetterData {
  if (!polish) return base;

  return {
    salutation: polish.salutation ?? base.salutation,
    p1: polish.p1 ?? base.p1,
    p2: polish.p2 ?? base.p2,
    p3: polish.p3 ?? base.p3,
    p4: polish.p4 ?? base.p4,
    signoff: polish.signoff ?? base.signoff,
  };
}
