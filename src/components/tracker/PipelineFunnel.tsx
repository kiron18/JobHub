import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PipelineCounts {
    APPLIED: number;
    INTERVIEW: number;
    OFFER: number;
    REJECTED: number;
}

interface PipelineFunnelProps {
    counts: PipelineCounts;
}

export const PipelineFunnel: React.FC<PipelineFunnelProps> = ({ counts }) => {
    return (
        <div className="glass-card p-5">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-4">Pipeline Funnel</p>
            <div className="flex items-center gap-0">
                {/* Applied */}
                <div className="flex flex-col items-center flex-1">
                    <div
                        className="w-full rounded-sm bg-blue-500/20 border border-blue-500/20 flex items-center justify-center"
                        style={{ height: 44 }}
                    >
                        <span className="text-xl font-black text-blue-400 tabular-nums">{counts.APPLIED}</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">Applied</p>
                </div>
                {/* Arrow + rate */}
                <div className="flex flex-col items-center px-2 mb-5">
                    <span className="text-[9px] font-bold text-slate-600">
                        {counts.APPLIED > 0 ? `${Math.round((counts.INTERVIEW / Math.max(counts.APPLIED, 1)) * 100)}%` : '—'}
                    </span>
                    <ChevronRight size={14} className="text-slate-700" />
                </div>
                {/* Interview */}
                <div className="flex flex-col items-center flex-1">
                    <div
                        className="w-full rounded-sm bg-amber-500/20 border border-amber-500/20 flex items-center justify-center"
                        style={{ height: Math.max(28, counts.APPLIED > 0 ? Math.round(44 * counts.INTERVIEW / Math.max(counts.APPLIED, 1)) : 28) }}
                    >
                        <span className="text-xl font-black text-amber-400 tabular-nums">{counts.INTERVIEW}</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">Interview</p>
                </div>
                {/* Arrow + rate */}
                <div className="flex flex-col items-center px-2 mb-5">
                    <span className="text-[9px] font-bold text-slate-600">
                        {counts.INTERVIEW > 0 ? `${Math.round((counts.OFFER / Math.max(counts.INTERVIEW, 1)) * 100)}%` : '—'}
                    </span>
                    <ChevronRight size={14} className="text-slate-700" />
                </div>
                {/* Offer */}
                <div className="flex flex-col items-center flex-1">
                    <div
                        className="w-full rounded-sm bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center"
                        style={{ height: Math.max(20, counts.APPLIED > 0 ? Math.round(44 * counts.OFFER / Math.max(counts.APPLIED, 1)) : 20) }}
                    >
                        <span className={`text-xl font-black tabular-nums ${counts.OFFER > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>{counts.OFFER}</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">Offer</p>
                </div>
                {/* Rejected aside */}
                {counts.REJECTED > 0 && (
                    <>
                        <div className="w-px h-10 bg-slate-800 mx-3 mb-5" />
                        <div className="flex flex-col items-center">
                            <div className="px-3 py-1 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <span className="text-sm font-black text-red-400 tabular-nums">{counts.REJECTED}</span>
                            </div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1.5">Rejected</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
