import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Search, Flame, Loader2, PartyPopper, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';

interface LeaderboardEntry {
    rank: number;
    name: string;
    isYou: boolean;
    applications: number;
    outreach: number;
    interviews: number;
    offers: number;
    points: number;
    streak: number;
    goalHit: boolean;
}

interface LeaderboardData {
    period: 'week' | 'all';
    weekStart: string;
    entries: LeaderboardEntry[];
    highlights: Array<{ name: string; title: string; company: string; when: string | null }>;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export const LeaderboardPage: React.FC = () => {
    const [period, setPeriod] = useState<'week' | 'all'>('week');
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['leaderboard', period],
        queryFn: async () => (await api.get(`/leaderboard?period=${period}`)).data as LeaderboardData,
        staleTime: 60_000,
    });

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return data?.entries ?? [];
        return (data?.entries ?? []).filter(e => e.name.toLowerCase().includes(q));
    }, [data, search]);

    const you = data?.entries.find(e => e.isYou);

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 4px 60px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Trophy size={16} style={{ color: '#C4713A' }} />
                        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: warm.colors.accentPetrol }}>
                            Cohort leaderboard
                        </span>
                    </div>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: warm.colors.textPrimary }}>
                        Who's putting in the work
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: warm.colors.textSecondary }}>
                        Points: 1 per application or outreach · 15 per interview · 40 per offer · 10 for hitting both weekly minimums.
                    </p>
                </div>
                {you && (
                    <div style={{
                        padding: '10px 16px', borderRadius: 12, background: warm.colors.bgSurface,
                        border: `1px solid ${warm.colors.borderWhisper}`, textAlign: 'right',
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your rank</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: warm.colors.textPrimary }}>
                            #{you.rank} <span style={{ fontSize: 13, fontWeight: 700, color: warm.colors.textSecondary }}>· {you.points} pts</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Interview highlights */}
            {(data?.highlights.length ?? 0) > 0 && (
                <div style={{
                    marginBottom: 18, padding: '12px 16px', borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(196,113,58,0.10), rgba(196,113,58,0.04))',
                    border: '1px solid rgba(196,113,58,0.25)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <PartyPopper size={13} style={{ color: '#C4713A' }} />
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C4713A' }}>
                            Interviews landed this week
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {data!.highlights.map((h, i) => (
                            <div key={i} style={{ fontSize: 13, color: warm.colors.textPrimary }}>
                                <strong>{h.name}</strong> — {h.title} at <strong>{h.company}</strong>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div style={{
                    display: 'inline-flex', background: warm.colors.bgAlt,
                    border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 12, padding: 4,
                }}>
                    {([['week', 'This week'], ['all', 'All time']] as const).map(([key, label]) => (
                        <button key={key} onClick={() => setPeriod(key)}
                            style={{
                                padding: '7px 18px', borderRadius: 9, border: 'none',
                                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                background: period === key ? warm.colors.bgSurface : 'transparent',
                                color: period === key ? warm.colors.textPrimary : warm.colors.textMuted,
                            }}>
                            {label}
                        </button>
                    ))}
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px',
                    borderRadius: 10, background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
                }}>
                    <Search size={13} style={{ color: warm.colors.textMuted }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Find a member…"
                        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: warm.colors.textPrimary, width: 160 }}
                    />
                </div>
            </div>

            {/* Board */}
            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <Loader2 size={22} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />
                </div>
            ) : (
                <div style={{ overflowX: 'auto', borderRadius: 14, border: `1px solid ${warm.colors.borderWhisper}`, background: warm.colors.bgSurface }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: `1px solid ${warm.colors.borderWhisper}` }}>
                                {['#', 'Member', 'Apps', 'Outreach', 'Interviews', 'Offers', 'Streak', period === 'week' ? 'On target' : '', 'Points'].map((h, i) => (
                                    <th key={i} style={{
                                        padding: '10px 14px', textAlign: i <= 1 ? 'left' : 'center',
                                        fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
                                        color: warm.colors.textMuted, whiteSpace: 'nowrap',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(e => (
                                <tr key={e.rank} style={{
                                    borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                                    background: e.isYou ? 'rgba(45,90,110,0.06)' : 'transparent',
                                }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 800, color: warm.colors.textPrimary, whiteSpace: 'nowrap' }}>
                                        {e.rank <= 3 ? MEDALS[e.rank - 1] : e.rank}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontWeight: e.isYou ? 800 : 600, color: warm.colors.textPrimary }}>
                                        {e.name}
                                        {e.isYou && <span style={{
                                            marginLeft: 7, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                                            background: 'rgba(45,90,110,0.12)', color: warm.colors.accentPetrol,
                                        }}>you</span>}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', color: warm.colors.textSecondary }}>{e.applications}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', color: warm.colors.textSecondary }}>{e.outreach}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: e.interviews > 0 ? 800 : 400, color: e.interviews > 0 ? '#C4713A' : warm.colors.textMuted }}>
                                        {e.interviews > 0 ? `🎯 ${e.interviews}` : '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: e.offers > 0 ? 800 : 400, color: e.offers > 0 ? warm.colors.success : warm.colors.textMuted }}>
                                        {e.offers > 0 ? e.offers : '—'}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                        {e.streak > 0
                                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: '#C4713A' }}><Flame size={11} />{e.streak}w</span>
                                            : <span style={{ color: warm.colors.textMuted }}>—</span>}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                        {period === 'week'
                                            ? (e.goalHit
                                                ? <CheckCircle2 size={15} style={{ color: warm.colors.success }} />
                                                : <span style={{ color: warm.colors.textMuted }}>—</span>)
                                            : null}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 900, color: warm.colors.textPrimary }}>{e.points}</td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ padding: 30, textAlign: 'center', color: warm.colors.textMuted }}>
                                        {search ? 'No members match that search.' : 'No activity on the board yet — first application gets the top spot.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <p style={{ margin: '12px 4px 0', fontSize: 11.5, color: warm.colors.textMuted }}>
                Week runs Monday to Sunday (AEST). Streak = consecutive weeks hitting both program minimums (20 applications + 20 outreach).
            </p>
        </div>
    );
};
