import React from 'react';

export type SortBy = 'recent' | 'priority' | 'company' | 'deadline' | 'match';

interface SortControlsProps {
    sortBy: SortBy;
    onSortChange: (sort: SortBy) => void;
}

export const SortControls: React.FC<SortControlsProps> = ({ sortBy, onSortChange }) => {
    return (
        <div className="ml-auto flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-1 py-0.5">
            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider px-1">Sort</span>
            {(['match', 'recent', 'priority', 'deadline', 'company'] as const).map(s => (
                <button
                    key={s}
                    onClick={() => onSortChange(s)}
                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${
                        sortBy === s ? 'bg-slate-700 text-slate-200' : 'text-slate-600 hover:text-slate-400'
                    }`}
                >
                    {s === 'match' ? 'Match' : s === 'recent' ? 'Newest' : s === 'priority' ? 'Priority' : s === 'deadline' ? 'Deadline' : 'A–Z'}
                </button>
            ))}
        </div>
    );
};
