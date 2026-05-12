/**
 * Hard Gap keywords — credentialled, non-bridgeable requirements.
 *
 * Used by Dual-Signal analysis to distinguish a genuine *Hard Gap* (the
 * candidate genuinely cannot do this role without obtaining the credential)
 * from a *Bridgeable Gap* (the candidate likely has the experience, just
 * hasn't named it on their profile).
 *
 * Rule of thumb: include only items that require a formal qualification,
 * licence, clearance, or status. Soft skills, tools, and methodologies do
 * NOT belong here — those are always bridgeable.
 *
 * Source: Australian job market norms (regulatory bodies + common APS /
 * health / legal credential requirements).
 */

export interface HardGapItem {
    id: string;
    keywords: string[];          // case-insensitive substring matches against JD text
    label: string;               // human-readable label for the gap card
    category: 'credential' | 'clearance' | 'visa' | 'registration';
}

export const HARD_GAP_ITEMS: HardGapItem[] = [
    // ── Accounting / finance credentials ────────────────────────────────────
    { id: 'cpa',         keywords: ['cpa qualified', 'cpa qualification', 'cpa accredited', 'cpa membership', 'must be cpa', 'cpa designation'], label: 'CPA qualification', category: 'credential' },
    { id: 'ca',          keywords: ['ca qualified', 'chartered accountant', 'ca anz', 'icaa qualified'], label: 'Chartered Accountant (CA ANZ)', category: 'credential' },
    { id: 'cfa',         keywords: ['cfa qualified', 'cfa charter', 'cfa designation'], label: 'CFA Charter', category: 'credential' },

    // ── Legal ───────────────────────────────────────────────────────────────
    { id: 'admitted-lawyer', keywords: ['admitted to practice', 'admitted lawyer', 'practising certificate', 'high court of australia'], label: 'Admitted lawyer with practising certificate', category: 'registration' },

    // ── Healthcare / AHPRA ──────────────────────────────────────────────────
    { id: 'ahpra',       keywords: ['ahpra registration', 'ahpra registered', 'current ahpra', 'registered with ahpra'], label: 'AHPRA registration', category: 'registration' },
    { id: 'rn',          keywords: ['registered nurse', 'rn registration', 'div 1 registered nurse'], label: 'Registered Nurse (RN)', category: 'registration' },
    { id: 'medical-reg', keywords: ['medical board of australia', 'general registration as a medical practitioner'], label: 'Medical Board registration', category: 'registration' },

    // ── Engineering / specialist ────────────────────────────────────────────
    { id: 'rpeq',        keywords: ['rpeq registered', 'registered professional engineer of queensland'], label: 'RPEQ registration', category: 'registration' },
    { id: 'npers',       keywords: ['npers registered', 'engineers australia chartered'], label: 'Engineers Australia Chartered status', category: 'registration' },

    // ── Project management / PM ─────────────────────────────────────────────
    { id: 'pmp',         keywords: ['pmp certified', 'pmp certification required', 'must hold pmp', 'pmi pmp'], label: 'PMP certification', category: 'credential' },
    { id: 'prince2',     keywords: ['prince2 practitioner required', 'must hold prince2 practitioner'], label: 'PRINCE2 Practitioner', category: 'credential' },

    // ── Security clearances ─────────────────────────────────────────────────
    { id: 'baseline-clearance', keywords: ['baseline clearance required', 'baseline security clearance', 'must hold baseline'], label: 'Baseline security clearance', category: 'clearance' },
    { id: 'nv1-clearance',      keywords: ['nv1 clearance', 'negative vetting level 1', 'nv-1 clearance'], label: 'NV1 security clearance', category: 'clearance' },
    { id: 'nv2-clearance',      keywords: ['nv2 clearance', 'negative vetting level 2', 'nv-2 clearance'], label: 'NV2 security clearance', category: 'clearance' },
    { id: 'pv-clearance',       keywords: ['pv clearance', 'positive vetting'], label: 'Positive Vetting clearance', category: 'clearance' },

    // ── Visa / citizenship ──────────────────────────────────────────────────
    { id: 'au-citizen',  keywords: ['australian citizenship required', 'must be an australian citizen', 'australian citizens only', 'aus citizenship required'], label: 'Australian citizenship', category: 'visa' },
    { id: 'au-pr',       keywords: ['australian permanent resident', 'must hold permanent residency', 'pr required', 'permanent residency required'], label: 'Australian Permanent Residency', category: 'visa' },
    { id: 'work-rights', keywords: ['full working rights', 'unrestricted work rights', 'no visa sponsorship'], label: 'Full / unrestricted Australian work rights', category: 'visa' },

    // ── Other ───────────────────────────────────────────────────────────────
    { id: 'drivers-licence', keywords: ['current drivers licence', 'valid driver\'s licence required', 'must hold a drivers licence'], label: 'Current Australian driver\'s licence', category: 'credential' },
    { id: 'wwcc',        keywords: ['working with children check', 'wwcc required', 'current wwcc'], label: 'Working With Children Check (WWCC)', category: 'registration' },
    { id: 'police-check',keywords: ['national police check', 'police clearance'], label: 'National Police Check', category: 'registration' },
];

/**
 * Detect Hard Gap signals in a job description.
 *
 * Returns an array of HardGapItems whose keywords match the JD text
 * (case-insensitive substring match). Does NOT cross-reference the
 * candidate's profile — that happens in the analysis prompt. The list
 * here is the universe of "things the model should treat as hard gaps
 * if the candidate doesn't claim them on their profile."
 */
export function detectHardGapHints(jobDescription: string): HardGapItem[] {
    const haystack = (jobDescription ?? '').toLowerCase();
    if (!haystack) return [];

    const hits: HardGapItem[] = [];
    for (const item of HARD_GAP_ITEMS) {
        if (item.keywords.some((kw) => haystack.includes(kw))) {
            hits.push(item);
        }
    }
    return hits;
}

/**
 * Simple keyword check for whether a JD likely requires a selection-criteria
 * response (separate document, structured answers). Used to auto-flip the
 * SC toggle on the Strategy Hub hero. A subsequent LLM verifier can confirm.
 */
const SC_KEYWORDS = [
    'selection criteria',
    'key selection criteria',
    'address the criteria',
    'criteria-based application',
    'addressing the following criteria',
    'address each of the following',
    'respond to the criteria',
    'capability framework',
    'aps integrated leadership system',
];

export function detectSelectionCriteria(jobDescription: string): boolean {
    const haystack = (jobDescription ?? '').toLowerCase();
    return SC_KEYWORDS.some((kw) => haystack.includes(kw));
}
