import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp, Quote, Shield, Tag, Lightbulb, Target, Ban, ExternalLink } from 'lucide-react';

interface StrategyBlueprint {
    openingHook: string;
    positioningStatement: string;
    proofPoints: Array<{
        achievementId: string;
        framingAngle: string;
        jdConnection: string;
        narrativeNote: string;
    }>;
    messagingAngles: string[];
    toneBlueprint: string;
    structureNotes: string;
    pitfallFlags: string[];
    employerInsight: string;
    sector: 'GOVERNMENT' | 'TECH_STARTUP' | 'CORPORATE' | 'HEALTHCARE' | 'EDUCATION' | 'NFP' | 'GENERAL';
}

interface Props {
    blueprint: StrategyBlueprint;
    rankedAchievements?: Array<{ id: string; title?: string; relevanceScore?: number }>;
    companyName?: string;
}

const SECTOR_COLOURS: Record<string, string> = {
    GOVERNMENT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    TECH_STARTUP: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    CORPORATE: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    HEALTHCARE: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    EDUCATION: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    NFP: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    GENERAL: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

export const StrategistDebrief: React.FC<Props> = ({ blueprint, rankedAchievements = [], companyName }) => {
    const [isOpen, setIsOpen] = useState(false);

    const isMissingEmployerInsight = blueprint.employerInsight?.includes('[MISSING:');
    const sectorStyle = SECTOR_COLOURS[blueprint.sector] || SECTOR_COLOURS.GENERAL;

    // Build a quick lookup from achievementId → title
    const achievementMap = new Map(rankedAchievements.map(a => [a.id, a]));

    return (
        <div className="w-full max-w-3xl mx-auto mt-4">
            <button
                onClick={() => setIsOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-900/80 border border-slate-800 rounded-xl hover:border-slate-700 transition-all group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-violet-500/10 rounded-lg flex items-center justify-center">
                        <Brain size={14} className="text-violet-400" />
                    </div>
                    <span className="text-xs font-bold text-slate-300">Strategist's Notes</span>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full border ${sectorStyle}`}>
                        {blueprint.sector.replace('_', ' ')}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium">See what Claude decided and why</span>
                </div>
                <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 bg-slate-900/60 border border-slate-800 rounded-xl divide-y divide-slate-800/60">

                            {/* Opening Hook */}
                            <div className="p-5 space-y-2">
                                <div className="flex items-center gap-2 mb-3">
                                    <Quote size={13} className="text-violet-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Opening Hook Strategy</span>
                                </div>
                                <blockquote className="border-l-2 border-violet-500/40 pl-4 italic text-sm text-slate-300 leading-relaxed">
                                    "{blueprint.openingHook}"
                                </blockquote>
                            </div>

                            {/* Positioning */}
                            <div className="p-5 space-y-2">
                                <div className="flex items-center gap-2 mb-3">
                                    <Target size={13} className="text-brand-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your Positioning</span>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">{blueprint.positioningStatement}</p>
                            </div>

                            {/* Key Themes */}
                            {blueprint.messagingAngles.length > 0 && (
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Tag size={13} className="text-emerald-400" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Key Themes Threaded Through</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {blueprint.messagingAngles.map((angle, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-emerald-500/8 border border-emerald-500/20 text-emerald-300 text-xs font-medium rounded-full">
                                                {angle}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Proof Points */}
                            {blueprint.proofPoints.length > 0 && (
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Lightbulb size={13} className="text-amber-400" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Why These Achievements Were Chosen</span>
                                    </div>
                                    <div className="space-y-3">
                                        {blueprint.proofPoints.map((pp, i) => {
                                            const ach = achievementMap.get(pp.achievementId);
                                            return (
                                                <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-2.5">
                                                    {ach && (
                                                        <p className="text-xs font-bold text-slate-200">{(ach as any).title || pp.achievementId}</p>
                                                    )}
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest w-20 shrink-0 mt-0.5">How framed</span>
                                                            <p className="text-xs text-slate-400 leading-relaxed">{pp.framingAngle}</p>
                                                        </div>
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest w-20 shrink-0 mt-0.5">Proves</span>
                                                            <p className="text-xs text-slate-500 leading-relaxed italic">"{pp.jdConnection}"</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Tone Decision */}
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Shield size={13} className="text-sky-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tone Decision</span>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed">{blueprint.toneBlueprint}</p>
                            </div>

                            {/* Language Blocked */}
                            {blueprint.pitfallFlags.length > 0 && (
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Ban size={13} className="text-red-400" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Generic Language Blocked</span>
                                        <span className="text-[9px] text-slate-600 font-medium">These phrases were suppressed</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {blueprint.pitfallFlags.map((flag, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-red-500/5 border border-red-500/15 text-slate-600 text-xs line-through rounded-lg">
                                                {flag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Employer Insight */}
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <ExternalLink size={13} className="text-orange-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Employer Insight</span>
                                </div>
                                {isMissingEmployerInsight ? (
                                    <div className="p-3 bg-amber-500/8 border border-amber-500/20 rounded-lg">
                                        <p className="text-xs text-amber-400 leading-relaxed">
                                            <span className="font-bold">Research needed:</span> No employer-specific detail was found in the JD. Add a specific insight about{companyName ? ` ${companyName}` : ' this company'} (recent news, strategic initiative, or annual report detail) to personalise the company connection paragraph.
                                        </p>
                                        {companyName && (
                                            <button
                                                onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(companyName + ' company news 2025')}`, '_blank')}
                                                className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
                                            >
                                                <ExternalLink size={10} />
                                                Research {companyName}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 leading-relaxed">{blueprint.employerInsight}</p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
