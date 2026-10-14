/**
 * AdminPeople: every lead and client in one list, at /admin/people.
 *
 * Replaces three screens that each showed part of the same people: the sales
 * board, the old People table and the coach roster. One row per person,
 * merged on email on the server (GET /api/admin/people), one pill saying
 * where they stand, and one line saying the thing most worth knowing about
 * them right now. Everything else is on their own page.
 *
 * The pill is worked out, never set by hand here: paying makes someone a
 * Client, a call in the diary makes them Call booked. The only stages a
 * person is moved into by hand are Pitched and Dead, on their page.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { AdminShell } from '../components/admin/AdminShell';
import IntakeBar from '../components/admin/sales/IntakeBar';
import { BUCKETS, type Bucket, daysAgoText, dayOf, personPath, pillClass, timeOf } from '../components/admin/people';

interface Person {
  name: string | null;
  email: string | null;
  bucket: Bucket;
  source: string;
  joinedAt: string;
  hasResume: boolean;
  hasAccount: boolean;
  trialEndsAt: string | null;
  userId: string | null;
  leadId: string | null;
  nextCallAt: string | null;
  lastActiveAt: string | null;
}

interface PeopleResponse {
  buckets: Record<Bucket, number>;
  people: Person[];
  professions: readonly string[];
  calendarConnected: boolean;
}

/** The one thing most worth knowing about this person right now. */
function lineFor(p: Person): string {
  if (p.nextCallAt) return `Call ${dayOf(p.nextCallAt)}, ${timeOf(p.nextCallAt)}.`;
  if (p.bucket === 'Client' || p.bucket === 'Trial') {
    if (!p.hasAccount) return 'Paid, but has not made an account yet.';
    const ago = daysAgoText(p.lastActiveAt);
    const trial = p.trialEndsAt ? ` Trial ends ${dayOf(p.trialEndsAt)}.` : '';
    return (ago ? `Last active ${ago}.` : 'Has not used the app yet.') + trial;
  }
  const joined = `Joined ${daysAgoText(p.joinedAt)}`;
  const from = p.source && p.source !== 'app' ? ` from ${p.source.replace(/-/g, ' ')}` : '';
  return `${joined}${from}. ${p.hasResume ? 'Resume on file.' : 'No resume yet.'}`;
}

export default function AdminPeople() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const picked = params.get('stage');
  const bucket = (BUCKETS as string[]).includes(picked ?? '') ? (picked as Bucket) : null;
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-people'],
    queryFn: async () => (await api.get('/admin/people')).data as PeopleResponse,
    refetchOnWindowFocus: true,
  });

  const people = data?.people ?? [];
  // Dead is out of "All": the list is the people worth a look, and someone
  // marked dead was marked so they would stop being looked at.
  const alive = useMemo(() => people.filter((p) => p.bucket !== 'Dead'), [people]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = bucket ? people.filter((p) => p.bucket === bucket) : q ? people : alive;
    return q ? pool.filter((p) => `${p.name ?? ''} ${p.email ?? ''}`.toLowerCase().includes(q)) : pool;
  }, [people, alive, bucket, search]);

  const setBucket = (b: Bucket | null) => setParams(b ? { stage: b } : {});

  return (
    <AdminShell
      title="People"
      subtitle="Every lead and client in one list."
      actions={<button className="adm-btn" onClick={() => setAdding((a) => !a)}>{adding ? 'Close' : 'Add a person'}</button>}
    >
      {adding && data && (
        <div className="adm-card adm-pad" style={{ marginBottom: 20 }}>
          <IntakeBar
            professions={data.professions}
            calendarConnected={data.calendarConnected}
            onDone={(leadId) => navigate(personPath({ leadId }))}
          />
        </div>
      )}

      <div className="adm-filters">
        <button className={`adm-chip${!bucket ? ' on' : ''}`} onClick={() => setBucket(null)}>All {alive.length}</button>
        {BUCKETS.filter((b) => (data?.buckets[b] ?? 0) > 0 || b === bucket).map((b) => (
          <button key={b} className={`adm-chip${bucket === b ? ' on' : ''}`} onClick={() => setBucket(b)}>
            {b} {data?.buckets[b] ?? 0}
          </button>
        ))}
        <input
          className="adm-input adm-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          aria-label="Search name or email"
        />
      </div>

      {error && <p className="adm-error">People could not be loaded. Refresh to try again.</p>}

      <div className="adm-card">
        {isLoading && <div className="adm-empty">Loading…</div>}
        {!isLoading && shown.length === 0 && <div className="adm-empty">Nobody matches that.</div>}
        {shown.map((p) => (
          <Link key={p.userId ?? p.leadId ?? p.email} to={personPath(p)} className="adm-row">
            <div className="adm-grow">
              <div className="adm-name">{p.name || p.email || 'No name yet'}</div>
              <div className="adm-meta">{lineFor(p)}</div>
            </div>
            <span className={pillClass(p.bucket)}>{p.bucket}</span>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
