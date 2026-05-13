/**
 * DraftCritiquePanel — quiet review surface that opens beside a document
 * draft in the stepper workspace. Each issue is category-coded with a
 * quoted snippet from the draft + why it hurts + how to rewrite.
 *
 * Calm-ally rule: this is a coach, not a grader. The "trust score" is the
 * frame, never a "you failed" panel. Strengths render alongside issues so
 * the user always sees what's working. The overall verdict is one sentence
 * of evidence-led judgement.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck, ChevronDown, X, AlertCircle, ShieldAlert, ThumbsUp } from 'lucide-react';
import { useAppTheme } from '../../contexts/ThemeContext';

export type CritiqueCategory = 'desperation' | 'overselling' | 'hedging' | 'vagueness' | 'weak_opening' | 'incoherence' | 'generic_positioning';

export interface CritiqueIssue {
    category: CritiqueCategory;
    severity: 'high' | 'medium' | 'low';
    snippet: string;
    why: string;
    fix: string;
}

export interface CritiqueResult {
    overall: { verdict: string; trustScore: number };
    issues: CritiqueIssue[];
    strengths: string[];
}

const CATEGORY_LABEL: Record<CritiqueCategory, string> = {
    desperation: 'Desperation signal',
    overselling: 'Overselling',
    hedging: 'Hedging',
    vagueness: 'Vagueness',
    weak_opening: 'Weak opening',
    incoherence: 'Narrative gap',
    generic_positioning: 'Generic positioning',
};

interface Props {
    open: boolean;
    onClose: () => void;
    loading: boolean;
    result: CritiqueResult | null;
}

export function DraftCritiquePanel({ open, onClose, loading, result }: Props) {
    const { T } = useAppTheme();
    const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

    if (!open) return null;

    const trustScore = result?.overall?.trustScore ?? 0;
    const trustColor = trustScore >= 80 ? T.accentSecondary : trustScore >= 60 ? T.accentSuccess : T.textMuted;

    return (
        <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.22 }}
            style={{
                background: T.card,
                border: `1px solid ${T.cardBorder}`,
                borderRadius: 14,
                padding: 22,
                marginTop: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }}
        >
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'inline-flex', color: T.accentSuccess, marginTop: 2, flexShrink: 0 }}>
                        <ShieldCheck size={18} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            margin: '0 0 4px',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: T.textMuted,
                        }}>
                            Draft review
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.55 }}>
                            What a recruiter scans for, before the words register.
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close review"
                    style={{ background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', padding: 4, flexShrink: 0 }}
                >
                    <X size={16} />
                </button>
            </header>

            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '36px 0', color: T.textMuted, fontSize: 13 }}>
                    <Loader2 size={16} className="animate-spin" />
                    Reading through your draft…
                </div>
            )}

            {!loading && result && (
                <>
                    {/* Verdict + score */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '14px 16px',
                        background: 'rgba(125,166,125,0.06)',
                        border: `1px solid rgba(125,166,125,0.20)`,
                        borderRadius: 12,
                    }}>
                        <div style={{
                            flexShrink: 0,
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `${trustColor}15`,
                            border: `2px solid ${trustColor}50`,
                        }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: trustColor, fontVariantNumeric: 'tabular-nums' }}>
                                {trustScore}
                            </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textMuted }}>
                                Recruiter trust read
                            </p>
                            <p style={{ margin: 0, fontSize: 13.5, color: T.text, lineHeight: 1.55, fontWeight: 500 }}>
                                {result.overall.verdict || 'Reviewed.'}
                            </p>
                        </div>
                    </div>

                    {/* Strengths */}
                    {result.strengths.length > 0 && (
                        <div>
                            <p style={{
                                margin: '0 0 10px',
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                color: T.accentSecondary,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <ThumbsUp size={11} />
                                What's working
                            </p>
                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {result.strengths.map((s, i) => (
                                    <li key={i} style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.65, paddingLeft: 14, position: 'relative' }}>
                                        <span style={{ position: 'absolute', left: 0, color: T.accentSecondary }}>·</span>
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Issues */}
                    {result.issues.length > 0 ? (
                        <div>
                            <p style={{
                                margin: '0 0 10px',
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                color: T.accentSuccess,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}>
                                <ShieldAlert size={11} />
                                Tighten these · {result.issues.length}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {result.issues.map((issue, idx) => {
                                    const isOpen = expandedIdx === idx;
                                    const accent = issue.severity === 'high' ? T.accentSuccess : issue.severity === 'medium' ? T.textMuted : T.textFaint;
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                background: 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${T.cardBorder}`,
                                                borderLeft: `3px solid ${accent}`,
                                                borderRadius: 10,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <button
                                                onClick={() => setExpandedIdx(isOpen ? null : idx)}
                                                style={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 10,
                                                    padding: '12px 14px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                }}
                                            >
                                                <AlertCircle size={14} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{
                                                        margin: '0 0 3px',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        letterSpacing: '0.12em',
                                                        textTransform: 'uppercase',
                                                        color: accent,
                                                    }}>
                                                        {CATEGORY_LABEL[issue.category] ?? issue.category}
                                                    </p>
                                                    <p style={{ margin: 0, fontSize: 12.5, color: T.text, lineHeight: 1.5, fontStyle: 'italic' }}>
                                                        "{issue.snippet}"
                                                    </p>
                                                </div>
                                                <motion.span
                                                    animate={{ rotate: isOpen ? 180 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    style={{ color: T.textMuted, flexShrink: 0, marginTop: 2, display: 'flex' }}
                                                >
                                                    <ChevronDown size={12} />
                                                </motion.span>
                                            </button>

                                            <AnimatePresence initial={false}>
                                                {isOpen && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.22 }}
                                                        style={{ overflow: 'hidden' }}
                                                    >
                                                        <div style={{ padding: '0 14px 14px 38px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            {issue.why && (
                                                                <div>
                                                                    <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.textFaint }}>
                                                                        Why it hurts
                                                                    </p>
                                                                    <p style={{ margin: 0, fontSize: 12.5, color: T.textMuted, lineHeight: 1.65 }}>
                                                                        {issue.why}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {issue.fix && (
                                                                <div>
                                                                    <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: T.accentSecondary }}>
                                                                        How to rewrite
                                                                    </p>
                                                                    <p style={{ margin: 0, fontSize: 12.5, color: T.text, lineHeight: 1.65 }}>
                                                                        {issue.fix}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.65, textAlign: 'center', padding: '16px 0' }}>
                            No recruiter-trust issues flagged. Read it through once more, then send.
                        </p>
                    )}
                </>
            )}
        </motion.aside>
    );
}
