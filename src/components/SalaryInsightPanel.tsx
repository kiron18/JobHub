import { useState } from 'react';
import { DollarSign, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';

interface SalaryResult {
    min: number | null;
    max: number | null;
    currency: string;
    period?: string;
    formatted: string;
    context?: string;
    source?: string | null;
}

interface SalaryInsightPanelProps {
    role: string;
    company?: string;
    location?: string;
}

export function SalaryInsightPanel({ role, company, location }: SalaryInsightPanelProps) {
    const [result, setResult] = useState<SalaryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [hasRun, setHasRun] = useState(false);

    const run = async () => {
        if (loading) return;
        setLoading(true);
        setOpen(true);
        try {
            const { data } = await api.post('/research/salary', { role, company, location });
            setResult(data);
            setHasRun(true);
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    const hasData = result && result.min !== null;

    return (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
            <button
                onClick={hasRun ? () => setOpen(o => !o) : run}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <DollarSign size={13} className="text-emerald-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salary Insight</span>
                    {hasData && (
                        <span className="text-[10px] font-bold text-emerald-400">{result.formatted}</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {loading && <Loader2 size={12} className="animate-spin text-emerald-400" />}
                    {!hasRun && !loading && (
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Look Up</span>
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
                        <div className="p-4 space-y-3">
                            {loading && (
                                <p className="text-xs text-slate-500 text-center py-2">Looking up salary data…</p>
                            )}

                            {result && !loading && (
                                <>
                                    {hasData ? (
                                        <>
                                            {/* Salary range bar */}
                                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                                <p className="text-base font-black text-emerald-400 leading-none">{result.formatted}</p>
                                                {result.context && (
                                                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">{result.context}</p>
                                                )}
                                                {result.source && (
                                                    <p className="text-[9px] text-slate-600 mt-1.5">Source: {result.source}</p>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-slate-600 leading-snug">
                                                Salary data from web sources. Use as a reference — actual offers vary by experience, negotiation, and employer.
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-slate-500 text-center py-2">
                                            No salary data found for this role. Try negotiating based on industry benchmarks.
                                        </p>
                                    )}
                                    <button
                                        onClick={run}
                                        className="text-[9px] font-bold text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-wider"
                                    >
                                        Re-run lookup
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
