/**
 * Choose who to write to, from a directory of people who actually work there.
 *
 * This is the deterministic half of contact discovery, and it is deterministic
 * on purpose. Everything it needs arrives as a labelled field: Hunter hands us
 * a department and a seniority per person, so the two things contactFilter has
 * to infer from a Google snippet are simply given. No model call, no ranking, no
 * score. The same directory and the same job always produce the same contacts,
 * which means a bad pick can be reproduced and fixed rather than re-rolled.
 *
 * Three slots, filled independently:
 *
 *   talent          whoever handles hiring. Replies most often, so it is the
 *                   slot worth filling even when the others are empty.
 *   hiring_manager  someone senior in the vacancy's own function.
 *   team_insider    someone at the candidate's own level in that function, who
 *                   is the likeliest to answer honestly and the least likely
 *                   to be asked.
 *
 * Any slot may come back empty and that is a result, not a degradation. Nothing
 * here invents a contact to make three cards look full.
 *
 * The small-employer rule. contactFilter's sharpest limitation was that it did
 * not know headcount, so it rejected the COO who genuinely is the hiring
 * manager at a twelve-person firm. Hunter reports how many addresses it holds
 * for the domain, which is the first headcount signal this pipeline has ever
 * had, and below the threshold the founder and the executives become eligible.
 *
 * That count is Hunter's coverage rather than the company's payroll, so a large
 * hospital it barely knows will read as tiny. It is therefore treated as
 * permission to widen the seniority rule and never as evidence about the
 * company. The department check stays binding at every size.
 */
import { rankOfTitle, disciplinesOf, type OutreachRole } from './contactFilter';
import type { Directory, DirectoryPerson } from './hunterDirectory';

export interface DirectoryTarget {
    /** The advertised role. Sets both the discipline and the rung to match. */
    role: string;
}

export interface Pick {
    name: string;
    email: string;
    position: string | null;
    department: string | null;
    verification: string | null;
    /** Why this person, in plain words, for the evidence record. */
    why: string[];
}

export type Slots = Record<OutreachRole, Pick | null>;

/**
 * At or below this many known addresses, treat the employer as small enough
 * that its executives are plausibly the hiring managers.
 *
 * Ten, because that is roughly where a company stops having a separate person
 * for hiring. It is deliberately below the ten-record page size, so a directory
 * that filled its page is never treated as small.
 */
export const SMALL_ORG_MAX = 10;

/**
 * Hunter's department labels, translated into the vocabulary contactFilter
 * already speaks so that one set of rules governs both paths.
 *
 * `executive` and `management` map to nothing on purpose. They describe where
 * someone sits, not what they work on, and treating them as a discipline is
 * exactly how a CEO came to be matched against a junior analyst vacancy.
 */
const DEPARTMENT_TO_DISCIPLINE: Record<string, string[]> = {
    hr: ['talent'],
    it: ['engineering', 'it-support', 'data'],
    engineering: ['engineering', 'it-support'],
    finance: ['finance'],
    legal: ['legal'],
    sales: ['sales'],
    marketing: ['marketing'],
    communication: ['marketing'],
    support: ['customer', 'it-support'],
    design: ['design'],
    health: ['clinical'],
    education: ['education'],
    // Operations is its own function, not delivery. Conflating them made a
    // Commodity Coordinator read as a peer for a business analyst vacancy.
    operations: ['operations'],
    product: ['product'],
    executive: [],
    management: [],
};

/** Everything we know about what this person works on. */
function disciplinesFor(p: DirectoryPerson): string[] {
    const fromDept = DEPARTMENT_TO_DISCIPLINE[(p.department ?? '').toLowerCase()] ?? [];
    // The title is the better signal when it disagrees: Hunter files a "Head of
    // Cloud" under management, and management tells us nothing.
    return [...new Set([...fromDept, ...disciplinesOf(p.position)])];
}

function fullName(p: DirectoryPerson): string {
    return [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
}

/** A real human we can address by name, rather than info@ or careers@. */
function isAddressablePerson(p: DirectoryPerson): boolean {
    if (!p.email) return false;
    if ((p.type ?? '').toLowerCase() === 'generic') return false;
    if (p.verification === 'invalid') return false;
    return Boolean(p.firstName && p.lastName);
}

const FOUNDER = /\b(founder|co[-\s]?founder|owner|principal|managing\s+director|proprietor)\b/i;

function toPick(p: DirectoryPerson, why: string[]): Pick {
    return {
        name: fullName(p),
        email: p.email,
        position: p.position,
        department: p.department,
        verification: p.verification,
        why,
    };
}

/**
 * Fill the three slots from a directory.
 *
 * Order within a slot is settled by explicit preference rules rather than by a
 * score, so that every choice can be stated as a sentence in `why`.
 */
export function pickFromDirectory(directory: Directory, target: DirectoryTarget): Slots {
    const slots: Slots = { talent: null, hiring_manager: null, team_insider: null };

    const people = directory.people.filter(isAddressablePerson);
    if (!people.length) return slots;

    const isSmall = directory.total > 0 && directory.total <= SMALL_ORG_MAX;
    const roleRank = rankOfTitle(target.role);
    const roleDisciplines = disciplinesOf(target.role);

    // -- talent ---------------------------------------------------------------
    //
    // Anyone in HR, most senior first. Seniority is not a disqualifier here the
    // way it is for a hiring manager: a Head of People is a better contact than
    // an HR coordinator, not a worse one, because hiring is their remit at any
    // level.
    const talent = people
        .filter(p => (p.department ?? '').toLowerCase() === 'hr' || disciplinesFor(p).includes('talent'))
        .sort((a, b) => rankOfTitle(b.position) - rankOfTitle(a.position));

    if (talent[0]) {
        slots.talent = toPick(talent[0], [
            `${talent[0].position ?? 'HR'} at ${directory.domain}`,
            'handles hiring, so replying is part of the job',
        ]);
    }

    // -- hiring manager -------------------------------------------------------
    //
    // Senior, and in the vacancy's own function. When the role names no
    // discipline we can match on, this stays empty rather than falling back to
    // whoever is most senior, which is the mistake the LinkedIn path made.
    const inFunction = people.filter(p => {
        const d = disciplinesFor(p);
        return roleDisciplines.length > 0 && d.some(x => roleDisciplines.includes(x));
    });

    const managers = inFunction
        .filter(p => {
            const rank = rankOfTitle(p.position);
            const gap = rank - roleRank;
            // Senior to the vacancy AND actually in a leading role. Without the
            // second half a Software Developer one rung above a junior analyst
            // reads as their hiring manager, which he is not.
            return rank >= 2 && gap >= 1 && gap <= 4;
        })
        .sort((a, b) => rankOfTitle(a.position) - rankOfTitle(b.position)); // closest above first

    if (managers[0]) {
        slots.hiring_manager = toPick(managers[0], [
            `${managers[0].position ?? 'senior'} in ${managers[0].department ?? 'the same function'}`,
            'senior to the advertised role and in the same function',
        ]);
    } else if (isSmall) {
        // Small employer: nobody carries the exact function, so the person who
        // runs the place is the person who hires. This is the branch that only
        // exists because the directory told us how small they are.
        const exec = people
            .filter(p => FOUNDER.test(p.position ?? '') || rankOfTitle(p.position) >= 4)
            .sort((a, b) => rankOfTitle(b.position) - rankOfTitle(a.position));
        if (exec[0]) {
            slots.hiring_manager = toPick(exec[0], [
                `${exec[0].position ?? 'executive'} at a company with ${directory.total} known staff`,
                'small enough that the leadership does its own hiring',
            ]);
        }
    }

    // -- team insider ---------------------------------------------------------
    //
    // Same function, at or near the candidate's own level, and never the person
    // already occupying another slot.
    const taken = new Set([slots.talent?.email, slots.hiring_manager?.email].filter(Boolean));
    const peers = inFunction
        .filter(p => !taken.has(p.email))
        // A peer, or one step up but not a manager: whoever does the work.
        .filter(p => rankOfTitle(p.position) < 2 && rankOfTitle(p.position) - roleRank <= 1)
        .sort((a, b) => rankOfTitle(b.position) - rankOfTitle(a.position)); // most senior peer first

    if (peers[0]) {
        slots.team_insider = toPick(peers[0], [
            `${peers[0].position ?? 'peer'} in ${peers[0].department ?? 'the same function'}`,
            'does the work the role does, so knows what the team actually needs',
        ]);
    }

    return slots;
}
