/**
 * Turn what `/research/company` returns into something the send card can show.
 *
 * The endpoint answers in two different shapes depending on which path found
 * the contact, and the frontend has never read either of them. The directory
 * path returns Hunter records, which carry an address that Hunter has actually
 * observed somewhere, plus a verification status. The search path returns
 * people found in search results, which carry a name and a title and no address
 * at all. Both arrive with a `why`, written in plain words by the picker for
 * exactly this purpose, and until now it was discarded on arrival.
 *
 * The job here is to normalise those into one person and a ranked list of
 * addresses, each labelled with how much it can be trusted, so the card can
 * tell the candidate the truth about what they are about to send.
 *
 * No address is invented. When the search path found a name but no address the
 * list comes back empty, which is a real answer: we know who to write to and
 * not where. Filling that gap with a guessed address is the failure this whole
 * pipeline was rebuilt to stop.
 */
import type { AddressOption, AddressConfidence } from './composeHandoff';

/** A slot as the directory path returns it (a `Pick` from directoryPick). */
interface RawDirectoryPick {
    name?: string | null;
    email?: string | null;
    position?: string | null;
    department?: string | null;
    verification?: string | null;
    why?: string[] | null;
}

/** A slot as the search path returns it (a `Candidate` plus `why`). */
interface RawSearchPick {
    name?: string | null;
    title?: string | null;
    email?: string | null;
    why?: string[] | null;
}

type RawSlot = RawDirectoryPick & RawSearchPick;

export interface ResearchResponse {
    source?: string;
    domain?: string | null;
    slots?: {
        talent?: RawSlot | null;
        hiringManager?: RawSlot | null;
        teamInsider?: RawSlot | null;
    } | null;
}

export interface ResolvedContact {
    name: string;
    title: string | null;
    addresses: AddressOption[];
}

/**
 * Local parts that reach a role rather than a person.
 *
 * Kept deliberately short. A false positive here demotes a real person's
 * address below a shared inbox, which loses a warm contact; a false negative
 * only means a role inbox is described as a person, which the candidate can
 * see for themselves from the address.
 */
const GENERIC_LOCAL = /^(info|admin|hr|careers|jobs|recruitment|recruiting|enquiries|enquiry|contact|hello|office|support|apply|talent|people|reception|mail)$/i;

export function isGenericAddress(address: string): boolean {
    const local = (address || '').split('@')[0] ?? '';
    return GENERIC_LOCAL.test(local);
}

/**
 * How much to trust an address, from where it came and whether it was checked.
 *
 * `jd` is its own tier, ahead of everything Hunter returns: the employer
 * named this address for this exact role, so it is not a guess about who the
 * right person is the way every Hunter pick still is, however good the
 * mailbox check on it comes back. A Hunter directory record is an address
 * Hunter has SEEN, not one it built, which is why it never lands on
 * `constructed`. Verification promotes it, and a shared inbox is called what
 * it is regardless of either.
 */
export function confidenceOf(address: string, verification: string | null | undefined): AddressConfidence {
    if (isGenericAddress(address)) return 'generic';
    if (verification === 'jd') return 'jd';
    if (verification === 'valid') return 'verified';
    return 'published';
}

/** Which slot this came from, said in words the candidate can act on. */
const SLOT_LABEL: Record<string, string> = {
    hiringManager: 'Likely hiring manager',
    talent: 'Recruitment or HR',
    teamInsider: 'On the team you would join',
};

/**
 * The one person to write to, and every address we hold for them.
 *
 * Slots are tried hiring manager first, then talent, then the team insider,
 * which is the order `research.ts` itself uses to pick a lead. Addresses from
 * the other slots are NOT offered: they belong to different people, and a list
 * mixing them would let the candidate send a letter addressed to one person to
 * the mailbox of another.
 */
export function resolveContact(data: ResearchResponse | null | undefined): ResolvedContact | null {
    const slots = data?.slots;
    if (!slots) return null;

    const order: Array<keyof NonNullable<ResearchResponse['slots']>> =
        ['hiringManager', 'talent', 'teamInsider'];

    for (const key of order) {
        const slot = slots[key];
        if (!slot?.name) continue;

        const why = Array.isArray(slot.why) ? slot.why.filter(Boolean) : [];
        const email = (slot.email || '').trim();

        return {
            name: slot.name,
            // The two shapes disagree on what the title field is called.
            title: slot.position ?? slot.title ?? null,
            addresses: email
                ? [{
                    address: email,
                    confidence: confidenceOf(email, slot.verification),
                    label: SLOT_LABEL[key as string] ?? '',
                    why,
                }]
                : [],
        };
    }

    return null;
}

/**
 * The employer's shared inbox, offered as the safer alternative.
 *
 * Only ever added alongside a named person, never instead of one, and only
 * when the ad itself carried it. We do not construct `careers@domain` and
 * present it as found: an invented shared inbox is still an invented address,
 * and the whole point of the confidence labels is that they mean something.
 */
export function withFallbackInbox(
    contact: ResolvedContact,
    inbox: string | null | undefined,
): ResolvedContact {
    const address = (inbox || '').trim();
    if (!address) return contact;
    if (contact.addresses.some(a => a.address.toLowerCase() === address.toLowerCase())) return contact;

    return {
        ...contact,
        addresses: [
            ...contact.addresses,
            {
                address,
                confidence: isGenericAddress(address) ? 'generic' : 'jd',
                label: 'Shared inbox from the job ad',
                why: ['Printed in the job ad itself.'],
            },
        ],
    };
}
