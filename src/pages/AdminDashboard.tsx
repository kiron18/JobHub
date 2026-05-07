import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, FileText, BarChart2, Activity,
  TrendingUp, Star, ClipboardList,
  RefreshCcw, Mail, Copy, Check, Zap, ExternalLink,
} from 'lucide-react';
import api from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  users: {
    total: number; onboarded: number; paid: number; free: number;
    newToday: number; newThisWeek: number;
    byPlan: Record<string, number>;
    daily: { date: string; count: number }[];
  };
  generations: {
    total: number; today: number; thisWeek: number;
    byType: Record<string, number>;
    daily: { date: string; count: number }[];
  };
  analyses: { total: number; thisWeek: number; today: number };
  diagnostics: { total: number; complete: number; thisWeek: number };
  applications: { byStatus: Record<string, number> };
  feedback: { total: number; avgRating: number | null };
}

interface BriefData {
  window: { from: string; to: string };
  reportCount: number;
  cached: boolean;
  script: string | null;
  generatedAt?: string;
}

interface PosthogStats {
  activeUsers7d: number | null;
  events7d: { key: string; count: number }[];
  onboardingSteps: { key: string; count: number }[];
  docTypes: { key: string; count: number }[];
  features: { key: string; count: number }[];
  cancelReasons: { key: string; count: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const S = {
  bg:     '#0d1117',
  card:   'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)',
  teal:   '#2dd4bf',
  purple: '#a78bfa',
  blue:   '#60a5fa',
  amber:  '#fbbf24',
  red:    '#f87171',
  green:  '#4ade80',
  main:   '#f3f4f6',
  sub:    '#9ca3af',
  dim:    '#6b7280',
};

function fmt(n: number | undefined | null): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function pct(a: number, b: number): string {
  if (!b) return '0%';
  return `${Math.round((a / b) * 100)}%`;
}

// ─── Mini bar chart (SVG, no library) ────────────────────────────────────────

function BarChart({ data, colour = S.teal }: { data: { date: string; count: number }[]; colour?: string }) {
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 100;
  const H = 48;
  const gap = 2;
  const barW = (W - gap * (data.length - 1)) / data.length;
  const labelIdxs = [0, Math.floor(data.length / 2), data.length - 1];
  const gapPct = `${(gap / W) * 100}%`;

  return (
    <div>
      {/* Count labels — rendered as HTML so they're legible */}
      <div style={{ display: 'flex', columnGap: gapPct, marginBottom: 4, alignItems: 'flex-end', height: 18 }}>
        {data.map(d => (
          <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
            {d.count > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: colour, lineHeight: 1 }}>{d.count}</span>
            )}
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 56, display: 'block' }}>
        {data.map((d, i) => {
          const h = Math.max((d.count / max) * H, d.count > 0 ? 2 : 0.5);
          const x = i * (barW + gap);
          const y = H - h;
          const isWeekend = [0, 6].includes(new Date(d.date + 'T00:00:00').getDay());
          return (
            <rect key={d.date} x={x} y={y} width={barW} height={h}
              fill={d.count > 0 ? colour : 'rgba(255,255,255,0.05)'}
              rx={1} opacity={isWeekend ? 0.55 : 1}>
              <title>{d.date}: {d.count}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {labelIdxs.map(i => (
          <span key={i} style={{ fontSize: 10, color: S.dim, fontFamily: 'system-ui' }}>
            {data[i]?.date.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, colour = S.teal, icon: Icon,
}: {
  label: string; value: string | number; sub?: string; colour?: string; icon: React.FC<any>;
}) {
  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`, borderRadius: 14,
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon size={13} style={{ color: colour }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.dim }}>
          {label}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: S.main, lineHeight: 1 }}>{fmt(value as number)}</p>
      {sub && <p style={{ margin: 0, fontSize: 11, color: S.sub }}>{sub}</p>}
    </div>
  );
}

// ─── Horizontal bar (plan / type breakdowns) ──────────────────────────────────

function HBar({ label, value, total, colour }: { label: string; value: number; total: number; colour: string }) {
  const w = total ? (value / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: S.sub }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: S.main }}>{fmt(value)} <span style={{ color: S.dim }}>({pct(value, total)})</span></span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${w}%`, background: colour, borderRadius: 99, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return (
    <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: S.dim }}>
      {label}
    </p>
  );
}

// ─── AI Insights section ──────────────────────────────────────────────────────

interface Insight { title: string; finding: string; impact: string; action: string; }

function parseInsights(raw: string): Insight[] {
  const blocks = raw.split(/\n(?=\*\*INSIGHT|\*\*[0-9])/).map(s => s.trim()).filter(Boolean);
  return blocks.map(block => {
    const titleMatch = block.match(/\*\*(?:INSIGHT\s*\d+:\s*)?(.+?)\*\*/i);
    const findingMatch = block.match(/(?:What the data shows|Finding)[:\s]+(.+?)(?=\n(?:Revenue|Impact|Action)|$)/si);
    const impactMatch = block.match(/(?:Revenue impact|Impact)[:\s]+(.+?)(?=\nAction|$)/si);
    const actionMatch = block.match(/Action[:\s]+(.+?)$/si);
    return {
      title: titleMatch?.[1]?.trim() ?? `Insight`,
      finding: findingMatch?.[1]?.trim() ?? '',
      impact: impactMatch?.[1]?.trim() ?? '',
      action: actionMatch?.[1]?.trim() ?? '',
    };
  }).filter(i => i.finding || i.action);
}

function InsightsSection() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/admin/analysis');
      setRaw(data.analysis);
      setInsights(parseInsights(data.analysis));
    } catch {
      setError('Failed to generate analysis.');
    } finally {
      setLoading(false);
    }
  }

  const accentByIndex = [S.teal, S.amber, S.purple, S.blue, S.green];

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: insights.length ? 20 : 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <SectionHead label="AI Growth Intelligence" />
          <p style={{ margin: '2px 0 0', fontSize: 12, color: S.dim }}>
            Reads your live data — surfaces what's making or leaking money right now
          </p>
        </div>
        <button onClick={generate} disabled={loading} style={{ ...btnStyle(S.purple), opacity: loading ? 0.6 : 1, minWidth: 160, justifyContent: 'center' }}>
          {loading ? 'Analysing...' : insights.length ? '↺ Refresh' : '✦ Run Analysis'}
        </button>
      </div>

      {!insights.length && !loading && !error && (
        <p style={{ fontSize: 12, color: S.dim, margin: 0, lineHeight: 1.6 }}>
          Scans feature usage, drop-off points, engagement patterns, and the free→paid gap.
          Tells you what to change and why — based on what's actually happening today.
        </p>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: S.dim, fontSize: 13 }}>
          <div style={{ width: 16, height: 16, border: `2px solid ${S.purple}40`, borderTopColor: S.purple, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Reading your data...
        </div>
      )}

      {error && <p style={{ color: S.red, fontSize: 13, margin: 0 }}>{error}</p>}

      {insights.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {insights.map((ins, i) => {
            const accent = accentByIndex[i % accentByIndex.length];
            return (
              <div key={i} style={{ padding: '16px 18px', background: `${accent}08`, border: `1px solid ${accent}22`, borderRadius: 11, borderLeft: `3px solid ${accent}` }}>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: accent }}>{ins.title}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ins.finding && (
                    <p style={{ margin: 0, fontSize: 12, color: S.sub, lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700, color: S.dim }}>Data: </span>{ins.finding}
                    </p>
                  )}
                  {ins.impact && (
                    <p style={{ margin: 0, fontSize: 12, color: S.sub, lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 700, color: S.dim }}>Impact: </span>{ins.impact}
                    </p>
                  )}
                  {ins.action && (
                    <p style={{ margin: 0, fontSize: 12, color: S.main, lineHeight: 1.6, background: `${accent}12`, padding: '8px 12px', borderRadius: 7, marginTop: 4 }}>
                      <span style={{ fontWeight: 700, color: accent }}>→ Action: </span>{ins.action}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {raw && insights.length === 0 && (
            <p style={{ fontSize: 13, color: S.sub, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{raw}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ stats }: { stats: Stats }) {
  const totalApps = Object.values(stats.applications.byStatus).reduce((s, v) => s + v, 0);
  const totalDocs = stats.generations.total;
  const totalByType = Object.values(stats.generations.byType).reduce((s, v) => s + v, 0);

  const statusColours: Record<string, string> = {
    SAVED: S.dim, APPLIED: S.blue, INTERVIEW: S.teal, OFFER: S.green, REJECTED: S.red,
  };
  const planColours: Record<string, string> = {
    free: S.dim, monthly: S.blue, three_month: S.teal, annual: S.purple,
  };
  const typeColours: Record<string, string> = {
    RESUME: S.teal, COVER_LETTER: S.blue, STAR_RESPONSE: S.purple,
  };
  const typeLabels: Record<string, string> = {
    RESUME: 'Resume', COVER_LETTER: 'Cover Letter', STAR_RESPONSE: 'Selection Criteria',
  };
  const planLabels: Record<string, string> = {
    free: 'Free', monthly: 'Monthly', three_month: '3-Month Bundle', annual: 'Annual',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Hero numbers */}
      <div>
        <SectionHead label="Users" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Total users" value={stats.users.total} sub={`${fmt(stats.users.onboarded)} onboarded`} icon={Users} colour={S.teal} />
          <StatCard label="Paid" value={stats.users.paid} sub={pct(stats.users.paid, stats.users.total) + ' conversion'} icon={Star} colour={S.amber} />
          <StatCard label="New this week" value={stats.users.newThisWeek} sub={`${fmt(stats.users.newToday)} today`} icon={TrendingUp} colour={S.green} />
          <StatCard label="Free tier" value={stats.users.free} sub="not yet converted" icon={Users} colour={S.dim} />
        </div>
      </div>

      {/* User growth chart */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionHead label="User growth — last 14 days" />
          <span style={{ fontSize: 11, color: S.dim }}>
            +{fmt(stats.users.daily.reduce((s, d) => s + d.count, 0))} total
          </span>
        </div>
        <BarChart data={stats.users.daily} colour={S.teal} />
      </div>

      {/* Generations */}
      <div>
        <SectionHead label="Document Generations" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <StatCard label="Total generated" value={totalDocs} icon={FileText} colour={S.blue} />
          <StatCard label="This week" value={stats.generations.thisWeek} sub={`${fmt(stats.generations.today)} today`} icon={Activity} colour={S.teal} />
          <StatCard label="Analyses run" value={stats.analyses.total} sub={`${fmt(stats.analyses.thisWeek)} this week`} icon={BarChart2} colour={S.purple} />
          <StatCard label="Diagnostics" value={stats.diagnostics.complete} sub={`${fmt(stats.diagnostics.thisWeek)} this week`} icon={ClipboardList} colour={S.amber} />
        </div>
      </div>

      {/* Generations chart */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <SectionHead label="Generations — last 14 days" />
          <span style={{ fontSize: 11, color: S.dim }}>
            {fmt(stats.generations.daily.reduce((s, d) => s + d.count, 0))} docs
          </span>
        </div>
        <BarChart data={stats.generations.daily} colour={S.blue} />
      </div>

      {/* Breakdowns row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

        {/* Plan breakdown */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <SectionHead label="Plan breakdown" />
          {['free', 'monthly', 'three_month', 'annual'].map(p => (
            <HBar key={p} label={planLabels[p] ?? p}
              value={stats.users.byPlan[p] ?? 0}
              total={stats.users.total}
              colour={planColours[p] ?? S.dim} />
          ))}
        </div>

        {/* Document types */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <SectionHead label="Document types" />
          {['RESUME', 'COVER_LETTER', 'STAR_RESPONSE'].map(t => (
            <HBar key={t} label={typeLabels[t] ?? t}
              value={stats.generations.byType[t] ?? 0}
              total={totalByType}
              colour={typeColours[t] ?? S.dim} />
          ))}
          {stats.feedback.avgRating != null && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={12} style={{ color: S.amber }} />
                <span style={{ fontSize: 12, color: S.sub }}>
                  Avg rating <strong style={{ color: S.main }}>{stats.feedback.avgRating.toFixed(1)}</strong>
                  <span style={{ color: S.dim }}> / 5 ({fmt(stats.feedback.total)} reviews)</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Application pipeline */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <SectionHead label="Application pipeline" />
          {['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].map(s => (
            <HBar key={s} label={s.charAt(0) + s.slice(1).toLowerCase()}
              value={stats.applications.byStatus[s] ?? 0}
              total={totalApps}
              colour={statusColours[s] ?? S.dim} />
          ))}
          <div style={{ marginTop: 12, fontSize: 11, color: S.dim }}>
            {totalApps} total tracked · {fmt(stats.applications.byStatus['INTERVIEW'] ?? 0)} interviewing
          </div>
        </div>
      </div>

      <InsightsSection />

    </div>
  );
}

// ─── Friday brief tab ─────────────────────────────────────────────────────────

function FridayBriefTab() {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<BriefData>({
    queryKey: ['friday-brief'],
    queryFn: async () => { const { data } = await api.get('/admin/friday-brief'); return data; },
    staleTime: 0,
  });

  const generateMutation = useMutation({
    mutationFn: async () => { const { data } = await api.post('/admin/friday-brief/generate', {}); return data; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friday-brief'] }),
    onError: () => toast.error('Generation failed — check server logs.'),
  });

  const emailMutation = useMutation({
    mutationFn: async () => { const { data } = await api.post('/admin/friday-brief/email', {}); return data; },
    onSuccess: (res) => toast.success(`Brief sent to ${res.sentTo}`),
    onError: () => toast.error('Failed to send — check RESEND_API_KEY.'),
  });

  function handleCopy() {
    if (!data?.script) return;
    navigator.clipboard.writeText(data.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const windowLabel = data
    ? `${new Date(data.window.from).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} → ${new Date(data.window.to).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`
    : '';

  if (isLoading) return <p style={{ color: S.dim, fontSize: 14 }}>Loading...</p>;
  if (!data) return null;

  return (
    <div>
      {/* Window + count */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        background: S.card, border: `1px solid ${S.border}`, borderRadius: 14,
        padding: '16px 20px', marginBottom: 20,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.dim }}>Current window</p>
          <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: S.main }}>{windowLabel}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.dim }}>First-time reports</p>
          <p style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 900, color: S.teal, lineHeight: 1 }}>{data.reportCount}</p>
        </div>
        {data.cached && data.generatedAt && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.dim }}>Last generated</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: S.sub }}>{new Date(data.generatedAt).toLocaleString('en-AU')}</p>
          </div>
        )}
      </div>

      {/* Script or generate prompt */}
      {data.script ? (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={handleCopy} style={btnStyle(copied ? S.teal : undefined)}>
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy script</>}
            </button>
            <button onClick={() => emailMutation.mutate()} disabled={emailMutation.isPending} style={btnStyle(S.teal)}>
              <Mail size={13} />
              {emailMutation.isPending ? 'Sending...' : 'Email to kiron@aussiegradcareers.com.au'}
            </button>
            <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} style={btnStyle()}>
              <RefreshCcw size={13} className={generateMutation.isPending ? 'animate-spin' : ''} />
              {generateMutation.isPending ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: `1px solid ${S.border}`,
            borderRadius: 16, padding: '28px 32px',
            whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.8, color: '#d1d5db',
            maxHeight: 600, overflowY: 'auto',
          }}>
            {data.script}
          </div>
        </>
      ) : (
        <div style={{
          background: S.card, border: `1px solid ${S.border}`, borderRadius: 16,
          padding: 40, textAlign: 'center',
        }}>
          <p style={{ fontSize: 15, color: S.sub, marginBottom: 24 }}>
            {data.reportCount === 0
              ? 'No first-time diagnostic reports in this window yet.'
              : `${data.reportCount} report${data.reportCount === 1 ? '' : 's'} ready. Generate the call script when you're ready.`}
          </p>
          {data.reportCount > 0 && (
            <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
              style={{
                background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: 'white',
                border: 'none', borderRadius: 12, padding: '14px 32px',
                fontSize: 15, fontWeight: 800,
                cursor: generateMutation.isPending ? 'default' : 'pointer',
                opacity: generateMutation.isPending ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
              <Zap size={15} />
              {generateMutation.isPending ? 'Generating...' : 'Generate Friday brief →'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function btnStyle(accent?: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: accent ? `${accent}18` : 'rgba(255,255,255,0.05)',
    border: `1px solid ${accent ? `${accent}40` : S.border}`,
    color: accent ?? S.sub,
    borderRadius: 10, padding: '8px 16px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  };
}

// ─── Funnel tab ───────────────────────────────────────────────────────────────

function FunnelTab({ stats }: { stats: Stats }) {
  const stages = [
    { label: 'Accounts created',       value: stats.users.total,            colour: S.teal,   note: 'Everyone who signed up' },
    { label: 'Completed onboarding',   value: stats.users.onboarded,        colour: S.blue,   note: 'Submitted answers + documents' },
    { label: 'Diagnostic report done', value: stats.diagnostics.complete,   colour: S.purple, note: 'Got their personalised diagnosis' },
    { label: 'Documents generated',    value: stats.generations.total,      colour: S.amber,  note: 'Total docs created (not unique users)' },
    { label: 'Job analyses run',       value: stats.analyses.total,         colour: S.green,  note: 'Ran at least one match analysis' },
    { label: 'Converted to paid',      value: stats.users.paid,             colour: '#f472b6', note: 'Active paid subscription' },
  ];
  const peak = Math.max(...stages.map(s => s.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Vercel Analytics link */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(99,102,241,0.04))',
        border: `1px solid rgba(99,102,241,0.25)`, borderRadius: 14,
        padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.purple }}>
            Vercel Analytics
          </p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.main }}>Page views, visitors &amp; traffic sources</p>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: S.dim }}>Live visitor data collected since Analytics was enabled — open Vercel to see it.</p>
        </div>
        <a
          href="https://vercel.com/dashboard"
          target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: `${S.purple}20`, border: `1px solid ${S.purple}40`,
            color: S.purple, borderRadius: 10, padding: '9px 16px',
            fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          <ExternalLink size={13} />
          Open Vercel Analytics
        </a>
      </div>

      {/* Conversion funnel */}
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '22px 24px' }}>
        <SectionHead label="Conversion funnel — all time" />
        <p style={{ fontSize: 12, color: S.dim, margin: '0 0 24px' }}>
          Drop-off at each stage of the user journey. Admin accounts excluded.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {stages.map((stage, i) => {
            const prev = i === 0 ? stage.value : stages[i - 1].value;
            const pct = peak ? Math.round((stage.value / peak) * 100) : 0;
            const dropPct = prev && i > 0 ? Math.round((stage.value / prev) * 100) : null;
            return (
              <div key={stage.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: stage.colour, flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: S.main }}>{stage.label}</span>
                    <span style={{ fontSize: 11, color: S.dim }}>{stage.note}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {dropPct !== null && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: dropPct >= 70 ? 'rgba(74,222,128,0.12)' : dropPct >= 40 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
                        color: dropPct >= 70 ? S.green : dropPct >= 40 ? S.amber : S.red,
                      }}>
                        {dropPct}% from prev
                      </span>
                    )}
                    <span style={{ fontSize: 18, fontWeight: 900, color: stage.colour, minWidth: 32, textAlign: 'right' }}>
                      {fmt(stage.value)}
                    </span>
                  </div>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 99,
                    background: stage.colour, transition: 'width 0.6s cubic-bezier(0.25,1,0.5,1)',
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary row */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${S.border}`, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.dim }}>Onboarding rate</p>
            <p style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 900, color: S.blue }}>{pct(stats.users.onboarded, stats.users.total)}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.dim }}>Diagnostic rate</p>
            <p style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 900, color: S.purple }}>{pct(stats.diagnostics.complete, stats.users.onboarded)}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.dim }}>Paid conversion</p>
            <p style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 900, color: '#f472b6' }}>{pct(stats.users.paid, stats.users.total)}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.dim }}>Docs per user</p>
            <p style={{ margin: '3px 0 0', fontSize: 22, fontWeight: 900, color: S.amber }}>
              {stats.users.onboarded ? (stats.generations.total / stats.users.onboarded).toFixed(1) : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Behaviour tab (PostHog) ──────────────────────────────────────────────────

function MiniBar({ value, max, colour }: { value: number; max: number; colour: string }) {
  return (
    <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${max ? (value / max) * 100 : 0}%`, background: colour, borderRadius: 99 }} />
    </div>
  );
}

function BehaviourTab() {
  const { data, isLoading, isError } = useQuery<PosthogStats>({
    queryKey: ['posthog-stats'],
    queryFn: async () => { const { data } = await api.get('/admin/posthog-stats'); return data; },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <p style={{ color: S.dim, fontSize: 14 }}>Loading PostHog data...</p>;
  if (isError || !data) return (
    <p style={{ color: S.red, fontSize: 14 }}>
      Failed to load PostHog data — make sure POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID are set in Railway.
    </p>
  );

  const topEvents = data.events7d.filter(e => !e.key.startsWith('$')).slice(0, 10);
  const maxEvent = Math.max(...topEvents.map(e => e.count), 1);
  const maxStep = Math.max(...data.onboardingSteps.map(s => s.count), 1);
  const maxDoc = Math.max(...data.docTypes.map(d => d.count), 1);
  const maxFeature = Math.max(...data.features.map(f => f.count), 1);
  const maxCancel = Math.max(...data.cancelReasons.map(c => c.count), 1);

  const orange = '#fb923c';

  function Breakdown({ items, colour, empty }: { items: { key: string; count: number }[]; colour: string; empty: string; max: number }) {
    if (items.length === 0) return <p style={{ fontSize: 12, color: S.dim }}>{empty}</p>;
    const m = Math.max(...items.map(i => i.count), 1);
    return (
      <>
        {items.map(item => (
          <div key={item.key} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: S.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{item.key}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: S.main, flexShrink: 0, marginLeft: 8 }}>{item.count}</span>
            </div>
            <MiniBar value={item.count} max={m} colour={colour} />
          </div>
        ))}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* PostHog link + active users */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'stretch' }}>
        <div style={{
          background: `rgba(249,115,22,0.07)`, border: `1px solid rgba(249,115,22,0.22)`, borderRadius: 14,
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: orange }}>PostHog</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.main }}>Behavioural analytics</p>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: S.dim }}>Event tracking, funnel analysis, session recordings</p>
          </div>
          <a href="https://us.posthog.com/project/413547" target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: `rgba(249,115,22,0.14)`, border: `1px solid rgba(249,115,22,0.35)`,
              color: orange, borderRadius: 10, padding: '9px 16px',
              fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
            }}>
            <ExternalLink size={13} /> Open PostHog
          </a>
        </div>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: S.dim }}>Active users</p>
          <p style={{ margin: '0 0 2px', fontSize: 36, fontWeight: 900, color: orange, lineHeight: 1 }}>{data.activeUsers7d ?? '—'}</p>
          <p style={{ margin: 0, fontSize: 11, color: S.dim }}>last 7 days</p>
        </div>
      </div>

      {/* Three columns: onboarding steps, doc types, features */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <SectionHead label="Onboarding steps (30d)" />
          <Breakdown items={data.onboardingSteps} colour={S.teal} empty="No step events yet" max={maxStep} />
        </div>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <SectionHead label="Docs generated (30d)" />
          <Breakdown items={data.docTypes} colour={S.blue} empty="No generation events yet" max={maxDoc} />
        </div>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <SectionHead label="Features opened (30d)" />
          <Breakdown items={data.features} colour={S.purple} empty="No feature events yet" max={maxFeature} />
        </div>
      </div>

      {/* Events + cancel reasons */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <SectionHead label="Top custom events — last 7 days" />
          {topEvents.length === 0 ? (
            <p style={{ fontSize: 12, color: S.dim }}>
              No events yet — make sure VITE_POSTHOG_KEY and VITE_POSTHOG_HOST are set in Vercel, then redeploy.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {topEvents.map(e => (
                <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MiniBar value={e.count} max={maxEvent} colour={orange} />
                  <span style={{ fontSize: 11, color: S.sub, width: 200, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.key}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: S.main, width: 28, textAlign: 'right', flexShrink: 0 }}>{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <SectionHead label="Cancellation reasons" />
          <Breakdown items={data.cancelReasons} colour={S.red} empty="None recorded yet" max={maxCancel} />
        </div>
      </div>

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'funnel' | 'friday' | 'behaviour'>('overview');

  const { data: stats, isLoading, isError, refetch, isFetching } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: async () => { const { data } = await api.get('/admin/stats'); return data; },
    staleTime: 60_000,
  });

  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.main, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Zap size={16} style={{ color: S.teal }} />
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.teal }}>
                Admin
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em' }}>Dashboard</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: S.dim }}>
              {today} <span style={{ margin: '0 8px', opacity: 0.5 }}>|</span>
              <span style={{ color: S.teal, fontWeight: 600 }}>Data since 27 April 2026</span>
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${S.border}`,
              borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700,
              color: S.sub, cursor: 'pointer', opacity: isFetching ? 0.5 : 1,
            }}>
            <RefreshCcw size={12} style={{ animation: isFetching ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'inline-flex', background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${S.border}`, borderRadius: 12, padding: 4, marginBottom: 28,
        }}>
          {([['overview', 'Overview', BarChart2], ['funnel', 'Funnel', TrendingUp], ['behaviour', 'Behaviour', Activity], ['friday', 'Friday Brief', ClipboardList]] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 18px', borderRadius: 9, border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                background: tab === key ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: tab === key ? S.main : S.dim,
              }}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {(tab === 'overview' || tab === 'funnel') && (
          isLoading ? (
            <p style={{ color: S.dim }}>Loading stats...</p>
          ) : isError || !stats ? (
            <p style={{ color: S.red }}>Failed to load stats. Make sure you're logged in as admin.</p>
          ) : tab === 'overview' ? (
            <OverviewTab stats={stats} />
          ) : (
            <FunnelTab stats={stats} />
          )
        )}

        {tab === 'behaviour' && <BehaviourTab />}
        {tab === 'friday' && <FridayBriefTab />}

      </div>
    </div>
  );
}
