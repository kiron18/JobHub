import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Pencil, Check, Loader2, Lock, Flame, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

type GoalType = 'daily' | 'weekly';

interface GoalSide { goal: number; goalType: GoalType; done: number; }

interface GoalState {
    application: GoalSide;
    outreach: GoalSide;
    week: {
        weekStart: string;
        applications: number;
        outreach: number;
        applicationsTarget: number;
        outreachTarget: number;
        applicationsPace: number;
        outreachPace: number;
    };
    pending: {
        appGoal: number; appGoalType: GoalType;
        outreachGoal: number; outreachGoalType: GoalType;
        effectiveAt: string;
    } | null;
    changes: {
        remaining: number;
        nextAllowedAt: string | null;
        isFirstChange: boolean;
        cooldownDays: number;
        windowDays: number;
        maxPerWindow: number;
    };
    streak: number;
    floors: {
        application: { dailyMin: number; weeklyMin: number };
        outreach: { dailyMin: number; weeklyMin: number };
        maxGoal: number;
    };
}

function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });
}

const ProgressRow: React.FC<{ label: string; side: GoalSide }> = ({ label, side }) => {
    const pct = Math.min(side.done / Math.max(side.goal, 1), 1) * 100;
    const hit = side.done >= side.goal;
    const periodLabel = side.goalType === 'weekly' ? 'this week' : 'today';
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <span style={{ fontSize: 12.5, color: warm.colors.textSecondary }}>
                    {label} {periodLabel}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: hit ? warm.colors.success : warm.colors.textPrimary }}>
                    {side.done} of {side.goal}{side.done > side.goal ? ` ✓ +${side.done - side.goal}` : ''}
                </span>
            </div>
            <div style={{ height: 7, borderRadius: 6, background: warm.colors.borderWhisper, overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 6, transition: 'width 0.4s ease',
                    background: hit ? warm.colors.success : warm.colors.accentPetrol,
                }} />
            </div>
        </div>
    );
};

const typeToggle = (value: GoalType, onChange: (t: GoalType) => void) => (
    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${warm.colors.borderDefined}` }}>
        {(['daily', 'weekly'] as const).map(t => (
            <button
                key={t}
                onClick={() => onChange(t)}
                style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: value === t ? warm.colors.accentPetrol : 'transparent',
                    color: value === t ? 'white' : warm.colors.textSecondary,
                }}
            >
                {t === 'daily' ? 'Daily' : 'Weekly'}
            </button>
        ))}
    </div>
);

const numInput = (value: number, onChange: (n: number) => void) => (
    <input
        type="number"
        min={1}
        max={100}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10) || 1)}
        style={{
            width: 60, padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
            color: warm.colors.textPrimary, outline: 'none',
        }}
    />
);

export const GoalCard: React.FC = () => {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [appType, setAppType] = useState<GoalType>('daily');
    const [appCount, setAppCount] = useState(5);
    const [outType, setOutType] = useState<GoalType>('daily');
    const [outCount, setOutCount] = useState(4);

    const { data } = useQuery({
        queryKey: ['tracker-goals'],
        queryFn: async () => (await api.get('/tracker/goals')).data as GoalState,
        staleTime: 30_000,
    });

    const saveMutation = useMutation({
        mutationFn: async () =>
            (await api.post('/tracker/goals', {
                appGoal: appCount, appGoalType: appType,
                outreachGoal: outCount, outreachGoalType: outType,
            })).data as GoalState,
        onSuccess: updated => {
            queryClient.setQueryData(['tracker-goals'], updated);
            queryClient.invalidateQueries({ queryKey: ['tracker-goal'] });
            setEditing(false);
            setConfirming(false);
            toast.success(updated.pending
                ? `Locked in — new goals start Monday ${fmtDate(updated.pending.effectiveAt)}`
                : 'Goals set');
        },
        onError: (err: any) => {
            const payload = err?.response?.data;
            setConfirming(false);
            if (payload?.nextAllowedAt) {
                toast.error(`Goal changes are locked until ${fmtDate(payload.nextAllowedAt)}.`);
            } else {
                toast.error(payload?.error ?? 'Could not save your goals — try again.');
            }
        },
    });

    if (!data) return null;

    const locked = Boolean(data.changes.nextAllowedAt);
    const appFloor = appType === 'daily' ? data.floors.application.dailyMin : data.floors.application.weeklyMin;
    const outFloor = outType === 'daily' ? data.floors.outreach.dailyMin : data.floors.outreach.weeklyMin;
    const belowFloor = appCount < appFloor || outCount < outFloor;

    const startEditing = () => {
        setAppType(data.application.goalType); setAppCount(data.application.goal);
        setOutType(data.outreach.goalType); setOutCount(data.outreach.goal);
        setConfirming(false);
        setEditing(true);
    };

    const goalHitBoth = data.application.done >= data.application.goal && data.outreach.done >= data.outreach.goal;

    return (
        <div style={{
            background: warm.colors.bgSurface,
            border: `1px solid ${goalHitBoth ? 'rgba(74,157,111,0.35)' : warm.colors.borderWhisper}`,
            borderRadius: 16, padding: '16px 20px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={14} style={{ color: goalHitBoth ? warm.colors.success : warm.colors.accentPetrol }} />
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: warm.colors.textSecondary }}>
                        Weekly commitments
                    </span>
                    {data.streak > 0 && (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999,
                            fontSize: 10, fontWeight: 800, background: 'rgba(196,113,58,0.12)', color: '#C4713A',
                        }}>
                            <Flame size={10} /> {data.streak}-week streak
                        </span>
                    )}
                </div>
                {!editing && (
                    locked ? (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                            borderRadius: 6, fontSize: 10, fontWeight: 700,
                            border: `1px solid ${warm.colors.borderWhisper}`, color: warm.colors.textMuted,
                        }}>
                            <Lock size={10} /> Locked until {fmtDate(data.changes.nextAllowedAt!)}
                        </span>
                    ) : (
                        <button
                            onClick={startEditing}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent',
                                color: warm.colors.textMuted,
                            }}
                        >
                            <Pencil size={10} /> Edit
                        </button>
                    )
                )}
            </div>

            {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 88, fontSize: 12, fontWeight: 700, color: warm.colors.textSecondary }}>Applications</span>
                        {typeToggle(appType, t => { setAppType(t); setConfirming(false); })}
                        {numInput(appCount, n => { setAppCount(n); setConfirming(false); })}
                        <span style={{ fontSize: 11, color: warm.colors.textMuted }}>
                            min {appFloor} per {appType === 'daily' ? 'day' : 'week'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 88, fontSize: 12, fontWeight: 700, color: warm.colors.textSecondary }}>Outreach</span>
                        {typeToggle(outType, t => { setOutType(t); setConfirming(false); })}
                        {numInput(outCount, n => { setOutCount(n); setConfirming(false); })}
                        <span style={{ fontSize: 11, color: warm.colors.textMuted }}>
                            min {outFloor} per {outType === 'daily' ? 'day' : 'week'}
                        </span>
                    </div>

                    {belowFloor && (
                        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: '#B0563C' }}>
                            Goals can't go below the program minimum ({appFloor} applications, {outFloor} outreach per {appType === 'daily' ? 'day' : 'week'}).
                        </p>
                    )}

                    {confirming && !belowFloor && (
                        <div style={{
                            padding: '10px 14px', borderRadius: 10, background: 'rgba(196,113,58,0.08)',
                            border: '1px solid rgba(196,113,58,0.25)',
                        }}>
                            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: warm.colors.textPrimary }}>
                                <strong>Before you confirm:</strong>{' '}
                                {data.changes.isFirstChange
                                    ? 'this first change applies straight away.'
                                    : 'new goals start next Monday, not today.'}{' '}
                                After saving, goal edits lock for {data.changes.cooldownDays} days, and you have{' '}
                                <strong>{data.changes.remaining} of {data.changes.maxPerWindow}</strong> changes left in a rolling{' '}
                                {data.changes.windowDays}-day window. Set a number you'll stand behind.
                            </p>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => (confirming ? saveMutation.mutate() : setConfirming(true))}
                            disabled={saveMutation.isPending || belowFloor}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                                borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none',
                                cursor: belowFloor ? 'not-allowed' : 'pointer',
                                background: confirming ? '#C4713A' : warm.colors.accentPetrol,
                                color: 'white', opacity: belowFloor ? 0.5 : 1,
                            }}
                        >
                            {saveMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            {confirming ? 'Confirm change' : 'Save'}
                        </button>
                        <button
                            onClick={() => { setEditing(false); setConfirming(false); }}
                            style={{ padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', background: 'transparent', color: warm.colors.textMuted, cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: warm.colors.textMuted, lineHeight: 1.5 }}>
                        Pick daily if your week is even. Pick weekly if you do shift work — hit the number whenever your hours allow.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <ProgressRow label="Applications" side={data.application} />
                    <ProgressRow label="Outreach" side={data.outreach} />
                    {(data.week.applications < data.week.applicationsPace || data.week.outreach < data.week.outreachPace) && (
                        <p style={{
                            margin: 0, padding: '7px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 600,
                            background: 'rgba(196,113,58,0.09)', border: '1px solid rgba(196,113,58,0.22)', color: '#9A5A2E',
                        }}>
                            Behind pace: by tonight you should be at {data.week.applicationsPace} applications and {data.week.outreachPace} outreach for the week. Still fixable today.
                        </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 11, color: warm.colors.textMuted }}>
                            Week so far: {data.week.applications}/{data.week.applicationsTarget} applications · {data.week.outreach}/{data.week.outreachTarget} outreach
                        </span>
                        {data.pending && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: warm.colors.accentPetrol }}>
                                <CalendarClock size={11} />
                                From Mon {fmtDate(data.pending.effectiveAt)}: {data.pending.appGoal}/{data.pending.appGoalType === 'daily' ? 'day' : 'wk'} apps, {data.pending.outreachGoal}/{data.pending.outreachGoalType === 'daily' ? 'day' : 'wk'} outreach
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
