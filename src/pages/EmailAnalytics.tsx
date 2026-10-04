/**
 * EmailAnalytics — every email that has actually gone out, one row each.
 *
 * Deliberately flat: one list, one Mail button per row, a popup with exactly
 * what the button promises (subject, recipients, opens, CTR). CTR reads N/A
 * rather than 0% when the email had no links to click — those are different
 * facts and the old version conflated them.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Users, Eye, MousePointer, X } from 'lucide-react';
import api from '../lib/api';

const warm = {
  surface: '#f8f8f8',
  border: '#eee',
  muted: '#888',
  text: '#1a1814',
  accent: '#2d5a6e',
};

interface EmailEntry {
  id: string;
  kind: 'broadcast' | 'template';
  label: string;
  subject: string;
  sentAt: string;
  recipients: number;
  opens: number;
  clicks: number;
  ctr: number | null; // null -> N/A, no links in the body
  hasLinks: boolean;
}

export default function EmailAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['email-analytics'],
    queryFn: () => api.get('/admin/email-analytics').then((r) => r.data),
    refetchInterval: 60_000,
  });
  const [open, setOpen] = useState<EmailEntry | null>(null);

  const emails: EmailEntry[] = data?.emails ?? [];

  if (isLoading) return <p style={{ padding: 24 }}>Loading analytics...</p>;

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Emails</h1>
      <p style={{ fontSize: 13.5, color: warm.muted, margin: '0 0 24px' }}>
        {data?.totals?.totalSends ?? 0} sends total, across {data?.totals?.totalContacts ?? 0} contacts
        ({data?.totals?.optedIn ?? 0} opted in).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {emails.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              background: warm.surface, border: `1px solid ${warm.border}`,
              borderRadius: 12, padding: '14px 16px',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(e)}
              aria-label={`Mail details for ${e.subject}`}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, minWidth: 40, borderRadius: 10, flexShrink: 0,
                background: warm.accent, color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              <Mail size={18} />
            </button>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14.5, color: warm.text }}>{e.subject}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: warm.muted }}>
                {e.sentAt ? new Date(e.sentAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                {' · '}{e.kind === 'broadcast' ? 'Campaign' : 'Automated'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 18, fontSize: 13, color: warm.muted }}>
              <span><strong style={{ color: warm.text }}>{e.recipients}</strong> sent</span>
              <span><strong style={{ color: warm.text }}>{e.opens}</strong> opened</span>
              <span><strong style={{ color: warm.text }}>{e.ctr === null ? 'N/A' : `${e.ctr}%`}</strong> CTR</span>
            </div>
          </div>
        ))}
        {emails.length === 0 && (
          <p style={{ padding: '24px 0', color: warm.muted, textAlign: 'center' }}>No emails sent yet.</p>
        )}
      </div>

      {open && <MailPopup email={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MailPopup({ email, onClose }: { email: EmailEntry; onClose: () => void }) {
  const stat = (icon: React.ReactNode, label: string, value: string) => (
    <div style={{ flex: '1 1 110px', background: warm.surface, borderRadius: 10, padding: '12px 14px', border: `1px solid ${warm.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: warm.muted }}>
        {icon}<span style={{ fontSize: 12 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: warm.text }}>{value}</div>
    </div>
  );

  return (
    <div
      role="dialog" aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,24,20,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, zIndex: 1000,
      }}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
          boxShadow: '0 12px 40px rgba(26,24,20,0.22)', boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: warm.text, lineHeight: 1.35 }}>{email.subject}</p>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: warm.muted, padding: 4, flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {stat(<Users size={13} />, 'Sent to', String(email.recipients))}
          {stat(<Eye size={13} />, 'Opened', String(email.opens))}
          {stat(<MousePointer size={13} />, 'Click-through', email.ctr === null ? 'N/A' : `${email.ctr}%`)}
        </div>

        {!email.hasLinks && (
          <p style={{ margin: '14px 0 0', fontSize: 12.5, color: warm.muted }}>
            N/A — this email had no links to click.
          </p>
        )}
      </div>
    </div>
  );
}
