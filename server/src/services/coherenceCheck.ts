/**
 * Profile coherence check — heuristic, no LLM.
 *
 * Looks at the candidate's profile holistically and surfaces signals that
 * indicate the *story* isn't coherent yet. This is the "system does what
 * AI can't" pass for the profile itself: catches scattered identity,
 * seniority/years mismatch with target, thin metric coverage, missing
 * target role.
 *
 * Calm-ally framing rule: every signal must be expressed as a forward
 * action ("tighten the story toward X"), never a deficit ("your profile is
 * incoherent"). Frontend renders these as quiet nudges, not alarms.
 */

import type { PositioningStatement } from './positioningStatement';

export type CoherenceSeverity = 'high' | 'medium' | 'low';
export type CoherenceCategory =
    | 'missing_target'
    | 'seniority_mismatch'
    | 'scattered_domain'
    | 'thin_metrics'
    | 'thin_achievement_bank';

export interface CoherenceSignal {
    category: CoherenceCategory;
    severity: CoherenceSeverity;
    headline: string;
    detail: string;
    fixHref?: string;
}

interface ProfileLike {
    targetRole?: string | null;
    achievements?: Array<{ metric?: string | null }>;
    experience?: Array<{ company?: string | null; role?: string | null }>;
    positioningStatement?: PositioningStatement | null;
}

const SENIOR_KEYWORDS = ['senior', 'lead', 'principal', 'head', 'manager', 'director', 'chief', 'vp', 'vice president'];
const JUNIOR_KEYWORDS = ['graduate', 'junior', 'associate', 'trainee', 'intern'];

function isRealMetric(metric?: string | null): boolean {
    if (!metric || typeof metric !== 'string') return false;
    const trimmed = metric.trim();
    if (!trimmed || trimmed === 'qualitative') return false;
    return /\d/.test(trimmed);
}

const DOMAIN_HINTS: Array<{ domain: string; tokens: string[] }> = [
    { domain: 'banking',           tokens: ['bank', 'westpac', 'anz', 'commonwealth', 'macquarie'] },
    { domain: 'tech',              tokens: ['software', 'tech', 'saas', 'platform', 'engineering'] },
    { domain: 'consulting',        tokens: ['consult', 'advisory', 'deloitte', 'pwc', 'kpmg'] },
    { domain: 'government',        tokens: ['government', 'department of', 'commonwealth of', 'council'] },
    { domain: 'education',         tokens: ['university', 'school', 'college', 'tafe'] },
    { domain: 'healthcare',        tokens: ['hospital', 'health', 'clinic', 'medical'] },
    { domain: 'retail',            tokens: ['retail', 'coles', 'woolworths', 'bunnings'] },
    { domain: 'media',             tokens: ['media', 'news', 'publishing', 'broadcast'] },
    { domain: 'nonprofit',         tokens: ['foundation', 'charity', 'community', 'volunteer'] },
];

function inferEmployerDomain(text: string): string | null {
    const lower = text.toLowerCase();
    for (const { domain, tokens } of DOMAIN_HINTS) {
        if (tokens.some((t) => lower.includes(t))) return domain;
    }
    return null;
}

export function runCoherenceCheck(profile: ProfileLike): CoherenceSignal[] {
    const signals: CoherenceSignal[] = [];

    const targetRole = profile.targetRole?.trim();
    const positioning = profile.positioningStatement;
    const years = positioning?.components?.years ?? 0;
    const seniority = positioning?.components?.seniority;

    // ── 1. Missing target ──────────────────────────────────────────────────
    if (!targetRole) {
        signals.push({
            category: 'missing_target',
            severity: 'high',
            headline: 'Set a target role to focus the analysis.',
            detail: 'Without a target role, every analysis runs against a blank brief. Add one in your profile so we can compare apples to apples.',
            fixHref: '/workspace',
        });
    }

    // ── 2. Seniority mismatch ──────────────────────────────────────────────
    if (targetRole) {
        const targetLower = targetRole.toLowerCase();
        const targetIsSenior = SENIOR_KEYWORDS.some((k) => targetLower.includes(k));
        const targetIsJunior = JUNIOR_KEYWORDS.some((k) => targetLower.includes(k));
        const profileIsJunior = seniority === 'junior' || seniority === 'mid';
        const profileIsSenior = seniority === 'senior' || seniority === 'lead' || seniority === 'principal' || seniority === 'head' || seniority === 'director';

        if (targetIsSenior && profileIsJunior && years < 5) {
            signals.push({
                category: 'seniority_mismatch',
                severity: 'high',
                headline: `Your target reads senior, your resume reads mid-level.`,
                detail: `Targeting "${targetRole}" but your profile shows ${years} year${years === 1 ? '' : 's'} and a mid-level title. Either tighten the target one rung down, or surface your senior-level wins (team owned, budget held, decisions made) so the seniority signal carries.`,
            });
        } else if (targetIsJunior && (profileIsSenior || years >= 5)) {
            signals.push({
                category: 'seniority_mismatch',
                severity: 'medium',
                headline: `Your target reads junior, your resume reads experienced.`,
                detail: `Targeting "${targetRole}" but you have ${years}+ years of experience. Graduate and junior programs filter out overqualified applicants. Aim one rung up or reframe the target.`,
            });
        }
    }

    // ── 3. Scattered domain ────────────────────────────────────────────────
    const experiences = profile.experience ?? [];
    if (experiences.length >= 3) {
        const recentThree = experiences.slice(0, 3);
        const domains = recentThree
            .map((e) => inferEmployerDomain(`${e.company ?? ''} ${e.role ?? ''}`))
            .filter((d): d is string => d !== null);
        if (domains.length >= 2) {
            const uniqueDomains = new Set(domains);
            if (uniqueDomains.size >= 3 || (uniqueDomains.size === 2 && domains.length === recentThree.length)) {
                const list = [...uniqueDomains].slice(0, 3).join(', ');
                signals.push({
                    category: 'scattered_domain',
                    severity: 'medium',
                    headline: 'Your last three roles span different worlds.',
                    detail: `Recent experience sits across ${list}. Recruiters scan for a clear story in 6 seconds. Pick the domain you're targeting and lean into the relevant wins; you can keep the others, but lead with one.`,
                });
            }
        }
    }

    // ── 4. Thin metric coverage ────────────────────────────────────────────
    const achievements = profile.achievements ?? [];
    if (achievements.length >= 3) {
        const withMetric = achievements.filter((a) => isRealMetric(a.metric)).length;
        const ratio = withMetric / achievements.length;
        if (ratio < 0.4) {
            signals.push({
                category: 'thin_metrics',
                severity: 'medium',
                headline: `${achievements.length - withMetric} of your ${achievements.length} achievements have no number on them.`,
                detail: 'Numbers stop a scanning eye. Adding a measurable result to even two more achievements lifts every document you generate from here.',
                fixHref: '/workspace',
            });
        }
    }

    // ── 5. Thin achievement bank ───────────────────────────────────────────
    if (achievements.length > 0 && achievements.length < 5) {
        signals.push({
            category: 'thin_achievement_bank',
            severity: 'low',
            headline: `${achievements.length} achievement${achievements.length === 1 ? '' : 's'} on file. Add a few more for sharper matches.`,
            detail: 'Every analysis ranks your achievements against the JD. A wider bank means tighter matches and stronger generated drafts.',
            fixHref: '/workspace',
        });
    }

    return signals;
}
