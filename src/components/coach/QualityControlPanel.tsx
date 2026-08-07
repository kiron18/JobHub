import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Loader2, RefreshCcw, ChevronDown, ChevronUp, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

/**
 * Coach-facing quality control.
 *
 * The sweep costs nothing and reads everything, so it refreshes freely. The
 * audit costs money and reads one document, so it only ever runs on a click,
 * and the result is cached against the version that was judged.
 */

type Dimension = 'targeting' | 'honesty' | 'quality';
type Severity = 'info' | 'warning' | 'critical';

interface Finding {
    check: string;
    dimension: Dimension;
    severity: Severity;
    message: string;
    evidence?: string[];
}

interface SweepRow {
    id: string;
    type: string;
    createdAt: string;
    edited: boolean;
    student: { userId: string; name: string | null; email: string | null };
    job: { id: string; title: string; company: string } | null;
    score: number;
    level: 'clean' | 'info' | 'warning' | 'critical';
    metrics: { wordCount: number; atsCoverage: number | null };
    unassessable: string[];
    findings: Finding[];
    audit: { reviewedAt: string; scores: { targeting: number; honesty: number; quality: number } | null } | null;
}

interface SweepData {
    days: number;
    scanned: number;
    summary: { scanned: number; clean: number; info: number; warning: number; critical: number };
    byCheck: Record<string, number>;
    documents: SweepRow[];
}

interface AuditFinding {
    dimension: Dimension;
    severity: Severity;
    quote: string;
    issue: string;
    fix: string;
}

interface Verdict {
    scores: { targeting: number; honesty: number; quality: number };
    summary: string;
    findings: AuditFinding[];
    discardedFindings: number;
    notAssessed: string[];
}

const SEVERITY_COLOUR: Record<Severity, string> = {
    critical: warm.colors.danger,
    warning: '#B0563C',
    info: warm.colors.textMuted,
};

const DIMENSION_LABEL: Record<Dimension, string> = {
    targeting: 'Targeting',
    honesty: 'Honesty',
    quality: 'Quality',
};

const TYPE_LABEL: Record<string, string> = {
    RESUME: 'Resume',
    BASELINE_RESUME: 'Base resume',
    COVER_LETTER: 'Cover letter',
    STAR_RESPONSE: 'Selection criteria',
};

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });

export const QualityControlPanel: React.FC<{ userId?: string }> = ({ userId }) => {
    const [days, setDays] = useState(30);
    const [type, setType] = useState<string>('');
    const [open, setOpen] = useState<string | null>(null);

    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['coach-qc-sweep', days, type, userId ?? null],
        queryFn: async () => {
            const params = new URLSearchParams({ days: String(days) });
            if (type) params.set('type', type);
            if (userId) params.set('userId', userId);
            return (await api.get(`/admin/coach/qc/sweep?${params}`)).data as SweepData;
        },
    });

    const s = data?.summary;

    return (
        <div style={{
            marginTop: 24, padding: '14px 16px', borderRadius: 14,
            background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ShieldCheck size={14} style={{ color: warm.colors.accentPetrol }} />
                    <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: warm.colors.textMuted }}>
                        Quality control — every document scanned free, worst first
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select value={days} onChange={e => setDays(parseInt(e.target.value, 10))} style={selectStyle}>
                        <option value={7}>7 days</option>
                        <option value={30}>30 days</option>
                        <option value={90}>90 days</option>
                    </select>
                    <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
                        <option value="">All types</option>
                        <option value="RESUME">Resumes</option>
                        <option value="COVER_LETTER">Cover letters</option>
                        <option value="STAR_RESPONSE">Selection criteria</option>
                    </select>
                    <button onClick={() => refetch()} disabled={isFetching} style={{ ...ghostBtn, opacity: isFetching ? 0.5 : 1 }}>
                        <RefreshCcw size={12} /> Refresh
                    </button>
                </div>
            </div>

            {s && (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                    <Chip label="Scanned" value={s.scanned} />
                    <Chip label="Must fix" value={s.critical} colour={warm.colors.danger} />
                    <Chip label="Review" value={s.warning} colour="#B0563C" />
                    <Chip label="Clean" value={s.clean} colour={warm.colors.success} />
                </div>
            )}

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
                    <Loader2 size={18} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />
                </div>
            ) : (data?.documents.length ?? 0) === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textMuted }}>
                    No documents generated in this window.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data!.documents.map(d => (
                        <DocumentRow key={d.id} row={d} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} />
                    ))}
                </div>
            )}

            <p style={{ margin: '12px 2px 0', fontSize: 11, color: warm.colors.textMuted }}>
                Score is a triage order, not a grade — honesty findings count double. Nothing here changes a client's document.
                "Run full audit" is the only thing that costs anything, and it is cached until the document changes.
            </p>
        </div>
    );
};

const DocumentRow: React.FC<{ row: SweepRow; open: boolean; onToggle: () => void }> = ({ row, open, onToggle }) => {
    const queryClient = useQueryClient();
    const [verdict, setVerdict] = useState<Verdict | null>(null);

    const audit = useMutation({
        mutationFn: async () =>
            (await api.post('/admin/coach/qc/review', { documentId: row.id })).data as {
                cached: boolean; verdict: Verdict; costUsd: number;
            },
        onSuccess: d => {
            setVerdict(d.verdict);
            queryClient.invalidateQueries({ queryKey: ['coach-qc-sweep'] });
            toast.success(d.cached ? 'Loaded the saved audit' : `Audited — ${(d.costUsd * 100).toFixed(1)}c`);
        },
        onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Audit failed'),
    });

    const scoreColour = row.level === 'critical' ? warm.colors.danger
        : row.level === 'warning' ? '#B0563C'
            : row.level === 'info' ? warm.colors.textSecondary
                : warm.colors.success;

    return (
        <div style={{ borderRadius: 10, border: `1px solid ${warm.colors.borderWhisper}`, background: warm.colors.bgAlt }}>
            <button onClick={onToggle} style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
                <span style={{
                    minWidth: 34, textAlign: 'center', padding: '2px 6px', borderRadius: 6,
                    fontSize: 12.5, fontWeight: 900, color: scoreColour,
                    background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
                }}>
                    {row.score}
                </span>
                <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: warm.colors.textPrimary }}>
                        {TYPE_LABEL[row.type] ?? row.type}
                        {row.job ? ` — ${row.job.title} at ${row.job.company}` : ' — no application attached'}
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: warm.colors.textMuted }}>
                        {row.student.name ?? row.student.email ?? 'Unknown'} · {fmtDate(row.createdAt)}
                        {row.edited && ' · edited by client'}
                        {row.metrics.atsCoverage != null && ` · ${Math.round(row.metrics.atsCoverage * 100)}% advert terms`}
                    </span>
                </span>
                <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {(['honesty', 'targeting', 'quality'] as Dimension[]).map(dim => {
                        const n = row.findings.filter(f => f.dimension === dim).length;
                        if (n === 0) return null;
                        const worst = row.findings.filter(f => f.dimension === dim)
                            .some(f => f.severity === 'critical') ? 'critical' : 'warning';
                        return (
                            <span key={dim} style={{
                                fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 999,
                                color: SEVERITY_COLOUR[worst as Severity],
                                background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
                            }}>
                                {DIMENSION_LABEL[dim]} {n}
                            </span>
                        );
                    })}
                    {row.audit && (
                        <span title={`Audited ${fmtDate(row.audit.reviewedAt)}`} style={{
                            fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 999,
                            color: warm.colors.accentPetrol, background: warm.colors.bgSurface,
                            border: `1px solid ${warm.colors.borderWhisper}`,
                        }}>
                            audited
                        </span>
                    )}
                </span>
                <span style={{ color: warm.colors.textMuted }}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
            </button>

            {open && (
                <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {row.findings.length === 0 && (
                        <p style={{ margin: 0, fontSize: 12, color: warm.colors.textSecondary }}>
                            Nothing found by the free checks.
                        </p>
                    )}
                    {row.findings.map((f, i) => (
                        <div key={i} style={{ fontSize: 12, color: warm.colors.textSecondary }}>
                            <span style={{ fontWeight: 800, color: SEVERITY_COLOUR[f.severity] }}>
                                {DIMENSION_LABEL[f.dimension]}:
                            </span>{' '}
                            {f.message}
                            {f.evidence && f.evidence.length > 0 && (
                                <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: warm.colors.textMuted }}>
                                    {f.evidence.join(' · ')}
                                </span>
                            )}
                        </div>
                    ))}

                    {row.unassessable.length > 0 && (
                        <div style={{ fontSize: 11.5, color: warm.colors.textMuted, display: 'flex', gap: 6 }}>
                            <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{row.unassessable.join(' ')}</span>
                        </div>
                    )}

                    <div>
                        <button onClick={() => audit.mutate()} disabled={audit.isPending} style={{
                            ...ghostBtn, borderColor: warm.colors.accentPetrol, color: warm.colors.accentPetrol,
                            opacity: audit.isPending ? 0.5 : 1,
                        }}>
                            {audit.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            {row.audit ? 'Show full audit' : 'Run full audit'}
                        </button>
                    </div>

                    {verdict && <VerdictView verdict={verdict} />}
                </div>
            )}
        </div>
    );
};

const VerdictView: React.FC<{ verdict: Verdict }> = ({ verdict }) => (
    <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
    }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
            {(Object.keys(verdict.scores) as Dimension[]).map(dim => (
                <span key={dim} style={{ fontSize: 11.5, fontWeight: 700, color: warm.colors.textSecondary }}>
                    {DIMENSION_LABEL[dim]}{' '}
                    <strong style={{ color: verdict.scores[dim] <= 2 ? warm.colors.danger : warm.colors.textPrimary }}>
                        {verdict.scores[dim]}/5
                    </strong>
                </span>
            ))}
        </div>
        {verdict.summary && (
            <p style={{ margin: '0 0 8px', fontSize: 12.5, color: warm.colors.textPrimary }}>{verdict.summary}</p>
        )}
        {verdict.findings.map((f, i) => (
            <div key={i} style={{ marginBottom: 8, fontSize: 12, color: warm.colors.textSecondary }}>
                <span style={{ fontWeight: 800, color: SEVERITY_COLOUR[f.severity] }}>{DIMENSION_LABEL[f.dimension]}:</span>{' '}
                {f.issue}
                <blockquote style={{
                    margin: '4px 0 4px 0', padding: '4px 10px', fontSize: 11.5,
                    borderLeft: `2px solid ${warm.colors.borderDefined}`, color: warm.colors.textMuted,
                }}>
                    “{f.quote}”
                </blockquote>
                <span style={{ fontSize: 11.5 }}><strong>Fix:</strong> {f.fix}</span>
            </div>
        ))}
        {verdict.findings.length === 0 && (
            <p style={{ margin: 0, fontSize: 12, color: warm.colors.success }}>Nothing to fix.</p>
        )}
        {verdict.notAssessed.length > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: warm.colors.textMuted }}>
                Not checked: {verdict.notAssessed.join('; ')}
            </p>
        )}
        {verdict.discardedFindings > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: warm.colors.textMuted }}>
                {verdict.discardedFindings} finding{verdict.discardedFindings === 1 ? '' : 's'} dropped — the quoted text was not in the document.
            </p>
        )}
    </div>
);

const Chip: React.FC<{ label: string; value: number; colour?: string }> = ({ label, value, colour }) => (
    <div>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: warm.colors.textMuted }}>
            {label}
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: colour ?? warm.colors.textPrimary }}>{value}</div>
    </div>
);

const ghostBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px',
    borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent',
    color: warm.colors.textSecondary, width: 'fit-content',
};

const selectStyle: React.CSSProperties = {
    padding: '6px 8px', borderRadius: 8, fontSize: 11.5, fontWeight: 700,
    background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
    color: warm.colors.textPrimary, outline: 'none', cursor: 'pointer',
};
