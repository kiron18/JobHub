import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, BarChart2, Zap } from 'lucide-react';
import api from '../lib/api';

interface Dimension {
    name: string;
    score: number;
    feedback: string;
}

interface ScoreResult {
    total: number;
    dimensions: Dimension[];
    topFix: string;
}

interface ResumeScorecardPanelProps {
    document: string;
    jobDescription?: string;
}

function grade(total: number): { label: string; color: string } {
    if (total >= 80) return { label: 'Excellent', color: '#34d399' };
    if (total >= 65) return { label: 'Good',      color: '#818cf8' };
    if (total >= 50) return { label: 'Fair',       color: '#fbbf24' };
    return               { label: 'Needs Work',  color: '#f87171' };
}

export function ResumeScorecardPanel({ document, jobDescription }: ResumeScorecardPanelProps) {
    const [result, setResult] = useState<ScoreResult | null>(null);
    const [loading, setLoading] = useState(false);

    const run = async () => {
        if (loading || !document) return;
        setLoading(true);
        try {
            const { data } = await api.post('/analyze/resume-score', { document, jobDescription });
            setResult(data);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    const g = result ? grade(result.total) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <BarChart2 size={12} color="#a78bfa" />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Resume Score
                    </span>
                </div>
                <button
                    onClick={run}
                    disabled={loading || !document}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid rgba(167,139,250,0.3)',
                        background: 'rgba(167,139,250,0.08)',
                        color: (loading || !document) ? '#6b7280' : '#a78bfa',
                        fontSize: 10, fontWeight: 700, cursor: (loading || !document) ? 'default' : 'pointer',
                    }}
                >
                    {loading ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                    {loading ? 'Scoring…' : result ? 'Re-score' : 'Score'}
                </button>
            </div>

            {!document && !result && (
                <p style={{ fontSize: 10, color: '#4b5563', textAlign: 'center', padding: '4px 0', margin: 0 }}>
                    Generate a resume first to get a quality score.
                </p>
            )}

            <AnimatePresence>
                {result && g && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                    >
                        {/* Total score */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
                                border: `3px solid ${g.color}`, background: `${g.color}15`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 18, fontWeight: 900, color: g.color,
                            }}>
                                {result.total}
                            </div>
                            <div>
                                <p style={{ fontSize: 11, fontWeight: 800, color: g.color, margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                    {g.label}
                                </p>
                                <p style={{ fontSize: 10, color: '#6b7280', margin: '2px 0 0' }}>out of 100</p>
                            </div>
                        </div>

                        {/* Dimension bars */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {result.dimensions.map((dim, i) => {
                                const pct = (dim.score / 20) * 100;
                                const dColor = pct >= 75 ? '#34d399' : pct >= 50 ? '#818cf8' : pct >= 30 ? '#fbbf24' : '#f87171';
                                return (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                {dim.name}
                                            </span>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: dColor }}>
                                                {dim.score}/20
                                            </span>
                                        </div>
                                        <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)' }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 0.5, delay: i * 0.07, ease: [0.25, 1, 0.5, 1] }}
                                                style={{ height: '100%', borderRadius: 99, background: dColor }}
                                            />
                                        </div>
                                        <p style={{ fontSize: 9, color: '#4b5563', margin: '2px 0 0', lineHeight: 1.4 }}>{dim.feedback}</p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Top fix */}
                        {result.topFix && (
                            <div style={{
                                padding: '8px 10px', borderRadius: 8,
                                border: '1px solid rgba(167,139,250,0.2)',
                                background: 'rgba(167,139,250,0.06)',
                            }}>
                                <p style={{ fontSize: 9, fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 3px' }}>
                                    Top Fix
                                </p>
                                <p style={{ fontSize: 11, color: '#ddd6fe', margin: 0, lineHeight: 1.5 }}>{result.topFix}</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
