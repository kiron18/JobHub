import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import api from '../lib/api';

interface ATSResult {
    score: number;
    matched: string[];
    missing: string[];
    quickFixes: string[];
}

interface ATSCoveragePanelProps {
    document: string;
    jobDescription: string;
    docType?: string;
}

function ScoreArc({ score }: { score: number }) {
    // Simple horizontal score bar
    const color = score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : '#f87171';
    const label = score >= 75 ? 'Strong' : score >= 50 ? 'Moderate' : 'Weak';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                border: `2.5px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 900, color,
                background: `${color}18`,
            }}>
                {score}
            </div>
            <div>
                <p style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                    {label} ATS Coverage
                </p>
                <div style={{ marginTop: 4, height: 4, width: 120, borderRadius: 9, background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
                        style={{ height: '100%', borderRadius: 9, background: color }}
                    />
                </div>
            </div>
        </div>
    );
}

export function ATSCoveragePanel({ document, jobDescription, docType }: ATSCoveragePanelProps) {
    const [result, setResult] = useState<ATSResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [fixesOpen, setFixesOpen] = useState(false);

    const run = async () => {
        if (loading || !document) return;
        setLoading(true);
        try {
            const { data } = await api.post('/analyze/ats-coverage', {
                document,
                jobDescription,
                docType: docType || 'resume',
            });
            setResult(data);
            setFixesOpen(false);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ShieldCheck size={12} color="#34d399" />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#34d399', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        ATS Coverage
                    </span>
                </div>
                <button
                    onClick={run}
                    disabled={loading || !document}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid rgba(52,211,153,0.3)',
                        background: 'rgba(52,211,153,0.08)',
                        color: (loading || !document) ? '#6b7280' : '#34d399',
                        fontSize: 10, fontWeight: 700,
                        cursor: (loading || !document) ? 'default' : 'pointer',
                    }}
                >
                    {loading ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                    {loading ? 'Checking…' : result ? 'Re-check' : 'Check ATS'}
                </button>
            </div>

            {!document && !result && (
                <p style={{ fontSize: 10, color: '#4b5563', textAlign: 'center', padding: '4px 0', margin: 0 }}>
                    Generate a document first to check ATS keyword coverage.
                </p>
            )}

            {!result && document && !loading && (
                <p style={{ fontSize: 10, color: '#4b5563', textAlign: 'center', padding: '4px 0', margin: 0 }}>
                    See how well your document's keywords match the job description.
                </p>
            )}

            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                    >
                        {/* Score */}
                        <ScoreArc score={result.score} />

                        {/* Matched terms */}
                        {result.matched.length > 0 && (
                            <div>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>
                                    Covered ({result.matched.length})
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {result.matched.map((term, i) => (
                                        <span key={i} style={{
                                            padding: '2px 7px', borderRadius: 99, fontSize: 9, fontWeight: 700,
                                            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)',
                                            color: '#34d399',
                                        }}>
                                            {term}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Missing terms */}
                        {result.missing.length > 0 && (
                            <div>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 5px' }}>
                                    Missing ({result.missing.length})
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {result.missing.map((term, i) => (
                                        <span key={i} style={{
                                            padding: '2px 7px', borderRadius: 99, fontSize: 9, fontWeight: 700,
                                            background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)',
                                            color: '#f87171',
                                        }}>
                                            {term}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Quick fixes — collapsible */}
                        {result.quickFixes.length > 0 && (
                            <div style={{
                                borderRadius: 8, overflow: 'hidden',
                                border: '1px solid rgba(99,102,241,0.2)',
                                background: 'rgba(99,102,241,0.04)',
                            }}>
                                <button
                                    onClick={() => setFixesOpen(o => !o)}
                                    style={{
                                        width: '100%', padding: '7px 10px', background: 'none', border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <span style={{ fontSize: 9, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                        Quick Fixes ({result.quickFixes.length})
                                    </span>
                                    {fixesOpen ? <ChevronUp size={10} color="#4b5563" /> : <ChevronDown size={10} color="#4b5563" />}
                                </button>
                                <AnimatePresence>
                                    {fixesOpen && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            style={{ overflow: 'hidden' }}
                                        >
                                            <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {result.quickFixes.map((fix, i) => (
                                                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                                                        <span style={{
                                                            flexShrink: 0, width: 14, height: 14, borderRadius: '50%',
                                                            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                                                            color: '#818cf8', fontSize: 8, fontWeight: 900,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}>
                                                            {i + 1}
                                                        </span>
                                                        <p style={{ fontSize: 11, color: '#c7d2fe', margin: 0, lineHeight: 1.5 }}>{fix}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
