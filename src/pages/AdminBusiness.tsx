/**
 * AdminBusiness: the weekly read, at /admin/business.
 *
 * Money in, where the funnel leaks, whether email is arriving, and which
 * bills are about to bite. Read once a week, not acted on hourly, which is
 * why it is one page and not four tabs.
 *
 * Four endpoints, each loaded on its own so one slow source (Stripe, PostHog)
 * never holds up the rest:
 *
 *   /admin/revenue          Stripe charges and who is paying now
 *   /admin/traffic          the funnel, visits to paid
 *   /admin/email-analytics  one line here; the whole picture is /admin/email
 *   /admin/expenses         running costs and credit balances
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { AdminShell } from '../components/admin/AdminShell';
import { money } from '../components/admin/people';

interface Revenue {
  totals: { gross: number; refunded: number; net: number; payments: number };
  byMonth: { month: string; net: number; payments: number }[];
  unmatched: number;
  clients: { payingNow: number; trialing: number; pastDue: number; onHold: number };
}

interface Traffic {
  totals: Record<'visitors' | 'uploaded' | 'resume' | 'enteredEmail' | 'signedUp' | 'trials' | 'paid', number>;
}

interface EmailSummary {
  sent: number; bounced: number;
  deliveryRate: number | null; openRate: number | null; clickRate: number | null;
}

interface Expense {
  id: string; name: string; status: 'live' | 'manual' | 'error'; urgency: 'good' | 'warning' | 'critical' | 'unknown';
  balance?: number; usedPct?: number; description: string; error?: string;
}

const DAYS = 90;

const STEPS: { key: keyof Traffic['totals']; label: string }[] = [
  { key: 'visitors', label: 'Visited' },
  { key: 'uploaded', label: 'Uploaded a resume' },
  { key: 'enteredEmail', label: 'Entered email' },
  { key: 'signedUp', label: 'New accounts' },
  { key: 'trials', label: 'Started a trial' },
  { key: 'paid', label: 'Paid' },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-AU', { month: 'short' });
const pct = (n: number | null) => (n === null ? 'not yet' : `${n}%`);

function costLine(e: Expense): string {
  if (e.status === 'error') return `Could not be checked${e.error ? `: ${e.error}` : ''}.`;
  if (e.balance !== undefined && e.usedPct === undefined) return `${money(e.balance)} credit left.`;
  if (e.usedPct !== undefined) return `${e.usedPct}% of this month’s allowance used.`;
  return e.description;
}

export default function AdminBusiness() {
  const revenue = useQuery({
    queryKey: ['admin-revenue', DAYS],
    queryFn: async () => (await api.get('/admin/revenue', { params: { days: DAYS } })).data as Revenue,
    staleTime: 5 * 60_000,
  });
  const traffic = useQuery({
    queryKey: ['admin-traffic', 'business', DAYS],
    queryFn: async () => {
      const to = new Date();
      const from = new Date(to.getTime() - (DAYS - 1) * 86_400_000);
      return (await api.get('/admin/traffic', { params: { from: ymd(from), to: ymd(to), interval: 'week' } })).data as Traffic;
    },
    staleTime: 5 * 60_000,
  });
  // Same query (and cache) the Email page opens on.
  const email = useQuery({
    queryKey: ['email-analytics', 30],
    queryFn: async () => (await api.get('/admin/email-analytics', { params: { days: 30 } })).data as { summary: EmailSummary },
    staleTime: 60_000,
  });
  const expenses = useQuery({
    queryKey: ['admin-expenses'],
    queryFn: async () => (await api.get('/admin/expenses')).data as { services: Expense[]; totalMonthlyAUD: number },
    staleTime: 10 * 60_000,
  });

  const r = revenue.data;
  const months = r?.byMonth ?? [];
  const top = Math.max(1, ...months.map((m) => m.net));
  const t = traffic.data?.totals;
  const em = email.data?.summary;
  const services = expenses.data?.services ?? [];
  const watch = services.filter((s) => s.urgency === 'critical' || s.urgency === 'warning' || s.status === 'error');
  const fine = services.length - watch.length;

  const dash = (v: string | number | undefined, loading: boolean) => (v !== undefined ? v : loading ? '…' : 'n/a');

  return (
    <AdminShell title="Business" subtitle={`The weekly read. Last ${DAYS} days.`}>
      <div className="adm-stats">
        <div className="adm-card adm-stat"><b>{dash(r && money(r.totals.net), revenue.isLoading)}</b><span>revenue, {DAYS} days</span></div>
        <div className="adm-card adm-stat"><b>{dash(r?.clients.payingNow, revenue.isLoading)}</b><span>paying clients</span></div>
        <div className="adm-card adm-stat"><b>{dash(r?.clients.trialing, revenue.isLoading)}</b><span>on trial</span></div>
        <div className="adm-card adm-stat">
          <b>{dash(expenses.data && money(Math.round(expenses.data.totalMonthlyAUD)), expenses.isLoading)}</b><span>fixed monthly costs</span>
        </div>
      </div>

      <h2>Revenue by month</h2>
      <div className="adm-card">
        {revenue.error && <div className="adm-empty adm-error">Revenue could not be loaded from Stripe.</div>}
        {revenue.isLoading && <div className="adm-empty">Loading from Stripe…</div>}
        {r && (
          <div className="adm-bars">
            {months.map((m) => (
              <div key={m.month} className="adm-bar">
                <b>{money(Math.round(m.net))}</b>
                <i style={{ height: Math.round((m.net / top) * 110) }} />
                {monthLabel(m.month)}
              </div>
            ))}
          </div>
        )}
      </div>
      {r && (r.totals.refunded > 0 || r.unmatched > 0) && (
        <p className="adm-meta" style={{ marginTop: 10 }}>
          {r.totals.refunded > 0 && `${money(r.totals.refunded)} refunded. `}
          {r.unmatched > 0 && `${r.unmatched} payment${r.unmatched === 1 ? '' : 's'} with no account behind ${r.unmatched === 1 ? 'it' : 'them'}.`}
        </p>
      )}

      <h2>Where visitors drop off</h2>
      <div className="adm-card">
        {traffic.error && <div className="adm-empty adm-error">The funnel could not be loaded.</div>}
        {traffic.isLoading && <div className="adm-empty">Loading…</div>}
        {t && STEPS.map((s) => (
          <div key={s.key} className="adm-row" style={{ padding: '12px 20px' }}>
            <div style={{ width: 150, flexShrink: 0 }}>{s.label}</div>
            <div className="adm-grow"><div className="adm-fbar" style={{ width: `${Math.max(0.5, (t[s.key] / Math.max(1, t.visitors)) * 100)}%` }} /></div>
            <b style={{ width: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{t[s.key].toLocaleString()}</b>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 10 }}><Link className="adm-link" to="/admin/growth">Open the full funnel, by day and by source</Link></p>

      <h2>Email <span>last 30 days</span></h2>
      <div className="adm-card">
        {email.error && <div className="adm-empty adm-error">Email numbers could not be loaded.</div>}
        {email.isLoading && <div className="adm-empty">Loading…</div>}
        {em && (
          <Link to="/admin/email" className="adm-row">
            <div className="adm-grow">
              <div className="adm-name">
                {em.sent} sent, {pct(em.deliveryRate)} delivered, {pct(em.openRate)} opened, {pct(em.clickRate)} clicked
              </div>
              {em.bounced > 0 && <div className="adm-meta adm-error">{em.bounced} did not arrive.</div>}
            </div>
            <span className="adm-btn ghost">Open email</span>
          </Link>
        )}
      </div>

      <h2>Costs to watch</h2>
      <div className="adm-card">
        {expenses.error && <div className="adm-empty adm-error">Costs could not be loaded.</div>}
        {expenses.isLoading && <div className="adm-empty">Loading…</div>}
        {watch.map((s) => (
          <div key={s.id} className="adm-row">
            <span className={`adm-dot ${s.urgency === 'critical' ? 'red' : 'amber'}`} />
            <div className="adm-grow">
              <div className="adm-name">{s.name}</div>
              <div className="adm-meta">{costLine(s)}</div>
            </div>
          </div>
        ))}
        {expenses.data && fine > 0 && (
          <div className="adm-row">
            <span className="adm-dot green" />
            <div className="adm-grow">
              <div className="adm-name">{watch.length ? 'Everything else' : 'Nothing needs attention'}</div>
              <div className="adm-meta">{fine} service{fine === 1 ? '' : 's'}, no action needed.</div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
