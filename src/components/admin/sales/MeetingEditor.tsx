/* Set, move or cancel a call with one person. Lives in a row's drawer, so a
   contact added without a meeting time can be given one later, and a time that
   was given can be changed. */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarX, Check, Copy, Loader2 } from 'lucide-react';
import api from '../../../lib/api';
import {
  C, DURATIONS, buttonStyle, errorText, inputStyle, isFinished, meetingLabel, nextReminder, primaryButtonStyle,
  sectionLabel, toLocalInput, type Meeting,
} from './shared';

export default function MeetingEditor({
  leadId,
  name,
  hasEmail,
  meeting,
  calendarConnected,
}: {
  leadId: string;
  name: string;
  hasEmail: boolean;
  meeting: Meeting | null;
  calendarConnected: boolean;
}) {
  const qc = useQueryClient();
  // A call that has already happened is history: the inputs start empty so the
  // next thing typed books the next call rather than appearing to edit the last.
  const upcoming = meeting && !isFinished(meeting) ? meeting : null;

  const [when, setWhen] = useState(upcoming ? toLocalInput(upcoming.startsAt) : '');
  const [minutes, setMinutes] = useState(upcoming?.minutes ?? 30);
  const [notify, setNotify] = useState(upcoming?.notify ?? true);
  const [copied, setCopied] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api.put(`/admin/sales/${leadId}/meeting`, { startsAt: new Date(when).toISOString(), minutes, notify }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sales'] }),
    onError: (err) => window.alert(errorText(err, 'The meeting was not saved. Try again.')),
  });

  /** The meeting exactly as it is saved, written to the calendar again. Not
   *  `save`, which would also apply whatever is half-typed in the boxes. */
  const resend = useMutation({
    mutationFn: () =>
      api.put(`/admin/sales/${leadId}/meeting`, { startsAt: upcoming!.startsAt, minutes: upcoming!.minutes, notify: upcoming!.notify }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sales'] }),
    onError: (err) => window.alert(errorText(err, 'The invite was not sent. Try again.')),
  });

  const cancel = useMutation({
    mutationFn: () => api.delete(`/admin/sales/${leadId}/meeting`),
    onSuccess: () => {
      setWhen('');
      qc.invalidateQueries({ queryKey: ['admin-sales'] });
    },
    onError: (err) => window.alert(errorText(err, 'The meeting was not cancelled. Try again.')),
  });

  const unchanged = !!upcoming
    && when === toLocalInput(upcoming.startsAt)
    && minutes === upcoming.minutes
    && notify === upcoming.notify;
  const busy = save.isPending || cancel.isPending;

  return (
    <div>
      <p style={sectionLabel}>Meeting</p>

      {upcoming ? (
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            {meetingLabel(upcoming.startsAt)}
            <span style={{ fontWeight: 500, color: C.ink3 }}> · {upcoming.minutes} min</span>
          </p>

          {upcoming.calendarError ? (
            /* Loud, because a meeting that looks booked and is not on the
               calendar is the one that gets missed. */
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.danger, lineHeight: 1.5, display: 'flex', gap: 6 }}>
              <CalendarX size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
              <span>
                Not on your calendar. {upcoming.calendarError}{' '}
                <button
                  onClick={() => save.mutate()}
                  disabled={busy}
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: C.blue, fontWeight: 600, fontSize: 12.5 }}
                >
                  Try again
                </button>
              </span>
            </p>
          ) : (
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.ink2, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', color: C.good, fontWeight: 600 }}>
                <CalendarCheck size={14} />
                {upcoming.calendarLink
                  ? <a href={upcoming.calendarLink} target="_blank" rel="noopener noreferrer" style={{ color: C.good }}>On your calendar</a>
                  : 'On your calendar'}
              </span>
              {upcoming.meetLink && (
                <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                  <a href={upcoming.meetLink} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontWeight: 600 }}>
                    {upcoming.meetLink.replace(/^https?:\/\//, '')}
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(upcoming.meetLink!).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1600);
                      });
                    }}
                    title="Copy the Meet link"
                    style={{ display: 'inline-flex', padding: 3, border: 'none', background: 'transparent', cursor: 'pointer', color: copied ? C.good : C.ink3 }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </span>
              )}
            </p>
          )}

          <p style={{ margin: '6px 0 0', fontSize: 12.5, color: C.ink2, lineHeight: 1.5 }}>
            {nextReminder(upcoming, hasEmail)}
            {/* For the invite that never arrived. Writes the same meeting to
                the calendar again, which invites anyone not yet on it. */}
            {hasEmail && upcoming.notify && !upcoming.calendarError && (
              <>
                {' '}
                <button
                  onClick={() => resend.mutate()}
                  disabled={busy || resend.isPending}
                  title="Writes this meeting to the calendar again. Google emails the invite to them if they are not on it yet."
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: C.blue, fontWeight: 600, fontSize: 12.5 }}
                >
                  {resend.isPending ? 'Sending…' : resend.isSuccess ? 'Invite sent' : 'Send the invite again'}
                </button>
              </>
            )}
          </p>
        </div>
      ) : (
        <p style={{ margin: '0 0 10px', fontSize: 13, color: C.ink3 }}>
          {meeting ? `Last call was ${meetingLabel(meeting.startsAt)}. Nothing booked since.` : 'Nothing booked yet.'}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          aria-label={`Meeting time with ${name}`}
          style={{ ...inputStyle, width: 'auto', flex: '1 1 180px' }}
        />
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          aria-label="Length"
          style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
        >
          {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
        </select>
      </div>

      <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', margin: '9px 0 0', fontSize: 12.5, color: C.ink2, cursor: 'pointer', lineHeight: 1.45 }}>
        <input
          type="checkbox"
          checked={notify && hasEmail}
          disabled={!hasEmail}
          onChange={(e) => setNotify(e.target.checked)}
          style={{ marginTop: 2, accentColor: C.blue }}
        />
        {hasEmail
          ? 'Send them the invite, and a reminder the day before and an hour before'
          : 'No email on file, so they cannot be sent an invite or reminders'}
      </label>

      {!calendarConnected && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: C.danger, lineHeight: 1.5 }}>
          Google Calendar is not connected. The meeting will be saved here and reminders will still go, but no calendar entry or Meet link is made.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 11 }}>
        <button
          onClick={() => save.mutate()}
          disabled={!when || unchanged || busy}
          style={{ ...primaryButtonStyle, opacity: !when || unchanged || busy ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer' }}
        >
          {save.isPending && <Loader2 size={13} className="animate-spin" />}
          {upcoming ? 'Save change' : 'Book meeting'}
        </button>
        {upcoming && (
          <button
            onClick={() => {
              const note = upcoming.notify && hasEmail ? ' They will be told it is cancelled.' : '';
              if (window.confirm(`Cancel the call with ${name} on ${meetingLabel(upcoming.startsAt)}?${note}`)) cancel.mutate();
            }}
            disabled={busy}
            style={{ ...buttonStyle, color: C.danger }}
          >
            {cancel.isPending && <Loader2 size={13} className="animate-spin" />}
            Cancel meeting
          </button>
        )}
      </div>
    </div>
  );
}
