import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, FileText, BarChart2, Activity,
  TrendingUp, Star, ClipboardList,
  RefreshCcw, Mail, Copy, Check, Zap, ExternalLink, DollarSign, AlertTriangle, Wifi, WifiOff,
} from 'lucide-react';
import api from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  users: {
    total: number; onboarded: number; paid: number; free: number;
    trialing: number; activePaid: number; pastDue: number;
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

interface ExpenseEntry {
  id: string;
  name: string;
  category: string;
  status: 'live' | 'manual' | 'error';
  balance?: number;
  used?: number;
  limit?: number;
  usedPct?: number;
  monthlyCostAUD?: number;
  billingCycle: 'monthly' | 'annual' | 'per-transaction' | 'free';
  description: string;
  urgency: 'good' | 'warning' | 'critical' | 'unknown';
  lastFetched?: string;
  error?: string;
}

interface ExpensesData {
  services: ExpenseEntry[];
  totalMonthlyAUD: number;
  fetchedAt: string;
  cached?: boolean;
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <StatCard label="Total users" value={stats.users.total} sub={`${fmt(stats.users.onboarded)} onboarded`} icon={Users} colour={S.teal} />
          <StatCard label="On trial" value={stats.users.trialing} sub={pct(stats.users.trialing, stats.users.total) + ' of users'} icon={Star} colour={S.amber} />
          <StatCard label="Active paid" value={stats.users.activePaid} sub={pct(stats.users.activePaid, stats.users.paid || 1) + ' trial→paid'} icon={Star} colour={S.green} />
          <StatCard label="New this week" value={stats.users.newThisWeek} sub={`${fmt(stats.users.newToday)} today`} icon={TrendingUp} colour={S.blue} />
          <StatCard label="Free tier" value={stats.users.free} sub={stats.users.pastDue > 0 ? `${stats.users.pastDue} past due` : 'not yet converted'} icon={Users} colour={stats.users.pastDue > 0 ? S.red : S.dim} />
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

// ─── Expenses tab ─────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
  good: S.green, warning: S.amber, critical: S.red, unknown: S.dim,
};
const CATEGORY_COLOR: Record<string, string> = {
  'AI / LLM': S.purple, 'Hosting': S.teal, 'Domain': S.blue,
  'Scraping': S.amber, 'Search': S.green, 'Email': S.blue,
  'Vector DB': S.teal, 'Community': '#f472b6', 'Marketing': '#fb923c',
  'Payments': S.green, 'AI / Parse': S.purple,
};

function UsageBar({ usedPct, urgency }: { usedPct: number; urgency: string }) {
  const colour = URGENCY_COLOR[urgency] ?? S.dim;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: S.dim }}>Usage</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: colour }}>{usedPct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${usedPct}%`, background: colour, borderRadius: 99, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function ExpenseCard({ entry }: { entry: ExpenseEntry }) {
  const urgencyColor = URGENCY_COLOR[entry.urgency] ?? S.dim;
  const catColor = CATEGORY_COLOR[entry.category] ?? S.dim;
  const isLive = entry.status === 'live';
  const isError = entry.status === 'error';

  return (
    <div style={{
      background: S.card, border: `1px solid ${S.border}`, borderRadius: 14,
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10,
      borderTop: `3px solid ${urgencyColor}`,
    }}>
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: S.main, letterSpacing: '-0.01em' }}>{entry.name}</p>
          <span style={{
            display: 'inline-block', marginTop: 4,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            background: `${catColor}15`, border: `1px solid ${catColor}30`,
            color: catColor, borderRadius: 6, padding: '2px 7px',
          }}>
            {entry.category}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {isLive ? (
            <Wifi size={11} style={{ color: S.teal }} />
          ) : isError ? (
            <WifiOff size={11} style={{ color: S.red }} />
          ) : null}
          <span style={{ fontSize: 10, color: isLive ? S.teal : isError ? S.red : S.dim, fontWeight: 600 }}>
            {isLive ? 'live' : isError ? 'error' : 'manual'}
          </span>
        </div>
      </div>

      {/* Cost / balance */}
      <div>
        {entry.monthlyCostAUD != null && (
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: S.main, lineHeight: 1 }}>
            A${entry.monthlyCostAUD.toFixed(0)}
            <span style={{ fontSize: 11, fontWeight: 500, color: S.dim, marginLeft: 4 }}>
              /{entry.billingCycle === 'annual' ? 'mo (annual)' : 'mo'}
            </span>
          </p>
        )}
        {entry.billingCycle === 'free' && (
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.green }}>Free tier</p>
        )}
        {entry.billingCycle === 'per-transaction' && entry.monthlyCostAUD == null && (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: S.dim }}>Per transaction</p>
        )}
        {entry.balance != null && entry.limit == null && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: S.sub }}>
            Balance: <strong style={{ color: S.main }}>{typeof entry.balance === 'number' && entry.balance < 1000 ? `$${entry.balance.toFixed(2)}` : fmt(entry.balance)}</strong>
          </p>
        )}
        {entry.used != null && entry.limit != null && (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: S.sub }}>
            {fmt(entry.used)} / {fmt(entry.limit)} used
          </p>
        )}
      </div>

      {/* Usage bar */}
      {entry.usedPct != null && <UsageBar usedPct={entry.usedPct} urgency={entry.urgency} />}

      {/* Description */}
      <p style={{ margin: 0, fontSize: 11, color: S.dim, lineHeight: 1.5 }}>{entry.description}</p>

      {/* Error */}
      {isError && entry.error && (
        <p style={{ margin: 0, fontSize: 11, color: S.red }}>{entry.error}</p>
      )}

      {/* Last fetched */}
      {entry.lastFetched && (
        <p style={{ margin: 0, fontSize: 10, color: S.dim }}>
          Updated {new Date(entry.lastFetched).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}

function ExpensesTab() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery<ExpensesData>({
    queryKey: ['admin-expenses'],
    queryFn: async () => { const { data } = await api.get('/admin/expenses'); return data; },
    staleTime: 60 * 60 * 1000,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['admin-expenses'] });
    api.get('/admin/expenses?refresh=1').then(({ data: fresh }) => {
      queryClient.setQueryData(['admin-expenses'], fresh);
    });
  }

  if (isLoading) return <p style={{ color: S.dim, fontSize: 14 }}>Fetching live data...</p>;
  if (isError || !data) return <p style={{ color: S.red, fontSize: 14 }}>Failed to load expenses.</p>;

  const needsAttention = data.services.filter(s => s.urgency === 'critical' || s.urgency === 'warning');
  const monthlyServices = data.services.filter(s => s.monthlyCostAUD != null && (s.billingCycle === 'monthly' || s.billingCycle === 'annual'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Burn banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.04))',
        border: `1px solid rgba(251,191,36,0.22)`, borderRadius: 14,
        padding: '18px 22px',
      }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.amber }}>
            Monthly burn (known fixed costs)
          </p>
          <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: S.main, lineHeight: 1, letterSpacing: '-0.03em' }}>
            A${data.totalMonthlyAUD.toFixed(0)}
            <span style={{ fontSize: 14, fontWeight: 500, color: S.dim, marginLeft: 8 }}>/mo</span>
          </p>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: S.dim }}>
            Excludes per-transaction costs (OpenRouter, Stripe, LlamaCloud)
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {monthlyServices.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: S.sub }}>{s.name}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: S.main }}>A${s.monthlyCostAUD!.toFixed(0)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            onClick={refresh}
            disabled={isFetching}
            style={{ ...btnStyle(S.amber), opacity: isFetching ? 0.5 : 1 }}
          >
            <RefreshCcw size={12} style={{ animation: isFetching ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh live data
          </button>
        </div>
      </div>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)',
          borderRadius: 14, padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ color: S.red }} />
            <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: S.red }}>
              Needs attention
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {needsAttention.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: URGENCY_COLOR[s.urgency], flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: S.main }}>{s.name}</span>
                <span style={{ fontSize: 12, color: S.sub, flex: 1 }}>{s.description}</span>
                {s.usedPct != null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: URGENCY_COLOR[s.urgency] }}>{s.usedPct}% used</span>
                )}
                {s.balance != null && s.limit == null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: URGENCY_COLOR[s.urgency] }}>
                    ${typeof s.balance === 'number' ? s.balance.toFixed(2) : s.balance} remaining
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service grid */}
      <div>
        <SectionHead label="All services" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {data.services.map(entry => (
            <ExpenseCard key={entry.id} entry={entry} />
          ))}
        </div>
      </div>

      {data.fetchedAt && (
        <p style={{ fontSize: 11, color: S.dim, margin: 0 }}>
          {data.cached ? 'Cached' : 'Fetched'} at {new Date(data.fetchedAt).toLocaleString('en-AU')}
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'funnel' | 'friday' | 'expenses'>('overview');

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
          {([['overview', 'Overview', BarChart2], ['funnel', 'Funnel', TrendingUp], ['friday', 'Friday Brief', ClipboardList], ['expenses', 'Expenses', DollarSign]] as const).map(([key, label, Icon]) => (
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

        {tab === 'friday' && <FridayBriefTab />}
        {tab === 'expenses' && <ExpensesTab />}

      </div>
    </div>
  );
}
