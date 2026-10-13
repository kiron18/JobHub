/* Who Kiron is speaking to on a given day, on /admin/daily.

   Reads the same payload as the sales board rather than an endpoint of its
   own, so a call booked there is here on the next refetch and the notes are
   the one set of notes, editable in either place.

   Under the day's calls sits the weekly-call list: everyone who has had a
   call, has nothing booked, and has gone a week or more without one. */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Video } from 'lucide-react';
import api from '../../../lib/api';
import { warm } from '../../../lib/theme/warmTokens';
import { timeLabel, type Meeting, type MeetingDot } from './shared';
import JourneyBar from './JourneyBar';
import { buildJourney, daysAgo, type JourneyLead } from './journey';

const C = warm.colors;

interface Lead extends JourneyLead {
  id: string;
  name: string;
  email: string | null;
  stage: string;
  archived: boolean;
  profession: string | null;
  jobTitle: string | null;
  location: string | null;
  visaStatus: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  hasResumeText: boolean;
  meeting: Meeting | null;
}

/** YYYY-MM-DD in Sydney, the same day the rest of the Daily page runs on. */
const sydneyDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date(iso));

const DUE_CAP = 8;

export default function DayCalls({ date, isToday }: { date: string; isToday: boolean }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-sales', '', false],
    queryFn: () => api.get('/admin/sales', { params: { search: '', archived: false } }).then((r) => r.data),
    refetchOnWindowFocus: true,
  });

  const saveNotes = useMutation({
    mutationFn: (v: { id: string; notes: string }) => api.patch(`/admin/sales/${v.id}`, { notes: v.notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sales'] }),
    onError: () => window.alert('That note was not saved. Check your connection and try again.'),
  });

  const leads: Lead[] = data?.leads ?? [];
  const meetings: MeetingDot[] = data?.meetings ?? [];

  const { calls, due } = useMemo(() => {
    const byId = new Map(leads.map((l) => [l.id, l]));
    const byLead = new Map<string, MeetingDot[]>();
    for (const m of meetings) {
      const list = byLead.get(m.leadId);
      if (list) list.push(m); else byLead.set(m.leadId, [m]);
    }
    const journeyOf = (l: Lead) => buildJourney(l, byLead.get(l.id) ?? []);

    const calls = meetings
      .filter((m) => sydneyDay(m.startsAt) === date)
      .flatMap((m) => {
        const lead = byId.get(m.leadId);
        return lead ? [{ m, lead, journey: journeyOf(lead) }] : [];
      });

    const due = leads
      .filter((l) => l.stage !== 'Dead')
      .map((l) => ({ lead: l, journey: journeyOf(l) }))
      .filter((x) => x.journey.callDue)
      // Longest without a call first: they are the ones going cold.
      .sort((a, b) => (a.journey.lastCallAt ?? 0) - (b.journey.lastCallAt ?? 0));

    return { calls, due };
  }, [leads, meetings, date]);

  if (isLoading) return <p style={{ ...warm.text.body, color: C.textMuted, margin: 0 }}>Loading your calls…</p>;
  if (error) return <p style={{ ...warm.text.body, color: C.danger, margin: 0 }}>Could not load the calls. Refresh to try again.</p>;

  return (
    <>
      {calls.length === 0 ? (
        <p style={{ ...warm.text.body, color: C.textMuted, margin: 0 }}>
          {isToday ? 'No calls booked today.' : 'No calls were booked that day.'}{' '}
          <Link to="/admin/sales" style={{ color: C.accentPetrol, fontWeight: 600 }}>Book one on the sales board</Link>
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {calls.map(({ m, lead: l, journey }) => {
            const meetLink = l.meeting?.id === m.id ? l.meeting.meetLink : null;
            const about = [l.profession, l.jobTitle, l.location, l.visaStatus].filter(Boolean).join(' · ');
            return (
              <div key={m.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ ...warm.text.body, fontWeight: 700, color: C.accentPetrol, whiteSpace: 'nowrap' }}>
                    {timeLabel(m.startsAt)}
                  </span>
                  <span style={{ ...warm.text.body, fontSize: 17, fontWeight: 600, minWidth: 0 }}>{l.name}</span>
                  <span style={{ ...warm.text.small, color: C.textMuted }}>{l.stage} · {m.minutes} min</span>
                </div>
                {about && <div style={{ ...warm.text.small, color: C.textSecondary, marginTop: 2 }}>{about}</div>}

                <div style={{ marginTop: 12 }}>
                  <JourneyBar journey={journey} />
                </div>

                <textarea
                  key={`${l.id}:${l.notes ?? ''}`}
                  defaultValue={l.notes ?? ''}
                  onBlur={(e) => {
                    if (e.target.value !== (l.notes ?? '')) saveNotes.mutate({ id: l.id, notes: e.target.value });
                  }}
                  placeholder="Notes on them. Saves when you click away."
                  rows={3}
                  style={{
                    ...warm.text.small, width: '100%', boxSizing: 'border-box', marginTop: 12, padding: 10,
                    borderRadius: warm.radius.input, border: `1px solid ${C.borderDefined}`,
                    color: C.textPrimary, resize: 'vertical', fontFamily: 'inherit',
                  }}
                />

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
                  {meetLink && (
                    <a href={meetLink} target="_blank" rel="noopener noreferrer" style={link}><Video size={14} /> Join the call</a>
                  )}
                  {l.hasResumeText && (
                    <a href={`/api/admin/sales/${l.id}/resume`} style={link}><FileText size={14} /> Resume</a>
                  )}
                  {l.linkedinUrl && (
                    <a href={l.linkedinUrl} target="_blank" rel="noopener noreferrer" style={link}><ExternalLink size={14} /> LinkedIn</a>
                  )}
                  <Link to={`/admin/sales?lead=${l.id}`} style={link}>Open on the board</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isToday && due.length > 0 && (
        <>
          <h2 style={{ ...warm.text.body, fontWeight: 700, margin: '28px 0 4px' }}>
            Due a weekly call <span style={{ color: C.textMuted, fontWeight: 400 }}>{due.length}</span>
          </h2>
          <p style={{ ...warm.text.small, color: C.textMuted, margin: '0 0 10px' }}>
            Had a call, nothing booked since, and a week or more has gone by.
          </p>
          <div style={{ display: 'grid', gap: 6 }}>
            {due.slice(0, DUE_CAP).map(({ lead: l, journey }) => (
              <Link
                key={l.id}
                to={`/admin/sales?lead=${l.id}`}
                style={{ ...card, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', textDecoration: 'none', color: C.textPrimary }}
              >
                <span style={{ ...warm.text.body, fontWeight: 600 }}>{l.name}</span>
                <span style={{ ...warm.text.small, color: C.textMuted }}>
                  {l.stage} · last call {daysAgo(journey.lastCallAt!)} · {journey.sinceCall} {journey.sinceCall === 1 ? 'email' : 'emails'} since
                </span>
              </Link>
            ))}
            {due.length > DUE_CAP && (
              <Link to="/admin/sales" style={{ ...warm.text.small, color: C.accentPetrol, fontWeight: 600 }}>
                and {due.length - DUE_CAP} more on the sales board
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}

const card = { border: `1px solid ${C.borderWhisper}`, borderRadius: warm.radius.card, padding: 16, background: C.bgSurface } as const;
const link = {
  ...warm.text.small, display: 'inline-flex', alignItems: 'center', gap: 6,
  color: C.accentPetrol, fontWeight: 600, textDecoration: 'none',
} as const;
