/**
 * Hand a finished draft to the candidate's own mail client, addressed and ready.
 *
 * The send itself is deliberately not ours. Sending on their behalf means
 * either Gmail's `gmail.send` scope, which is restricted and expires its
 * refresh tokens every 7 days until the app passes an annual security
 * assessment, or relaying through our own domain, which puts every bounced
 * guess against the reputation of the address we mail paying clients from.
 *
 * So we open their compose window instead, filled in. The properties that
 * actually matter all survive: the message comes from their address, it lands
 * in their Sent folder, and replies go to them rather than to us.
 *
 * The human step is the point, not a limitation. Contact discovery picks the
 * right person about a third of the time, so a true one-click send would be
 * mailing strangers twice for every person it reached, with the candidate's
 * name on it. A compose window shows them the name, the title and the address
 * before anything leaves.
 */

/** Roughly where mail clients and browsers start truncating a URL. */
export const MAX_BODY_CHARS = 1800;

export type MailClient = 'gmail' | 'outlook' | 'default';

/**
 * Which compose window to open, from the address they signed up with.
 *
 * Guessing wrong is a dead button rather than a wrong send: a `mailto:` link
 * does nothing at all for someone reading webmail in a browser with no handler
 * registered, and they get no error explaining why.
 */
export function clientForAddress(address: string | null | undefined): MailClient {
    const domain = (address || '').split('@')[1]?.toLowerCase() ?? '';
    if (!domain) return 'default';
    if (/^(gmail\.com|googlemail\.com)$/.test(domain)) return 'gmail';
    if (/^(outlook\.|hotmail\.|live\.|msn\.)/.test(domain)) return 'outlook';
    return 'default';
}

export interface ComposeDraft {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
}

/**
 * Trim a body to what a URL will carry, on a paragraph boundary.
 *
 * Cutting mid-sentence produces a draft that reads as broken rather than
 * short, and the candidate sends it anyway because the compose window looks
 * finished. Cutting at a blank line at least ends on a whole thought.
 */
export function fitBody(body: string, max = MAX_BODY_CHARS): { body: string; truncated: boolean } {
    const text = body ?? '';
    if (text.length <= max) return { body: text, truncated: false };

    const head = text.slice(0, max);
    const lastBreak = head.lastIndexOf('\n\n');
    return {
        body: lastBreak > max * 0.5 ? head.slice(0, lastBreak) : head.trimEnd(),
        truncated: true,
    };
}

/**
 * The URL that opens their compose window with everything filled in.
 *
 * Gmail and Outlook web both take the draft as query parameters, so a browser
 * tab is enough and nothing needs to be installed. Everyone else gets
 * `mailto:`, which their desktop client handles.
 *
 * `account` is the address the draft should be sent FROM, and it only does
 * anything on Gmail. Without it the link goes to `mail.google.com/mail/`, which
 * resolves to whichever Google account the browser happens to consider default
 * — for anybody signed into a personal address and a university or work
 * Workspace at the same time, that is a coin toss, and losing it means the
 * follow-up composes in the wrong mailbox and lands in the wrong Sent folder.
 * Worse, it is silent: the window opens, filled in and looking correct.
 *
 * `/mail/u/<address>/` pins it. Google resolves the address to that session's
 * account index, and if they are not signed into it, they get an account
 * chooser rather than the wrong mailbox. Pinning it also skips the redirect
 * hop the default path takes, which is most of the wait before compose appears.
 */
export function composeUrl(draft: ComposeDraft, client: MailClient, account?: string | null): string {
    const { body } = fitBody(draft.body);
    const q = new URLSearchParams();

    if (client === 'gmail') {
        q.set('view', 'cm');
        q.set('fs', '1');
        q.set('to', draft.to);
        q.set('su', draft.subject);
        q.set('body', body);
        if (draft.cc) q.set('cc', draft.cc);
        if (draft.bcc) q.set('bcc', draft.bcc);
        // Only an address is worth pinning. Anything else in that path segment
        // is a 404 rather than a fallback to the default account.
        const pinned = account && account.includes('@') ? `u/${encodeURIComponent(account.trim())}/` : '';
        return `https://mail.google.com/mail/${pinned}?${q.toString()}`;
    }

    if (client === 'outlook') {
        q.set('path', '/mail/action/compose');
        q.set('to', draft.to);
        q.set('subject', draft.subject);
        q.set('body', body);
        return `https://outlook.live.com/mail/0/deeplink/compose?${q.toString()}`;
    }

    // mailto encodes its own parameters, and URLSearchParams renders a space
    // as "+" which a mail client shows literally rather than as a space.
    const params = [
        `subject=${encodeURIComponent(draft.subject)}`,
        `body=${encodeURIComponent(body)}`,
        ...(draft.cc ? [`cc=${encodeURIComponent(draft.cc)}`] : []),
        ...(draft.bcc ? [`bcc=${encodeURIComponent(draft.bcc)}`] : []),
    ];
    return `mailto:${encodeURIComponent(draft.to)}?${params.join('&')}`;
}

/** How confident we are that this address reaches a real, relevant human. */
export type AddressConfidence = 'jd' | 'published' | 'verified' | 'constructed' | 'generic';

export interface AddressOption {
    address: string;
    confidence: AddressConfidence;
    /** Who this reaches, in plain words. Shown next to the address. */
    label: string;
    /** Why we believe it, carried through from the picker's evidence. */
    why: string[];
}

/**
 * Order the addresses we can offer, safest first.
 *
 * `jd` leads because the employer named this address themselves for this
 * exact role, which beats anything inferred from a directory or a search.
 *
 * A generic `careers@` outranks a constructed personal address on purpose.
 * The constructed one is a hypothesis that will be silently accepted by any
 * catch-all domain and read by nobody, while the role inbox is certain to be
 * monitored even though it is less flattering to reach. Being read by the
 * wrong-but-real person beats being delivered to no one.
 */
const CONFIDENCE_ORDER: Record<AddressConfidence, number> = {
    jd: 0,
    published: 1,
    verified: 2,
    generic: 3,
    constructed: 4,
};

export function rankAddresses(options: AddressOption[]): AddressOption[] {
    return [...options].sort(
        (a, b) => CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence],
    );
}

/**
 * The sentence shown beside an address, so the candidate knows what they are
 * about to trust. Never reassuring about a guess.
 */
export function confidenceNote(confidence: AddressConfidence): string {
    switch (confidence) {
        case 'jd':
            return 'Named in the job ad as the contact for this role. Not a guess.';
        case 'published':
            // Covers both an address printed by the employer and one Hunter
            // has observed in the wild. Neither is a guess, and neither is a
            // promise the mailbox is still live, so the wording claims only
            // what is true of both: somebody wrote it down.
            return 'Found published online, not a guess. Not re-checked recently.';
        case 'verified':
            return 'Checked and the mailbox exists.';
        case 'generic':
            return 'A shared inbox, not a person. Certain to be monitored, less likely to be answered personally.';
        case 'constructed':
            return 'Built from this employer’s address pattern, not confirmed. It may bounce, or reach the wrong person. Worth checking on LinkedIn first.';
    }
}
