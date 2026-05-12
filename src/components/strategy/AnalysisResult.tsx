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
import { ArrowRight, CheckCircle2, Sparkles, Lock, Pencil, AlertCircle } from 'lucide-react';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AchievementDraftModal } from './AchievementDraftModal';

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
}

interface Props {
    result: DualSignalResult;
    onContinue: () => void;
    onSkip?: () => void;
}

export function AnalysisResult({ result, onContinue, onSkip }: Props) {
    const { T } = useAppTheme();
    const { fitBands, extractedMetadata, dominantBand, insights, duplicate } = result;
    const { directMatch, bridgeableGap, hardGap } = fitBands;

    const [draftIndex, setDraftIndex] = useState<number | null>(null);
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
                    <AlertCircle size={18} style={{ color: T.accentSuccess, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: T.text }}>
                            You analysed a similar role on {formatDate(duplicate.createdAt)}.
                        </p>
                        <p style={{ margin: '0 0 8px', fontSize: 12, color: T.textMuted, lineHeight: 1.55 }}>
                            {duplicate.title} at {duplicate.company} · status: {humaniseStatus(duplicate.status)}
                            {duplicate.dateApplied && ` · applied ${formatDate(duplicate.dateApplied)}`}
                        </p>
                        <Link
                            to="/tracker"
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: T.accentSuccess,
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
                    color: T.textMuted,
                }}>
                    Analysis · {extractedMetadata.role} · {extractedMetadata.company}
                </p>
                <h2 style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: T.text,
                    lineHeight: 1.35,
                }}>
                    {headline}
                </h2>
            </div>

            {/* Direct Match card */}
            {directMatch.pct > 0 && (
                <ResultCard
                    accent={T.accentSuccess}
                    icon={<CheckCircle2 size={18} />}
                    label="Direct match"
                    pct={directMatch.pct}
                    body={
                        <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {directMatch.evidence.length === 0 ? (
                                <li style={{ fontSize: 13, color: T.textFaint, lineHeight: 1.6 }}>
                                    No achievement evidence surfaced for this role.
                                </li>
                            ) : (
                                directMatch.evidence.map((line, i) => (
                                    <li key={i} style={{
                                        fontSize: 13,
                                        color: T.textMuted,
                                        lineHeight: 1.6,
                                        paddingLeft: 14,
                                        position: 'relative',
                                    }}>
                                        <span style={{ position: 'absolute', left: 0, color: T.accentSuccess }}>•</span>
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
                    accent={T.accentSecondary}
                    icon={<Sparkles size={18} />}
                    label="Bridgeable gap"
                    pct={bridgeableGap.pct}
                    body={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                            <p style={{ margin: 0, fontSize: 12, color: T.textFaint, lineHeight: 1.55 }}>
                                Based on your role and experience you likely have these. They just aren't named on your profile yet. Draft and save each one to strengthen your match for future analyses.
                            </p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {bridgeableGap.items.map((item, i) => (
                                    <li key={i} style={{
                                        padding: '12px 14px',
                                        background: 'rgba(125,166,125,0.06)',
                                        border: '1px solid rgba(125,166,125,0.18)',
                                        borderRadius: 10,
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: T.text }}>
                                                {item.skill}
                                            </p>
                                            <p style={{ margin: 0, fontSize: 12, color: T.textMuted, lineHeight: 1.55, fontStyle: 'italic' }}>
                                                "{item.suggestion}"
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setDraftIndex(i)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                padding: '6px 10px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: T.accentSecondary,
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
                                    </li>
                                ))}
                            </ul>
                        </div>
                    }
                />
            )}

            {/* Hard Gap card */}
            {hardGap.items.length > 0 && (
                <ResultCard
                    accent={T.textMuted}
                    icon={<Lock size={18} />}
                    label="Hard gap"
                    pct={null}
                    body={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                            <p style={{ margin: 0, fontSize: 12, color: T.textFaint, lineHeight: 1.55 }}>
                                These look like formal requirements you haven't claimed on your profile. If you do hold them, add them to your profile so future analyses pick them up.
                            </p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {hardGap.items.map((item, i) => (
                                    <li key={i} style={{
                                        fontSize: 13,
                                        color: T.text,
                                        lineHeight: 1.55,
                                        paddingLeft: 14,
                                        position: 'relative',
                                    }}>
                                        <span style={{ position: 'absolute', left: 0, color: T.textMuted }}>•</span>
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
                        color: T.textMuted,
                    }}>
                        Strategic notes
                    </p>
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {insights.map((line, i) => (
                            <li key={i} style={{
                                fontSize: 13,
                                color: T.textMuted,
                                lineHeight: 1.65,
                                paddingLeft: 14,
                                position: 'relative',
                            }}>
                                <span style={{ position: 'absolute', left: 0, color: T.textFaint }}>·</span>
                                {line}
                            </li>
                        ))}
                    </ul>
                </div>
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
                        color: T.btnText,
                        background: T.btnBg,
                        border: 'none',
                        borderRadius: 12,
                        cursor: 'pointer',
                        boxShadow: T.btnShadow,
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
                            color: T.textMuted,
                            background: 'transparent',
                            border: `1px solid ${T.cardBorder}`,
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
                onSaved={() => setDraftIndex(null)}
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
    const { T } = useAppTheme();
    return (
        <div style={{
            background: T.card,
            border: `1px solid ${T.cardBorder}`,
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
