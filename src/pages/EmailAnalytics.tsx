/**
 * EmailAnalytics: what went out, when, and how it did.
 *
 * One headline row (last send, volume, open and click rate over 30 days) and
 * one row per kind of email. Click rate is the number to trust: Apple Mail
 * opens every message on delivery to hide the reader, so opens run high.
 *
 * Plain-text emails can't be measured (no pixel, and their links are left as
 * written), so their rates read "not tracked" rather than a 0% that would look
 * like nobody opened them.
 */
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { AdminShell, AdminToolLink } from '../components/admin/AdminShell';

const C = warm.colors;

interface EmailRow {
  id: string;
  label: string;
  kind: 'automated' | 'campaign';
  tracked: boolean;
  hasLinks: boolean;
  lastSentAt: string;
  lastSubject: string;
  sent: number;
  sent30: number;
  openRate: number | null;
  clickRate: number | null;
}

interface EmailResponse {
  summary: {
    lastSentAt: string | null;
    lastSubject: string | null;
    sent7: number;
    sent30: number;
    openRate30: number | null;
    clickRate30: number | null;
    trackedSent30: number;
    unsubscribed: number;
    contacts: number;
  };
  emails: EmailRow[];
}

/** "3 hours ago", "2 days ago": a last-sent time is read for how stale it is. */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function rateText(r: EmailRow, which: 'open' | 'click'): string {
  if (!r.tracked) return 'not tracked';
  if (which === 'click' && !r.hasLinks) return 'no links';
  const v = which === 'open' ? r.openRate : r.clickRate;
  return v === null ? '–' : `${v}%`;
}

export default function EmailAnalytics() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['email-analytics'],
    queryFn: async () => (await api.get('/admin/email-analytics')).data as EmailResponse,
    refetchInterval: 60_000,
  });
  const s = data?.summary;

  return (
    <AdminShell
      title="Email"
      subtitle="Every email we send to leads and clients. Rates are the last 30 days. Trust clicks over opens: Apple Mail opens everything on arrival, so opens run high."
      actions={<AdminToolLink to="/admin/broadcasts">Send a broadcast</AdminToolLink>}
    >
      {error && <p style={{ ...warm.text.body, color: C.danger }}>Could not load email stats.</p>}
      {isLoading && <p style={{ ...warm.text.body, color: C.textMuted }}>Loading…</p>}

      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 24 }}>
          <Stat
            label="Last email sent"
            value={s.lastSentAt ? ago(s.lastSentAt) : 'never'}
            note={s.lastSubject ?? ''}
          />
          <Stat label="Sent" value={String(s.sent30)} note={`last 30 days · ${s.sent7} this week`} />
          <Stat label="Click rate" value={s.clickRate30 === null ? '–' : `${s.clickRate30}%`} note="the one to watch" strong />
          <Stat label="Open rate" value={s.openRate30 === null ? '–' : `${s.openRate30}%`} note={`of ${s.trackedSent30} trackable sends`} />
          <Stat label="Unsubscribed" value={String(s.unsubscribed)} note={`of ${s.contacts} contacts`} />
        </div>
      )}

      {data && (
        <div style={{ border: `1px solid ${C.borderWhisper}`, borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr style={{ background: C.bgAlt, textAlign: 'left' }}>
                {['Email', 'Last sent', 'Sent (30d)', 'Opened', 'Clicked'].map((h) => (
                  <th key={h} style={{ ...warm.text.micro, color: C.textMuted, padding: '10px 14px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.emails.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${C.borderWhisper}` }}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{r.label}</div>
                    <div style={{ color: C.textMuted, marginTop: 2 }}>
                      {r.kind === 'campaign' ? 'Broadcast' : 'Automated'} · {r.lastSubject}
                    </div>
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap', color: C.textSecondary }}>{ago(r.lastSentAt)}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    {r.sent30} <span style={{ color: C.textMuted }}>({r.sent} all time)</span>
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap', color: r.tracked ? C.textPrimary : C.textMuted }}>{rateText(r, 'open')}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap', fontWeight: r.tracked && r.hasLinks ? 600 : 400, color: r.tracked && r.hasLinks ? C.textPrimary : C.textMuted }}>
                    {rateText(r, 'click')}
                  </td>
                </tr>
              ))}
              {data.emails.length === 0 && (
                <tr><td colSpan={5} style={{ ...cell, color: C.textMuted, textAlign: 'center', padding: 32 }}>No emails recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.emails.some((r) => !r.tracked) && (
        <p style={{ ...warm.text.small, color: C.textMuted, marginTop: 12 }}>
          "Not tracked" means a plain-text email. We count those sends, but there's no way to see opens or clicks without switching them to HTML.
        </p>
      )}
    </AdminShell>
  );
}

const cell = { ...warm.text.small, padding: '10px 14px', verticalAlign: 'top' as const };

function Stat({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div style={{ padding: '14px 16px', border: `1px solid ${strong ? C.accentPetrol : C.borderWhisper}`, borderRadius: 12, minWidth: 0 }}>
      <p style={{ ...warm.text.micro, margin: 0, color: C.textMuted }}>{label}</p>
      <p style={{ ...warm.text.h2, margin: '4px 0 2px', color: strong ? C.accentPetrol : C.textPrimary }}>{value}</p>
      {note && <p style={{ ...warm.text.small, margin: 0, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</p>}
    </div>
  );
}
