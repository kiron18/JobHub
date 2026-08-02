/**
 * The one place that decides what a downloaded document is called.
 *
 * Both exporters used to build this themselves, and they had drifted: the PDF
 * derived a missing candidate name from the markdown while the Word export did
 * not, so cover letters came down as `document_Cover_Letter.docx`. They also
 * disagreed on the label — `Selection_Criteria.pdf` against
 * `Statement_Addressing_Selection_Criteria.docx` for the same document. Both
 * now call this, so a fix lands in both formats or neither.
 *
 * The shape is:
 *
 *     Michael_OConnor_Bunnings_Resume.pdf      name + company
 *     Michael_OConnor_Plumber_Resume.pdf       name + role, when no company
 *     Michael_OConnor_Resume.pdf               name only, when neither is known
 */

export type ExportDocType =
    | 'resume'
    | 'cover-letter'
    | 'selection-criteria'
    | 'interview-prep'
    | 'teaching-philosophy'
    | 'research-statement';

/** Filename labels. Deliberately shorter than the headings printed inside. */
const FILENAME_LABELS: Record<ExportDocType, string> = {
    'resume': 'Resume',
    'cover-letter': 'Cover_Letter',
    'selection-criteria': 'Selection_Criteria',
    'interview-prep': 'Interview_Prep',
    'teaching-philosophy': 'Teaching_Philosophy',
    'research-statement': 'Research_Statement',
};

/**
 * Values that reach here as a company or role but name nothing. The first two
 * are this app's own fallbacks; the rest are what a user types when a field is
 * required and they don't have the answer.
 */
const PLACEHOLDERS = new Set([
    'unknown company', 'untitled role', 'unknown', 'untitled', 'n/a', 'na',
    'none', 'tbc', 'tbd', 'application', 'document', 'company', 'role',
]);

/**
 * Reject anything that is prose rather than a name. Job title and company are
 * extracted from the pasted ad, and when that extraction slips it hands back a
 * sentence fragment — real rows in the tracker carry companies like
 * "the core of our oper" and "Marshall White, a prominent name i". Those must
 * not end up in a filename the candidate sends to an employer.
 *
 * This is a net under a bug, not a fix for it: the extraction that writes those
 * values is the thing actually broken, and a truncation that happens to look
 * like a name ("Heights qualificatio") still gets through. It only has to be
 * good enough that the obvious garbage never reaches an employer's inbox.
 */
function nameable(value: string | undefined | null): string | null {
    const trimmed = (value ?? '').trim();
    if (!trimmed) return null;
    if (PLACEHOLDERS.has(trimmed.toLowerCase())) return null;
    if (trimmed.length > 45) return null;
    if (trimmed.split(/\s+/).length > 6) return null;
    // Sentence punctuation belongs to prose, not to an employer's name.
    if (/[.!?;:]/.test(trimmed)) return null;
    // "Marshall White, a prominent name i" — a comma into a lowercase word is a
    // clause continuing, where a real "Smith, Jones & Co" stays capitalised.
    if (/,\s+[a-z]/.test(trimmed)) return null;
    // "the core of our oper" — no capital anywhere. Lowercase-styled brands
    // (eBay, iSelect) still carry one, so this only catches running text.
    if (/^[a-z]/.test(trimmed) && !/[A-Z]/.test(trimmed)) return null;
    return trimmed;
}

/**
 * Reduce a fragment to something every filesystem accepts. Windows rejects
 * \ / : * ? " < > | outright, and a trailing dot or space silently breaks a
 * file there, so this keeps to letters, digits and underscores.
 */
function slug(value: string, maxLength: number): string {
    return value
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')       // strip accents, keep the letter
        .replace(/['’]/g, '')                   // O'Connor, not O_Connor
        .replace(/&/g, 'and')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, maxLength)
        .replace(/_$/, '');
}

export interface FilenameParts {
    candidateName?: string;
    company?: string;
    jobTitle?: string;
    docType: ExportDocType;
    extension: 'pdf' | 'docx';
}

/** Build the download filename, extension included. */
export function buildExportFilename({
    candidateName,
    company,
    jobTitle,
    docType,
    extension,
}: FilenameParts): string {
    const namePart = slug(nameable(candidateName) ?? '', 40) || 'Application';
    // Company is the more useful half of the pair when both are present: the
    // candidate is sending one document per employer, not per job title.
    const context = nameable(company) ?? nameable(jobTitle);
    const contextPart = context ? slug(context, 28) : '';
    const label = FILENAME_LABELS[docType] ?? 'Document';

    return [namePart, contextPart, label].filter(Boolean).join('_') + '.' + extension;
}

/**
 * Last-resort recovery of the candidate's name and the role from the generated
 * markdown itself, for call sites that have neither to hand.
 *
 * A resume opens with "# Name" then "*Job Title*". A cover letter has no
 * heading at all — it is a letter — so the name is found at the sign-off
 * instead, which is why cover letters were the documents that came down
 * unnamed.
 */
export function deriveFromContent(content: string): { candidateName?: string; jobTitle?: string } {
    const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const jobTitle = content.match(/^\*([^*\n]+)\*$/m)?.[1]?.trim();
    if (heading) return { candidateName: heading, jobTitle };

    // "Kind regards," / "Sincerely," / "Yours sincerely," then the name, allowing
    // for the blank line a letter usually leaves between them.
    const signOff = content.match(
        /^\s*(?:kind(?:est)? regards|warm regards|regards|yours sincerely|yours faithfully|sincerely|thank you)[,.]?\s*\n+\s*(.+?)\s*$/im,
    )?.[1]?.trim();

    // A sign-off line that runs on is the closing paragraph, not a signature.
    const signature = signOff && signOff.length <= 45 && signOff.split(/\s+/).length <= 5 && !/[.!?]$/.test(signOff)
        ? signOff.replace(/^[*_#\s]+|[*_\s]+$/g, '')
        : undefined;

    return { candidateName: signature, jobTitle };
}
