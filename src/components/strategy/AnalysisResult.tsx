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
import { useState, useEffect } from 'react';
import { capabilityStatement, type BridgedGap } from '../../lib/bridgedGaps';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles, Lock, Pencil, AlertCircle } from 'lucide-react';
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
    onBridgedGapsChange?: (gaps: BridgedGap[]) => void;
}

export function AnalysisResult({ result, jobDescription, onContinue, onSkip: _onSkip, onBridgedGapsChange }: Props) {
    const { fitBands, extractedMetadata, dominantBand, insights, duplicate } = result;
    const { directMatch, bridgeableGap, hardGap } = fitBands;

    const [draftIndex, setDraftIndex] = useState<number | null>(null);
    const [bridgedIndices, setBridgedIndices] = useState<Set<number>>(new Set());
    const [bridgedText, setBridgedText] = useState<Map<number, string>>(new Map());
    const [enrichmentDone, setEnrichmentDone] = useState(false);
    const enrichmentCandidates = result.enrichmentCandidates ?? [];
    const draftItem = draftIndex !== null ? bridgeableGap.items[draftIndex] ?? null : null;

    useEffect(() => {
        if (!onBridgedGapsChange) return;
        const gaps: BridgedGap[] = [...bridgedIndices].map(i => {
            const item = bridgeableGap.items[i];
            const edited = bridgedText.get(i);
            const statement = (edited && edited.trim()) || capabilityStatement(item?.suggestion ?? '');
            return { skill: item?.skill ?? '', statement };
        }).filter(g => g.skill && g.statement);
        onBridgedGapsChange(gaps);
    }, [bridgedIndices, bridgedText, bridgeableGap.items, onBridgedGapsChange]);

    const headline =
        dominantBand === 'directMatch'
            ? `Your achievements prove you can do ${directMatch.pct}% of this role right now.`
            : dominantBand === 'bridgeableGap'
              ? `Direct match: ${directMatch.pct}%. Could add: ${directMatch.pct + bridgeableGap.pct}% once you name what you already do.`
              : 'This role lists requirements you haven\'t claimed on your profile.';
    const bridgedCount = bridgedIndices.size;

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
                border: `1px solid ${bridgedCount > 0 ? 'rgba(45,90,110,0.35)' : warm.colors.borderWhisper}`,
                borderRadius: 14,
                boxShadow: warm.shadow.soft,
                marginBottom: 16,
                transition: 'border-color 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
            }}>
                <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                        Apply for this role
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: bridgedCount > 0 ? warm.colors.success : warm.colors.textMuted }}>
                        {bridgedCount > 0
                            ? `✓ ${bridgedCount} strength${bridgedCount > 1 ? 's' : ''} added — you're ready to apply`
                            : `${extractedMetadata.role} · ${extractedMetadata.company}`}
                    </p>
                </div>
                <button
                    onClick={onContinue}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: bridgedCount > 0 ? '12px 26px' : '10px 22px',
                        fontSize: 14,
                        fontWeight: 700,
                        color: warm.colors.bgCanvas,
                        background: warm.colors.accentPetrol,
                        border: 'none',
                        borderRadius: 12,
                        cursor: 'pointer',
                        boxShadow: bridgedCount > 0
                            ? `0 0 0 4px rgba(45,90,110,0.18), ${warm.shadow.soft}`
                            : warm.shadow.soft,
                        letterSpacing: '-0.01em',
                        whiteSpace: 'nowrap',
                        transition: 'padding 0.3s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
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

            {/* Bridgeable Gap card */}
            {bridgeableGap.items.length > 0 && (
                <ResultCard
                    accent={warm.colors.accentPetrol}
                    icon={<Sparkles size={18} />}
                    label="Could add"
                    pct={bridgeableGap.pct}
                    body={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                            <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.55 }}>
                                You likely have these — they just aren't on your profile yet.
                                Adding them boosts your match to {directMatch.pct + bridgeableGap.pct}%.
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <input
                                                        type="checkbox"
                                                        id={`bridge-${i}`}
                                                        checked={isBridged}
                                                        onChange={() => {
                                                            setBridgedIndices(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(i)) {
                                                                    next.delete(i);
                                                                } else {
                                                                    next.add(i);
                                                                }
                                                                return next;
                                                            });
                                                        }}
                                                        style={{ accentColor: warm.colors.accentPetrol, cursor: 'pointer', flexShrink: 0, width: 18, height: 18 }}
                                                    />
                                                    <label htmlFor={`bridge-${i}`} style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary, cursor: 'pointer',
                                                        textDecoration: isBridged ? 'line-through' : 'none',
                                                        textDecorationColor: 'rgba(125,166,125,0.55)',
                                                        textDecorationThickness: '1px',
                                                    }}>
                                                        {item.skill}
                                                    </label>
                                                </div>
                                                {isBridged ? (
                                                    <div style={{
                                                        marginTop: 8,
                                                        marginLeft: 28,
                                                        padding: '8px 10px',
                                                        background: 'rgba(125,166,125,0.08)',
                                                        border: '1px solid rgba(125,166,125,0.20)',
                                                        borderRadius: 8,
                                                        fontSize: 12,
                                                        color: warm.colors.textSecondary,
                                                        lineHeight: 1.55,
                                                    }}>
                                                        <textarea
                                                            value={bridgedText.get(i) ?? capabilityStatement(item.suggestion)}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setBridgedText(prev => {
                                                                    const next = new Map(prev);
                                                                    next.set(i, v);
                                                                    return next;
                                                                });
                                                            }}
                                                            rows={2}
                                                            style={{
                                                                width: '100%', margin: 0, fontSize: 12,
                                                                color: warm.colors.textSecondary, lineHeight: 1.55,
                                                                background: 'transparent', border: 'none',
                                                                resize: 'vertical', fontStyle: 'italic', fontFamily: 'inherit',
                                                            }}
                                                        />
                                                        <p style={{ margin: '2px 0 0', fontSize: 10.5, color: warm.colors.textMuted, fontStyle: 'normal' }}>
                                                            Tip: edit in a real metric to stand out.
                                                        </p>
                                                        <div style={{ marginTop: 6, display: 'flex', gap: 10 }}>
                                                            <button
                                                                onClick={() => {
                                                                    setBridgedIndices(prev => {
                                                                        const next = new Set(prev);
                                                                        next.delete(i);
                                                                        return next;
                                                                    });
                                                                }}
                                                                style={{
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    color: warm.colors.textMuted,
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    padding: '4px 0',
                                                                }}
                                                            >
                                                                &#215; Undo
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p style={{
                                                        margin: '4px 0 0 28px',
                                                        fontSize: 12,
                                                        color: warm.colors.textSecondary,
                                                        lineHeight: 1.55,
                                                        fontStyle: 'italic',
                                                    }}>
                                                        &ldquo;{item.suggestion}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                            {!isBridged && (
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
                                                    Draft
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                            <button
                                onClick={onContinue}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    padding: '10px 20px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: warm.colors.bgCanvas,
                                    background: bridgedIndices.size > 0 ? warm.colors.accentPetrol : 'rgba(125,166,125,0.50)',
                                    border: 'none',
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    transition: 'background 0.25s',
                                    marginTop: 4,
                                }}
                            >
                                Apply for this role
                                <ArrowRight size={14} />
                            </button>
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


            {/* Achievement draft modal — fired from Bridgeable Gap items */}
            <AchievementDraftModal
                open={draftItem !== null}
                onClose={() => setDraftIndex(null)}
                skill={draftItem?.skill ?? ''}
                suggestion={draftItem?.suggestion ?? ''}
                jobRole={extractedMetadata.role}
                jobCompany={extractedMetadata.company}
                onSaved={(finalDescription) => {
                    if (draftIndex !== null) {
                        const idx = draftIndex;
                        setBridgedText(prev => {
                            const next = new Map(prev);
                            next.set(idx, finalDescription);
                            return next;
                        });
                        setBridgedIndices(prev => {
                            const next = new Set(prev);
                            next.add(idx);
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
