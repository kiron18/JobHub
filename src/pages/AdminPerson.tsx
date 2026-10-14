/**
 * AdminPerson: one person, at /admin/people/view?lead=…&user=…
 *
 * The page that is open during a call. A lead, a contact and a client used to
 * be three screens for the same human; this is the one, joined on email on
 * the server (GET /api/admin/people/person).
 *
 * Top to bottom it is the order the questions come up on a call: who is this
 * and how do I reach them, are they using the app, what did we say last time,
 * when are we speaking next, and what have they paid.
 *
 * Notes and booked calls hang off the sales lead. Someone who signed up in
 * the app without ever being a lead has no such row, so they are offered
 * "Add to pipeline" first, and nothing is created until that is pressed.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { AdminShell } from '../components/admin/AdminShell';
import ContactFieldGrid from '../components/admin/sales/ContactFieldGrid';
import MeetingEditor from '../components/admin/sales/MeetingEditor';
import {
  contactValuesOf, errorText, isFinished, type ContactField, type ContactValues, type Meeting,
} from '../components/admin/sales/shared';
import { MemberActivity } from '../components/coach/MemberActivity';
import {
  type Bucket, dateOf, daysAgoText, dayOf, money, openPersonResume, pillClass, timeOf, whatsappLink,
} from '../components/admin/people';

interface Lead extends Partial<Record<ContactField, string | null>> {
  id: string;
  name: string;
  email: string | null;
  stage: string;
  source: string;
  archived: boolean;
  notes: string | null;
  nextBest: string | null;
  createdAt: string;
}

interface PersonResponse {
  name: string;
  email: string | null;
  bucket: Bucket;
  lead: Lead | null;
  meeting: Meeting | null;
  meetings: { id: string; startsAt: string; minutes: number }[];
  hasResume: boolean;
  answers: Record<string, unknown> | null;
  questionSchema: { id: string; label: string }[] | null;
  account: {
    userId: string; joinedAt: string; plan: string; planStatus: string; paid: boolean;
    trialEndsAt: string | null; onHold: boolean; phone: string | null;
    location: string | null; targetRole: string | null; visaStatus: string | null;
  } | null;
  activity: {
    applications: number; applicationTarget: number; outreach: number; outreachTarget: number;
    lifetimeApplications: number; lastActiveAt: string | null; daysQuiet: number | null;
  } | null;
  professions: readonly string[];
  calendarConnected: boolean;
}

interface Payment { id: string; paidAt: string; amount: number; refunded: number; description: string | null }

/** The stages a person is moved into by hand. Client is set by a payment. */
const HAND_STAGES = ['Lead', 'Pitched', 'Client', 'Dead'];

export default function AdminPerson() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const leadId = params.get('lead') ?? '';
  const userId = params.get('user') ?? '';

  // Under the 'admin-sales' key on purpose: the meeting editor and the intake
  // bar invalidate that prefix when they save, and this page should refetch
  // when they do.
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-sales', 'person', leadId, userId],
    queryFn: async () => (await api.get('/admin/people/person', { params: { leadId, userId } })).data as PersonResponse,
    enabled: !!(leadId || userId),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-sales'] });
    qc.invalidateQueries({ queryKey: ['admin-people'] });
    qc.invalidateQueries({ queryKey: ['admin-today'] });
  };

  const lead = data?.lead ?? null;
  const account = data?.account ?? null;

  const payments = useQuery({
    queryKey: ['admin-person-payments', data?.email, account?.userId],
    queryFn: async () =>
      (await api.get('/admin/people/person/payments', { params: { email: data?.email ?? undefined, userId: account?.userId } })).data.payments as Payment[],
    enabled: !!data && !!(data.email || account),
    staleTime: 5 * 60_000,
  });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/admin/sales/${lead!.id}`, body),
    onSuccess: refresh,
    onError: (err) => { window.alert(errorText(err, 'That change was not saved.')); refresh(); },
  });

  const addToPipeline = useMutation({
    mutationFn: async () => (await api.post('/admin/people/lead', { userId: account!.userId })).data.lead as Lead,
    onSuccess: (l) => { setParams({ lead: l.id, user: account!.userId }, { replace: true }); refresh(); },
    onError: (err) => window.alert(errorText(err, 'Could not add them to the pipeline.')),
  });

  const remove = useMutation({
    mutationFn: () => api.post('/admin/sales/delete', { ids: [lead!.id] }),
    onSuccess: () => { refresh(); navigate('/admin/people'); },
    onError: (err) => window.alert(`Nothing was deleted. ${errorText(err, 'The server refused it.')}`),
  });

  const [showActivity, setShowActivity] = useState(false);

  if (!leadId && !userId) return <AdminShell title="Person"><p className="adm-error">No person was picked.</p></AdminShell>;
  if (isLoading) return <AdminShell title="Loading…"><span /></AdminShell>;
  if (error || !data) {
    return (
      <AdminShell title="Not found">
        <p className="adm-error">{errorText(error, 'That person could not be loaded.')}</p>
        <Link className="adm-link" to="/admin/people">Back to people</Link>
      </AdminShell>
    );
  }

  const phone = lead?.phone ?? account?.phone ?? null;
  const wa = whatsappLink(phone, data.name);
  const upcoming = data.meeting && !isFinished(data.meeting) ? data.meeting : null;
  const about = [
    lead?.jobTitle ?? lead?.profession ?? account?.targetRole,
    lead?.location ?? account?.location,
    lead?.visaStatus ?? account?.visaStatus,
  ].filter(Boolean).join('. ');
  const a = data.activity;

  return (
    <AdminShell
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {data.name} <span className={pillClass(data.bucket)}>{data.bucket}</span>
      </span>}
      subtitle={about ? `${about}.` : data.email ?? undefined}
      actions={<Link className="adm-link" to="/admin/people">&larr; Back to people</Link>}
    >
      <div className="adm-actions" style={{ marginBottom: 4 }}>
        {upcoming?.meetLink && (
          <a className="adm-btn" href={upcoming.meetLink} target="_blank" rel="noopener noreferrer">
            Join call, {dayOf(upcoming.startsAt)} {timeOf(upcoming.startsAt)}
          </a>
        )}
        {data.hasResume && (
          <button className="adm-btn ghost" onClick={() => openPersonResume({ email: data.email, userId: account?.userId })}>Open resume</button>
        )}
        {wa && <a className="adm-btn ghost" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
        {data.email && <a className="adm-btn ghost" href={`mailto:${data.email}`}>Email</a>}
        {lead?.linkedinUrl && <a className="adm-btn ghost" href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
      </div>

      <h2>This week in the app</h2>
      {a && account ? (
        <>
          <div className="adm-stats">
            <div className="adm-card adm-stat"><b>{a.applications}</b><span>applications (goal {a.applicationTarget})</span></div>
            <div className="adm-card adm-stat"><b>{a.outreach}</b><span>outreach messages (goal {a.outreachTarget})</span></div>
            <div className="adm-card adm-stat"><b>{a.lifetimeApplications}</b><span>applications all time</span></div>
            <div className="adm-card adm-stat">
              <b style={{ textTransform: 'capitalize' }}>{daysAgoText(a.lastActiveAt) ?? 'Never'}</b>
              <span>last active</span>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="adm-link" onClick={() => setShowActivity((s) => !s)}>
              {showActivity ? 'Hide the day by day' : 'Show the day by day'}
            </button>
          </div>
          {showActivity && <div className="adm-card adm-pad" style={{ marginTop: 10, overflowX: 'auto' }}><MemberActivity userId={account.userId} /></div>}
        </>
      ) : (
        <div className="adm-card adm-empty">No app account yet, so there is nothing to show here.</div>
      )}

      {!lead && account && (
        <div className="adm-card adm-pad" style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="adm-grow">
            <div className="adm-name">Not on the pipeline yet</div>
            <div className="adm-meta">They signed up in the app without being a lead first. Add them to keep notes and book calls.</div>
          </div>
          <button className="adm-btn" disabled={addToPipeline.isPending} onClick={() => addToPipeline.mutate()}>Add to pipeline</button>
        </div>
      )}

      <div className="adm-two">
        <div>
          {lead && <>
            <h2>Notes</h2>
            <SavedText key={`notes:${lead.id}`} value={lead.notes ?? ''} rows={5}
              placeholder="What was said, what they want, what to push next."
              onSave={(notes) => patch.mutate({ notes })} />

            <h2>Next step</h2>
            <SavedText key={`next:${lead.id}`} value={lead.nextBest ?? ''} rows={1}
              placeholder="The one thing that moves this person forward."
              onSave={(nextBest) => patch.mutate({ nextBest })} />

            <h2>Calls</h2>
            <div className="adm-card adm-pad">
              {/* Keyed on the meeting itself, so the inputs re-seed when a
                  save or a cancel lands rather than holding what was typed. */}
              <MeetingEditor
                key={`${lead.id}:${data.meeting?.id ?? 'none'}:${data.meeting?.startsAt ?? ''}:${data.meeting?.minutes ?? ''}:${data.meeting?.notify ?? ''}`}
                leadId={lead.id}
                name={lead.name}
                hasEmail={!!lead.email}
                meeting={data.meeting}
                calendarConnected={data.calendarConnected}
              />
            </div>
            {data.meetings.length > 0 && (
              <div className="adm-card" style={{ marginTop: 12 }}>
                {data.meetings.map((m) => (
                  <div key={m.id} className="adm-row">
                    <div className="adm-grow">
                      <div className="adm-name">{dayOf(m.startsAt)}, {timeOf(m.startsAt)}</div>
                      <div className="adm-meta">{isFinished(m) ? `${m.minutes} minutes. Done.` : `${m.minutes} minutes. Coming up.`}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>}

          {data.answers && data.questionSchema && Object.keys(data.answers).length > 0 && <>
            <h2>What they told us</h2>
            <div className="adm-card adm-pad">
              {data.questionSchema.map((q) => {
                const v = data.answers![q.id];
                if (v == null || String(v).trim() === '') return null;
                return (
                  <div key={q.id} style={{ marginBottom: 12 }}>
                    <div className="adm-meta" style={{ marginTop: 0 }}>{q.label}</div>
                    <div>{Array.isArray(v) ? v.join(', ') : String(v)}</div>
                  </div>
                );
              })}
            </div>
          </>}
        </div>

        <div>
          <h2>Details</h2>
          <div className="adm-card adm-pad">
            {lead ? (
              <>
                <label className="adm-meta" style={{ display: 'block', marginTop: 0, marginBottom: 14 }}>
                  Stage
                  <select
                    className="adm-input"
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                    value={lead.stage}
                    onChange={(e) => patch.mutate({ stage: e.target.value })}
                  >
                    {[...new Set([lead.stage, ...HAND_STAGES])].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <LeadContact lead={lead} professions={data.professions} onSave={(body) => patch.mutate(body)} />
              </>
            ) : (
              <div className="adm-kv">
                <span>Email</span><span>{data.email ?? 'None'}</span>
                <span>Phone</span><span>{phone ?? 'None'}</span>
              </div>
            )}
            <div className="adm-kv" style={{ marginTop: 16 }}>
              <span>Source</span><span>{lead?.source?.replace(/-/g, ' ') ?? 'app'}</span>
              <span>First seen</span><span>{dateOf(lead && (!account || lead.createdAt < account.joinedAt) ? lead.createdAt : account!.joinedAt)}</span>
              {account && <><span>Plan</span><span>{account.plan}{account.planStatus && account.planStatus !== 'active' ? `, ${account.planStatus.replace(/_/g, ' ')}` : ''}{account.onHold ? ', on hold' : ''}</span></>}
              {account?.trialEndsAt && <><span>Trial ends</span><span>{dateOf(account.trialEndsAt)}</span></>}
            </div>
          </div>

          <h2>Payments</h2>
          <div className="adm-card">
            {payments.isLoading && <div className="adm-empty">Loading from Stripe…</div>}
            {payments.error && <div className="adm-empty adm-error">Payments could not be loaded from Stripe.</div>}
            {payments.data?.length === 0 && <div className="adm-empty">Nothing paid yet.</div>}
            {payments.data?.map((p) => (
              <div key={p.id} className="adm-row">
                <div className="adm-grow">
                  <div className="adm-name">{money(p.amount)}{p.refunded > 0 ? ` (${money(p.refunded)} refunded)` : ''}</div>
                  <div className="adm-meta">{dateOf(p.paidAt)}{p.description ? `. ${p.description}` : ''}</div>
                </div>
                <span className={`adm-dot ${p.refunded >= p.amount ? 'amber' : 'green'}`} />
              </div>
            ))}
          </div>

          {lead && <>
            <h2>Tidy up</h2>
            <div className="adm-actions">
              <button className="adm-btn ghost" onClick={() => patch.mutate({ archived: !lead.archived })}>
                {lead.archived ? 'Bring back from archive' : 'Archive'}
              </button>
              <button
                className="adm-btn danger"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Delete ${lead.name} for good? This also removes their resume and any upcoming call. Their app account, if they have one, is not touched.`)) remove.mutate();
                }}
              >
                Delete lead
              </button>
            </div>
          </>}
        </div>
      </div>
    </AdminShell>
  );
}

/** A text box that saves when you leave it, and says so. */
function SavedText({ value, rows, placeholder, onSave }: {
  value: string; rows: number; placeholder: string; onSave: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setText(value); }, [value]);
  return (
    <>
      <textarea
        className="adm-input"
        rows={rows}
        value={text}
        placeholder={placeholder}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        onBlur={() => { if (text !== value) { onSave(text); setSaved(true); } }}
      />
      {saved && <div className="adm-meta">Saved.</div>}
    </>
  );
}

/** The contact fields, each one saving as you leave it. Read off a resume by
 *  a model in the first place, so every one of them can be typed over. */
function LeadContact({ lead, professions, onSave }: {
  lead: Lead; professions: readonly string[]; onSave: (body: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<ContactValues>(contactValuesOf(lead));
  useEffect(() => { setValues(contactValuesOf(lead)); }, [lead]);
  const leave = (field: ContactField, value = values[field]) => {
    if (value !== (lead[field] ?? '')) onSave({ [field]: value });
  };
  return (
    <ContactFieldGrid
      values={values}
      professions={professions}
      onChange={(field, value) => {
        setValues((v) => ({ ...v, [field]: value }));
        // A select has no "leaving" worth waiting for: picking is the edit.
        if (field === 'profession') leave(field, value);
      }}
      onLeave={(field) => { if (field !== 'profession') leave(field); }}
    />
  );
}
