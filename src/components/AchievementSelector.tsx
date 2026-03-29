import React, { useState } from 'react';
import { 
    X, 
    Star, 
    CheckCircle2, 
    Hash,
    RefreshCcw,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Achievement {
    id: string;
    description: string;
    tier: 'STRONG' | 'MODERATE' | 'WEAK';
    category?: string;
    matchedKeywords?: string[];
    relevanceScore?: number;
}

interface AchievementSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    achievements: Achievement[];
    selectedIds: string[];
    onUpdate: (ids: string[]) => void;
    onConfirm: () => void;
}

export const AchievementSelector: React.FC<AchievementSelectorProps> = ({
    isOpen,
    onClose,
    achievements,
    selectedIds,
    onUpdate,
    onConfirm
}) => {
    const [filter, setFilter] = useState<'ALL' | 'STRONG' | 'MODERATE' | 'WEAK'>('ALL');

    const filteredAchievements = achievements
        .filter((a, idx, arr) => arr.findIndex(b => b.id === a.id) === idx)
        .filter(a => filter === 'ALL' || a.tier === filter);

    const toggleId = (id: string) => {
        if (selectedIds.includes(id)) {
            onUpdate(selectedIds.filter(i => i !== id));
        } else {
            onUpdate([...selectedIds, id]);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-[480px] bg-slate-900 border-l border-slate-800 z-50 flex flex-col shadow-2xl"
                    >
                        <header className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                    <Star className="text-brand-500" size={20} />
                                    Achievement Selector
                                </h2>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    {selectedIds.length} Selected • {achievements.length} Available
                                </p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        <div className="p-4 border-b border-slate-800 flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
                            {(['ALL', 'STRONG', 'MODERATE', 'WEAK'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border whitespace-nowrap ${
                                        filter === f 
                                            ? 'bg-brand-600 border-brand-500 text-white shadow-lg' 
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300'
                                    }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {filteredAchievements.map(achievement => (
                                <motion.div
                                    key={achievement.id}
                                    onClick={() => toggleId(achievement.id)}
                                    layout
                                    className={`group p-4 rounded-xl border transition-all cursor-pointer ${
                                        selectedIds.includes(achievement.id)
                                            ? 'bg-brand-600/10 border-brand-500 shadow-lg shadow-brand-500/5'
                                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                                    }`}
                                >
                                    <div className="flex gap-3">
                                        <div className={`mt-1 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                            selectedIds.includes(achievement.id)
                                                ? 'bg-brand-500 border-brand-500 text-white'
                                                : 'bg-slate-900 border-slate-700 group-hover:border-slate-500'
                                        }`}>
                                            {selectedIds.includes(achievement.id) && <CheckCircle2 size={12} strokeWidth={3} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-tighter ${
                                                    achievement.tier === 'STRONG' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    achievement.tier === 'MODERATE' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-slate-500/20 text-slate-400'
                                                }`}>
                                                    {achievement.tier}
                                                </span>
                                                {achievement.relevanceScore !== undefined && (
                                                    <span className="text-[8px] font-bold text-slate-500">
                                                        {achievement.relevanceScore}% match
                                                    </span>
                                                )}
                                                {achievement.category && (
                                                    <span className="text-[8px] font-extrabold text-slate-500 uppercase flex items-center gap-1 opacity-50">
                                                        <Hash size={8} />
                                                        {achievement.category}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs leading-relaxed text-slate-300 mb-2">
                                                {achievement.description}
                                            </p>
                                            {achievement.matchedKeywords && achievement.matchedKeywords.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider self-center">matched:</span>
                                                    {achievement.matchedKeywords.slice(0, 5).map(kw => (
                                                        <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded bg-brand-600/10 text-brand-400 border border-brand-600/20 font-semibold">
                                                            {kw}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <footer className="p-6 border-t border-slate-800 bg-slate-900/50 shrink-0">
                            <button 
                                onClick={onConfirm}
                                className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl transition-all shadow-xl shadow-brand-600/20 flex items-center justify-center gap-2"
                            >
                                <RefreshCcw size={18} />
                                Update and Re-generate
                            </button>
                            <p className="text-[10px] text-center text-slate-500 mt-4 font-bold flex items-center justify-center gap-2 uppercase tracking-widest">
                                <AlertCircle size={10} />
                                Overwrites current draft
                            </p>
                        </footer>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
