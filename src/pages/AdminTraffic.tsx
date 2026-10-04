/**
 * AdminTraffic — who visits the site, per day/week/month, and how far they get.
 *
 * One bar chart (visitors per bucket, hover a bar for the rest of that
 * bucket's funnel) and one funnel row for the whole range:
 * visited -> uploaded -> saw resume -> signed up -> trial -> paid.
 *
 * Data via GET /api/admin/traffic: visits and uploads from PostHog, signups
 * and trials from the database (PostHog undercounts both). Test accounts,
 * staging/localhost runs and headless crawler hits are dropped server-side.
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';

type Interval = 'day' | 'week' | 'month';

interface Metrics {
  visitors: number;
  uploaded: number;
  resume: number;
  enteredEmail: number;
  signedUp: number;
  trials: number;
  paid: number;
}

interface TrafficResponse {
  from: string;
  to: string;
  interval: Interval;
  buckets: (Metrics & { bucket: string })[];
  totals: Metrics;
}

const C = warm.colors;

const STEPS: { key: keyof Metrics; label: string }[] = [
  { key: 'visitors', label: 'Visited' },
  { key: 'uploaded', label: 'Uploaded a resume' },
  { key: 'resume', label: 'Saw their resume' },
  { key: 'enteredEmail', label: 'Entered email' },
  { key: 'signedUp', label: 'New accounts' },
  { key: 'trials', label: 'Started a trial' },
  { key: 'paid', label: 'Paid' },
];

const PRESETS: { label: string; days: number; interval: Interval }[] = [
  { label: '7 days', days: 7, interval: 'day' },
  { label: '30 days', days: 30, interval: 'day' },
  { label: '90 days', days: 90, interval: 'week' },
  { label: '12 months', days: 365, interval: 'month' },
];

/** Local calendar date as YYYY-MM-DD (not toISOString, which is UTC). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  return ymd(d);
}

function bucketLabel(bucket: string, interval: Interval): string {
  const d = new Date(`${bucket}T00:00:00`);
  if (interval === 'month') return d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function pct(n: number, of: number): string | null {
  return of > 0 ? `${Math.round((n / of) * 100)}%` : null;
}

export function AdminTraffic() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(ymd(new Date()));
  const [interval, setGroupBy] = useState<Interval>('day');
  const [hover, setHover] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-traffic', from, to, interval],
    queryFn: async () => (await api.get('/admin/traffic', { params: { from, to, interval } })).data as TrafficResponse,
    enabled: from <= to,
  });

  const max = useMemo(() => Math.max(1, ...(data?.buckets ?? []).map(b => b.visitors)), [data]);
  // Round the axis top up to a clean number so gridlines land on whole values.
  const axisTop = useMemo(() => {
    const step = max <= 10 ? 2 : max <= 50 ? 10 : max <= 200 ? 25 : 100;
    return Math.ceil(max / step) * step;
  }, [max]);
  const gridlines = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(axisTop * f));

  const buckets = data?.buckets ?? [];
  // Thin the x labels so they never collide: at most ~10 across.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 10));

  const applyPreset = (p: typeof PRESETS[number]) => {
    setFrom(daysAgo(p.days));
    setTo(ymd(new Date()));
    setGroupBy(p.interval);
  };
  const activePreset = PRESETS.find(p => from === daysAgo(p.days) && to === ymd(new Date()) && interval === p.interval);

  const forbidden = (error as any)?.response?.status === 403;

  return (
    <div style={{ height: '100dvh', overflowY: 'auto', background: C.bgCanvas, color: C.textPrimary }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(16px, 5vw, 32px) 16px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Link to="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.accentPetrol, textDecoration: 'none', ...warm.text.small }}>
            <ArrowLeft size={14} /> Admin
          </Link>
          <h1 style={{ ...warm.text.h1, margin: 0 }}>Site traffic</h1>
          <p style={{ ...warm.text.small, margin: 0, color: C.textMuted }}>
            New accounts and trials are exact, from the database. Visits, uploads and emails are recorded through our own server, so ad blockers no longer hide them (from 3 Oct 2026; earlier days undercount). Test accounts, staging and crawlers removed. Days are UTC.
          </p>
        </div>

        {/* Filters: one row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {PRESETS.map(p => {
            const on = activePreset === p;
            return (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                style={{
                  ...warm.text.small, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${on ? C.accentPetrol : C.borderDefined}`,
                  background: on ? C.accentPetrolSoft : C.bgSurface,
                  color: on ? C.accentPetrol : C.textSecondary,
                  fontWeight: on ? 600 : 400,
                }}
              >
                {p.label}
              </button>
            );
          })}
          <span style={{ width: 8 }} />
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inputStyle} aria-label="From" />
          <span style={{ ...warm.text.small, color: C.textMuted }}>to</span>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={inputStyle} aria-label="To" />
          <select value={interval} onChange={e => setGroupBy(e.target.value as Interval)} style={inputStyle} aria-label="Group by">
            <option value="day">By day</option>
            <option value="week">By week</option>
            <option value="month">By month</option>
          </select>
        </div>

        {forbidden && <p style={{ ...warm.text.body, color: C.danger }}>Admin only.</p>}
        {error && !forbidden && <p style={{ ...warm.text.body, color: C.danger }}>Could not load PostHog data.</p>}

        {/* Funnel for the whole range */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {STEPS.map((s, i) => {
            const value = data?.totals[s.key];
            const prev = i > 0 ? data?.totals[STEPS[i - 1].key] : undefined;
            const conv = value != null && prev != null ? pct(value, prev) : null;
            return (
              <div key={s.key} style={{ padding: '14px 16px', border: `1px solid ${C.borderWhisper}`, borderRadius: 12 }}>
                <p style={{ ...warm.text.micro, margin: 0, color: C.textMuted }}>{s.label}</p>
                <p style={{ ...warm.text.h1, margin: '4px 0 0', color: i === 0 ? C.accentPetrol : C.textPrimary }}>
                  {isLoading ? '…' : value ?? '–'}
                </p>
                <p style={{ ...warm.text.small, margin: 0, color: C.textMuted, minHeight: 20 }}>
                  {conv ? `${conv} of previous` : ''}
                </p>
              </div>
            );
          })}
        </div>

        {/* Visitors bar chart */}
        <div style={{ border: `1px solid ${C.borderWhisper}`, borderRadius: 12, padding: '16px 16px 12px' }}>
          <p style={{ ...warm.text.h3, margin: '0 0 12px' }}>Visitors per {interval}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Y axis */}
            <div style={{ position: 'relative', width: 28, height: 260, flexShrink: 0 }}>
              {gridlines.map((g, gi) => (
                <span key={gi} style={{ position: 'absolute', right: 0, bottom: `${(g / axisTop) * 100}%`, transform: 'translateY(50%)', fontSize: 11, color: C.textMuted }}>
                  {g}
                </span>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ position: 'relative', height: 260 }} onMouseLeave={() => setHover(null)}>
                {gridlines.map((g, gi) => (
                  <div key={gi} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(g / axisTop) * 100}%`, borderTop: `1px solid ${g === 0 ? C.borderDefined : C.borderWhisper}` }} />
                ))}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                  {buckets.map((b, i) => (
                    <div
                      key={b.bucket}
                      onMouseEnter={() => setHover(i)}
                      onClick={() => setHover(i)}
                      style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'default' }}
                    >
                      <div style={{
                        width: '100%', maxWidth: 40,
                        height: `${(b.visitors / axisTop) * 100}%`,
                        minHeight: b.visitors > 0 ? 2 : 0,
                        background: C.accentPetrol,
                        opacity: hover === null || hover === i ? 1 : 0.45,
                        borderRadius: '4px 4px 0 0',
                        transition: 'opacity 0.12s',
                      }} />
                    </div>
                  ))}
                </div>
                {hover !== null && buckets[hover] && (
                  <Tooltip
                    b={buckets[hover]}
                    interval={interval}
                    leftPct={((hover + 0.5) / buckets.length) * 100}
                  />
                )}
              </div>
              {/* X axis */}
              <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                {buckets.map((b, i) => (
                  <span key={b.bucket} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'visible' }}>
                    {i % labelEvery === 0 ? bucketLabel(b.bucket, interval) : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {!isLoading && buckets.length > 0 && buckets.every(b => b.visitors === 0) && (
            <p style={{ ...warm.text.small, color: C.textMuted, margin: '8px 0 0' }}>No visitors in this range.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Tooltip({ b, interval, leftPct }: { b: Metrics & { bucket: string }; interval: Interval; leftPct: number }) {
  const title = interval === 'week' ? `Week of ${bucketLabel(b.bucket, 'day')}` : bucketLabel(b.bucket, interval);
  // Flip to the left half of the bar once past the middle so it never clips.
  const side = leftPct > 60 ? { right: `${100 - leftPct}%` } : { left: `${leftPct}%` };
  return (
    <div style={{
      position: 'absolute', top: 0, ...side, margin: '0 8px', pointerEvents: 'none', zIndex: 2,
      background: C.bgSurface, border: `1px solid ${C.borderDefined}`, borderRadius: 8,
      padding: '8px 12px', boxShadow: '0 4px 16px rgba(15,32,56,0.10)', minWidth: 170,
    }}>
      <p style={{ ...warm.text.small, fontWeight: 600, margin: '0 0 4px', color: C.textPrimary }}>{title}</p>
      {STEPS.map(s => (
        <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, ...warm.text.small, color: C.textSecondary }}>
          <span>{s.label}</span>
          <span style={{ fontWeight: 600, color: C.textPrimary }}>{b[s.key]}</span>
        </div>
      ))}
    </div>
  );
}

const inputStyle: CSSProperties = {
  ...warm.text.small,
  // 16px, not the 13px small() gives everywhere else: under 16px, iOS Safari
  // zooms the whole page in on focus for any real form control.
  fontSize: 16,
  padding: '5px 8px',
  borderRadius: 8,
  border: `1px solid ${C.borderDefined}`,
  background: C.bgSurface,
  color: C.textPrimary,
};
