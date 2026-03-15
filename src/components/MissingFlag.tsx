import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Edit3, PlusCircle, Trash2, X } from 'lucide-react';

interface MissingFlagProps {
    text: string;
    onEditInline?: () => void;
    onAddToProfile?: (label: string) => void;
    onRemove?: (text: string) => void;
}

export const MissingFlag: React.FC<MissingFlagProps> = ({ 
    text, 
    onEditInline, 
    onAddToProfile, 
    onRemove 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const label = text.replace('[MISSING:', '').replace(']', '').trim();

    const handleAction = (action: () => void) => {
        action();
        setIsOpen(false);
    };

    return (
        <span className="relative inline-block mx-1">
            <button
                onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(!isOpen);
                }}
                className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md text-xs font-black border border-amber-300 hover:bg-amber-200 transition-all shadow-sm"
            >
                {label}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                        className="absolute bottom-full left-0 mb-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-30 p-2 overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-2 border-b border-slate-800 mb-1">
                            <div className="flex items-center gap-2">
                                <AlertCircle size={10} className="text-amber-500" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Content Gap</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-slate-600 hover:text-slate-400">
                                <X size={10} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-1">
                            <button 
                                onClick={() => handleAction(() => onEditInline?.())}
                                className="flex items-center gap-2 w-full p-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                            >
                                <Edit3 size={12} className="text-brand-500 group-hover:scale-110 transition-transform" />
                                Edit inline
                            </button>
                            <button 
                                onClick={() => handleAction(() => onAddToProfile?.(label))}
                                className="flex items-center gap-2 w-full p-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                            >
                                <PlusCircle size={12} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                                Add to Profile Bank
                            </button>
                            <button 
                                onClick={() => handleAction(() => onRemove?.(text))}
                                className="flex items-center gap-2 w-full p-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                            >
                                <Trash2 size={12} className="text-red-500 group-hover:scale-110 transition-transform" />
                                Remove flag
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </span>
    );
};
