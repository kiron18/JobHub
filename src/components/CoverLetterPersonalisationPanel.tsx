import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Heart, Zap } from 'lucide-react';
import api from '../lib/api';

interface Dimension {
    name: string;
    score: number;
    note: string;
}

interface PersonalisationResult {
    score: number;
    dimensions: Dimension[];
    topFix: string;
}

interface CoverLetterPersonalisationPanelProps {
    document: string;
    jobDescription: string;
    company?: string;
}

function grade(score: number) {
    if (score >= 80) return { label: 'Highly Personalised', color: '#34d399' };
    if (score >= 60) return { label: 'Somewhat Personal',   color: '#818cf8' };
    if (score >= 40) return { label: 'Needs Personalising', color: '#fbbf24' };
    return               { label: 'Generic — Revise',      color: '#f87171' };
}

export function CoverLetterPersonalisationPanel({ document, jobDescription, company }: CoverLetterPersonalisationPanelProps) {
    const [result, setResult] = useState<PersonalisationResult | null>(null);
    const [loading, setLoading] = useState(false);

    const run = async () => {
        if (loading || !document) return;
        setLoading(true);
        try {
            const { data } = await api.post('/analyze/cover-letter-personalisation', {
                document,
                jobDescription,
                company,
            });
            setResult(data);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    const g = result ? grade(result.score) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Heart size={12} color="#f472b6" />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#f472b6', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Personalisation
                    </span>
                </div>
                <button
                    onClick={run}
                    disabled={loading || !document}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid rgba(244,114,182,0.3)',
                        background: 'rgba(244,114,182,0.08)',
                        color: (loading || !document) ? '#6b7280' : '#f472b6',
                        fontSize: 10, fontWeight: 700, cursor: (loading || !document) ? 'default' : 'pointer',
                    }}
                >
                    {loading ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                    {loading ? 'Checking…' : result ? 'Re-check' : 'Check'}
                </button>
            </div>

            {!document && (
                <p style={{ fontSize: 10, color: '#4b5563', textAlign: 'center', padding: '4px 0', margin: 0 }}>
                    Generate a cover letter first.
                </p>
            )}

            <AnimatePresence>
                {result && g && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                    >
                        {/* Score */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                                border: `2.5px solid ${g.color}`, background: `${g.color}15`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16, fontWeight: 900, color: g.color,
                            }}>
                                {result.score}
                            </div>
                            <div>
                                <p style={{ fontSize: 10, fontWeight: 800, color: g.color, margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                    {g.label}
                                </p>
                                <div style={{ marginTop: 4, height: 3, width: 100, borderRadius: 99, background: 'rgba(255,255,255,0.06)' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${result.score}%` }}
                                        transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                                        style={{ height: '100%', borderRadius: 99, background: g.color }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Dimension bars */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {result.dimensions.map((dim, i) => {
                                const pct = (dim.score / 25) * 100;
                                const dColor = pct >= 75 ? '#34d399' : pct >= 50 ? '#818cf8' : pct >= 25 ? '#fbbf24' : '#f87171';
                                return (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                {dim.name}
                                            </span>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: dColor }}>{dim.score}/25</span>
                                        </div>
                                        <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)' }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.25, 1, 0.5, 1] }}
                                                style={{ height: '100%', borderRadius: 99, background: dColor }}
                                            />
                                        </div>
                                        <p style={{ fontSize: 9, color: '#4b5563', margin: '2px 0 0', lineHeight: 1.4 }}>{dim.note}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Top fix */}
                        {result.topFix && (
                            <div style={{
                                padding: '8px 10px', borderRadius: 8,
                                border: '1px solid rgba(244,114,182,0.2)',
                                background: 'rgba(244,114,182,0.05)',
                            }}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#f472b6', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>
                                    Top Fix
                                </p>
                                <p style={{ fontSize: 11, color: '#fce7f3', margin: 0, lineHeight: 1.5 }}>{result.topFix}</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
