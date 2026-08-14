/**
 * Fills the post-apply outreach messages from data the apply workspace already
 * holds, so the candidate is handed something they can send rather than a form
 * to complete.
 *
 * Everything here is deterministic, and deliberately so. By the time this runs
 * the cover letter has already been generated, against this exact job ad from
 * this exact resume, so the argument we need is sitting in it. Generating it a
 * second time would add a spinner and a failure mode to a card whose whole
 * premise is that it never blocks the next application.
 *
 * The one thing this will not do is guess a person's name. A fabricated hiring
 * manager ends up pasted into a real email to a real company, so every name
 * here either appeared verbatim in the job ad or in the letter's own
 * salutation, or it is left out and the greeting falls back to "Hi there,".
 *
 * The cover letter is re-split here rather than imported from exportPdf, whose
 * module body builds react-pdf stylesheets. This runs on a card that renders on
 * every application, and it does not need a PDF renderer in its bundle to read
 * four paragraphs.
 */

/**
 * LinkedIn caps connection notes at 200 characters on a free account and 300 on
 * Premium. Most of this audience is on free, so 200 is the limit we hold to: a
 * note written to 200 sends for everyone, one written to 300 silently fails for
 * the majority.
 */
export const LINKEDIN_NOTE_LIMIT = 200;

/**
 * Below this there is no room to say anything, and a four-word fragment of a
 * cover letter reads worse than leaving the candidate to write their own line.
 */
const MIN_PITCH_LINE = 40;

/** Keeps the pitch paragraph from turning a short email into a wall of text. */
const MAX_PITCH_PARAGRAPH = 480;

// ── Cover letter ────────────────────────────────────────────────────────────

export interface CoverLetterParts {
    salutation: string;
    body: string[];
}

/**
 * Split a generated cover letter into its salutation and body paragraphs.
 *
 * Anchored on the salutation because that is the only line whose position is
 * dependable: the live generator opens directly on "Dear ..." with no
 * letterhead, while older drafts carry contact details and a date above it.
 * A letter with no salutation at all is treated as all body.
 */
export function splitCoverLetter(content: string): CoverLetterParts {
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const salutationIndex = lines.findIndex((l) => l.startsWith('Dear '));

    const body: string[] = [];
    for (const line of lines.slice(salutationIndex + 1)) {
        if (line.includes('Yours sincerely') || line.includes('Yours faithfully')) break;
        body.push(line);
    }

    return {
        salutation: salutationIndex === -1 ? '' : lines[salutationIndex],
        body,
    };
}

/**
 * Strip the markdown the editor allows, along with any bracketed placeholder
 * the generator was supposed to have resolved. A `[MISSING: ...]` tag reaching
 * a recruiter is the worst outcome this module can produce, so it is removed
 * here rather than anywhere further downstream.
 */
export function cleanProse(text: string): string {
    return text
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/^#+\s+/gm, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/** Split prose into sentences, keeping their terminating punctuation. */
function sentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

/**
 * The evidence paragraph: one quantified achievement story, mapped to this
 * job's top requirement. Both the v1 rules file and the live v2 prompt put it
 * second, after the opening hook, which is exactly what the outreach email
 * asks the candidate to write.
 *
 * Trimmed to a whole sentence rather than cut mid-clause, because the number
 * usually lands in the last sentence and a truncated story loses the payload.
 */
export function evidenceParagraph(body: string[]): string | null {
    const paragraphs = body.map(cleanProse).filter((p) => p.length > 0);
    if (paragraphs.length === 0) return null;

    const chosen = paragraphs.length >= 2 ? paragraphs[1] : paragraphs[0];
    if (chosen.length <= MAX_PITCH_PARAGRAPH) return chosen;

    let out = '';
    for (const sentence of sentences(chosen)) {
        if (out && `${out} ${sentence}`.length > MAX_PITCH_PARAGRAPH) break;
        out = out ? `${out} ${sentence}` : sentence;
    }
    return out || null;
}

/**
 * One line for the LinkedIn note, which has almost no room to spare.
 *
 * Drawn only from the hook and the evidence, which is to say the first two
 * paragraphs. The generator writes the hook as the single strongest fit between
 * this candidate and this job, and the evidence as the proof, so between them
 * they are the only part of the letter that answers "why you". Letting the pool
 * run to the end of the letter meant the closing line won on length alone, and
 * "I'd welcome the chance to discuss this further" is a sentence that says
 * nothing while spending a quarter of the budget to say it.
 *
 * Picks the longest whole sentence that fits, preferring one carrying a figure.
 * Never truncates, and returns nothing rather than settle: a clipped
 * half-thought in a connection request is worse than a blank the candidate
 * fills in themselves, which is what the budget was freed up for.
 */
export function shortPitchLine(body: string[], budget: number): string | null {
    if (budget < MIN_PITCH_LINE) return null;

    const candidates = body
        .slice(0, 2)
        .map(cleanProse)
        .flatMap(sentences)
        .filter((s) => s.length >= MIN_PITCH_LINE && s.length <= budget);

    if (candidates.length === 0) return null;

    // Digits, percentages and dollar figures only. Spelled-out numbers were
    // tempting, but "one" and "half" appear in ordinary prose often enough that
    // matching them would mark nearly every sentence as quantified and the
    // preference would stop meaning anything.
    const quantified = candidates.filter((s) => /[\d%$]/.test(s));
    const pool = quantified.length > 0 ? quantified : candidates;
    return pool.reduce((best, s) => (s.length > best.length ? s : best));
}

// ── Contact name ────────────────────────────────────────────────────────────

const TITLE_PREFIX = /^(Mr|Mrs|Ms|Miss|Dr|Prof|Professor)\.?\s+/i;

/**
 * Words that show up where a name would sit but are a department, a job title
 * or a piece of furniture from the ad. "Contact Centre Manager" is a role at
 * half the employers in this market, and reading it as a person's name would
 * open a message with "Hi Contact Centre,".
 */
const NOT_A_NAME = new Set([
    'hiring', 'manager', 'management', 'talent', 'acquisition', 'human', 'resources',
    'recruitment', 'recruiting', 'recruiter', 'team', 'people', 'culture', 'careers',
    'career', 'support', 'customer', 'service', 'services', 'centre', 'center', 'office',
    'head', 'department', 'division', 'group', 'australia', 'australian', 'pty', 'ltd',
    'limited', 'details', 'information', 'info', 'us', 'me', 'our', 'the', 'this',
    'applications', 'application', 'candidates', 'enquiries', 'sir', 'madam',
]);

/** One to three capitalised words, allowing O'Brien and Anne-Marie. */
const NAME_TOKENS = "([A-Z][a-z'’\\-]+(?:\\s+[A-Z][a-z'’\\-]+){0,2})";

/**
 * How Australian ads name a contact. Each pattern must anchor on a lead-in that
 * only ever precedes a person, so an ordinary capitalised phrase in the body of
 * the ad cannot be mistaken for one.
 */
const CONTACT_PATTERNS: RegExp[] = [
    new RegExp(`(?:please\\s+)?contact\\s+${NAME_TOKENS}`, 'i'),
    new RegExp(`(?:please\\s+)?(?:call|phone)\\s+${NAME_TOKENS}`, 'i'),
    new RegExp(`(?:reach\\s+out|speak|talk)\\s+to\\s+${NAME_TOKENS}`, 'i'),
    new RegExp(`(?:directed|addressed|sent|submitted)\\s+to\\s+${NAME_TOKENS}`, 'i'),
    new RegExp(`(?:questions|enquiries|inquiries|queries)\\s+to\\s+${NAME_TOKENS}`, 'i'),
    new RegExp(`(?:contact|recruiter|consultant|hiring\\s+manager|point\\s+of\\s+contact)\\s*:\\s*${NAME_TOKENS}`, 'i'),
];

/** True when every token reads like part of a person's name. */
function looksLikeAPerson(name: string, company?: string): boolean {
    const tokens = name.split(/\s+/);
    if (tokens.length === 0 || tokens.length > 3) return false;
    if (tokens.some((t) => t.length < 2 || NOT_A_NAME.has(t.toLowerCase()))) return false;

    // A match that is really just the employer's name read back at us.
    const companyTokens = new Set(
        (company ?? '').toLowerCase().split(/[^a-z]+/).filter((t) => t.length > 2),
    );
    if (tokens.some((t) => companyTokens.has(t.toLowerCase()))) return false;

    return true;
}

/**
 * The name to greet, from the letter's own salutation.
 *
 * The generator is instructed to address a specific person when the job ad
 * names one, so a salutation that is not "Dear Hiring Manager," is a name the
 * ad supplied. A bare surname keeps its title, because "Hi Williams," is worse
 * than either "Hi Ms Williams," or "Hi there,".
 */
export function contactNameFromSalutation(salutation: string): string | null {
    const raw = salutation.replace(/^Dear\s+/i, '').replace(/[,:]\s*$/, '').trim();
    if (!raw) return null;

    const titled = TITLE_PREFIX.test(raw);
    const bare = raw.replace(TITLE_PREFIX, '').trim();
    if (!looksLikeAPerson(bare)) return null;

    const tokens = bare.split(/\s+/);
    if (titled && tokens.length === 1) return raw;
    return tokens[0];
}

/** The name to greet, read straight out of the job ad. */
export function contactNameFromJobDescription(jd: string, company?: string): string | null {
    for (const pattern of CONTACT_PATTERNS) {
        const match = jd.match(pattern);
        if (!match) continue;
        const name = match[1].trim();
        if (looksLikeAPerson(name, company)) return name.split(/\s+/)[0];
    }
    return null;
}

// ── Messages ────────────────────────────────────────────────────────────────

export interface OutreachInput {
    role: string;
    company: string;
    /** The generated cover letter, if the candidate got that far. */
    coverLetter?: string;
    jobDescription?: string;
    candidateName?: string;
    /** ISO date the application was logged. */
    dateApplied?: string;
}

export interface OutreachMessages {
    linkedIn: string;
    subject: string;
    email: string;
    /** True when the candidate still has to write the line themselves. */
    linkedInNeedsPitch: boolean;
    emailNeedsPitch: boolean;
    /** Set when we greeted a real person rather than falling back. */
    contactName: string | null;
}

function formatApplied(iso?: string): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
    }).format(date);
}

const PITCH_LINE_BLANK = '[One line on why this role fits you.]';
const PITCH_PARAGRAPH_BLANK =
    '[Two sentences of your own here: the specific thing the job ad asks for, and the ' +
    'concrete evidence from your experience that meets it, with a real number if you have one.]';

export function buildOutreachMessages(input: OutreachInput): OutreachMessages {
    const role = input.role || '[role]';
    const company = input.company || '[company]';

    const letter = input.coverLetter ? splitCoverLetter(input.coverLetter) : null;

    const contactName =
        (letter ? contactNameFromSalutation(letter.salutation) : null) ??
        (input.jobDescription
            ? contactNameFromJobDescription(input.jobDescription, input.company)
            : null);

    const greeting = contactName ?? 'there';
    const signature = input.candidateName?.trim() || '[Your name]';
    const applied = formatApplied(input.dateApplied) ?? '[date]';

    // The LinkedIn note carries no signature. A connection request already shows
    // the sender's name and headline, so signing it spends characters we do not
    // have on information the recipient is already looking at.
    const opener = `Hi ${greeting}, I've just applied for the ${role} role at ${company}`;
    const full = (pitch: string) => `${opener}. ${pitch}Thought I'd introduce myself here too.`;

    const pitchLine = letter
        ? shortPitchLine(letter.body, LINKEDIN_NOTE_LIMIT - full('').length - 1)
        : null;

    // Longest form that fits, shortest that says something honest as the floor.
    // A note over the limit is not rejected by LinkedIn with an error, it simply
    // never sends, so shipping one is worse than dropping a sentence.
    const linkedIn = [
        full(pitchLine ? `${pitchLine} ` : `${PITCH_LINE_BLANK} `),
        full(''),
        `${opener} and wanted to introduce myself.`,
        `${opener}.`,
    ].find((note) => note.length <= LINKEDIN_NOTE_LIMIT) ?? `${opener}.`;

    const pitchParagraph = letter ? evidenceParagraph(letter.body) : null;

    const email =
        `Hi ${greeting},\n\n` +
        `I applied for the ${role} role at ${company} on ${applied} and wanted to introduce myself directly.\n\n` +
        `${pitchParagraph ?? PITCH_PARAGRAPH_BLANK}\n\n` +
        `If you're not the right person for this one, I'd be grateful for a pointer to who is.\n\n` +
        `Best regards,\n${signature}`;

    return {
        linkedIn,
        subject: `Application for ${role}, ${signature}`,
        email,
        linkedInNeedsPitch: linkedIn.includes(PITCH_LINE_BLANK),
        emailNeedsPitch: pitchParagraph === null,
        contactName,
    };
}
