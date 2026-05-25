import React from 'react';
import { warm } from '../../lib/theme/warmTokens';

export type SortBy = 'recent' | 'priority' | 'company' | 'deadline' | 'match';

interface SortControlsProps {
    sortBy: SortBy;
    onSortChange: (sort: SortBy) => void;
}

export const SortControls: React.FC<SortControlsProps> = ({ sortBy, onSortChange }) => {
    return (
        <div style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2,
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 10, padding: '2px 4px',
        }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 4px' }}>Sort</span>
            {(['match', 'recent', 'priority', 'deadline', 'company'] as const).map(s => {
                const active = sortBy === s;
                return (
                    <button
                        key={s}
                        onClick={() => onSortChange(s)}
                        style={{
                            padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
                            background: active ? warm.colors.bgAlt : 'transparent',
                            border: 'none', color: active ? warm.colors.textPrimary : warm.colors.textMuted,
                        }}
                    >
                        {s === 'match' ? 'Match' : s === 'recent' ? 'Newest' : s === 'priority' ? 'Priority' : s === 'deadline' ? 'Deadline' : 'A–Z'}
                    </button>
                );
            })}
        </div>
    );
};
