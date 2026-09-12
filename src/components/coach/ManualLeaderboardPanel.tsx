import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Plus, Trash2, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

/* ── ManualLeaderboardPanel ───────────────────────────────────────────────
   Real clients the coach tracks outside JobHub (not yet onboarded, or run
   through another channel) but still wants visible and ranking on the
   cohort leaderboard. These are not fake — see routes/leaderboard.ts and
   schema.prisma's ManualLeaderboardEntry. displayName should already be in
   the "First L." privacy format used everywhere else on the board.

   isPlaceholder just flags a row whose numbers haven't been supplied for
   real yet, so it doesn't get lost among rows that are already accurate.
*/

interface ManualEntry {
    id: string;
    displayName: string;
    applications: number;
    outreach: number;
    interviews: number;
    offers: number;
    currentStreak: number;
    isPlaceholder: boolean;
    active: boolean;
}

const numInput: React.CSSProperties = {
    width: 56, padding: '5px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
    color: warm.colors.textPrimary, outline: 'none',
};

const emptyDraft = { displayName: '', applications: 0, outreach: 0, interviews: 0, offers: 0, currentStreak: 0 };

export const ManualLeaderboardPanel: React.FC = () => {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState(emptyDraft);

    const { data, isLoading } = useQuery({
        queryKey: ['coach-manual-leaderboard'],
        queryFn: async () => (await api.get('/admin/coach/leaderboard')).data as ManualEntry[],
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['coach-manual-leaderboard'] });

    const createMutation = useMutation({
        mutationFn: async () => (await api.post('/admin/coach/leaderboard', { ...draft, isPlaceholder: true })).data,
        onSuccess: () => { invalidate(); setDraft(emptyDraft); toast.success('Added to the leaderboard'); },
        onError: () => toast.error('Could not add that entry'),
    });

    const updateMutation = useMutation({
        mutationFn: async (vars: { id: string; data: Partial<ManualEntry> }) =>
            (await api.patch(`/admin/coach/leaderboard/${vars.id}`, vars.data)).data,
        onSuccess: invalidate,
        onError: () => toast.error('Could not save that change'),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => (await api.delete(`/admin/coach/leaderboard/${id}`)).data,
        onSuccess: () => { invalidate(); toast.success('Removed'); },
        onError: () => toast.error('Could not remove that entry'),
    });

    const entries = data ?? [];

    return (
        <div style={{
            background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 14, padding: '16px 18px', marginBottom: 16,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Trophy size={14} style={{ color: warm.colors.accentPetrol }} />
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: warm.colors.textSecondary }}>
                    Manual leaderboard entries
                </span>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 11.5, color: warm.colors.textMuted, lineHeight: 1.5 }}>
                Real clients tracked outside the app. They rank on the cohort leaderboard alongside everyone
                else — use "First L." only, same privacy format as the rest of the board.
            </p>

            {isLoading ? (
                <Loader2 size={16} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {entries.map(e => (
                        <div key={e.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                            padding: '6px 10px', borderRadius: 8, background: warm.colors.bgAlt,
                        }}>
                            <span style={{ flex: '1 1 100px', fontSize: 12.5, fontWeight: 700, color: warm.colors.textPrimary }}>
                                {e.displayName}
                                {e.isPlaceholder && (
                                    <span style={{
                                        marginLeft: 6, padding: '1px 6px', borderRadius: 999, fontSize: 9.5, fontWeight: 800,
                                        background: 'rgba(196,113,58,0.12)', color: '#C4713A',
                                    }}>
                                        placeholder
                                    </span>
                                )}
                            </span>
                            {([
                                ['applications', 'Apps'], ['outreach', 'Outreach'], ['interviews', 'Int.'],
                                ['offers', 'Offers'], ['currentStreak', 'Streak'],
                            ] as const).map(([field, label]) => (
                                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: warm.colors.textMuted }}>
                                    {label}
                                    <input
                                        type="number" min={0} value={e[field]} style={numInput}
                                        onChange={ev => updateMutation.mutate({ id: e.id, data: { [field]: parseInt(ev.target.value, 10) || 0 } })}
                                    />
                                </label>
                            ))}
                            <button
                                onClick={() => updateMutation.mutate({ id: e.id, data: { isPlaceholder: !e.isPlaceholder } })}
                                title="Toggle placeholder flag"
                                style={{
                                    padding: '5px 9px', borderRadius: 8, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
                                    border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent', color: warm.colors.textSecondary,
                                }}
                            >
                                <Check size={11} />
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(e.id)}
                                title="Remove"
                                style={{
                                    padding: '5px 9px', borderRadius: 8, cursor: 'pointer',
                                    border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent', color: '#B0563C',
                                }}
                            >
                                <Trash2 size={11} />
                            </button>
                        </div>
                    ))}
                    {entries.length === 0 && (
                        <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted }}>No manual entries yet.</p>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                    value={draft.displayName}
                    onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))}
                    placeholder="First L."
                    style={{ ...numInput, width: 100 }}
                />
                {([
                    ['applications', 'Apps'], ['outreach', 'Outreach'], ['interviews', 'Int.'],
                    ['offers', 'Offers'], ['currentStreak', 'Streak'],
                ] as const).map(([field, label]) => (
                    <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: warm.colors.textMuted }}>
                        {label}
                        <input
                            type="number" min={0} value={draft[field]} style={numInput}
                            onChange={e => setDraft(d => ({ ...d, [field]: parseInt(e.target.value, 10) || 0 }))}
                        />
                    </label>
                ))}
                <button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || !draft.displayName.trim()}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                        borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                        background: warm.colors.accentPetrol, color: 'white',
                        opacity: draft.displayName.trim() ? 1 : 0.5,
                    }}
                >
                    {createMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                    Add
                </button>
            </div>
        </div>
    );
};
