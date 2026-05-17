/**
 * AdminFunnel — trial conversion action queue.
 *
 * Founder-ritual view: open in the morning, scan three things in order.
 *
 *   1. Summary strip — active trials, ending this week, paid count,
 *      conversion rate over last 30 days. The numbers you check daily.
 *
 *   2. Funnel — signup -> onboarded -> diagnostic -> first app -> 5+ apps ->
 *      paid. Where is the biggest drop, this week vs last week.
 *
 *   3. Action queue — trial users sorted by urgency (trial-end ASC). Two
 *      signals per row: quota usage (hot/warm/cold based on apps sent) and
 *      recency (active/stale/inactive based on last touch). Plus a copy-email
 *      button so you can write to them right now.
 *
 * Numbers exclude internal/test accounts via the server-side EXCLUDED_EMAILS
 * list. Auth gate is server-side (requireAdmin); this page assumes the user
 * is admin and surfaces a forbidden state if the API returns 403.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, AlertTriangle, ArrowLeft, Clock, Zap } from 'lucide-react';
import api from '../lib/api';

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
}

interface OverviewResponse {
  funnel: FunnelStage[];
  summary: {
    activeTrials: number;
    trialsEndingThisWeek: number;
    paidUsers: number;
    conversionLast30Days: number | null;
    trialsEndedLast30: number;
    convertedFromEnded: number;
  };
}

interface TrialUser {
  userId: string;
  email: string | null;
  name: string | null;
  targetRole: string | null;
  targetCity: string | null;
  signupAt: string;
  trialEndDate: string | null;
  daysToTrialEnd: number | null;
  appsSent: number;
  freeAppQuota: number;
  lastActiveAt: string;
  daysSinceActive: number | null;
  quotaStatus: 'hot' | 'warm' | 'cold';
  recencyStatus: 'active' | 'stale' | 'inactive';
}

interface TrialsResponse {
  trials: TrialUser[];
}

// ── Visual tokens (matching the existing AdminDashboard's S object) ────────
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

const QUOTA_VISUAL: Record<TrialUser['quotaStatus'], { label: string; color: string; bg: string }> = {
  hot:  { label: 'Hot',  color: S.green, bg: 'rgba(74,222,128,0.12)' },
  warm: { label: 'Warm', color: S.amber, bg: 'rgba(251,191,36,0.12)' },
  cold: { label: 'Cold', color: S.dim,   bg: 'rgba(107,114,128,0.12)' },
};

const RECENCY_VISUAL: Record<TrialUser['recencyStatus'], { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',   color: S.green, bg: 'rgba(74,222,128,0.12)' },
  stale:    { label: 'Stale',    color: S.amber, bg: 'rgba(251,191,36,0.12)' },
  inactive: { label: 'Inactive', color: S.red,   bg: 'rgba(248,113,113,0.12)' },
};

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  return `${Math.round(n * 100)}%`;
}

function fmtRelativeDays(days: number | null, opts: { future: boolean } = { future: false }): string {
  if (days === null) return '—';
  if (days === 0) return opts.future ? 'today' : 'today';
  if (days < 0) return opts.future ? `${Math.abs(days)}d overdue` : `${Math.abs(days)}d ago`;
  return opts.future ? `in ${days}d` : `${days}d ago`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

// ── Summary card ───────────────────────────────────────────────────────────
function SummaryCard({
  label, value, sub, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div style={{
      padding: '18px 20px',
      background: S.card,
      border: `1px solid ${S.border}`,
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: S.sub, textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: accent ?? S.main, letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sub && (
        <p style={{ margin: 0, fontSize: 11, color: S.dim, lineHeight: 1.4 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Funnel bar ─────────────────────────────────────────────────────────────
function FunnelBar({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.count ?? 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stages.map((stage, i) => {
        const prev = i === 0 ? null : stages[i - 1];
        const widthPct = top === 0 ? 0 : Math.max((stage.count / top) * 100, stage.count > 0 ? 3 : 1);
        const dropPct = prev && prev.count > 0
          ? Math.round(((prev.count - stage.count) / prev.count) * 100)
          : null;
        const conversionFromPrev = prev && prev.count > 0
          ? Math.round((stage.count / prev.count) * 100)
          : null;

        return (
          <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <p style={{ margin: 0, width: 200, fontSize: 13, color: S.sub, flexShrink: 0 }}>
              {stage.label}
            </p>
            <div style={{ flex: 1, height: 28, position: 'relative', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
              <div style={{
                width: `${widthPct}%`,
                height: '100%',
                background: i === 0 ? 'rgba(45,212,191,0.20)' : i === stages.length - 1 ? 'rgba(74,222,128,0.25)' : 'rgba(96,165,250,0.18)',
                border: `1px solid ${i === 0 ? S.teal : i === stages.length - 1 ? S.green : S.blue}`,
                borderRadius: 8,
                transition: 'width 0.3s',
              }} />
              <p style={{
                position: 'absolute',
                top: '50%',
                left: 12,
                transform: 'translateY(-50%)',
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: S.main,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {stage.count}
                {conversionFromPrev !== null && (
                  <span style={{ marginLeft: 8, fontWeight: 500, color: S.sub }}>
                    ({conversionFromPrev}% from prev)
                  </span>
                )}
              </p>
            </div>
            <p style={{
              margin: 0,
              width: 90,
              fontSize: 11,
              color: dropPct !== null && dropPct >= 50 ? S.red : S.dim,
              textAlign: 'right',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {dropPct !== null ? `−${dropPct}%` : ''}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Trial row ──────────────────────────────────────────────────────────────
function TrialRow({ user }: { user: TrialUser }) {
  const [copied, setCopied] = useState(false);
  const quota = QUOTA_VISUAL[user.quotaStatus];
  const recency = RECENCY_VISUAL[user.recencyStatus];
  const trialEndedAlready = user.daysToTrialEnd !== null && user.daysToTrialEnd < 0;
  const trialEndUrgent = user.daysToTrialEnd !== null && user.daysToTrialEnd >= 0 && user.daysToTrialEnd <= 2;

  async function copyEmail() {
    if (!user.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable; silently noop
    }
  }

  return (
    <tr style={{ borderBottom: `1px solid ${S.border}` }}>
      <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: S.main }}>
            {user.name ?? '—'}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: S.sub, fontFamily: 'monospace' }}>
            {user.email ?? '—'}
          </p>
          {(user.targetRole || user.targetCity) && (
            <p style={{ margin: '4px 0 0', fontSize: 10, color: S.dim }}>
              {user.targetRole}{user.targetRole && user.targetCity ? ' · ' : ''}{user.targetCity}
            </p>
          )}
        </div>
      </td>
      <td style={{ padding: '14px 12px', verticalAlign: 'top', fontSize: 12, color: S.sub }}>
        {fmtDate(user.signupAt)}
      </td>
      <td style={{ padding: '14px 12px', verticalAlign: 'top', fontSize: 12 }}>
        <p style={{
          margin: 0,
          fontWeight: trialEndUrgent || trialEndedAlready ? 700 : 500,
          color: trialEndedAlready ? S.red : trialEndUrgent ? S.amber : S.main,
        }}>
          {fmtRelativeDays(user.daysToTrialEnd, { future: true })}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: S.dim }}>
          {fmtDate(user.trialEndDate)}
        </p>
      </td>
      <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: S.main, fontVariantNumeric: 'tabular-nums' }}>
            {user.appsSent} / {user.freeAppQuota}
          </p>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            alignSelf: 'flex-start',
            padding: '2px 7px',
            background: quota.bg,
            color: quota.color,
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 6,
            letterSpacing: '0.02em',
          }}>
            <Zap size={9} />
            {quota.label}
          </span>
        </div>
      </td>
      <td style={{ padding: '14px 12px', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ margin: 0, fontSize: 12, color: S.main }}>
            {fmtRelativeDays(user.daysSinceActive)}
          </p>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            alignSelf: 'flex-start',
            padding: '2px 7px',
            background: recency.bg,
            color: recency.color,
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 6,
            letterSpacing: '0.02em',
          }}>
            <Clock size={9} />
            {recency.label}
          </span>
        </div>
      </td>
      <td style={{ padding: '14px 12px', verticalAlign: 'top', textAlign: 'right' }}>
        <button
          onClick={copyEmail}
          disabled={!user.email}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: copied ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)',
            color: copied ? S.green : S.sub,
            border: `1px solid ${copied ? 'rgba(74,222,128,0.30)' : S.border}`,
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            cursor: user.email ? 'pointer' : 'not-allowed',
            opacity: user.email ? 1 : 0.4,
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy email'}
        </button>
      </td>
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export function AdminFunnel() {
  const overviewQ = useQuery<OverviewResponse>({
    queryKey: ['admin-funnel', 'overview'],
    queryFn: async () => (await api.get('/admin/funnel/overview')).data,
    staleTime: 60 * 1000,
  });

  const trialsQ = useQuery<TrialsResponse>({
    queryKey: ['admin-funnel', 'trials'],
    queryFn: async () => (await api.get('/admin/funnel/trials')).data,
    staleTime: 60 * 1000,
  });

  const forbidden = (overviewQ.error as any)?.response?.status === 403
    || (trialsQ.error as any)?.response?.status === 403;

  if (forbidden) {
    return (
      <div style={{ minHeight: '100vh', background: S.bg, color: S.main, padding: 40 }}>
        <div style={{
          maxWidth: 480, margin: '80px auto', padding: 32, textAlign: 'center',
          background: S.card, border: `1px solid ${S.border}`, borderRadius: 12,
        }}>
          <AlertTriangle size={32} style={{ color: S.amber, marginBottom: 12 }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Admin only</h1>
          <p style={{ fontSize: 13, color: S.sub, margin: 0 }}>
            You don't have access to this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: S.bg, color: S.main, padding: '32px 28px 80px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Link
              to="/admin"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: S.sub,
                textDecoration: 'none',
                marginBottom: 8,
              }}
            >
              <ArrowLeft size={11} />
              Back to admin
            </Link>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Trial conversion funnel
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: S.sub }}>
              Where the ball is, and who to push next.
            </p>
          </div>
        </div>

        {/* Summary strip */}
        {overviewQ.data ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}>
            <SummaryCard
              label="Active trials"
              value={String(overviewQ.data.summary.activeTrials)}
              sub="On free trial right now"
              accent={S.blue}
            />
            <SummaryCard
              label="Ending this week"
              value={String(overviewQ.data.summary.trialsEndingThisWeek)}
              sub="Decision window opens"
              accent={S.amber}
            />
            <SummaryCard
              label="Paid users"
              value={String(overviewQ.data.summary.paidUsers)}
              sub="All-time, currently active"
              accent={S.green}
            />
            <SummaryCard
              label="Conversion (last 30d)"
              value={fmtPct(overviewQ.data.summary.conversionLast30Days)}
              sub={`${overviewQ.data.summary.convertedFromEnded} of ${overviewQ.data.summary.trialsEndedLast30} trials converted`}
              accent={S.teal}
            />
          </div>
        ) : (
          <p style={{ fontSize: 13, color: S.sub }}>
            {overviewQ.isLoading ? 'Loading summary…' : 'Could not load summary.'}
          </p>
        )}

        {/* Funnel */}
        <div style={{
          padding: '22px 24px',
          background: S.card,
          border: `1px solid ${S.border}`,
          borderRadius: 14,
        }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase', color: S.sub }}>
            Funnel
          </h2>
          <p style={{ margin: '0 0 22px', fontSize: 12, color: S.dim }}>
            Drop-offs over 50% (red column) deserve attention.
          </p>
          {overviewQ.data ? (
            <FunnelBar stages={overviewQ.data.funnel} />
          ) : (
            <p style={{ fontSize: 13, color: S.sub }}>
              {overviewQ.isLoading ? 'Loading funnel…' : 'Could not load funnel.'}
            </p>
          )}
        </div>

        {/* Trial queue */}
        <div style={{
          padding: '22px 24px',
          background: S.card,
          border: `1px solid ${S.border}`,
          borderRadius: 14,
        }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase', color: S.sub }}>
            Action queue
          </h2>
          <p style={{ margin: '0 0 18px', fontSize: 12, color: S.dim }}>
            Trial users sorted by urgency. Hot + Active = highest-probability conversion. Cold + Inactive = probably lost.
          </p>

          {trialsQ.data ? (
            trialsQ.data.trials.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: S.sub, fontStyle: 'italic' }}>
                No trial users in the action window. When someone signs up, they'll appear here.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: S.sub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        User
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: S.sub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Signed up
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: S.sub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Trial ends
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: S.sub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Quota
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: S.sub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Last active
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: S.sub, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialsQ.data.trials.map(user => (
                      <TrialRow key={user.userId} user={user} />
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <p style={{ fontSize: 13, color: S.sub }}>
              {trialsQ.isLoading ? 'Loading action queue…' : 'Could not load action queue.'}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
