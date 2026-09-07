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
            /* Five sort options at 16px tall in a 20px strip. On a phone this
               was a row of controls nobody could operate; it now wraps to its
               own line rather than being squeezed to the right of the filters. */
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2,
            flexWrap: 'wrap',
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 10, padding: '3px 5px',
        }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 4px' }}>Sort</span>
            {(['match', 'recent', 'priority', 'deadline', 'company'] as const).map(s => {
                const active = sortBy === s;
                return (
                    <button
                        key={s}
                        onClick={() => onSortChange(s)}
                        style={{
                            padding: '9px 9px', minHeight: 34, borderRadius: 6,
                            fontSize: 10, fontWeight: 700,
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
