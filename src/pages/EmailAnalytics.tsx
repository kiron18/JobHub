import { useQuery } from '@tanstack/react-query';
import { Send, Eye, MousePointer, Users } from 'lucide-react';
import api from '../lib/api';

const warm = {
  surface: '#f8f8f8',
  border: '#eee',
  muted: '#888',
};

export default function EmailAnalytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['email-analytics'],
    queryFn: () => api.get('/admin/email-analytics').then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return <p style={{ padding: 24 }}>Loading analytics...</p>;

  const statCard = (icon: React.ReactNode, label: string, value: number | string, sub?: string) => (
    <div style={{ background: warm.surface, borderRadius: 12, padding: '16px 20px', border: `1px solid ${warm.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 13, color: warm.muted }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: warm.muted }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        Email Analytics
      </h1>

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {statCard(<Users size={18} color={warm.muted} />, 'Total Contacts', data?.totals?.totalContacts ?? 0, `${data?.totals?.optedIn ?? 0} opted in`)}
        {statCard(<Send size={18} color={warm.muted} />, 'Emails Sent', data?.totals?.totalSends ?? 0)}
        {statCard(<Eye size={18} color={warm.muted} />, 'Opens', data?.totals?.totalOpens ?? 0)}
        {statCard(<MousePointer size={18} color={warm.muted} />, 'Clicks', data?.totals?.totalClicks ?? 0)}
      </div>

      {/* Per-sequence */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Sequences</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 32 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Priority</th>
            <th style={{ padding: '8px' }}>Active</th>
            <th style={{ padding: '8px' }}>Enrolled</th>
            <th style={{ padding: '8px' }}>Sends</th>
            <th style={{ padding: '8px' }}>Open Rate</th>
            <th style={{ padding: '8px' }}>Click Rate</th>
          </tr>
        </thead>
        <tbody>
          {data?.sequences?.map((s: any) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>{s.name}</td>
              <td style={{ padding: '8px' }}>{s.priority === 1 ? 'Highest' : s.priority === 4 ? 'Lowest' : s.priority}</td>
              <td style={{ padding: '8px' }}>{s.active}</td>
              <td style={{ padding: '8px' }}>{s.enrollments}</td>
              <td style={{ padding: '8px' }}>{s.sends}</td>
              <td style={{ padding: '8px' }}>{s.openRate}%</td>
              <td style={{ padding: '8px' }}>{s.clickRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Per-broadcast */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Broadcasts</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Name</th>
            <th style={{ padding: '8px' }}>Status</th>
            <th style={{ padding: '8px' }}>Sent</th>
            <th style={{ padding: '8px' }}>Sends</th>
            <th style={{ padding: '8px' }}>Open Rate</th>
            <th style={{ padding: '8px' }}>Click Rate</th>
          </tr>
        </thead>
        <tbody>
          {data?.broadcasts?.map((b: any) => (
            <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>{b.name}</td>
              <td style={{ padding: '8px' }}>{b.status}</td>
              <td style={{ padding: '8px', fontSize: 13 }}>{b.sentAt ? new Date(b.sentAt).toLocaleDateString() : '—'}</td>
              <td style={{ padding: '8px' }}>{b.sends}</td>
              <td style={{ padding: '8px' }}>{b.openRate}%</td>
              <td style={{ padding: '8px' }}>{b.clickRate}%</td>
            </tr>
          ))}
          {(!data?.broadcasts || data.broadcasts.length === 0) && (
            <tr><td colSpan={6} style={{ padding: '16px', color: '#888', textAlign: 'center' }}>No broadcasts</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
