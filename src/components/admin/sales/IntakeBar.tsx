/* The upload at the top of the sales board.

   A resume goes in, the server reads the contact details off it and creates
   the person, and what comes back is a card that asks the one question the
   document could not answer: when are you meeting them.

   ⚠️ THE CONTACT ALREADY EXISTS BY THE TIME THE CARD APPEARS. The card is not a
   form that creates someone on save; it is a chance to correct what was read
   and to add a time. That is why "Skip for now" is safe and loses nothing: the
   meeting time is often not known yet, and it can be added from the person's
   row whenever it is. */
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, X } from 'lucide-react';
import api from '../../../lib/api';
import ContactFieldGrid from './ContactFieldGrid';
import {
  C, CONTACT_FIELDS, DURATIONS, buttonStyle, contactValuesOf, errorText, inputStyle, meetingLabel,
  primaryButtonStyle, sectionLabel, toLocalInput, type ContactField, type ContactValues,
} from './shared';

interface IntakeResult {
  lead: { id: string } & Partial<Record<ContactField, string | null>>;
  /** True when the email was already on the board and that person was updated. */
  existing: boolean;
  /** False when the model could not read the document. */
  parsed: boolean;
  chars: number;
  resumeSaved: boolean;
  filename: string;
  meeting: { startsAt: string; minutes: number; notify: boolean } | null;
}

interface Card {
  result: IntakeResult;
  /** Kept so the file can be filed once an email is typed in, for a resume
   *  that did not have one. */
  file: File;
  original: ContactValues;
}

export default function IntakeBar({
  professions,
  calendarConnected,
  onDone,
}: {
  professions: readonly string[];
  calendarConnected: boolean;
  /** Told which person was just handled, so the board can open their row. */
  onDone: (leadId: string) => void;
}) {
  const qc = useQueryClient();
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [values, setValues] = useState<ContactValues>(contactValuesOf({}));
  const [when, setWhen] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [notify, setNotify] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('resume', file);
      const r = await api.post('/admin/sales/intake', fd);
      return { result: r.data as IntakeResult, file };
    },
    onSuccess: ({ result, file }) => {
      const original = contactValuesOf(result.lead);
      setCard({ result, file, original });
      setValues(original);
      setWhen(result.meeting ? toLocalInput(result.meeting.startsAt) : '');
      setMinutes(result.meeting?.minutes ?? 30);
      setNotify(result.meeting?.notify ?? true);
      setSaveError(null);
      // The person is on the board already, whatever happens to the card.
      qc.invalidateQueries({ queryKey: ['admin-sales'] });
    },
    onError: (err) => window.alert(errorText(err, 'The upload failed. Try again.')),
  });

  /**
   * In order, and stopping at the first failure: the details first, because a
   * corrected email is what the resume and the invite both hang off, then the
   * file, then the meeting. The card stays open on an error so nothing typed
   * is lost.
   */
  const save = useMutation({
    mutationFn: async () => {
      if (!card) return;
      const id = card.result.lead.id;

      const changed: Partial<ContactValues> = {};
      for (const [field] of CONTACT_FIELDS) {
        if (values[field].trim() !== card.original[field].trim()) changed[field] = values[field].trim();
      }
      if (Object.keys(changed).length) await api.patch(`/admin/sales/${id}`, changed);

      if (!card.result.resumeSaved && values.email.trim()) {
        const fd = new FormData();
        fd.append('resume', card.file);
        await api.post(`/admin/sales/${id}/resume`, fd);
      }

      if (when) {
        await api.put(`/admin/sales/${id}/meeting`, { startsAt: new Date(when).toISOString(), minutes, notify });
      }
    },
    onSuccess: () => {
      const id = card?.result.lead.id;
      qc.invalidateQueries({ queryKey: ['admin-sales'] });
      setCard(null);
      if (id) onDone(id);
    },
    onError: (err) => {
      qc.invalidateQueries({ queryKey: ['admin-sales'] });
      setSaveError(errorText(err, 'That did not save. Try again.'));
    },
  });

  const take = (file: File | undefined | null) => {
    if (file && !upload.isPending) upload.mutate(file);
  };

  if (card) {
    const { result } = card;
    const hasEmail = !!values.email.trim();
    const warnings: string[] = [];
    if (!result.chars) {
      warnings.push('No text came out of this file. It is almost certainly a scan or an image, so the details below need typing in.');
    } else if (!result.parsed) {
      warnings.push('The resume could not be read properly this time. The email and phone are a best guess. Check everything.');
    }
    if (!result.resumeSaved) {
      warnings.push('No email was found, and the resume is filed against the email. Type one in and the file will be saved with it.');
    }

    return (
      <div style={{ border: `1.5px solid ${C.blue}`, borderRadius: 12, padding: '16px 18px 18px', marginBottom: 18, background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {result.existing ? `${values.name || 'This person'} was already on the board` : `${values.name || 'New contact'} added`}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: C.ink3, wordBreak: 'break-all' }}>
              {result.existing
                ? `Blank details were filled in from ${result.filename}. Nothing already there was overwritten.`
                : `Read from ${result.filename}. Fix anything that came out wrong.`}
            </p>
          </div>
          <button
            onClick={() => { setCard(null); onDone(result.lead.id); }}
            title="Close. The contact is already saved."
            style={{ display: 'inline-flex', padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: C.ink3 }}
          >
            <X size={17} />
          </button>
        </div>

        {warnings.map((w) => (
          <p key={w} style={{ margin: '0 0 10px', fontSize: 12.5, color: C.danger, lineHeight: 1.5 }}>{w}</p>
        ))}

        <ContactFieldGrid
          values={values}
          professions={professions}
          onChange={(field, value) => setValues((v) => ({ ...v, [field]: value }))}
        />

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <p style={sectionLabel}>When are you meeting?</p>
          {result.meeting && (
            <p style={{ margin: '0 0 8px', fontSize: 12.5, color: C.ink2 }}>
              Already booked for {meetingLabel(result.meeting.startsAt)}. Change it here to move it.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label="Meeting day and time"
              style={{ ...inputStyle, width: 'auto', flex: '0 1 230px' }}
            />
            <select
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              aria-label="Length"
              style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
            >
              {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
            <span style={{ fontSize: 12.5, color: C.ink3 }}>
              Leave it blank if you do not have a time yet. You can add it from their row later.
            </span>
          </div>

          {when && (
            <label style={{ display: 'flex', gap: 7, alignItems: 'flex-start', margin: '10px 0 0', fontSize: 12.5, color: C.ink2, cursor: 'pointer', lineHeight: 1.45 }}>
              <input
                type="checkbox"
                checked={notify && hasEmail}
                disabled={!hasEmail}
                onChange={(e) => setNotify(e.target.checked)}
                style={{ marginTop: 2, accentColor: C.blue }}
              />
              {hasEmail
                ? `Send ${values.email.trim()} the invite, and a reminder the day before and an hour before`
                : 'No email, so they cannot be sent an invite or reminders'}
            </label>
          )}
          {when && !calendarConnected && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: C.danger, lineHeight: 1.5 }}>
              Google Calendar is not connected. The meeting will be saved here and reminders will still go, but no calendar entry or Meet link is made.
            </p>
          )}
        </div>

        {saveError && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: C.danger, fontWeight: 600 }}>{saveError}</p>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            style={{ ...primaryButtonStyle, padding: '9px 16px', fontSize: 13, cursor: save.isPending ? 'wait' : 'pointer' }}
          >
            {save.isPending && <Loader2 size={14} className="animate-spin" />}
            {when ? 'Save and book the meeting' : 'Save'}
          </button>
          <button
            onClick={() => { setCard(null); onDone(result.lead.id); }}
            disabled={save.isPending}
            style={{ ...buttonStyle, padding: '9px 16px', fontSize: 13 }}
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files?.[0]);
      }}
      onClick={() => !upload.isPending && picker.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.current?.click(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 13, marginBottom: 18,
        padding: '15px 18px', borderRadius: 12, cursor: upload.isPending ? 'wait' : 'pointer',
        border: `1.5px dashed ${dragging ? C.blue : C.lineStrong}`,
        background: dragging ? '#EEF4FA' : C.alt,
      }}
    >
      {upload.isPending
        ? <Loader2 size={20} className="animate-spin" style={{ color: C.blue, flex: '0 0 auto' }} />
        : <Upload size={20} style={{ color: C.blue, flex: '0 0 auto' }} />}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          {upload.isPending ? `Reading ${upload.variables?.name ?? 'the resume'}…` : 'Add a contact from a resume'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.ink3 }}>
          {upload.isPending
            ? 'Pulling out the name, email, phone, location and job title.'
            : 'Drop a PDF or DOCX here, or click to choose one. It reads the name, email, phone, location and job title, then asks when you are meeting.'}
        </p>
      </div>
      <input
        ref={picker}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the same file again still fires a change.
          e.target.value = '';
          take(file);
        }}
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'none' }}
      />
    </div>
  );
}
