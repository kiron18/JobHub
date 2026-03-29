import { useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Zap, Loader2, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

interface AchievementSuggestion {
    title: string;
    prompt: string;
    example: string;
    why: string;
}

interface GapResult {
    overallFit: 'STRONG' | 'MODERATE' | 'WEAK';
    missingKeywords: string[];
    skillGaps: Array<{ gap: string; suggestion: string }>;
    strengthAreas: string[];
    quickWins: string[];
    profileReadiness: number;
}

interface GapAnalysisPanelProps {
    jobDescription: string;
    keywords?: string[];
}

const FIT_CONFIG: Record<GapResult['overallFit'], { label: string; color: string; bg: string; border: string }> = {
    STRONG: { label: 'Strong fit', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    MODERATE: { label: 'Moderate fit', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    WEAK: { label: 'Weak fit', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

export function GapAnalysisPanel({ jobDescription, keywords }: GapAnalysisPanelProps) {
    const [result, setResult] = useState<GapResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [hasRun, setHasRun] = useState(false);
    const [suggestions, setSuggestions] = useState<AchievementSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);

    const loadSuggestions = async () => {
        if (loadingSuggestions || suggestions.length > 0) { setSuggestionsOpen(true); return; }
        setLoadingSuggestions(true);
        setSuggestionsOpen(true);
        try {
            const { data } = await api.post('/analyze/achievement-suggestions', { jobDescription });
            setSuggestions(data.suggestions || []);
        } catch {
            // silent
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const run = async () => {
        if (loading) return;
        setLoading(true);
        setOpen(true);
        try {
            const { data } = await api.post('/analyze/gap', { jobDescription, keywords });
            setResult(data);
            setHasRun(true);
        } catch {
            // silent — button stays visible to retry
        } finally {
            setLoading(false);
        }
    };

    const fitCfg = result ? FIT_CONFIG[result.overallFit] : null;

    return (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
            <button
                onClick={hasRun ? () => setOpen(o => !o) : run}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <TrendingUp size={13} className="text-brand-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Gap Analysis</span>
                    {fitCfg && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${fitCfg.color} ${fitCfg.bg} ${fitCfg.border}`}>
                            {fitCfg.label}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {loading && <Loader2 size={12} className="animate-spin text-brand-400" />}
                    {!hasRun && !loading && (
                        <span className="text-[9px] font-bold text-brand-400 uppercase tracking-wider">Run Analysis</span>
                    )}
                    {hasRun && (open ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />)}
                </div>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden border-t border-slate-800"
                    >
                        <div className="p-4 space-y-4">
                            {loading && (
                                <div className="text-center py-4">
                                    <p className="text-xs text-slate-500">Analysing your profile against the JD…</p>
                                </div>
                            )}

                            {result && !loading && (
                                <>
                                    {/* Profile readiness bar */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Profile Readiness</span>
                                            <span className={`text-[10px] font-black ${fitCfg?.color}`}>{result.profileReadiness}%</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div
                                                className={`h-full rounded-full ${result.profileReadiness >= 70 ? 'bg-emerald-500' : result.profileReadiness >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${result.profileReadiness}%` }}
                                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Strength areas */}
                                    {result.strengthAreas.length > 0 && (
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                <CheckCircle size={9} className="text-emerald-400" /> Your strengths for this role
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {result.strengthAreas.map((s, i) => (
                                                    <span key={i} className="text-[10px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Missing keywords */}
                                    {result.missingKeywords.length > 0 && (
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                <AlertTriangle size={9} className="text-amber-400" /> Missing from your profile
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {result.missingKeywords.map((kw, i) => (
                                                    <span key={i} className="text-[10px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Skill gaps */}
                                    {result.skillGaps.length > 0 && (
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Gaps to address</p>
                                            <div className="space-y-2">
                                                {result.skillGaps.map((sg, i) => (
                                                    <div key={i} className="p-2.5 bg-slate-800/50 rounded-lg border border-slate-700/30">
                                                        <p className="text-[10px] font-bold text-slate-300">{sg.gap}</p>
                                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">→ {sg.suggestion}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick wins */}
                                    {result.quickWins.length > 0 && (
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                <Zap size={9} className="text-brand-400" /> Quick wins
                                            </p>
                                            <ul className="space-y-1">
                                                {result.quickWins.map((qw, i) => (
                                                    <li key={i} className="text-[10px] text-slate-400 leading-snug flex items-start gap-1.5">
                                                        <span className="text-brand-400 mt-0.5 shrink-0">·</span>
                                                        {qw}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Achievement suggestions */}
                                    <div className="pt-1 border-t border-slate-800">
                                        <button
                                            onClick={loadSuggestions}
                                            className="w-full flex items-center justify-between py-2 text-[10px] font-bold text-brand-400 hover:text-brand-300 transition-colors"
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <Lightbulb size={10} />
                                                Achievement suggestions for this role
                                            </span>
                                            {loadingSuggestions ? <Loader2 size={10} className="animate-spin" /> : (suggestionsOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                                        </button>
                                        <AnimatePresence>
                                            {suggestionsOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    {loadingSuggestions ? (
                                                        <p className="text-[10px] text-slate-500 py-2 text-center">Loading suggestions…</p>
                                                    ) : (
                                                        <div className="space-y-2 pb-1">
                                                            {suggestions.map((s, i) => (
                                                                <div key={i} className="p-2.5 bg-brand-600/5 border border-brand-600/15 rounded-lg">
                                                                    <p className="text-[10px] font-bold text-brand-300">{s.title}</p>
                                                                    <p className="text-[10px] text-slate-400 mt-0.5 italic">"{s.prompt}"</p>
                                                                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{s.why}</p>
                                                                    <p className="text-[9px] text-slate-600 mt-1 leading-snug">e.g. {s.example}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <button
                                        onClick={run}
                                        className="text-[9px] font-bold text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-wider"
                                    >
                                        Re-run analysis
                                    </button>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
