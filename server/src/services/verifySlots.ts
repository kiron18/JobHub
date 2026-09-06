/**
 * Check the mailboxes we are about to hand a candidate, but only the ones
 * nobody has checked yet.
 *
 * Hunter returns a verification status with SOME directory records and not
 * others. The best pick at AUS-MEAT, a Head of People, arrived with no status
 * at all: Hunter held her address but had never tested it. So a blanket
 * re-verify would spend a credit re-confirming what Hunter already told us,
 * on every slot, on every application.
 *
 * Verification is billed separately at half a credit, so on three slots the
 * blanket version costs 1.5 credits against the 2 the directory itself cost.
 * Skipping the records that already carry a status typically halves that, and
 * it is the same answer either way.
 *
 * A failed check leaves the status as it was rather than marking the address
 * bad. Hunter being unreachable is not evidence about a mailbox, and dropping
 * a real contact because a verification call timed out is a worse error than
 * showing one whose status we could not refresh.
 */
import { verifyEmail } from './hunterDirectory';
import type { Slots, Pick } from './directoryPick';

/**
 * Statuses that mean this address needs no credit spent on it.
 *
 * 'jd' is ours, not Hunter's: it marks an address printed in the job ad, which
 * the employer published as the way to reach them. Verifying that would be
 * paying to second-guess the employer about their own mailbox.
 */
const ALREADY_CHECKED = new Set(['valid', 'invalid', 'accept_all', 'disposable', 'webmail', 'unknown', 'jd']);

export function needsVerification(pick: Pick | null): boolean {
    if (!pick?.email) return false;
    return !pick.verification || !ALREADY_CHECKED.has(pick.verification);
}

/**
 * Verify every slot that carries an unchecked address, in parallel.
 *
 * Returns a new Slots. `invalid` is left in place rather than nulling the slot:
 * the card reads the status and can say so, and a candidate who can see that
 * an address failed is better served than one shown three slots when we found
 * four people. Filtering happens where it is displayed, not here.
 */
export async function verifySlots(slots: Slots): Promise<Slots> {
    const entries = Object.entries(slots) as Array<[keyof Slots, Pick | null]>;

    const checked = await Promise.all(
        entries.map(async ([role, pick]) => {
            if (!needsVerification(pick)) return [role, pick] as const;
            const status = await verifyEmail(pick!.email);
            // A null status is Hunter failing, not a verdict. Keep what we had.
            return [role, status ? { ...pick!, verification: status } : pick] as const;
        }),
    );

    return Object.fromEntries(checked) as Slots;
}

/** How many credits a verification pass over these slots will cost. */
export function verificationCost(slots: Slots): number {
    return Object.values(slots).filter(needsVerification).length * 0.5;
}
