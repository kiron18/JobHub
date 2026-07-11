import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ShieldCheck, CheckCircle2, AlertTriangle, OctagonAlert, Info,
    FileText, ChevronDown, Loader2, ExternalLink,
} from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';

interface Signal {
    severity: 'info' | 'warning' | 'critical';
    category: string;
    message: string;
    evidence?: string[];
}

interface FlaggedDoc {
    id: string;
    type: string;
    createdAt: string;
    level: 'info' | 'warning' | 'critical';
    student: { name: string | null; email: string | null };
    job: { title: string; company: string } | null;
    signals: Signal[];
}

interface QualityData {
    days: number;
    summary: { total: number; clean: number; info: number; warning: number; critical: number };
    byCategory: Record<string, number>;
    flagged: FlaggedDoc[];
}

// Status palette — reserved colors, always paired with an icon + label.
const LEVEL_CONFIG = {
    clean:    { label: 'Clean',    color: warm.colors.success,      Icon: CheckCircle2 },
    info:     { label: 'Info',     color: warm.colors.accentPetrol, Icon: Info },
    warning:  { label: 'Warning',  color: warm.colors.accentGold,   Icon: AlertTriangle },
    critical: { label: 'Critical', color: warm.colors.danger,       Icon: OctagonAlert },
} as const;

const CATEGORY_LABELS: Record<string, string> = {
    ats_keywords: 'ATS keywords',
    quality_gate: 'Quality gate',
    achievement_match: 'Achievement match',
    blueprint: 'Blueprint fallback',
    voice: 'Voice scrubber',
    bridged_gap: 'Bridged gap',
    employer_questions: 'Employer questions',
};

const DOC_TYPE_LABELS: Record<string, string> = {
    RESUME: 'Resume',
    COVER_LETTER: 'Cover letter',
    STAR_RESPONSE: 'Selection criteria / response',
};

function StatTile({ label, value, sub, color, Icon }: {
    label: string; value: number | string; sub?: string; color: string;
    Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}) {
    return (
        <div style={{
            background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon size={13} style={{ color }} />
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: warm.colors.textMuted }}>
                    {label}
                </span>
            </div>
            <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', color: warm.colors.textPrimary, lineHeight: 1 }}>
                {value}
            </span>
            {sub && <span style={{ fontSize: 11, color: warm.colors.textMuted }}>{sub}</span>}
        </div>
    );
}

export function AdminQuality() {
    const [days, setDays] = useState(7);
    const [openId, setOpenId] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['admin-quality', days],
        queryFn: async () => (await api.get(`/admin/quality?days=${days}`)).data as QualityData,
        staleTime: 60_000,
    });

    const cleanPct = data && data.summary.total > 0
        ? Math.round((data.summary.clean / data.summary.total) * 100)
        : null;

    return (
        <div style={{ minHeight: '100vh', background: warm.colors.bgCanvas, padding: '32px 20px' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <ShieldCheck size={16} style={{ color: warm.colors.accentPetrol }} />
                            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: warm.colors.accentPetrol }}>
                                Admin
                            </span>
                        </div>
                        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', color: warm.colors.textPrimary }}>
                            Output Quality
                        </h1>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: warm.colors.textMuted }}>
                            Quality signals collected on every generated document — spot bad output before a student sends it.
                        </p>
                    </div>
                    <a
                        href="/admin"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700,
                            color: warm.colors.textSecondary, textDecoration: 'none',
                        }}
                    >
                        Dashboard <ExternalLink size={10} />
                    </a>
                </div>

                {/* Filter row */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            style={{
                                padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer',
                                border: `1px solid ${days === d ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
                                background: days === d ? warm.colors.bgAlt : 'transparent',
                                color: days === d ? warm.colors.textPrimary : warm.colors.textMuted,
                            }}
                        >
                            {d} days
                        </button>
                    ))}
                </div>

                {isLoading || !data ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                        <Loader2 size={28} className="animate-spin" style={{ color: warm.colors.textMuted }} />
                    </div>
                ) : (
                    <>
                        {/* Stat tiles */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                            <StatTile label="Documents" value={data.summary.total} sub={`last ${data.days} days`} color={warm.colors.textSecondary} Icon={FileText} />
                            <StatTile label="Clean" value={data.summary.clean} sub={cleanPct !== null ? `${cleanPct}% of output` : undefined} color={LEVEL_CONFIG.clean.color} Icon={LEVEL_CONFIG.clean.Icon} />
                            <StatTile label="Warnings" value={data.summary.warning + data.summary.info} sub="review when possible" color={LEVEL_CONFIG.warning.color} Icon={LEVEL_CONFIG.warning.Icon} />
                            <StatTile label="Critical" value={data.summary.critical} sub="intervene before sending" color={LEVEL_CONFIG.critical.color} Icon={LEVEL_CONFIG.critical.Icon} />
                        </div>

                        {/* Category breakdown */}
                        {Object.keys(data.byCategory).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                                    <span key={cat} style={{
                                        fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 16,
                                        border: `1px solid ${warm.colors.borderWhisper}`, background: warm.colors.bgSurface,
                                        color: warm.colors.textSecondary,
                                    }}>
                                        {CATEGORY_LABELS[cat] ?? cat} <span style={{ color: warm.colors.textPrimary }}>{count}</span>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Flagged documents */}
                        {data.flagged.length === 0 ? (
                            <div style={{
                                background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
                                borderRadius: 16, padding: 48, textAlign: 'center',
                            }}>
                                <CheckCircle2 size={32} style={{ color: warm.colors.success, marginBottom: 10 }} />
                                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textSecondary }}>
                                    No flagged documents in this window
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: warm.colors.textMuted }}>
                                    Flagged documents · {data.flagged.length}
                                </p>
                                {data.flagged.map(doc => {
                                    const cfg = LEVEL_CONFIG[doc.level];
                                    const isOpen = openId === doc.id;
                                    return (
                                        <div key={doc.id} style={{
                                            background: warm.colors.bgSurface,
                                            border: `1px solid ${isOpen ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
                                            borderRadius: 12, overflow: 'hidden',
                                        }}>
                                            <button
                                                onClick={() => setOpenId(isOpen ? null : doc.id)}
                                                style={{
                                                    width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                                                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
                                                }}
                                            >
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                                                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                                                    color: cfg.color,
                                                }}>
                                                    <cfg.Icon size={12} /> {cfg.label}
                                                </span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: warm.colors.textPrimary, flexShrink: 0 }}>
                                                    {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                                                </span>
                                                <span style={{ fontSize: 12, color: warm.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                    {doc.student.name || doc.student.email || 'Unknown student'}
                                                    {doc.job ? ` · ${doc.job.title} at ${doc.job.company}` : ''}
                                                </span>
                                                <span style={{ fontSize: 11, color: warm.colors.textMuted, flexShrink: 0 }}>
                                                    {new Date(doc.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                                                </span>
                                                <ChevronDown size={13} style={{ color: warm.colors.textMuted, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                            </button>
                                            {isOpen && (
                                                <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${warm.colors.borderWhisper}`, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12 }}>
                                                    {doc.signals.map((s, i) => {
                                                        const sCfg = LEVEL_CONFIG[s.severity] ?? LEVEL_CONFIG.info;
                                                        return (
                                                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                    <sCfg.Icon size={11} style={{ color: sCfg.color }} />
                                                                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: sCfg.color }}>
                                                                        {CATEGORY_LABELS[s.category] ?? s.category}
                                                                    </span>
                                                                </div>
                                                                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textSecondary, lineHeight: 1.5 }}>
                                                                    {s.message}
                                                                </p>
                                                                {s.evidence && s.evidence.length > 0 && (
                                                                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                        {s.evidence.map((e, ei) => (
                                                                            <li key={ei} style={{ fontSize: 11, color: warm.colors.textMuted, lineHeight: 1.5 }}>{e}</li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
