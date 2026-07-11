import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Pencil, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

interface GoalData {
    goalType: 'daily' | 'weekly';
    goal: number;
    applied: number;
}

export const GoalCard: React.FC = () => {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [editType, setEditType] = useState<'daily' | 'weekly'>('daily');
    const [editCount, setEditCount] = useState(5);

    const { data } = useQuery({
        queryKey: ['tracker-goal'],
        queryFn: async () => (await api.get('/tracker/goal')).data as GoalData,
        staleTime: 30_000,
    });

    const saveMutation = useMutation({
        mutationFn: async ({ goalType, goal }: { goalType: string; goal: number }) =>
            (await api.post('/tracker/goal', { goalType, goal })).data as GoalData,
        onSuccess: updated => {
            queryClient.setQueryData(['tracker-goal'], updated);
            setEditing(false);
            toast.success(`Goal set: ${updated.goal} applications ${updated.goalType === 'weekly' ? 'a week' : 'a day'}`);
        },
        onError: () => toast.error('Could not save your goal — try again.'),
    });

    if (!data) return null;

    const pct = Math.min(data.applied / data.goal, 1) * 100;
    const hit = data.applied >= data.goal;
    const periodLabel = data.goalType === 'weekly' ? 'this week' : 'today';

    return (
        <div style={{
            background: warm.colors.bgSurface,
            border: `1px solid ${hit ? 'rgba(74,157,111,0.35)' : warm.colors.borderWhisper}`,
            borderRadius: 16, padding: '16px 20px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={14} style={{ color: hit ? warm.colors.success : warm.colors.accentPetrol }} />
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: warm.colors.textSecondary }}>
                        Application goal
                    </span>
                </div>
                {!editing && (
                    <button
                        onClick={() => { setEditType(data.goalType); setEditCount(data.goal); setEditing(true); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                            borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent',
                            color: warm.colors.textMuted,
                        }}
                    >
                        <Pencil size={10} /> Edit
                    </button>
                )}
            </div>

            {editing ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${warm.colors.borderDefined}` }}>
                        {(['daily', 'weekly'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setEditType(t)}
                                style={{
                                    padding: '6px 14px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                                    background: editType === t ? warm.colors.accentPetrol : 'transparent',
                                    color: editType === t ? 'white' : warm.colors.textSecondary,
                                }}
                            >
                                {t === 'daily' ? 'Daily' : 'Weekly'}
                            </button>
                        ))}
                    </div>
                    <input
                        type="number"
                        min={1}
                        max={100}
                        value={editCount}
                        onChange={e => setEditCount(parseInt(e.target.value, 10) || 1)}
                        style={{
                            width: 64, padding: '6px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                            background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
                            color: warm.colors.textPrimary, outline: 'none',
                        }}
                    />
                    <span style={{ fontSize: 12, color: warm.colors.textSecondary }}>
                        applications {editType === 'weekly' ? 'a week' : 'a day'}
                    </span>
                    <button
                        onClick={() => saveMutation.mutate({ goalType: editType, goal: editCount })}
                        disabled={saveMutation.isPending}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                            borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                            background: warm.colors.accentPetrol, color: 'white',
                        }}
                    >
                        {saveMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                        Save
                    </button>
                    <button
                        onClick={() => setEditing(false)}
                        style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', background: 'transparent', color: warm.colors.textMuted, cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <p style={{ flexBasis: '100%', margin: 0, fontSize: 11, color: warm.colors.textMuted, lineHeight: 1.5 }}>
                        Pick daily if your week is even. Pick weekly if you do shift work — hit the number whenever your hours allow.
                    </p>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                        <span style={{ fontSize: 13, color: warm.colors.textSecondary }}>
                            {hit ? `Goal hit ${periodLabel} — keep the streak alive` : `Applications ${periodLabel}`}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: hit ? warm.colors.success : warm.colors.textPrimary }}>
                            {data.applied} of {data.goal}{data.applied > data.goal ? ` ✓ +${data.applied - data.goal}` : ''}
                        </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 6, background: warm.colors.borderWhisper, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', width: `${pct}%`, borderRadius: 6, transition: 'width 0.4s ease',
                            background: hit ? warm.colors.success : warm.colors.accentPetrol,
                        }} />
                    </div>
                </>
            )}
        </div>
    );
};
