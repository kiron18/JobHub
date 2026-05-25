/**
 * AnalysisResult — Distance-to-Match output for the Strategy Hub hero.
 *
 * Renders the three result bands (Direct Match / Bridgeable Gap / Hard Gap)
 * surfaced by /api/analyze/dual. Always offers a continue path — the
 * product is a coach, not a filter.
 *
 * Visual language:
 *   - Direct Match    → gold (success/value)
 *   - Bridgeable Gap  → sage (potential/progress)
 *   - Hard Gap        → muted slate (honest, never alarming)
 *
 * Achievement-draft-from-gap modal is a stub for now — clicking it routes
 * the user to /workspace where they can edit achievements directly. Phase
 * 2i will replace this with an inline LLM-draft modal.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles, Lock, Pencil, AlertCircle, Check } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { AchievementDraftModal } from './AchievementDraftModal';
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
        bridgeableGap: { pct: number; items: Array<{ skill: string; suggestion: string }> };
        hardGap:       { items: string[] };
    };
    dominantBand: 'directMatch' | 'bridgeableGap' | 'hardGap';
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

export function AnalysisResult({ result, jobDescription, onContinue, onSkip }: Props) {
    const { fitBands, extractedMetadata, dominantBand, insights, duplicate } = result;
    const { directMatch, bridgeableGap, hardGap } = fitBands;

    const [draftIndex, setDraftIndex] = useState<number | null>(null);
    const [bridgedIndices, setBridgedIndices] = useState<Set<number>>(new Set());
    const [enrichmentDone, setEnrichmentDone] = useState(false);
    const enrichmentCandidates = result.enrichmentCandidates ?? [];
    const draftItem = draftIndex !== null ? bridgeableGap.items[draftIndex] ?? null : null;

    const headline =
        dominantBand === 'directMatch'
            ? `Your achievements prove you can do ${directMatch.pct}% of this role right now.`
            : dominantBand === 'bridgeableGap'
              ? `Direct match: ${directMatch.pct}%. Likely fit: ${directMatch.pct + bridgeableGap.pct}% once we name what you already do.`
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
                    label="Direct match"
                    pct={directMatch.pct}
                    body={
                        <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {directMatch.evidence.length === 0 ? (
                                <li style={{ fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                                    No achievement evidence surfaced for this role.
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
                    }
                />
            )}

            {/* Bridgeable Gap card */}
            {bridgeableGap.items.length > 0 && (
                <ResultCard
                    accent={warm.colors.accentPetrol}
                    icon={<Sparkles size={18} />}
                    label="Bridgeable gap"
                    pct={bridgeableGap.pct}
                    body={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                            <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.55 }}>
                                Based on your role and experience you likely have these. They just aren't named on your profile yet. Draft and save each one to strengthen your match for future analyses.
                            </p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {bridgeableGap.items.map((item, i) => {
                                    const isBridged = bridgedIndices.has(i);
                                    return (
                                        <li key={i} style={{
                                            padding: '12px 14px',
                                            background: isBridged ? 'rgba(125,166,125,0.14)' : 'rgba(125,166,125,0.06)',
                                            border: `1px solid ${isBridged ? 'rgba(125,166,125,0.40)' : 'rgba(125,166,125,0.18)'}`,
                                            borderRadius: 10,
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            gap: 12,
                                            transition: 'background 0.25s, border-color 0.25s, opacity 0.25s',
                                            opacity: isBridged ? 0.85 : 1,
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    margin: '0 0 4px',
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: warm.colors.textPrimary,
                                                    textDecoration: isBridged ? 'line-through' : 'none',
                                                    textDecorationColor: 'rgba(125,166,125,0.55)',
                                                    textDecorationThickness: '1px',
                                                }}>
                                                    {item.skill}
                                                </p>
                                                <p style={{
                                                    margin: 0,
                                                    fontSize: 12,
                                                    color: warm.colors.textSecondary,
                                                    lineHeight: 1.55,
                                                    fontStyle: 'italic',
                                                }}>
                                                    {isBridged ? 'Drafted and saved to your achievements.' : `"${item.suggestion}"`}
                                                </p>
                                            </div>
                                            {isBridged ? (
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        padding: '6px 10px',
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        color: warm.colors.accentPetrol,
                                                        background: 'rgba(125,166,125,0.18)',
                                                        border: '1px solid rgba(125,166,125,0.45)',
                                                        borderRadius: 8,
                                                        flexShrink: 0,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    <Check size={11} />
                                                    Bridged
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => setDraftIndex(i)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        padding: '6px 10px',
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        color: warm.colors.accentPetrol,
                                                        background: 'rgba(125,166,125,0.10)',
                                                        border: '1px solid rgba(125,166,125,0.30)',
                                                        borderRadius: 8,
                                                        cursor: 'pointer',
                                                        flexShrink: 0,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    <Pencil size={11} />
                                                    Draft this
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
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
                    label="Hard gap"
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

            {/* CTAs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                <button
                    onClick={onContinue}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '12px 22px',
                        fontSize: 14,
                        fontWeight: 700,
                        color: warm.colors.bgCanvas,
                        background: warm.colors.accentPetrol,
                        border: 'none',
                        borderRadius: 12,
                        cursor: 'pointer',
                        boxShadow: warm.shadow.soft,
                        letterSpacing: '-0.01em',
                    }}
                >
                    {dominantBand === 'hardGap' ? 'Apply anyway' : 'Apply'}
                    <ArrowRight size={16} />
                </button>
                {dominantBand === 'hardGap' && onSkip && (
                    <button
                        onClick={onSkip}
                        style={{
                            padding: '12px 18px',
                            fontSize: 13,
                            fontWeight: 600,
                            color: warm.colors.textSecondary,
                            background: 'transparent',
                            border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 12,
                            cursor: 'pointer',
                        }}
                    >
                        Skip this one
                    </button>
                )}
            </div>

            {/* Achievement draft modal — fired from Bridgeable Gap items */}
            <AchievementDraftModal
                open={draftItem !== null}
                onClose={() => setDraftIndex(null)}
                skill={draftItem?.skill ?? ''}
                suggestion={draftItem?.suggestion ?? ''}
                jobRole={extractedMetadata.role}
                jobCompany={extractedMetadata.company}
                onSaved={() => {
                    if (draftIndex !== null) {
                        setBridgedIndices(prev => {
                            const next = new Set(prev);
                            next.add(draftIndex);
                            return next;
                        });
                    }
                    setDraftIndex(null);
                }}
            />
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
