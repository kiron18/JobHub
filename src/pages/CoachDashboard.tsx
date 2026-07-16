import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Users, Flame, AlertTriangle, Loader2, ChevronDown, ChevronUp,
    PauseCircle, Check, RefreshCcw, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';

interface WeekCell { weekStart: string; applications: number; outreach: number; paused: boolean; hit: boolean; }

interface CoachMember {
    userId: string;
    name: string;
    email: string | null;
    goals: {
        appGoal: number; appGoalType: string;
        outreachGoal: number; outreachGoalType: string;
        weeklyAppTarget: number; weeklyOutreachTarget: number;
    };
    week: { applications: number; outreach: number; paused: boolean; onTrackApps: boolean; onTrackOutreach: boolean };
    streak: number;
    lastFourWeeks: WeekCell[];
    flags: { missedWeeks: number; backdatedEntries14d: number; needsConversation: boolean };
    goalChanges: {
        countLast90d: number;
        lastChangeAt: string | null;
        pending: { appGoal: number; appGoalType: string; outreachGoal: number; outreachGoalType: string; effectiveAt: string } | null;
        recent: Array<{ appGoal: number; appGoalType: string; outreachGoal: number; outreachGoalType: string; byCoach: boolean; createdAt: string; effectiveAt: string }>;
    };
    pauseWeeks: string[];
}

interface CoachData { weekStart: string; members: CoachMember[]; }

// TEMPORARY MOCK DATA GENERATOR for demo purposes - does NOT affect real users
const MOCK_NAMES = [
    'Jairaj Bhagat', 'Shahzaib Ali Adil', 'Abhishek Kathuria', 'Nagaraja Sai Nandimandalam',
    'Mary Nyokabi', 'Shishir Dhakal', 'Ani Bharadwaj', 'Rahul Madathil', 'Adam Pearce',
    'Priya Sharma', 'Mohammed Al-Rashid', 'Lisa Chen', 'James Wilson', 'Fatima Hassan',
    'David Kim', 'Sofia Martinez', 'Aryan Patel', 'Emma Thompson', 'Lucas Silva',
    'Zara Ahmed', 'Daniel Lee', 'Olivia Brown', 'Noah Garcia', 'Aisha Okafor',
    'Benjamin Taylor', 'Mia Anderson', 'Ethan Wright'
];

const MOCK_EMAILS = [
    'jairaj.b@gmail.com', 'shahzaib.adil@outlook.com', 'abhishek.k@yahoo.com', 'sai.n@hotmail.com',
    'mary.nyokabi@gmail.com', 'shishir.d@gmail.com', 'ani.b@outlook.com', 'rahul.m@yahoo.com', 'adam.pearce@email.com',
    'priya.s@gmail.com', 'mohammed.ar@outlook.com', 'lisa.chen@email.com', 'james.w@gmail.com', 'fatima.h@yahoo.com',
    'david.kim@outlook.com', 'sofia.m@email.com', 'aryan.p@gmail.com', 'emma.t@hotmail.com', 'lucas.s@email.com',
    'zara.a@gmail.com', 'daniel.lee@outlook.com', 'olivia.b@yahoo.com', 'noah.g@gmail.com', 'aisha.o@email.com',
    'ben.taylor@outlook.com', 'mia.a@hotmail.com', 'ethan.w@gmail.com'
];

function generateMockData(): CoachData {
    const today = new Date('2026-07-13'); // Current week start
    const weekStart = '2026-07-13';

    // Helper to get Monday of a week offset
    const getMonday = (weeksAgo: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (weeksAgo * 7));
        return d.toISOString().slice(0, 10);
    };

    // Member age distribution: 16 (1mo), 8 (2mo), 3 (3mo)
    const memberAges = [
        ...Array(16).fill(1),  // 1 month old (joined mid-June)
        ...Array(8).fill(2),   // 2 months old (joined mid-May)
        ...Array(3).fill(3)    // 3 months old (joined mid-April, early adopters)
    ];

    const members: CoachMember[] = MOCK_NAMES.map((name, i) => {
        const ageMonths = memberAges[i];
        const email = MOCK_EMAILS[i];

        // Goals: mix of daily and weekly
        const appGoalType = Math.random() > 0.7 ? 'weekly' : 'daily';
        const outreachGoalType = Math.random() > 0.7 ? 'weekly' : 'daily';
        const appGoal = appGoalType === 'daily' ? (Math.random() > 0.5 ? 5 : 3) : 25;
        const outreachGoal = outreachGoalType === 'daily' ? (Math.random() > 0.5 ? 4 : 2) : 20;
        const weeklyAppTarget = appGoalType === 'daily' ? appGoal * 5 : appGoal;
        const weeklyOutreachTarget = outreachGoalType === 'daily' ? outreachGoal * 5 : outreachGoal;

        // Current week progress (Tuesday of the week)
        const daysIntoWeek = 2; // Tuesday
        const dailyProgress = daysIntoWeek / 5; // 40% through week

        // Performance tier affects current stats
        const rand = Math.random();
        let performance: 'high' | 'medium' | 'low';
        if (rand > 0.6) performance = 'high';
        else if (rand > 0.25) performance = 'medium';
        else performance = 'low';

        let appsCurrent: number, outreachCurrent: number;
        if (performance === 'high') {
            appsCurrent = Math.floor(weeklyAppTarget * (0.5 + Math.random() * 0.6));
            outreachCurrent = Math.floor(weeklyOutreachTarget * (0.5 + Math.random() * 0.6));
        } else if (performance === 'medium') {
            appsCurrent = Math.floor(weeklyAppTarget * (0.3 + Math.random() * 0.5));
            outreachCurrent = Math.floor(weeklyOutreachTarget * (0.3 + Math.random() * 0.5));
        } else {
            appsCurrent = Math.floor(weeklyAppTarget * Math.random() * 0.4);
            outreachCurrent = Math.floor(weeklyOutreachTarget * Math.random() * 0.4);
        }

        // Cap at targets
        appsCurrent = Math.min(appsCurrent, weeklyAppTarget);
        outreachCurrent = Math.min(outreachCurrent, weeklyOutreachTarget);

        const onTrackApps = appsCurrent >= (weeklyAppTarget * dailyProgress);
        const onTrackOutreach = outreachCurrent >= (weeklyOutreachTarget * dailyProgress);
        const isPaused = Math.random() > 0.92; // ~8% paused

        // Generate last 4 weeks history based on member age
        const lastFourWeeks: WeekCell[] = [];
        const maxWeeks = ageMonths * 4; // How many weeks of history they could have
        const weeksAvailable = Math.min(4, maxWeeks);

        let hitCount = 0;
        for (let w = 0; w < 4; w++) {
            const ws = getMonday(3 - w);
            if (w >= weeksAvailable) {
                // No history yet (joined after this week)
                lastFourWeeks.push({ weekStart: ws, applications: 0, outreach: 0, paused: false, hit: false });
                continue;
            }

            const weekPaused = Math.random() > 0.9;
            if (weekPaused) {
                lastFourWeeks.push({ weekStart: ws, applications: 0, outreach: 0, paused: true, hit: false });
                continue;
            }

            // Simulate weekly performance
            const wkPerformance = Math.random();
            const wkApps = weekPaused ? 0 : Math.floor(weeklyAppTarget * (0.3 + wkPerformance * 0.9));
            const wkOutreach = weekPaused ? 0 : Math.floor(weeklyOutreachTarget * (0.3 + wkPerformance * 0.9));
            const hit = wkApps >= weeklyAppTarget && wkOutreach >= weeklyOutreachTarget;
            if (hit) hitCount++;

            lastFourWeeks.push({
                weekStart: ws,
                applications: wkApps,
                outreach: wkOutreach,
                paused: weekPaused,
                hit
            });
        }

        // Calculate streak (consecutive weeks hitting goals)
        let streak = 0;
        for (const week of lastFourWeeks) {
            if (week.hit) streak++;
            else if (!week.paused) break;
        }
        // Add historical streak for older members
        if (ageMonths >= 2 && performance === 'high') streak += Math.floor(Math.random() * 6) + 2;
        else if (ageMonths >= 3 && performance === 'high') streak += Math.floor(Math.random() * 8) + 4;

        // Flags
        const missedWeeks = lastFourWeeks.filter(w => !w.hit && !w.paused).length;
        const needsConversation = missedWeeks >= 2 && performance === 'low';
        const backdatedEntries14d = Math.random() > 0.85 ? Math.floor(Math.random() * 3) + 1 : 0;

        // Goal changes
        const countLast90d = ageMonths >= 2 ? Math.floor(Math.random() * 2) : 0;
        const recent: CoachMember['goalChanges']['recent'] = [];
        if (countLast90d > 0 && ageMonths >= 2) {
            recent.push({
                appGoal: appGoal - 1,
                appGoalType,
                outreachGoal: outreachGoal - 1,
                outreachGoalType,
                byCoach: Math.random() > 0.5,
                createdAt: getMonday(8),
                effectiveAt: getMonday(4)
            });
        }

        // Pause weeks
        const pauseWeeks: string[] = [];
        if (isPaused) pauseWeeks.push(weekStart);
        if (Math.random() > 0.8) {
            const prevWeek = getMonday(1);
            if (!isPaused || prevWeek !== weekStart) pauseWeeks.push(prevWeek);
        }

        return {
            userId: `mock-user-${i}`,
            name,
            email,
            goals: { appGoal, appGoalType, outreachGoal, outreachGoalType, weeklyAppTarget, weeklyOutreachTarget },
            week: {
                applications: isPaused ? 0 : appsCurrent,
                outreach: isPaused ? 0 : outreachCurrent,
                paused: isPaused,
                onTrackApps: isPaused ? true : onTrackApps,
                onTrackOutreach: isPaused ? true : onTrackOutreach
            },
            streak,
            lastFourWeeks,
            flags: { missedWeeks, backdatedEntries14d, needsConversation },
            goalChanges: {
                countLast90d,
                lastChangeAt: countLast90d > 0 ? getMonday(8) : null,
                pending: null,
                recent
            },
            pauseWeeks
        };
    });

    return { weekStart, members };
}

const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });

const goalLabel = (goal: number, type: string) => `${goal}/${type === 'weekly' ? 'wk' : 'day'}`;

export const CoachDashboard: React.FC = () => {
    const queryClient = useQueryClient();
    const [expanded, setExpanded] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [override, setOverride] = useState({ appGoal: 5, appGoalType: 'daily', outreachGoal: 4, outreachGoalType: 'daily' });

    // TEMPORARY: Use mock data for demo (100% safe - no API calls, no DB writes)
    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['coach-overview'],
        queryFn: async () => generateMockData(),
    });

    // TEMPORARY: Mock mutations that just show toast (no API calls)
    const pauseMutation = useMutation({
        mutationFn: async (_body: { userId: string; weekStart: string; remove?: boolean }) => {
            await new Promise(r => setTimeout(r, 300));
            return { success: true };
        },
        onSuccess: (_d, vars) => {
            toast.success(vars.remove ? 'Pause removed (demo)' : 'Pause week granted (demo)');
        },
        onError: () => toast.error('Could not update pause week'),
    });

    const overrideMutation = useMutation({
        mutationFn: async (_body: { userId: string }) => {
            await new Promise(r => setTimeout(r, 300));
            return { success: true };
        },
        onSuccess: () => {
            toast.success('Goals overridden — applies immediately (demo)');
        },
        onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Override failed'),
    });

    const nextMonday = data
        ? new Date(new Date(`${data.weekStart}T00:00:00.000Z`).getTime() + 7 * 86400000).toISOString().slice(0, 10)
        : '';

    const members = (data?.members ?? []).filter(m => {
        const q = search.trim().toLowerCase();
        return !q || m.name.toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q);
    });

    const attention = members.filter(m => m.flags.needsConversation).length;

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '8px 4px 60px' }}>
            {/* TEMPORARY DEMO MODE BANNER */}
            <div style={{
                background: 'linear-gradient(90deg, #C4713A, #B0563C)',
                color: 'white',
                padding: '10px 16px',
                borderRadius: 10,
                marginBottom: 16,
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <span>🎭 DEMO MODE — Mock data for presentation. NO real customer data affected.</span>
                <span style={{ fontSize: 11, opacity: 0.9 }}>27 members | April–July 2026 timeline</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Users size={16} style={{ color: warm.colors.accentPetrol }} />
                        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: warm.colors.accentPetrol }}>
                            Coach view
                        </span>
                    </div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: warm.colors.textPrimary }}>
                        Member accountability
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: warm.colors.textSecondary }}>
                        Week of {data ? fmt(data.weekStart) : '…'}
                        {attention > 0 && <span style={{ color: '#B0563C', fontWeight: 700 }}> · {attention} member{attention === 1 ? '' : 's'} need a conversation</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
                        borderRadius: 10, background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
                    }}>
                        <Search size={13} style={{ color: warm.colors.textMuted }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Find a member…"
                            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: warm.colors.textPrimary, width: 150 }}
                        />
                    </div>
                    <button onClick={() => refetch()} disabled={isFetching}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, background: warm.colors.bgAlt,
                            border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 10, padding: '8px 14px',
                            fontSize: 12, fontWeight: 700, color: warm.colors.textSecondary, cursor: 'pointer', opacity: isFetching ? 0.5 : 1,
                        }}>
                        <RefreshCcw size={12} /> Refresh
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <Loader2 size={22} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {members.map(m => {
                        const isOpen = expanded === m.userId;
                        const currentPaused = m.week.paused;
                        return (
                            <div key={m.userId} style={{
                                borderRadius: 14, background: warm.colors.bgSurface,
                                border: `1px solid ${m.flags.needsConversation ? 'rgba(176,86,60,0.4)' : warm.colors.borderWhisper}`,
                            }}>
                                {/* Summary row */}
                                <button
                                    onClick={() => {
                                        setExpanded(isOpen ? null : m.userId);
                                        setOverride({
                                            appGoal: m.goals.appGoal, appGoalType: m.goals.appGoalType,
                                            outreachGoal: m.goals.outreachGoal, outreachGoalType: m.goals.outreachGoalType,
                                        });
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 16px',
                                        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                                    }}
                                >
                                    <div style={{ flex: '1 1 180px', minWidth: 140 }}>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: warm.colors.textPrimary, display: 'flex', alignItems: 'center', gap: 7 }}>
                                            {m.name}
                                            {m.flags.needsConversation && (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 8px', borderRadius: 999,
                                                    fontSize: 10, fontWeight: 800, background: 'rgba(176,86,60,0.12)', color: '#B0563C',
                                                }}>
                                                    <AlertTriangle size={10} /> talk to them
                                                </span>
                                            )}
                                            {currentPaused && (
                                                <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 8px', borderRadius: 999, background: warm.colors.bgAlt, color: warm.colors.textMuted }}>
                                                    paused
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 11.5, color: warm.colors.textMuted }}>{m.email}</div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                                        <Stat label="Apps" value={`${m.week.applications}/${m.goals.weeklyAppTarget}`} good={m.week.onTrackApps} />
                                        <Stat label="Outreach" value={`${m.week.outreach}/${m.goals.weeklyOutreachTarget}`} good={m.week.onTrackOutreach} />
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                            {m.lastFourWeeks.map(w => (
                                                <span key={w.weekStart} title={`${w.weekStart}: ${w.applications} apps, ${w.outreach} outreach${w.paused ? ' (paused)' : ''}`}
                                                    style={{
                                                        width: 10, height: 10, borderRadius: 3,
                                                        background: w.paused ? warm.colors.borderDefined : w.hit ? warm.colors.success : 'rgba(176,86,60,0.55)',
                                                    }} />
                                            ))}
                                        </div>
                                        {m.streak > 0 && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 800, color: '#C4713A' }}>
                                                <Flame size={12} />{m.streak}w
                                            </span>
                                        )}
                                        {m.flags.backdatedEntries14d > 0 && (
                                            <span title="Entries logged with an applied date well before the day they were entered"
                                                style={{ fontSize: 11, fontWeight: 700, color: '#B0563C' }}>
                                                {m.flags.backdatedEntries14d} backdated
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ marginLeft: 'auto', color: warm.colors.textMuted }}>
                                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </button>

                                {/* Detail panel */}
                                {isOpen && (
                                    <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${warm.colors.borderWhisper}` }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, paddingTop: 14 }}>
                                            {/* Goals + history */}
                                            <div style={{ flex: '1 1 260px' }}>
                                                <SectionLabel>Goals</SectionLabel>
                                                <p style={{ margin: '0 0 6px', fontSize: 13, color: warm.colors.textPrimary }}>
                                                    {goalLabel(m.goals.appGoal, m.goals.appGoalType)} applications · {goalLabel(m.goals.outreachGoal, m.goals.outreachGoalType)} outreach
                                                </p>
                                                {m.goalChanges.pending && (
                                                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: warm.colors.accentPetrol }}>
                                                        Pending from {fmt(m.goalChanges.pending.effectiveAt)}: {goalLabel(m.goalChanges.pending.appGoal, m.goalChanges.pending.appGoalType)} apps, {goalLabel(m.goalChanges.pending.outreachGoal, m.goalChanges.pending.outreachGoalType)} outreach
                                                    </p>
                                                )}
                                                <p style={{ margin: '0 0 8px', fontSize: 11.5, color: warm.colors.textMuted }}>
                                                    {m.goalChanges.countLast90d} member change{m.goalChanges.countLast90d === 1 ? '' : 's'} in last 90 days
                                                    {m.goalChanges.lastChangeAt ? ` · last ${fmt(m.goalChanges.lastChangeAt)}` : ''}
                                                </p>
                                                {m.goalChanges.recent.length > 0 && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        {m.goalChanges.recent.map((c, i) => (
                                                            <div key={i} style={{ fontSize: 11.5, color: warm.colors.textSecondary }}>
                                                                {fmt(c.createdAt)}: {goalLabel(c.appGoal, c.appGoalType)} apps, {goalLabel(c.outreachGoal, c.outreachGoalType)} outreach
                                                                {c.byCoach && <strong style={{ color: warm.colors.accentPetrol }}> (coach)</strong>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Pause weeks */}
                                            <div style={{ flex: '0 1 220px' }}>
                                                <SectionLabel>Pause weeks</SectionLabel>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    <button
                                                        onClick={() => pauseMutation.mutate({ userId: m.userId, weekStart: data!.weekStart, remove: currentPaused })}
                                                        disabled={pauseMutation.isPending}
                                                        style={pauseBtnStyle}
                                                    >
                                                        <PauseCircle size={12} /> {currentPaused ? 'Unpause this week' : 'Pause this week'}
                                                    </button>
                                                    <button
                                                        onClick={() => pauseMutation.mutate({ userId: m.userId, weekStart: nextMonday, remove: m.pauseWeeks.includes(nextMonday) })}
                                                        disabled={pauseMutation.isPending}
                                                        style={pauseBtnStyle}
                                                    >
                                                        <PauseCircle size={12} /> {m.pauseWeeks.includes(nextMonday) ? 'Unpause next week' : 'Pause next week'}
                                                    </button>
                                                    {m.pauseWeeks.length > 0 && (
                                                        <span style={{ fontSize: 11, color: warm.colors.textMuted }}>Granted: {m.pauseWeeks.join(', ')}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Coach override */}
                                            <div style={{ flex: '1 1 280px' }}>
                                                <SectionLabel>Override goals (applies immediately)</SectionLabel>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 12, color: warm.colors.textSecondary }}>Apps</span>
                                                    <input type="number" min={1} max={100} value={override.appGoal}
                                                        onChange={e => setOverride(o => ({ ...o, appGoal: parseInt(e.target.value, 10) || 1 }))}
                                                        style={miniInput} />
                                                    <select value={override.appGoalType}
                                                        onChange={e => setOverride(o => ({ ...o, appGoalType: e.target.value }))}
                                                        style={miniInput}>
                                                        <option value="daily">/day</option>
                                                        <option value="weekly">/week</option>
                                                    </select>
                                                    <span style={{ fontSize: 12, color: warm.colors.textSecondary }}>Outreach</span>
                                                    <input type="number" min={1} max={100} value={override.outreachGoal}
                                                        onChange={e => setOverride(o => ({ ...o, outreachGoal: parseInt(e.target.value, 10) || 1 }))}
                                                        style={miniInput} />
                                                    <select value={override.outreachGoalType}
                                                        onChange={e => setOverride(o => ({ ...o, outreachGoalType: e.target.value }))}
                                                        style={miniInput}>
                                                        <option value="daily">/day</option>
                                                        <option value="weekly">/week</option>
                                                    </select>
                                                    <button
                                                        onClick={() => overrideMutation.mutate({ userId: m.userId })}
                                                        disabled={overrideMutation.isPending}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                                                            borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                                                            background: warm.colors.accentPetrol, color: 'white',
                                                        }}>
                                                        {overrideMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                                                        Apply
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {members.length === 0 && (
                        <div style={{ padding: 40, textAlign: 'center', color: warm.colors.textMuted, fontSize: 13 }}>
                            No members match.
                        </div>
                    )}
                </div>
            )}

            <p style={{ margin: '14px 4px 0', fontSize: 11.5, color: warm.colors.textMuted }}>
                Squares = last 4 completed weeks (green hit both minimums, red missed, grey paused). "Talk to them" = 2+ missed weeks in the last 4.
            </p>

            <NudgePreview />
        </div>
    );
};

interface NudgeRunResult {
    kind: string;
    dryRun: boolean;
    enabled: boolean;
    sent: Array<{ email: string; name: string; reason: string }>;
    skipped: Array<{ email: string; reason: string }>;
}

/** Dry-run panel for the accountability emails — never sends, only previews. */
const NudgePreview: React.FC = () => {
    const [result, setResult] = useState<NudgeRunResult | null>(null);
    const runMutation = useMutation({
        mutationFn: async (kind: string) =>
            (await api.post('/admin/coach/nudges/run', { kind, dryRun: true })).data as NudgeRunResult,
        onSuccess: setResult,
        onError: () => toast.error('Preview failed'),
    });

    const kinds: Array<[string, string]> = [
        ['daily_pace', 'Pace nudges (5pm Mon–Fri)'],
        ['weekly_wrap', 'Weekly wraps (Mon 9am)'],
        ['coach_digest', 'Coach digest (Mon 9am)'],
    ];

    return (
        <div style={{
            marginTop: 24, padding: '14px 16px', borderRadius: 14,
            background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
        }}>
            <SectionLabel>Email nudges — preview who would get what (nothing is sent)</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: result ? 12 : 0 }}>
                {kinds.map(([kind, label]) => (
                    <button key={kind}
                        onClick={() => runMutation.mutate(kind)}
                        disabled={runMutation.isPending}
                        style={pauseBtnStyle}>
                        {runMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {label}
                    </button>
                ))}
            </div>
            {result && (
                <div style={{ fontSize: 12, color: warm.colors.textSecondary }}>
                    <p style={{ margin: '0 0 6px', fontWeight: 700, color: warm.colors.textPrimary }}>
                        {result.kind}: {result.sent.length} would receive an email
                        {!result.enabled && <span style={{ color: '#B0563C' }}> · live sending is OFF (set ACCOUNTABILITY_EMAILS=true to enable the cron)</span>}
                    </p>
                    {result.sent.map((s, i) => (
                        <div key={i} style={{ padding: '2px 0' }}>
                            <strong>{s.name}</strong> ({s.email}) — {s.reason}
                        </div>
                    ))}
                    {result.sent.length === 0 && <div>Nobody currently qualifies.</div>}
                </div>
            )}
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string; good: boolean }> = ({ label, value, good }) => (
    <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: warm.colors.textMuted }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: good ? warm.colors.success : '#B0563C' }}>{value}</div>
    </div>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: warm.colors.textMuted, marginBottom: 7 }}>
        {children}
    </div>
);

const pauseBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
    borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent', color: warm.colors.textSecondary,
    width: 'fit-content',
};

const miniInput: React.CSSProperties = {
    width: 64, padding: '5px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
    color: warm.colors.textPrimary, outline: 'none',
};
