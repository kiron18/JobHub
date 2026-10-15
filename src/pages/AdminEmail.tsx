/**
 * AdminEmail: every email we send, at /admin/email.
 *
 * Read top to bottom it answers four questions, in this order:
 *   1. Is mail going out and arriving?      the four numbers at the top
 *   2. How did the marketing emails do?     broadcasts, one row each
 *   3. Is each automated email working?     grouped by where the person is
 *   4. Did anything not arrive?             bounces, by name
 * and then shows the last few sends, so "did Asha get her reminder" is one look.
 *
 * Where the numbers come from (server/src/email/admin/analyticsRoutes.ts):
 *   delivered, opened, bounced   Resend's webhook
 *   clicked                      our own site, from the ?e= tag on links
 * Measuring started on 15 October 2026. Rates only count emails sent since
 * then, so a window reaching back further is not dragged down by emails that
 * were never measured.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { AdminShell } from '../components/admin/AdminShell';

interface Numbers {
  sent: number; measured: number; delivered: number; opened: number; clicked: number;
  openable: number; clickable: number;
  bounced: number; complained: number;
  deliveryRate: number | null; openRate: number | null; clickRate: number | null;
  canOpen: boolean; canClick: boolean;
}
interface Row extends Numbers {
  id: string; label: string; kind: 'automated' | 'campaign'; stage: string;
  lastSentAt: string; lastSubject: string;
}
interface Recent { id: string; toEmail: string; subject: string; label: string; sentAt: string; status: string; detail: string | null }
interface Bounce { toEmail: string; subject: string; bouncedAt: string; reason: string | null }
interface EmailResponse {
  days: number;
  trackingSince: string;
  summary: Numbers & { unsubscribed: number; contacts: number };
  emails: Row[];
  recent: Recent[];
  bounces: Bounce[];
}

const WINDOWS = [7, 30, 90];
const STAGES = ['Signup and trial', 'Paying clients', 'Job search nudges', 'Calls and workshops', 'Other'];

const shortDate = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const when = (d: string) => new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** A rate as a table cell: the percent, with the count behind it on hover. */
function Rate({ n, of, pct, can, cannot }: { n: number; of: number; pct: number | null; can: boolean; cannot: string }) {
  if (!can) return <span className="adm-faint">{cannot}</span>;
  if (pct === null) return <span className="adm-faint">not yet</span>;
  return <span title={`${n} of ${of}`}>{pct}%</span>;
}

const STATUS_CLASS: Record<string, string> = {
  Clicked: 'st-good', Opened: 'st-blue', Delivered: 'st-plain', Sent: 'st-plain',
  'Sent, not measured': 'st-faint', Bounced: 'st-bad', 'Marked as spam': 'st-bad',
};

export default function AdminEmail() {
  const [days, setDays] = useState(30);
  const q = useQuery({
    queryKey: ['email-analytics', days],
    queryFn: async () => (await api.get('/admin/email-analytics', { params: { days } })).data as EmailResponse,
    staleTime: 60_000,
  });
  const d = q.data;
  const s = d?.summary;
  const campaigns = (d?.emails ?? []).filter((e) => e.kind === 'campaign');
  const automated = (d?.emails ?? []).filter((e) => e.kind === 'automated');
  const since = d ? new Date(d.trackingSince) : null;
  const windowStart = new Date(Date.now() - days * 86_400_000);
  const partlyUnmeasured = since !== null && windowStart < since;

  const stat = (v: string | number | null | undefined) => (q.isLoading ? '…' : v ?? 'n/a');

  return (
    <AdminShell
      title="Email"
      subtitle="What went out, whether it arrived, and what people did with it."
      actions={WINDOWS.map((w) => (
        <button key={w} className={`adm-chip${w === days ? ' on' : ''}`} onClick={() => setDays(w)}>Last {w} days</button>
      ))}
    >
      {q.error && <p className="adm-error">Email numbers could not be loaded. Refresh to try again.</p>}

      <div className="adm-stats">
        <div className="adm-card adm-stat"><b>{stat(s?.sent)}</b><span>emails sent</span></div>
        <div className="adm-card adm-stat">
          <b>{stat(s && (s.deliveryRate === null ? 'not yet' : `${s.deliveryRate}%`))}</b>
          <span>delivered{s && s.bounced > 0 && <>, <strong className="adm-error">{s.bounced} bounced</strong></>}</span>
        </div>
        <div className="adm-card adm-stat">
          <b>{stat(s && (s.openRate === null ? 'not yet' : `${s.openRate}%`))}</b><span>opened</span>
        </div>
        <div className="adm-card adm-stat">
          <b>{stat(s && (s.clickRate === null ? 'not yet' : `${s.clickRate}%`))}</b><span>clicked a link</span>
        </div>
      </div>
      {s && partlyUnmeasured && (
        <p className="adm-meta" style={{ marginTop: 12 }}>
          Measuring started {shortDate(d!.trackingSince)}. The percentages count only the {s.measured} email{s.measured === 1 ? '' : 's'} sent since then.
        </p>
      )}
      {s && s.complained > 0 && (
        <p className="adm-error" style={{ marginTop: 8 }}>{s.complained} email{s.complained === 1 ? ' was' : 's were'} marked as spam. Worth a look at what and to whom.</p>
      )}

      <h2>Marketing emails</h2>
      <div className="adm-card">
        {d && campaigns.length === 0 && (
          <div className="adm-row">
            <div className="adm-grow adm-meta" style={{ marginTop: 0 }}>No broadcasts sent in the last {days} days.</div>
            <Link className="adm-btn ghost" to="/admin/broadcasts">Send a broadcast</Link>
          </div>
        )}
        {q.isLoading && <div className="adm-empty">Loading…</div>}
        {campaigns.length > 0 && <Table rows={campaigns} />}
      </div>

      <h2>Automated emails</h2>
      <div className="adm-card">
        {d && automated.length === 0 && <div className="adm-empty">No automated emails went out in the last {days} days.</div>}
        {q.isLoading && <div className="adm-empty">Loading…</div>}
        {automated.length > 0 && <Table rows={automated} grouped />}
      </div>

      {!!d?.bounces.length && <>
        <h2>Did not arrive</h2>
        <div className="adm-card">
          {d.bounces.map((b, i) => (
            <div key={`${b.toEmail}:${b.bouncedAt}:${i}`} className="adm-row">
              <span className="adm-dot red" />
              <div className="adm-grow">
                <div className="adm-name">{b.toEmail}</div>
                <div className="adm-meta">{b.subject}. {when(b.bouncedAt)}{b.reason ? `. ${b.reason}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      </>}

      {!!d?.recent.length && <>
        <h2>Latest sends</h2>
        <div className="adm-card">
          {d.recent.map((r) => (
            <div key={r.id} className="adm-row">
              <span className={`adm-pill ${STATUS_CLASS[r.status] ?? 'st-plain'}`}>{r.status}</span>
              <div className="adm-grow">
                <div className="adm-name">{r.toEmail}</div>
                <div className="adm-meta">{r.label}. {r.subject}{r.detail ? `. ${r.detail}` : ''}</div>
              </div>
              <span className="adm-meta" style={{ marginTop: 0, whiteSpace: 'nowrap' }}>{when(r.sentAt)}</span>
            </div>
          ))}
        </div>
      </>}

      <p className="adm-meta" style={{ marginTop: 24 }}>
        Clicks are the number to trust. Opens run high because Apple Mail opens every email by itself,
        and plain-text emails cannot show an open at all.
      </p>
    </AdminShell>
  );
}

function Table({ rows, grouped }: { rows: Row[]; grouped?: boolean }) {
  const stages = grouped ? STAGES.filter((st) => rows.some((r) => r.stage === st)) : [null];
  return (
    <table>
      <thead>
        <tr>
          <th>Email</th><th>Last sent</th><th className="num">Sent</th>
          <th className="num">Delivered</th><th className="num">Opened</th><th className="num">Clicked</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((st) => {
          const list = st ? rows.filter((r) => r.stage === st) : rows;
          return [
            st && <tr key={`h:${st}`} className="adm-group"><td colSpan={6}>{st}</td></tr>,
            ...list.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>{r.kind === 'campaign' ? r.lastSubject || r.label : r.label}</b>
                  {r.bounced > 0 && <span className="adm-error"> {r.bounced} bounced</span>}
                </td>
                <td>{shortDate(r.lastSentAt)}</td>
                <td className="num">{r.sent}</td>
                <td className="num"><Rate n={r.delivered} of={r.measured} pct={r.deliveryRate} can cannot="" /></td>
                <td className="num"><Rate n={r.opened} of={r.openable} pct={r.openRate} can={r.canOpen} cannot="plain text" /></td>
                <td className="num"><Rate n={r.clicked} of={r.clickable} pct={r.clickRate} can={r.canClick} cannot="no links" /></td>
              </tr>
            )),
          ];
        })}
      </tbody>
    </table>
  );
}
