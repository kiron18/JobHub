/**
 * AdminPeople: every lead and client in one list.
 *
 * One row per person, merged on email across the sales leads and the app's
 * accounts (GET /api/admin/people). Status is worked out on the server from
 * billing and trial facts, so it can't drift:
 * Paid, Trial, Signed up, Lapsed, Lead.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { AdminShell, AdminToolLink } from '../components/admin/AdminShell';

const C = warm.colors;

type Status = 'Paid' | 'Trial' | 'Signed up' | 'Lapsed' | 'Lead';
const STATUSES: Status[] = ['Paid', 'Trial', 'Signed up', 'Lapsed', 'Lead'];

interface Person {
  name: string | null;
  email: string | null;
  status: Status;
  stage: string | null;
  source: string;
  joinedAt: string;
  hasResume: boolean;
  hasAccount: boolean;
  trialEndsAt: string | null;
  userId: string | null;
  leadId: string | null;
}

interface PeopleResponse {
  counts: Record<Status, number>;
  people: Person[];
}

const PILL: Record<Status, { bg: string; fg: string; border: string }> = {
  Paid: { bg: C.accentPetrol, fg: '#FFFFFF', border: C.accentPetrol },
  Trial: { bg: C.accentPetrolSoft, fg: C.accentPetrol, border: C.accentPetrolSoft },
  'Signed up': { bg: C.bgAlt, fg: C.textSecondary, border: C.borderWhisper },
  Lapsed: { bg: C.accentGoldSoft, fg: C.accentGold, border: C.accentGoldSoft },
  Lead: { bg: 'transparent', fg: C.textMuted, border: C.borderDefined },
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
}

/** The extra word under a status, when there is one worth reading. */
function statusDetail(p: Person): string | null {
  if (p.status === 'Trial' && p.trialEndsAt) return `ends ${shortDate(p.trialEndsAt)}`;
  if (p.status === 'Lead' && p.stage && p.stage !== 'Lead') return p.stage.toLowerCase();
  if (p.status === 'Paid' && !p.hasAccount) return 'no account yet';
  return null;
}

async function openResume(p: Person) {
  // Opened before the request, not after: a window opened once the await
  // returns is no longer tied to the click and gets popup-blocked.
  const tab = window.open('', '_blank');
  try {
    const r = await api.get('/admin/people/resume', {
      params: { email: p.email ?? undefined, userId: p.userId ?? undefined },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(r.data as Blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch {
    tab?.close();
    alert('No resume on file for this person.');
  }
}

export default function AdminPeople() {
  const [params, setParams] = useSearchParams();
  const status = (STATUSES as string[]).includes(params.get('status') ?? '') ? (params.get('status') as Status) : null;
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-people'],
    queryFn: async () => (await api.get('/admin/people')).data as PeopleResponse,
    staleTime: 60_000,
  });

  const setStatus = (s: Status | null) => {
    const next = new URLSearchParams(params);
    if (s) next.set('status', s); else next.delete('status');
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.people ?? []).filter((p) =>
      (!status || p.status === status) &&
      (!q || (p.name ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)),
    );
  }, [data, status, search]);

  const total = data?.people.length ?? 0;

  return (
    <AdminShell
      title="People"
      subtitle="Every lead and client, one row each, matched on email. Test accounts are left out."
      actions={<>
        <AdminToolLink to="/admin/sales">Sales pipeline</AdminToolLink>
        <AdminToolLink to="/admin/workshop">Workshop</AdminToolLink>
      </>}
    >
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <Chip on={!status} onClick={() => setStatus(null)} label="All" count={total} />
        {STATUSES.map((s) => (
          <Chip key={s} on={status === s} onClick={() => setStatus(s)} label={s} count={data?.counts[s] ?? 0} />
        ))}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', padding: '4px 10px',
          border: `1px solid ${C.borderDefined}`, borderRadius: 8, background: C.bgSurface, minWidth: 0, flex: '0 1 240px',
        }}>
          <Search size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
            aria-label="Search people"
            // 16px: under that, iOS Safari zooms the page on focus.
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 16, color: C.textPrimary, width: '100%', minWidth: 0, padding: '2px 0' }}
          />
        </div>
      </div>

      {error && <p style={{ ...warm.text.body, color: C.danger }}>Could not load people.</p>}
      {isLoading && <p style={{ ...warm.text.body, color: C.textMuted }}>Loading…</p>}

      {data && (
        <div style={{ border: `1px solid ${C.borderWhisper}`, borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: C.bgAlt, textAlign: 'left' }}>
                {/* Status beside the name, so it is on screen on a phone
                    without swiping the table sideways. */}
                {['Name', 'Status', 'Email', 'Resume', 'Joined'].map((h) => (
                  <th key={h} style={{ ...warm.text.micro, color: C.textMuted, padding: '10px 14px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const detail = statusDetail(p);
                const pill = PILL[p.status];
                return (
                  <tr key={p.userId ?? p.leadId ?? p.email} style={{ borderTop: `1px solid ${C.borderWhisper}` }}>
                    <td style={cell}><span style={{ fontWeight: 600 }}>{p.name || '–'}</span></td>
                    <td style={cell}>
                      <span style={{
                        ...warm.text.small, fontWeight: 600, padding: '2px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                        background: pill.bg, color: pill.fg, border: `1px solid ${pill.border}`,
                      }}>
                        {p.status}
                      </span>
                      {detail && <div style={{ ...warm.text.small, color: C.textMuted, marginTop: 4, whiteSpace: 'nowrap' }}>{detail}</div>}
                    </td>
                    <td style={{ ...cell, color: C.textSecondary, wordBreak: 'break-all' }}>{p.email || '–'}</td>
                    <td style={cell}>
                      {p.hasResume ? (
                        <button
                          onClick={() => openResume(p)}
                          style={{ ...warm.text.small, background: 'none', border: 'none', padding: 0, color: C.accentPetrol, fontWeight: 600, cursor: 'pointer' }}
                        >
                          View
                        </button>
                      ) : <span style={{ color: C.textMuted }}>–</span>}
                    </td>
                    <td style={{ ...cell, color: C.textMuted, whiteSpace: 'nowrap' }}>{shortDate(p.joinedAt)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} style={{ ...cell, color: C.textMuted, textAlign: 'center', padding: 32 }}>No one matches.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

const cell = { ...warm.text.small, padding: '10px 14px', verticalAlign: 'middle' as const };

function Chip({ on, onClick, label, count }: { on: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...warm.text.small, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${on ? C.accentPetrol : C.borderDefined}`,
        background: on ? C.accentPetrolSoft : C.bgSurface,
        color: on ? C.accentPetrol : C.textSecondary,
        fontWeight: on ? 600 : 400,
      }}
    >
      {label} <span style={{ color: on ? C.accentPetrol : C.textMuted }}>{count}</span>
    </button>
  );
}
