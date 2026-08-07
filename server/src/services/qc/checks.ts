/**
 * Deterministic quality control for generated documents.
 *
 * Everything here is pure string work over data already in the database — no
 * model call, no network, no cost. That is the point: a coach spot-checking
 * output should never have to pay per document to find out which documents are
 * worth looking at. The LLM audit (see audit.ts) is the second pass, run by
 * hand on the few documents this pass ranks worst.
 *
 * Findings are grouped into three dimensions because they fail differently and
 * carry different consequences:
 *
 *   targeting — is this document actually aimed at the advertised job? The
 *               failure mode is a generic document, or worse, one still
 *               addressed to the previous employer.
 *   honesty   — does every employer, number and year claim trace back to what
 *               the client actually told us? This is the one that ends a
 *               client relationship, so it is weighted hardest.
 *   quality   — is it well written and the right shape? Placeholders left in,
 *               banned phrasing, wrong length.
 *
 * A check only fires on evidence it can point at. Anything it cannot verify —
 * no stored job description, no source resume — is reported as unassessable
 * rather than guessed at, because a QC pass that invents a verdict is worse
 * than one that admits a gap.
 */
import { checkAtsKeywords } from '../../lib/atsKeywords';
import { checkStyle } from '../../lib/styleLint';
import { detectYearsClaim } from '../../lib/yearsClaimDetector';
import { normalizeForMatch, isGroundedInSource } from '../../lib/fidelityGuard';

export type QcDimension = 'targeting' | 'honesty' | 'quality';
export type QcSeverity = 'info' | 'warning' | 'critical';

export interface QcFinding {
    /** Stable id, safe to filter and count on. */
    check: string;
    dimension: QcDimension;
    severity: QcSeverity;
    message: string;
    evidence?: string[];
}

export interface QcProfileSnapshot {
    name?: string | null;
    /** Clean rebuilt resume — the ground truth every generation is meant to sit on. */
    resumeRawText?: string | null;
    /** The original upload, kept for recovery. Used here as a second source of truth. */
    resumeOriginalText?: string | null;
    yearsOfExperience?: number | null;
    experience?: Array<{ company?: string | null; role?: string | null }>;
    achievements?: Array<{ description?: string | null; metric?: string | null }>;
}

export interface QcInput {
    docType: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE' | 'BASELINE_RESUME' | 'INTERVIEW_PREP';
    content: string;
    /** The advert this document was generated against, if the row still holds one. */
    jobDescription?: string | null;
    jobTitle?: string | null;
    company?: string | null;
    profile: QcProfileSnapshot;
    /**
     * Companies from the client's OTHER applications. A cover letter naming one
     * of these is the copy-paste failure — the single most damaging thing that
     * can reach an employer — and it is only detectable with this list.
     */
    otherCompanies?: string[];
    /** Signals recorded at generation time, replayed so nothing is lost. */
    generationSignals?: Array<{ severity: string; category: string; message: string; evidence?: string[] }> | null;
}

export interface QcResult {
    findings: QcFinding[];
    /** 0-100, higher is better. See scoreFindings for the weighting. */
    score: number;
    level: 'clean' | 'info' | 'warning' | 'critical';
    /** Checks that could not run, and why. Never counted as a pass. */
    unassessable: string[];
    metrics: {
        wordCount: number;
        atsCoverage: number | null;
    };
}

/** Cover letters that open like this read as machine-written to any recruiter. */
const GENERIC_OPENERS = [
    'i am writing to express my interest',
    'i am writing to apply',
    'i am excited to apply',
    'i am thrilled to apply',
    'i am writing in response to',
    'please accept this letter',
    'i would like to express my interest',
    'with great interest i',
];

/** Anything that should never survive to a real employer. */
const PLACEHOLDER_PATTERNS: Array<{ re: RegExp; label: string }> = [
    { re: /\[[A-Za-z][^\]]{0,40}\]/g, label: 'square-bracket placeholder' },
    { re: /\{\{[^}]{0,40}\}\}/g, label: 'template placeholder' },
    { re: /<\s*insert[^>]{0,40}>/gi, label: 'insert marker' },
    { re: /\bTBD\b|\bTODO\b/g, label: 'TODO marker' },
    { re: /\blorem ipsum\b/gi, label: 'lorem ipsum' },
    { re: /\bXX+%|\bXX+\b/g, label: 'unfilled number' },
    { re: /\bYour Company\b|\bCompany Name\b|\bRole Title\b/gi, label: 'unfilled field' },
];

const COVER_LETTER_WORDS = { min: 180, max: 500 };
const RESUME_WORDS = { min: 250, max: 1400 };

/**
 * The `company` field on an application is filled by extraction from the
 * advert, and on real data it is often a fragment rather than an employer:
 * "risk", "pace", "its core", "raw data", "the door", "midday", "Unknown".
 * Comparing a document against those produces a flag on almost every document,
 * which is the fastest way to get a QC panel ignored.
 *
 * A value earns comparison only if it looks like an organisation: more than one
 * significant word, or a single distinctive word of six characters or more that
 * is not ordinary English.
 */
const NON_COMPANY_WORDS = new Set([
    'risk', 'pace', 'scale', 'core', 'data', 'door', 'midday', 'meetings', 'unknown',
    'company', 'business', 'group', 'team', 'role', 'work', 'client', 'clients',
    'services', 'service', 'systems', 'system', 'solutions', 'people', 'health',
    'digital', 'global', 'national', 'australia', 'sydney', 'melbourne', 'brisbane',
    'all', 'the', 'its', 'raw', 'new', 'one', 'two', 'level', 'levels', 'high', 'low',
]);

export function isPlausibleCompanyName(raw: string): boolean {
    // Two-character tokens count: an employer is often an initialism paired
    // with a word ("EARTH AI"), and dropping those loses real names.
    const tokens = normalizeForMatch(raw)
        .split(' ')
        .filter(t => t.length >= 2 && !NON_COMPANY_WORDS.has(t));
    if (tokens.length >= 2) return true;
    return tokens.length === 1 && tokens[0].length >= 6;
}

/** Whole-word containment. Without this "tanda" matches inside "standard". */
function containsWholePhrase(normalizedHaystack: string, normalizedPhrase: string): boolean {
    if (!normalizedPhrase) return false;
    const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(normalizedHaystack);
}

/**
 * Organisations a document actually asserts the client was involved with.
 *
 * Scanning every capitalised phrase — which is what the generation-time
 * employer check does — returns section headings, salutations and job titles:
 * "Professional Summary", "Dear Hiring Manager", "Work Experience", "Business
 * Intelligence Analyst". None of those are employers and flagging them buries
 * the one case that matters. Employers appear in prose in two shapes, so only
 * those two are collected: after a joining preposition, or carrying a corporate
 * or institutional suffix.
 */
export function extractNamedOrganisations(text: string): string[] {
    const found = new Set<string>();
    // No full stop inside a name: allowing one lets the match run past the end
    // of the sentence and swallow the next word ("Ramsay Health Care. Studied").
    const NAME = `[A-Z][A-Za-z&'-]*(?:[ ][A-Z][A-Za-z&'-]*){0,3}`;

    // "at Ramsay Health Care", "with Telstra", "joined Deloitte"
    for (const m of text.matchAll(new RegExp(`\\b(?:at|with|for|joined|from)\\s+(${NAME})`, 'g'))) {
        found.add(m[1].trim());
    }
    // "Acme Pty Ltd", "Monash University", "Epworth Hospital"
    const SUFFIX = 'Pty Ltd|Pty\\.? Limited|Ltd|Limited|Inc|LLC|PLC|Group|Holdings|University|Hospital|Bank|Institute|Corporation|Consulting';
    for (const m of text.matchAll(new RegExp(`\\b(${NAME}\\s+(?:${SUFFIX}))\\b`, 'g'))) {
        found.add(m[1].trim());
    }

    // A single capitalised word after a preposition is usually the start of a
    // sentence or a place, not an employer.
    return [...found].filter(p => p.split(/\s+/).length >= 2);
}

function words(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Every source of truth we hold for this client, normalised once. */
function groundTruth(profile: QcProfileSnapshot): string {
    return normalizeForMatch([
        profile.resumeRawText ?? '',
        profile.resumeOriginalText ?? '',
        ...(profile.achievements ?? []).flatMap(a => [a.description ?? '', a.metric ?? '']),
        ...(profile.experience ?? []).flatMap(e => [e.company ?? '', e.role ?? '']),
    ].join(' \n '));
}

/**
 * Figures a document asserts that ought to be traceable: percentages, money,
 * and any standalone number of two digits or more.
 *
 * Deliberately narrow. Single digits are excluded because "3 teams" is both
 * unremarkable and impossible to trace reliably, and a check that cries wolf
 * gets switched off. Years are excluded here and handled by the years claim
 * detector, which knows the stored figure to compare against.
 */
export function extractClaimedFigures(text: string): string[] {
    const out = new Set<string>();
    const patterns = [
        /\d{1,3}(?:\.\d+)?\s?%/g,
        /(?:\$|AUD\s?)\d[\d,]*(?:\.\d+)?[kKmM]?/g,
        /\b\d{2,}(?:,\d{3})*\b/g,
    ];
    for (const re of patterns) {
        for (const m of text.matchAll(re)) out.add(m[0].trim());
    }
    return [...out];
}

/** Just the digits, so "$1,200" and "1200" compare equal. */
function figureDigits(figure: string): string {
    return figure.replace(/[^\d]/g, '');
}

function isFigureGrounded(figure: string, normalizedSource: string): boolean {
    const digits = figureDigits(figure);
    if (!digits) return true;
    // Match on the digit run rather than the formatted string: sources write
    // the same number a dozen ways and formatting differences are not lies.
    return normalizedSource.replace(/[^\d\s]/g, '').includes(digits)
        || normalizedSource.replace(/[^\d]/g, '').includes(digits);
}

export function runDeterministicChecks(input: QcInput): QcResult {
    const findings: QcFinding[] = [];
    const unassessable: string[] = [];
    const content = input.content ?? '';
    const lower = content.toLowerCase();
    const isCoverLetter = input.docType === 'COVER_LETTER';
    const isResume = input.docType === 'RESUME' || input.docType === 'BASELINE_RESUME';
    const wordCount = words(content);

    const add = (f: QcFinding) => findings.push(f);

    // ── Targeting ────────────────────────────────────────────────────────────
    let atsCoverage: number | null = null;
    const jd = (input.jobDescription ?? '').trim();
    const placeholderJd = jd.length < 200; // a one-line stand-in, not an advert

    if (placeholderJd) {
        unassessable.push(
            'No job description stored on this application, so targeting cannot be verified against the advert.',
        );
    } else if (isResume || isCoverLetter) {
        const ats = checkAtsKeywords({
            jobDescription: jd,
            generatedDocument: content,
            docType: isResume ? 'RESUME' : 'COVER_LETTER',
        });
        atsCoverage = ats.coverage;
        if (ats.coverage < 0.4) {
            add({
                check: 'targeting.ats_coverage',
                dimension: 'targeting',
                severity: 'critical',
                message: `Only ${Math.round(ats.coverage * 100)}% of the advert's key terms appear in the document. An ATS is likely to filter it before a person reads it.`,
                evidence: ats.missingFromOutput.slice(0, 8),
            });
        } else if (ats.coverage < 0.6) {
            add({
                check: 'targeting.ats_coverage',
                dimension: 'targeting',
                severity: 'warning',
                message: `Advert term coverage is ${Math.round(ats.coverage * 100)}%.`,
                evidence: ats.missingFromOutput.slice(0, 8),
            });
        }
        for (const w of ats.warnings) {
            if (w.startsWith('CRITICAL')) {
                add({
                    check: 'targeting.role_title_missing',
                    dimension: 'targeting',
                    severity: 'critical',
                    message: w.replace(/^CRITICAL:\s*/, ''),
                });
            }
        }
    }

    const company = (input.company ?? '').trim();
    if (company && company.toLowerCase() !== 'unknown company') {
        const companyTokens = normalizeForMatch(company).split(' ').filter(t => t.length > 2);
        const named = companyTokens.length > 0 && companyTokens.some(t => lower.includes(t));
        if (!named && isCoverLetter) {
            add({
                check: 'targeting.company_not_named',
                dimension: 'targeting',
                severity: 'critical',
                message: `The cover letter never names ${company}. It reads as a document sent to anyone.`,
            });
        } else if (!named && isResume) {
            add({
                check: 'targeting.company_not_named',
                dimension: 'targeting',
                severity: 'info',
                message: `${company} is not mentioned anywhere in the resume.`,
            });
        }
    } else {
        unassessable.push('No employer recorded on this application, so the company mention check cannot run.');
    }

    // The copy-paste catastrophe: a document that names a DIFFERENT employer the
    // client has also applied to.
    //
    // Only worth reporting when it can be reported precisely. Whole-word
    // matching stops "Tanda" firing on "standard", and isPlausibleCompanyName
    // discards the extraction fragments that fill this column on real data.
    // Reported as a warning, not a must-fix: naming a previous employer is
    // often legitimate, and only a human can tell which this is.
    const normalizedContent = normalizeForMatch(content);
    const wrongCompanies = (input.otherCompanies ?? [])
        .map(c => c.trim())
        .filter(c => c.toLowerCase() !== company.toLowerCase())
        .filter(isPlausibleCompanyName)
        .filter(c => containsWholePhrase(normalizedContent, normalizeForMatch(c)));
    if (wrongCompanies.length > 0) {
        add({
            check: 'targeting.wrong_employer_named',
            dimension: 'targeting',
            severity: 'warning',
            message: `Names an employer from a different application${company ? ` while applying to ${company}` : ''}. Check this was not left over from the previous generation.`,
            evidence: [...new Set(wrongCompanies)].slice(0, 5),
        });
    }

    // ── Honesty ──────────────────────────────────────────────────────────────
    const source = groundTruth(input.profile);
    const haveSource = source.replace(/\s/g, '').length > 200;

    if (!haveSource) {
        unassessable.push(
            'No stored resume text for this client, so nothing in the document can be traced back to a source.',
        );
    } else {
        const ungroundedFigures = extractClaimedFigures(content)
            .filter(f => !isFigureGrounded(f, source));
        if (ungroundedFigures.length > 0) {
            add({
                check: 'honesty.unsourced_figures',
                dimension: 'honesty',
                severity: ungroundedFigures.length >= 3 ? 'critical' : 'warning',
                message: `${ungroundedFigures.length} figure${ungroundedFigures.length === 1 ? '' : 's'} in the document ${ungroundedFigures.length === 1 ? 'does' : 'do'} not appear in anything the client gave us.`,
                evidence: ungroundedFigures.slice(0, 8),
            });
        }

        // The employer the client is applying to, and their own name, are meant
        // to be in the document and are not in their history.
        const selfNames = normalizeForMatch([input.profile.name ?? '', company, input.jobTitle ?? ''].join(' '))
            .split(' ')
            .filter(t => t.length > 2);
        const suspicious = extractNamedOrganisations(content)
            .filter(phrase => {
                const tokens = normalizeForMatch(phrase).split(' ').filter(t => t.length > 2);
                return tokens.length > 0 && !tokens.every(t => selfNames.includes(t));
            })
            .filter(phrase => !isGroundedInSource(phrase, source));
        if (suspicious.length > 0) {
            add({
                check: 'honesty.ungrounded_employer',
                dimension: 'honesty',
                severity: 'warning',
                message: 'Names organisations that do not appear in the client\'s own history. Worth confirming before this goes out.',
                evidence: [...new Set(suspicious)].slice(0, 5),
            });
        }
    }

    const yearsClaim = detectYearsClaim(content, input.profile.yearsOfExperience ?? null);
    if (yearsClaim.violates) {
        add({
            check: 'honesty.years_claim',
            dimension: 'honesty',
            severity: 'critical',
            message: input.profile.yearsOfExperience
                ? `Claims a length of experience that does not match the ${input.profile.yearsOfExperience} years on file.`
                : 'States a number of years of experience that we hold no figure for.',
            evidence: yearsClaim.matches.slice(0, 4).map(m => m.phrase),
        });
    }

    // ── Quality ──────────────────────────────────────────────────────────────
    const placeholders: string[] = [];
    for (const { re, label } of PLACEHOLDER_PATTERNS) {
        for (const m of content.matchAll(re)) placeholders.push(`${label}: ${m[0]}`);
    }
    if (placeholders.length > 0) {
        add({
            check: 'quality.placeholder_left_in',
            dimension: 'quality',
            severity: 'critical',
            message: 'Unfilled placeholder text is still in the document.',
            evidence: [...new Set(placeholders)].slice(0, 6),
        });
    }

    const limits = isCoverLetter ? COVER_LETTER_WORDS : isResume ? RESUME_WORDS : null;
    if (limits) {
        if (wordCount < limits.min) {
            add({
                check: 'quality.too_short',
                dimension: 'quality',
                severity: 'warning',
                message: `${wordCount} words — thin for a ${isCoverLetter ? 'cover letter' : 'resume'} (expected at least ${limits.min}).`,
            });
        } else if (wordCount > limits.max) {
            add({
                check: 'quality.too_long',
                dimension: 'quality',
                severity: 'warning',
                message: `${wordCount} words — long for a ${isCoverLetter ? 'cover letter' : 'resume'} (expected under ${limits.max}).`,
            });
        }
    }

    if (isCoverLetter) {
        const opener = GENERIC_OPENERS.filter(p => lower.includes(p));
        if (opener.length > 0) {
            add({
                check: 'quality.generic_opener',
                dimension: 'quality',
                severity: 'warning',
                message: 'Opens with stock cover-letter phrasing.',
                evidence: opener,
            });
        }
    }

    const style = checkStyle(content, isCoverLetter);
    // Word count is already reported above with the right thresholds per type;
    // taking styleLint's copy too would double-count the same defect.
    const styleViolations = style.violations.filter(v => v.type !== 'word-count');
    if (styleViolations.length > 0) {
        add({
            check: 'quality.style',
            dimension: 'quality',
            severity: 'info',
            message: `${styleViolations.length} house-style issue${styleViolations.length === 1 ? '' : 's'}.`,
            evidence: styleViolations.slice(0, 6).map(v => v.message),
        });
    }

    // Repeated bullet openers are the clearest tell of a generated document.
    const bulletOpeners = content
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => /^[-•*]\s+/.test(l))
        .map(l => l.replace(/^[-•*]\s+/, '').split(/\s+/)[0]?.toLowerCase())
        .filter((w): w is string => Boolean(w));
    if (bulletOpeners.length >= 5) {
        const counts = new Map<string, number>();
        for (const w of bulletOpeners) counts.set(w, (counts.get(w) ?? 0) + 1);
        const repeated = [...counts.entries()].filter(([, n]) => n >= 3);
        if (repeated.length > 0) {
            add({
                check: 'quality.repeated_bullet_openers',
                dimension: 'quality',
                severity: 'info',
                message: 'The same word opens several bullets.',
                evidence: repeated.map(([w, n]) => `"${w}" x${n}`),
            });
        }
    }

    // Replay what generation recorded at the time. Those checks ran with
    // context this pass no longer has, so losing them would lose real signal.
    for (const s of input.generationSignals ?? []) {
        add({
            check: `generation.${s.category}`,
            dimension: s.category === 'ats_keywords' ? 'targeting' : 'quality',
            severity: s.severity === 'critical' ? 'critical' : s.severity === 'warning' ? 'warning' : 'info',
            message: s.message,
            evidence: s.evidence,
        });
    }

    return {
        findings,
        ...scoreFindings(findings),
        unassessable,
        metrics: { wordCount, atsCoverage },
    };
}

/**
 * Collapse findings to one number so a coach can sort a month of output and
 * look at the worst five.
 *
 * Honesty costs double: a weak sentence embarrasses a client, a fabricated
 * employer ends the relationship. The score is a triage order, not a grade —
 * nothing acts on it automatically.
 */
export function scoreFindings(findings: QcFinding[]): { score: number; level: QcResult['level'] } {
    const weight = (f: QcFinding) => {
        const base = f.severity === 'critical' ? 25 : f.severity === 'warning' ? 10 : 3;
        return f.dimension === 'honesty' ? base * 2 : base;
    };
    const penalty = findings.reduce((sum, f) => sum + weight(f), 0);
    const score = Math.max(0, 100 - penalty);

    const level: QcResult['level'] =
        findings.some(f => f.severity === 'critical') ? 'critical'
            : findings.some(f => f.severity === 'warning') ? 'warning'
                : findings.length > 0 ? 'info'
                    : 'clean';

    return { score, level };
}
