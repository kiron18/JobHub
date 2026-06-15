/**
 * AnalysisResult — Distance-to-Match output for the Strategy Hub hero.
 *
 * Renders the two result bands (Direct Match / Hard Gap) surfaced by
 * /api/analyze/dual. Always offers a continue path — the product is a
 * coach, not a filter.
 *
 * Visual language:
 *   - Direct Match    → gold (success/value)
 *   - Hard Gap        → muted slate (honest, never alarming)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { EnrichmentPrompt } from '../EnrichmentPrompt';

export interface DuplicateInfo {
    applicationId: string;
    title: string;
    company: string;
    status: string;
    dateApplied: string | null;
    createdAt: string;
}

export interface DualSignalResult {
    positioningStatement: string | null;
    extractedMetadata: { company: string; role: string };
    fitBands: {
        directMatch:   { pct: number; evidence: string[] };
        bridgeableGap: { pct: number; items: Array<{ skill: string; suggestion: string }> };  // Deprecated: always empty
        hardGap:       { items: string[] };
    };
    dominantBand: 'directMatch' | 'hardGap';  // bridgeableGap removed
    insights: string[];
    scDetected: boolean;
    duplicate?: DuplicateInfo | null;
    enrichmentCandidates?: Array<{ achievementId: string; title: string; text: string }>;
}

interface Props {
    result: DualSignalResult;
    jobDescription: string;
    onContinue: () => void;
    onSkip?: () => void;
}

export function AnalysisResult({ result, jobDescription, onContinue }: Props) {
    const { fitBands, extractedMetadata, dominantBand, insights, duplicate } = result;
    const { directMatch, hardGap } = fitBands;

    const [enrichmentDone, setEnrichmentDone] = useState(false);
    const enrichmentCandidates = result.enrichmentCandidates ?? [];

    const headline =
        dominantBand === 'directMatch'
            ? `Your achievements prove you can do ${directMatch.pct}% of this role right now.`
            : 'This role lists requirements you haven\'t claimed on your profile.';

    return (
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Duplicate warning — soft, never blocks */}
            {duplicate && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 18px',
                    background: 'rgba(197,160,89,0.08)',
                    border: '1px solid rgba(197,160,89,0.25)',
                    borderRadius: 12,
                }}>
                    <AlertCircle size={18} style={{ color: warm.colors.success, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                            You analysed a similar role on {formatDate(duplicate.createdAt)}.
                        </p>
                        <p style={{ margin: '0 0 8px', fontSize: 12, color: warm.colors.textSecondary, lineHeight: 1.55 }}>
                            {duplicate.title} at {duplicate.company} · status: {humaniseStatus(duplicate.status)}
                            {duplicate.dateApplied && ` · applied ${formatDate(duplicate.dateApplied)}`}
                        </p>
                        <Link
                            to="/tracker"
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: warm.colors.success,
                                textDecoration: 'none',
                            }}
                        >
                            View existing application →
                        </Link>
                    </div>
                </div>
            )}

            {/* Apply CTA */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 20px',
                background: warm.colors.bgSurface,
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 14,
                boxShadow: warm.shadow.soft,
                marginBottom: 16,
            }}>
                <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                        Apply for this role
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: warm.colors.textMuted }}>
                        {extractedMetadata.role} · {extractedMetadata.company}
                    </p>
                </div>
                <button
                    onClick={onContinue}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '10px 22px',
                        fontSize: 14,
                        fontWeight: 700,
                        color: warm.colors.bgCanvas,
                        background: warm.colors.accentPetrol,
                        border: 'none',
                        borderRadius: 12,
                        cursor: 'pointer',
                        boxShadow: warm.shadow.soft,
                        letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap',
                    }}
                >
                    Apply now
                    <ArrowRight size={16} />
                </button>
            </div>

            {/* Headline + role/company */}
            <div>
                <p style={{
                    margin: '0 0 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: warm.colors.textSecondary,
                }}>
                    Analysis · {extractedMetadata.role} · {extractedMetadata.company}
                </p>
                <h2 style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: warm.colors.textPrimary,
                    lineHeight: 1.35,
                }}>
                    {headline}
                </h2>
            </div>

            {/* Direct Match card */}
            {directMatch.pct > 0 && (
                <ResultCard
                    accent={warm.colors.success}
                    icon={<CheckCircle2 size={18} />}
                    label="Include in resume"
                    pct={directMatch.pct}
                    body={
                        <div style={{ marginTop: 4 }}>
                            <p style={{ margin: '0 0 10px', fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.55 }}>
                                Achievements that prove you can deliver what this role asks for.
                                <br /><strong>These will be included in your resume.</strong>
                            </p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {directMatch.evidence.length === 0 ? (
                                    <li style={{ fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                                        No achievements surfaced for this role yet.
                                    </li>
                                ) : (
                                    directMatch.evidence.map((line, i) => (
                                        <li key={i} style={{
                                            fontSize: 13,
                                            color: warm.colors.textSecondary,
                                            lineHeight: 1.6,
                                            paddingLeft: 14,
                                            position: 'relative',
                                        }}>
                                            <span style={{ position: 'absolute', left: 0, color: warm.colors.success }}>•</span>
                                            {line}
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>
                    }
                />
            )}

            {/* Hard Gap card */}
            {hardGap.items.length > 0 && (
                <ResultCard
                    accent={warm.colors.textSecondary}
                    icon={<Lock size={18} />}
                    label="Not on your profile"
                    pct={null}
                    body={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                            <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.55 }}>
                                These look like formal requirements you haven't claimed on your profile. If you do hold them, add them to your profile so future analyses pick them up.
                            </p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {hardGap.items.map((item, i) => (
                                    <li key={i} style={{
                                        fontSize: 13,
                                        color: warm.colors.textPrimary,
                                        lineHeight: 1.55,
                                        paddingLeft: 14,
                                        position: 'relative',
                                    }}>
                                        <span style={{ position: 'absolute', left: 0, color: warm.colors.textSecondary }}>•</span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    }
                />
            )}

            {/* Insights */}
            {insights.length > 0 && (
                <div>
                    <p style={{
                        margin: '8px 0 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: warm.colors.textSecondary,
                    }}>
                        Strategic notes
                    </p>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {insights.map((line, i) => (
                            <li key={i} style={{
                                fontSize: 13,
                                color: warm.colors.textSecondary,
                                lineHeight: 1.65,
                                paddingLeft: 14,
                                position: 'relative',
                            }}>
                                <span style={{ position: 'absolute', left: 0, color: warm.colors.textMuted }}>·</span>
                                {line}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* JD-time enrichment — surfaces achievements that match this JD
                but lack a real metric so the user can sharpen them before
                generating. Skipping never blocks the continue button. */}
            {enrichmentCandidates.length > 0 && !enrichmentDone && (
                <EnrichmentPrompt
                    jobDescription={jobDescription}
                    achievementIds={enrichmentCandidates.map(c => c.achievementId)}
                    onComplete={() => setEnrichmentDone(true)}
                    onSkipAll={() => setEnrichmentDone(true)}
                />
            )}
        </div>
    );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return iso;
    }
}

function humaniseStatus(status: string): string {
    const map: Record<string, string> = {
        SAVED: 'Saved',
        APPLIED: 'Applied',
        INTERVIEW: 'Interview',
        OFFER: 'Offer',
        REJECTED: 'Rejected',
    };
    return map[status] ?? status;
}

// ─── Internal ResultCard ────────────────────────────────────────────────────

function ResultCard({
    accent,
    icon,
    label,
    pct,
    body,
}: {
    accent: string;
    icon: React.ReactNode;
    label: string;
    pct: number | null;
    body: React.ReactNode;
}) {
    return (
        <div style={{
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderLeft: `3px solid ${accent}`,
            borderRadius: 14,
            padding: '18px 22px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-flex', color: accent }}>{icon}</span>
                    <p style={{
                        margin: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: accent,
                    }}>
                        {label}
                    </p>
                </div>
                {pct !== null && (
                    <p style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        color: accent,
                        fontVariantNumeric: 'tabular-nums',
                    }}>
                        {pct}%
                    </p>
                )}
            </div>
            {body}
        </div>
    );
}
