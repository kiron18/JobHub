import { describe, it, expect, vi, beforeEach } from 'vitest';
import { needsVerification, verificationCost } from './verifySlots';
import type { Pick, Slots } from './directoryPick';

const pick = (over: Partial<Pick> = {}): Pick => ({
    name: 'Sarah Chen',
    email: 'sarah.chen@acme.com.au',
    position: 'Head of Analytics',
    department: 'it',
    verification: null,
    why: [],
    ...over,
});

const slots = (over: Partial<Slots> = {}): Slots => ({
    talent: null, hiring_manager: null, team_insider: null, ...over,
});

describe('needsVerification', () => {
    it('checks an address Hunter never tested', () => {
        // The best pick at AUS-MEAT arrived exactly like this: a real address
        // Hunter held but had never verified.
        expect(needsVerification(pick({ verification: null }))).toBe(true);
    });

    it('does not re-check what Hunter already tested', () => {
        for (const status of ['valid', 'invalid', 'accept_all', 'webmail', 'disposable', 'unknown']) {
            expect(needsVerification(pick({ verification: status }))).toBe(false);
        }
    });

    it('never spends a credit on an empty slot or a person with no address', () => {
        expect(needsVerification(null)).toBe(false);
        expect(needsVerification(pick({ email: '' }))).toBe(false);
    });
});

describe('verificationCost', () => {
    it('is half a credit per unchecked address', () => {
        expect(verificationCost(slots({
            talent: pick({ verification: null }),
            hiring_manager: pick({ verification: null }),
        }))).toBe(1);
    });

    it('charges nothing when Hunter already checked everyone', () => {
        expect(verificationCost(slots({
            talent: pick({ verification: 'valid' }),
            hiring_manager: pick({ verification: 'accept_all' }),
        }))).toBe(0);
    });

    it('is zero for an empty directory', () => {
        expect(verificationCost(slots())).toBe(0);
    });
});

describe('verifySlots', () => {
    beforeEach(() => vi.resetModules());

    it('keeps the old status when the verifier fails', async () => {
        // Hunter being unreachable is not evidence about a mailbox. Dropping a
        // real contact because a call timed out is the worse error.
        vi.doMock('./hunterDirectory', () => ({ verifyEmail: vi.fn().mockResolvedValue(null) }));
        const { verifySlots } = await import('./verifySlots');
        const out = await verifySlots(slots({ hiring_manager: pick({ verification: null }) }));
        expect(out.hiring_manager?.verification).toBeNull();
        expect(out.hiring_manager?.email).toBe('sarah.chen@acme.com.au');
    });

    it('stamps the status it gets back', async () => {
        vi.doMock('./hunterDirectory', () => ({ verifyEmail: vi.fn().mockResolvedValue('valid') }));
        const { verifySlots } = await import('./verifySlots');
        const out = await verifySlots(slots({ talent: pick({ verification: null }) }));
        expect(out.talent?.verification).toBe('valid');
    });

    it('spends nothing when every address already carries a status', async () => {
        const verifyEmail = vi.fn().mockResolvedValue('valid');
        vi.doMock('./hunterDirectory', () => ({ verifyEmail }));
        const { verifySlots } = await import('./verifySlots');
        await verifySlots(slots({
            talent: pick({ verification: 'valid' }),
            hiring_manager: pick({ verification: 'accept_all' }),
        }));
        expect(verifyEmail).not.toHaveBeenCalled();
    });

    it('keeps an invalid address rather than silently dropping the slot', async () => {
        // The card reads the status and can say the address failed. A
        // candidate who can see that is better served than one shown three
        // slots when four people were found.
        vi.doMock('./hunterDirectory', () => ({ verifyEmail: vi.fn().mockResolvedValue('invalid') }));
        const { verifySlots } = await import('./verifySlots');
        const out = await verifySlots(slots({ team_insider: pick({ verification: null }) }));
        expect(out.team_insider).not.toBeNull();
        expect(out.team_insider?.verification).toBe('invalid');
    });
});
