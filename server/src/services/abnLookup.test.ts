import { describe, it, expect } from 'vitest';
import { looksLikeAcronym, MIN_MATCH_SCORE } from './abnLookup';

describe('looksLikeAcronym', () => {
    it('catches the names that made the domain search fail', () => {
        // Both resolved to an unrelated organisation in the bake-off, because
        // the search had nothing distinctive to go on.
        expect(looksLikeAcronym('BHL')).toBe(true);
        expect(looksLikeAcronym('AC3')).toBe(true);
        expect(looksLikeAcronym('DBG')).toBe(true);
    });

    it('leaves a real company name alone', () => {
        // These search perfectly well as written, and swapping them for a
        // registered legal name would search worse, not better.
        expect(looksLikeAcronym('Bank Australia')).toBe(false);
        expect(looksLikeAcronym('Australian Venue Co.')).toBe(false);
        expect(looksLikeAcronym('Centorrino Technologies')).toBe(false);
        expect(looksLikeAcronym('Dispensary on Lygon Pty Ltd')).toBe(false);
    });

    it('does not treat a single ordinary word as an acronym', () => {
        // "Bioscience" is a bad search term, but it is not an acronym and the
        // register will not have a better name for it either.
        expect(looksLikeAcronym('Bioscience')).toBe(false);
        expect(looksLikeAcronym('Randstad')).toBe(false);
    });
});

describe('the match threshold', () => {
    it('is high, because ABR answers almost anything', () => {
        // ABR's matcher is generous by design. A mid-scoring match sends the
        // domain search after an unrelated business, which is the exact
        // failure this service exists to prevent.
        expect(MIN_MATCH_SCORE).toBeGreaterThanOrEqual(90);
    });
});
