import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface UserUsageRow {
  userId: string; userIds: string[]; accountCount: number;
  name: string | null; email: string | null;
  plan: string; planStatus: string; accessExpiresAt: string | null;
  signedUpAt: string; lastActiveAt: string; firstGeneratedAt: string | null;
  applicationsStarted: number; applicationsSent: number; applicationsApplied: number;
  resumesGenerated: number; coverLettersGenerated: number;
  selectionCriteriaGenerated: number; documentsEdited: number;
}

interface UnidentifiedRow {
  userId: string; name: string | null; plan: string; planStatus: string; signedUpAt: string;
}

interface UsageResponse {
  users: UserUsageRow[];
  unidentified: UnidentifiedRow[];
  totals: {
    paidClients: number;
    resumesGenerated: number;
    coverLettersGenerated: number;
    applicationsSent: number;
  };
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });

export function AdminUserUsage() {
  const { data, isLoading, isError } = useQuery<UsageResponse>({
    queryKey: ['admin-user-usage'],
    queryFn: async () => (await api.get('/admin/funnel/user-usage')).data,
  });

  if (isLoading) return <div style={{ padding: 32 }}>Loading</div>;
  if (isError) return <div style={{ padding: 32 }}>Could not load (admin only).</div>;

  const users = data?.users ?? [];
  const totals = data?.totals;
  const unidentified = data?.unidentified ?? [];

  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#666', borderBottom: '1px solid #ddd', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid #f0f0f0', whiteSpace: 'nowrap' };

  return (
    <div style={{ height: '100dvh', overflowY: 'auto' }}>
      <div style={{ padding: 32, maxWidth: 1280, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Client usage</h1>
        <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>
          Paying clients only. {totals?.paidClients ?? users.length} clients,{' '}
          {totals?.resumesGenerated ?? 0} resumes and {totals?.coverLettersGenerated ?? 0} cover letters
          generated, {totals?.applicationsSent ?? 0} applications sent. One row per generation, so a
          regenerated resume counts again. For weekly evaluation calls.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Client</th>
                <th style={th}>Plan</th>
                <th style={th}>Resumes</th>
                <th style={th}>Cover letters</th>
                <th style={th}>Criteria</th>
                <th style={th}>Apps sent</th>
                <th style={th}>Apps started</th>
                <th style={th}>Edits</th>
                <th style={th}>First gen</th>
                <th style={th}>Last active</th>
                <th style={th}>Signed up</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.userId}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>
                      {u.name || '(no name)'}
                      {u.accountCount > 1 && (
                        <span
                          title={`${u.accountCount} accounts merged: ${u.userIds.join(', ')}`}
                          style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: '#8a5a00', background: '#fff4d6', padding: '1px 6px', borderRadius: 4 }}
                        >
                          {u.accountCount} accounts
                        </span>
                      )}
                    </div>
                    <div style={{ color: '#888', fontSize: 11 }}>{u.email || '(no email)'}</div>
                  </td>
                  <td style={td}>
                    {u.plan}{u.planStatus !== 'active' ? ` (${u.planStatus})` : ''}
                    {u.accessExpiresAt && (
                      <div style={{ color: '#888', fontSize: 11 }}>until {fmt(u.accessExpiresAt)}</div>
                    )}
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>{u.resumesGenerated}</td>
                  <td style={td}>{u.coverLettersGenerated}</td>
                  <td style={td}>{u.selectionCriteriaGenerated}</td>
                  <td style={td}>
                    {u.applicationsSent}
                    {u.applicationsApplied !== u.applicationsSent && (
                      <span style={{ color: '#888', fontSize: 11 }} title="Still sitting in APPLIED; the rest moved on to interview, rejected or offer">
                        {' '}({u.applicationsApplied} open)
                      </span>
                    )}
                  </td>
                  <td style={td}>{u.applicationsStarted}</td>
                  <td style={td}>{u.documentsEdited}</td>
                  <td style={td}>{u.firstGeneratedAt ? fmt(u.firstGeneratedAt) : '-'}</td>
                  <td style={td}>{fmt(u.lastActiveAt)}</td>
                  <td style={td}>{fmt(u.signedUpAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {unidentified.length > 0 && (
          <p style={{ color: '#8a5a00', fontSize: 12, marginTop: 16 }}>
            {unidentified.length} profile{unidentified.length === 1 ? '' : 's'} on a paid plan with no
            email, kept off the roster as test signups:{' '}
            {unidentified.map(u => `${u.name || '(no name)'} (${u.plan}, ${fmt(u.signedUpAt)})`).join(', ')}.
            If one of those is a real client, their email needs fixing on the profile.
          </p>
        )}
      </div>
    </div>
  );
}
