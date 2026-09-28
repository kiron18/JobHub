import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

interface ActivityData {
    signupDate: string;
    thisWeekStart: string;
    days: Array<{ date: string; applications: number; outreach: number }>;
    pauseWeeks: string[];
    goals: { appPerDay: number; outreachPerDay: number };
}

const BLUE = warm.colors.accentPetrol;
const GOLD = warm.colors.accentGoldBright;
const MISS = '#B0563C';
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const short = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** 0..1 share of the day's goal met, averaged over apps and outreach. */
const dayScore = (d: { applications: number; outreach: number }, g: ActivityData['goals']) =>
    Math.min(1, ((g.appPerDay > 0 ? Math.min(1, d.applications / g.appPerDay) : 0) +
        (g.outreachPerDay > 0 ? Math.min(1, d.outreach / g.outreachPerDay) : 0)) / 2);

const shade = (score: number) => {
    // 0 -> pale, 1 -> full blue
    const a = 0.18 + score * 0.82;
    return `rgba(18,87,196,${a.toFixed(2)})`;
};

export const MemberActivity: React.FC<{ userId: string }> = ({ userId }) => {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['coach-activity', userId],
        queryFn: async () => (await api.get(`/admin/coach/member/${userId}/activity`)).data as ActivityData,
        staleTime: 60_000,
    });

    const view = useMemo(() => {
        if (!data) return null;
        const paused = new Set(data.pauseWeeks);
        const today = new Date(Date.now() + 10 * 3600 * 1000).toISOString().slice(0, 10);
        const weeks: Array<{ start: string; days: ActivityData['days']; paused: boolean; apps: number; outreach: number }> = [];
        for (let i = 0; i < data.days.length; i += 7) {
            const days = data.days.slice(i, i + 7);
            weeks.push({
                start: days[0].date, days, paused: paused.has(days[0].date),
                apps: days.reduce((s, d) => s + d.applications, 0),
                outreach: days.reduce((s, d) => s + d.outreach, 0),
            });
        }
        const weeklyApp = data.goals.appPerDay * 5;
        const weeklyOut = data.goals.outreachPerDay * 5;
        const weekScore = (w: { apps: number; outreach: number }) =>
            ((weeklyApp > 0 ? w.apps / weeklyApp : 0) + (weeklyOut > 0 ? w.outreach / weeklyOut : 0)) / 2;

        const completed = weeks.filter(w => w.start < data.thisWeekStart);
        const counted = completed.filter(w => !w.paused);
        const hit = counted.filter(w => w.apps >= weeklyApp && w.outreach >= weeklyOut).length;

        // Weekdays from sign-up to today, skipping paused weeks.
        const elapsed = data.days.filter(d => {
            if (d.date > today || d.date < data.signupDate) return false;
            const dow = (new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7;
            if (dow > 4) return false;
            const wk = weeks.find(w => w.days.some(x => x.date === d.date));
            return !wk?.paused;
        });
        const activeDays = elapsed.filter(d => d.applications + d.outreach > 0).length;

        // Longest run of weekdays with nothing logged.
        let gap = 0, cur = 0;
        for (const d of elapsed) { cur = d.applications + d.outreach > 0 ? 0 : cur + 1; gap = Math.max(gap, cur); }

        const lastActive = [...data.days].reverse().find(d => d.date <= today && d.applications + d.outreach > 0)?.date ?? null;

        // Best run of consecutive hit weeks.
        let best = 0, run = 0;
        for (const w of completed) {
            if (w.paused) continue;
            run = w.apps >= weeklyApp && w.outreach >= weeklyOut ? run + 1 : 0;
            best = Math.max(best, run);
        }

        const lastWeek = weeks.find(w => w.start === new Date(new Date(`${data.thisWeekStart}T00:00:00Z`).getTime() - 7 * 86400000).toISOString().slice(0, 10));
        const thisWeek = weeks.find(w => w.start === data.thisWeekStart);
        return { weeks, today, weekScore, weeklyApp, weeklyOut, hit, counted: counted.length, elapsed: elapsed.length, activeDays, gap, lastActive, best, lastWeek, thisWeek };
    }, [data]);

    if (isLoading) {
        return <div style={{ padding: '18px 0', display: 'flex', justifyContent: 'center' }}><Loader2 size={16} className="animate-spin" style={{ color: BLUE }} /></div>;
    }
    if (isError || !data || !view) {
        return <p style={{ fontSize: 12, color: MISS, margin: '14px 0 0' }}>Could not load activity.</p>;
    }

    const pct = view.elapsed ? Math.round((view.activeDays / view.elapsed) * 100) : 0;
    const sinceLast = view.lastActive
        ? Math.max(0, Math.round((new Date(`${view.today}T00:00:00Z`).getTime() - new Date(`${view.lastActive}T00:00:00Z`).getTime()) / 86400000))
        : null;

    return (
        <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Headline numbers */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Big label="Active weekdays" value={`${pct}%`} sub={`${view.activeDays} of ${view.elapsed} since ${short(data.signupDate)}`} tone={pct >= 70 ? BLUE : pct >= 40 ? GOLD : MISS} />
                <Big label="Weeks on target" value={`${view.hit}/${view.counted}`} sub="apps and outreach both" tone={view.counted && view.hit / view.counted >= 0.6 ? BLUE : view.hit / Math.max(1, view.counted) >= 0.3 ? GOLD : MISS} />
                <Big label="Best run" value={`${view.best}w`} sub="consecutive weeks on target" tone={BLUE} />
                <Big label="Longest gap" value={`${view.gap}d`} sub="weekdays with nothing logged" tone={view.gap >= 7 ? MISS : view.gap >= 3 ? GOLD : BLUE} />
                <Big label="Last active" value={sinceLast === null ? 'never' : sinceLast === 0 ? 'today' : `${sinceLast}d ago`} sub={view.lastActive ? short(view.lastActive) : ''} tone={sinceLast === null || sinceLast >= 4 ? MISS : BLUE} />
            </div>

            {/* Last week and this week, day by day */}
            <div>
                <Label>Day by day</Label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                    {view.lastWeek && <WeekBars title={`Last week (${short(view.lastWeek.start)})`} week={view.lastWeek} goals={data.goals} today={view.today} />}
                    {view.thisWeek && <WeekBars title={`This week (${short(view.thisWeek.start)})`} week={view.thisWeek} goals={data.goals} today={view.today} />}
                </div>
                <Legend items={[[BLUE, 'Applications'], [GOLD, 'Outreach'], [warm.colors.textMuted, 'Dashed line = daily goal']]} />
            </div>

            {/* Consistency heatmap */}
            <div>
                <Label>Every day since sign-up</Label>
                <Heatmap weeks={view.weeks} goals={data.goals} today={view.today} signup={data.signupDate} />
                <Legend items={[[shade(0), 'Nothing'], [shade(0.5), 'Half the goal'], [shade(1), 'Goal met'], [warm.colors.borderDefined, 'Paused week']]} />
            </div>

            {/* Weekly trend */}
            <div>
                <Label>Week by week vs weekly target</Label>
                <WeeklyTrend weeks={view.weeks} weekScore={view.weekScore} thisWeekStart={data.thisWeekStart} />
                <Legend items={[[BLUE, 'Hit both targets'], [MISS, 'Missed'], [warm.colors.borderDefined, 'Paused'], [warm.colors.textMuted, 'Dashed line = 100%']]} />
            </div>
        </div>
    );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: warm.colors.textMuted, marginBottom: 8 }}>{children}</div>
);

const Big: React.FC<{ label: string; value: string; sub: string; tone: string }> = ({ label, value, sub, tone }) => (
    <div style={{ flex: '1 1 130px', padding: '10px 12px', borderRadius: 12, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}` }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: warm.colors.textMuted }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', color: tone, lineHeight: 1.15 }}>{value}</div>
        <div style={{ fontSize: 11, color: warm.colors.textSecondary }}>{sub}</div>
    </div>
);

const Legend: React.FC<{ items: Array<[string, string]> }> = ({ items }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
        {items.map(([c, t]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: warm.colors.textMuted }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: c }} />{t}
            </span>
        ))}
    </div>
);

const WeekBars: React.FC<{
    title: string;
    week: { days: ActivityData['days']; paused: boolean };
    goals: ActivityData['goals'];
    today: string;
}> = ({ title, week, goals, today }) => {
    const W = 260, H = 110, pad = 18, colW = (W - 4) / 7;
    const maxV = Math.max(goals.appPerDay, goals.outreachPerDay, ...week.days.map(d => Math.max(d.applications, d.outreach)), 1) * 1.15;
    const y = (v: number) => H - pad - (v / maxV) * (H - pad - 6);
    return (
        <div style={{ flex: '1 1 260px', maxWidth: 420 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: warm.colors.textSecondary, marginBottom: 2 }}>
                {title}{week.paused && <span style={{ color: warm.colors.textMuted }}> · paused</span>}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}>
                {[goals.appPerDay, goals.outreachPerDay].map((g, i) => (
                    <line key={i} x1={0} x2={W} y1={y(g)} y2={y(g)} stroke={i === 0 ? BLUE : GOLD} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                ))}
                {week.days.map((d, i) => {
                    const x0 = 2 + i * colW;
                    const future = d.date > today;
                    const bw = colW * 0.28;
                    const empty = !future && d.applications + d.outreach === 0 && i < 5 && !week.paused;
                    return (
                        <g key={d.date} opacity={future ? 0.35 : 1}>
                            {empty && <rect x={x0 + 2} y={6} width={colW - 4} height={H - pad - 6} rx={4} fill={MISS} opacity={0.08} />}
                            <rect x={x0 + colW / 2 - bw - 1} width={bw} rx={2} fill={BLUE} y={y(d.applications)} height={Math.max(0, H - pad - y(d.applications))}>
                                <title>{`${d.date}: ${d.applications} applications`}</title>
                            </rect>
                            <rect x={x0 + colW / 2 + 1} width={bw} rx={2} fill={GOLD} y={y(d.outreach)} height={Math.max(0, H - pad - y(d.outreach))}>
                                <title>{`${d.date}: ${d.outreach} outreach`}</title>
                            </rect>
                            <text x={x0 + colW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={warm.colors.textMuted}>{DOW[i]}</text>
                            {(d.applications > 0 || d.outreach > 0) && (
                                <text x={x0 + colW / 2} y={y(Math.max(d.applications, d.outreach)) - 3} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={warm.colors.textSecondary}>
                                    {d.applications}/{d.outreach}
                                </text>
                            )}
                        </g>
                    );
                })}
                <line x1={0} x2={W} y1={H - pad} y2={H - pad} stroke={warm.colors.borderDefined} />
            </svg>
        </div>
    );
};

const Heatmap: React.FC<{ weeks: Array<{ start: string; days: ActivityData['days']; paused: boolean }>; goals: ActivityData['goals']; today: string; signup: string }> = ({ weeks, goals, today, signup }) => {
    const cell = 14, gap = 3, left = 28, top = 16;
    const W = left + weeks.length * (cell + gap), H = top + 7 * (cell + gap);
    let lastMonth = '';
    return (
        <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width={Math.max(W, 280)} style={{ maxWidth: '100%', minWidth: Math.min(W, 320) }} role="img" aria-label="Daily activity since sign-up">
                {[0, 2, 4].map(r => (
                    <text key={r} x={0} y={top + r * (cell + gap) + cell - 3} fontSize={9} fill={warm.colors.textMuted}>{DOW[r]}</text>
                ))}
                {weeks.map((w, wi) => {
                    const month = new Date(`${w.start}T00:00:00Z`).toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' });
                    const showMonth = month !== lastMonth;
                    lastMonth = month;
                    return (
                        <g key={w.start}>
                            {showMonth && <text x={left + wi * (cell + gap)} y={10} fontSize={9} fill={warm.colors.textMuted}>{month}</text>}
                            {w.days.map((d, di) => {
                                const future = d.date > today;
                                const beforeSignup = d.date < signup;
                                const active = d.applications + d.outreach > 0;
                                let fill: string;
                                if (future || (beforeSignup && !active)) fill = 'transparent';
                                else if (w.paused) fill = warm.colors.borderDefined;
                                else fill = shade(dayScore(d, goals));
                                if (!future && !active && !w.paused && di > 4) fill = 'rgba(18,87,196,0.07)';
                                return (
                                    <rect key={d.date} x={left + wi * (cell + gap)} y={top + di * (cell + gap)} width={cell} height={cell} rx={3}
                                        fill={fill} stroke={future ? warm.colors.borderWhisper : 'none'} strokeDasharray={future ? '2 2' : undefined}>
                                        <title>{`${d.date}: ${d.applications} apps, ${d.outreach} outreach${w.paused ? ' (paused week)' : ''}`}</title>
                                    </rect>
                                );
                            })}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const WeeklyTrend: React.FC<{
    weeks: Array<{ start: string; paused: boolean; apps: number; outreach: number }>;
    weekScore: (w: { apps: number; outreach: number }) => number;
    thisWeekStart: string;
}> = ({ weeks, weekScore, thisWeekStart }) => {
    const bw = 16, gap = 5, left = 4, H = 90, base = H - 16;
    const W = left + weeks.length * (bw + gap);
    const cap = 1.4;
    const yOf = (s: number) => base - (Math.min(s, cap) / cap) * (base - 6);
    return (
        <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width={Math.max(W, 280)} style={{ maxWidth: '100%', minWidth: Math.min(W, 320) }} role="img" aria-label="Weekly progress against target">
                {weeks.map((w, i) => {
                    const s = weekScore(w);
                    const current = w.start === thisWeekStart;
                    const hit = s >= 1 && w.apps > 0 && w.outreach > 0;
                    const fill = w.paused ? warm.colors.borderDefined : hit ? BLUE : MISS;
                    const x = left + i * (bw + gap);
                    return (
                        <g key={w.start} opacity={current ? 0.55 : 1}>
                            <rect x={x} y={yOf(s)} width={bw} height={Math.max(2, base - yOf(s))} rx={3} fill={fill}>
                                <title>{`Week of ${w.start}: ${w.apps} apps, ${w.outreach} outreach${w.paused ? ' (paused)' : ''}${current ? ' (in progress)' : ''}`}</title>
                            </rect>
                            {(i % 4 === 0 || i === weeks.length - 1) && (
                                <text x={x + bw / 2} y={H - 3} textAnchor="middle" fontSize={8.5} fill={warm.colors.textMuted}>{short(w.start)}</text>
                            )}
                        </g>
                    );
                })}
                <line x1={0} x2={W} y1={yOf(1)} y2={yOf(1)} stroke={warm.colors.textMuted} strokeWidth={1} strokeDasharray="3 3" />
            </svg>
        </div>
    );
};
