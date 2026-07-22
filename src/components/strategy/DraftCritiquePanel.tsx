/**
 * DraftCritiquePanel — an optional second opinion on a draft, deliberately
 * kept out of the way.
 *
 * Design rule: this is a note in the margin, not a gate. It never grades the
 * document, never shows a score, and never opens by itself. At most two
 * suggestions, framed so it is obvious the user can ignore them and send. A
 * number would invite people to optimise for the number instead of the job.
 */
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

export type CritiqueCategory = 'desperation' | 'overselling' | 'hedging' | 'vagueness' | 'weak_opening' | 'incoherence' | 'generic_positioning' | 'inflation';

export interface CritiqueIssue {
    category: CritiqueCategory;
    snippet: string;
    why: string;
    fix: string;
}

export interface CritiqueResult {
    issues: CritiqueIssue[];
}

interface Props {
    open: boolean;
    onClose: () => void;
    loading: boolean;
    result: CritiqueResult | null;
}

export function DraftCritiquePanel({ open, onClose, loading, result }: Props) {
    if (!open) return null;

    const issues = result?.issues ?? [];

    return (
        <motion.aside
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            style={{
                background: 'transparent',
                borderTop: `1px solid ${warm.colors.borderWhisper}`,
                paddingTop: 14,
                marginTop: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}
        >
            <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.55 }}>
                    A couple of things you could tighten, if you want to. Your draft is ready to send either way.
                </p>
                <button
                    onClick={onClose}
                    aria-label="Dismiss suggestions"
                    style={{ background: 'transparent', border: 'none', color: warm.colors.textMuted, cursor: 'pointer', padding: 2, flexShrink: 0 }}
                >
                    <X size={14} />
                </button>
            </header>

            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: warm.colors.textMuted, fontSize: 12 }}>
                    <Loader2 size={13} className="animate-spin" />
                    Reading it over…
                </div>
            )}

            {!loading && issues.length === 0 && (
                <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                    Nothing worth changing. Send it.
                </p>
            )}

            {!loading && issues.map((issue, idx) => (
                <div key={idx} style={{ paddingLeft: 12, borderLeft: `2px solid ${warm.colors.borderWhisper}` }}>
                    <p style={{ margin: '0 0 4px', fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.55, fontStyle: 'italic' }}>
                        "{issue.snippet}"
                    </p>
                    {issue.fix && (
                        <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textPrimary, lineHeight: 1.6 }}>
                            {issue.fix}
                        </p>
                    )}
                    {issue.why && (
                        <p style={{ margin: '3px 0 0', fontSize: 11.5, color: warm.colors.textMuted, lineHeight: 1.55 }}>
                            {issue.why}
                        </p>
                    )}
                </div>
            ))}
        </motion.aside>
    );
}
