import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, FileText, BarChart2, Activity,
  TrendingUp, Star, ClipboardList,
  RefreshCcw, Mail, Copy, Check, Zap,
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

  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} preserveAspectRatio="none" style={{ width: '100%', height: 72, display: 'block' }}>
      {data.map((d, i) => {
        const h = Math.max((d.count / max) * H, d.count > 0 ? 2 : 0.5);
        const x = i * (barW + gap);
        const y = H - h;
        const isWeekend = [0, 6].includes(new Date(d.date + 'T00:00:00').getDay());
        const label = d.date.slice(5); // MM-DD
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={h}
              fill={d.count > 0 ? colour : 'rgba(255,255,255,0.05)'}
              rx={1} opacity={isWeekend ? 0.55 : 1}>
              <title>{d.date}: {d.count}</title>
            </rect>
            {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
              <text x={x + barW / 2} y={H + 11} textAnchor="middle"
                fontSize={4.5} fill={S.dim} fontFamily="system-ui">
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
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

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'friday'>('overview');

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
            <p style={{ margin: '4px 0 0', fontSize: 13, color: S.dim }}>{today}</p>
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
          {([['overview', 'Overview', BarChart2], ['friday', 'Friday Brief', ClipboardList]] as const).map(([key, label, Icon]) => (
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
        {tab === 'overview' && (
          isLoading ? (
            <p style={{ color: S.dim }}>Loading stats...</p>
          ) : isError || !stats ? (
            <p style={{ color: S.red }}>Failed to load stats. Make sure you're logged in as admin.</p>
          ) : (
            <OverviewTab stats={stats} />
          )
        )}

        {tab === 'friday' && <FridayBriefTab />}

      </div>
    </div>
  );
}
