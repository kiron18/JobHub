/**
 * CoherenceCard — quiet "story health" panel on the Strategy Hub.
 *
 * Renders only when the server-side coherence check returns signals. Each
 * signal is a forward-framed action: scattered domain, seniority mismatch,
 * thin metrics, missing target, thin achievement bank.
 *
 * Calm-ally rule: this is not an error list. The chip uses sage by default
 * (story to tighten, not a problem to fix). High-severity items get a quiet
 * gold accent to indicate priority without alarming.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Compass, Target, Layers, Hash, Award } from 'lucide-react';
import { useAppTheme } from '../../contexts/ThemeContext';

export interface CoherenceSignal {
    category: 'missing_target' | 'seniority_mismatch' | 'scattered_domain' | 'thin_metrics' | 'thin_achievement_bank';
    severity: 'high' | 'medium' | 'low';
    headline: string;
    detail: string;
    fixHref?: string;
}

const ICONS: Record<CoherenceSignal['category'], React.ComponentType<{ size?: number }>> = {
    missing_target: Target,
    seniority_mismatch: Compass,
    scattered_domain: Layers,
    thin_metrics: Hash,
    thin_achievement_bank: Award,
};

export function CoherenceCard({ signals }: { signals: CoherenceSignal[] }) {
    const { T } = useAppTheme();
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    if (!signals || signals.length === 0) return null;

    return (
        <section>
            <p
                style={{
                    margin: '0 0 16px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: T.textMuted,
                }}
            >
                Story health · {signals.length} {signals.length === 1 ? 'signal' : 'signals'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {signals.map((signal, i) => {
                    const Icon = ICONS[signal.category];
                    const isHigh = signal.severity === 'high';
                    const accent = isHigh ? T.accentSuccess : T.accentSecondary;
                    const isOpen = expandedKey === `${signal.category}-${i}`;

                    return (
                        <div
                            key={`${signal.category}-${i}`}
                            style={{
                                background: T.card,
                                border: `1px solid ${T.cardBorder}`,
                                borderLeft: `3px solid ${accent}`,
                                borderRadius: 12,
                                overflow: 'hidden',
                            }}
                        >
                            <button
                                onClick={() => setExpandedKey(isOpen ? null : `${signal.category}-${i}`)}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 12,
                                    padding: '14px 16px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                <span style={{ display: 'inline-flex', color: accent, marginTop: 2, flexShrink: 0 }}>
                                    <Icon size={16} />
                                </span>
                                <p style={{ flex: 1, margin: 0, fontSize: 13.5, fontWeight: 600, color: T.text, lineHeight: 1.5 }}>
                                    {signal.headline}
                                </p>
                                <motion.span
                                    animate={{ rotate: isOpen ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    style={{ color: T.textMuted, flexShrink: 0, display: 'flex', marginTop: 2 }}
                                >
                                    <ChevronDown size={14} />
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
                                        <div style={{ padding: '0 16px 14px 44px' }}>
                                            <p style={{ margin: '0 0 10px', fontSize: 13, color: T.textMuted, lineHeight: 1.65 }}>
                                                {signal.detail}
                                            </p>
                                            {signal.fixHref && (
                                                <Link
                                                    to={signal.fixHref}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        color: accent,
                                                        textDecoration: 'underline',
                                                        textUnderlineOffset: 3,
                                                    }}
                                                >
                                                    Open profile to address this →
                                                </Link>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
