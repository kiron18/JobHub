import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface UserUsageRow {
  userId: string; name: string | null; email: string | null;
  plan: string; planStatus: string; trialDay: number | null;
  signedUpAt: string; lastActiveAt: string;
  applicationsStarted: number; applicationsSent: number;
  resumesGenerated: number; coverLettersGenerated: number; documentsEdited: number;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });

export function AdminUserUsage() {
  const { data, isLoading, isError } = useQuery<{ users: UserUsageRow[] }>({
    queryKey: ['admin-user-usage'],
    queryFn: async () => (await api.get('/admin/funnel/user-usage')).data,
  });

  if (isLoading) return <div style={{ padding: 32 }}>Loading</div>;
  if (isError) return <div style={{ padding: 32 }}>Could not load (admin only).</div>;

  const users = data?.users ?? [];
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#666', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>User usage</h1>
      <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>{users.length} users. For weekly evaluation calls.</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>User</th>
              <th style={th}>Plan</th>
              <th style={th}>Trial day</th>
              <th style={th}>Apps sent</th>
              <th style={th}>Apps started</th>
              <th style={th}>Resumes</th>
              <th style={th}>Cover letters</th>
              <th style={th}>Edits</th>
              <th style={th}>Last active</th>
              <th style={th}>Signed up</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.userId}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{u.name || '(no name)'}</div>
                  <div style={{ color: '#888', fontSize: 11 }}>{u.email}</div>
                </td>
                <td style={td}>{u.plan}{u.planStatus !== 'active' ? ` (${u.planStatus})` : ''}</td>
                <td style={td}>{u.trialDay ? `${u.trialDay} of 7` : '-'}</td>
                <td style={{ ...td, fontWeight: 700 }}>{u.applicationsSent}</td>
                <td style={td}>{u.applicationsStarted}</td>
                <td style={td}>{u.resumesGenerated}</td>
                <td style={td}>{u.coverLettersGenerated}</td>
                <td style={td}>{u.documentsEdited}</td>
                <td style={td}>{fmt(u.lastActiveAt)}</td>
                <td style={td}>{fmt(u.signedUpAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
