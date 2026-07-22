import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Check, Video, UserPlus, X, MessageCircle, Clock, Copy, Send, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import type { OutreachLogEntry } from './types';
import { renderFollowUpNudge } from '../../data/outreachTemplates';

const STATUS_COLORS: Record<OutreachLogEntry['status'], string> = {
  ACTIVE: '#60a5fa',
  REPLIED: '#34d399',
  CALL_BOOKED: '#a78bfa',
  REFERRAL: '#fbbf24',
  CLOSED_NO_REPLY: '#94a3b8',
  CLOSED_MANUAL: '#64748b',
};

const STATUS_LABELS: Record<OutreachLogEntry['status'], string> = {
  ACTIVE: 'Active',
  REPLIED: 'Replied',
  CALL_BOOKED: 'Call Happened',
  REFERRAL: 'Referral',
  CLOSED_NO_REPLY: 'No Reply',
  CLOSED_MANUAL: 'Closed',
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 90, background: warm.colors.bgSurface,
      border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 14,
      padding: '14px 16px', textAlign: 'center',
    }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    </div>
  );
}

function StatsRow({ entries }: { entries: OutreachLogEntry[] }) {
  const active = entries.filter((e) => e.status === 'ACTIVE').length;
  const replied = entries.filter((e) => e.status === 'REPLIED').length;
  const callsHappened = entries.filter((e) => e.status === 'CALL_BOOKED').length;
  const referrals = entries.filter((e) => e.status === 'REFERRAL').length;

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
      <StatCard label="Sent" value={entries.length} color={warm.colors.textPrimary} />
      <StatCard label="Active" value={active} color="#60a5fa" />
      <StatCard label="Replied" value={replied} color="#34d399" />
      <StatCard label="Calls Happened" value={callsHappened} color="#a78bfa" />
      <StatCard label="Referrals" value={referrals} color="#fbbf24" />
    </div>
  );
}

// Users self-select when to send each message, so this just counts what's
// been sent rather than plotting progress against a fixed number of touches.
function MessageCount({ messages }: { messages: Array<{ touchNumber: number }> }) {
  const count = messages.length;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: warm.colors.textSecondary,
        background: warm.colors.bgAlt,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: 20,
        padding: '3px 10px',
      }}
      title="Messages logged for this outreach"
    >
      {count} {count === 1 ? 'message' : 'messages'} sent
    </span>
  );
}

function StatusChip({ status }: { status: OutreachLogEntry['status'] }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '3px 8px',
        borderRadius: 4,
        background: `${STATUS_COLORS[status]}20`,
        color: STATUS_COLORS[status],
        border: `1px solid ${STATUS_COLORS[status]}40`,
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// A saved draft, editable in place, with copy-and-mark-sent. This is where a
// user comes back days later once the person accepts their request.
function DraftRow({
  label,
  value,
  hint,
  sent,
  onSave,
  onSend,
}: {
  label: string;
  value: string;
  hint?: string;
  sent: boolean;
  onSave: (body: string) => void;
  onSend?: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState(value);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleSend() {
    if (!onSend || sending) return;
    setSending(true);
    try {
      await onSend(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: sent ? '#34d399' : '#0A66C2' }}>
          {label}{sent ? ' · sent' : ''}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700,
              padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${copied ? '#34d399' : warm.colors.borderWhisper}`,
              background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
              color: copied ? '#34d399' : warm.colors.textSecondary,
            }}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {onSend && !sent && (
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700,
                padding: '3px 9px', borderRadius: 6, cursor: sending ? 'default' : 'pointer',
                border: '1px solid rgba(10,102,194,0.4)', background: 'rgba(10,102,194,0.1)',
                color: '#60a5fa',
              }}
            >
              {sending ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={10} />}
              Mark sent
            </button>
          )}
        </div>
      </div>
      {hint && (
        <p style={{ margin: '0 0 5px', fontSize: 11, color: warm.colors.textMuted, lineHeight: 1.45 }}>{hint}</p>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => { if (body !== value) onSave(body); }}
        rows={3}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 8,
          padding: '8px 10px', fontSize: 12.5, color: warm.colors.textPrimary,
          resize: 'vertical', lineHeight: 1.55, fontFamily: 'inherit',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// A message already sent that didn't come from a template. Kept read-only —
// rewriting history would make the thread log untrustworthy.
function ReadOnlyMessage({ body, sentAt }: { body: string; sentAt?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#34d399' }}>
          Sent{sentAt ? ` · ${new Date(sentAt).toLocaleDateString()}` : ''}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700,
            padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${copied ? '#34d399' : warm.colors.borderWhisper}`,
            background: copied ? 'rgba(52,211,153,0.1)' : 'transparent',
            color: copied ? '#34d399' : warm.colors.textSecondary,
          }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p style={{
        margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.55,
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: 8, padding: '8px 10px', whiteSpace: 'pre-wrap',
      }}>
        {body}
      </p>
    </div>
  );
}

// Log a message that wasn't generated here — a reply typed straight into
// LinkedIn. Without this the thread log has holes, so coming back to see what
// you last said to someone doesn't work.
function AddMessageRow({ onAdd, personName }: { onAdd: (body: string) => Promise<void>; personName: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd(body.trim());
      setBody('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
          color: warm.colors.textMuted, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
          padding: 0, marginTop: 4,
        }}
      >
        <Plus size={12} />
        Log another message you sent {personName}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Paste what you sent ${personName}…`}
        rows={3}
        autoFocus
        style={{
          width: '100%', background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 8,
          padding: '8px 10px', fontSize: 12.5, color: warm.colors.textPrimary,
          resize: 'vertical', lineHeight: 1.55, fontFamily: 'inherit',
          outline: 'none', boxSizing: 'border-box', marginBottom: 8,
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleAdd}
          disabled={!body.trim() || saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
            padding: '5px 12px', borderRadius: 6,
            border: '1px solid rgba(10,102,194,0.4)',
            background: body.trim() ? 'rgba(10,102,194,0.12)' : 'transparent',
            color: '#60a5fa', cursor: !body.trim() || saving ? 'default' : 'pointer',
          }}
        >
          {saving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={11} />}
          Save to thread
        </button>
        <button
          onClick={() => { setOpen(false); setBody(''); }}
          style={{
            fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 6,
            border: `1px solid ${warm.colors.borderWhisper}`, background: 'transparent',
            color: warm.colors.textMuted, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  onUpdate,
  onRefresh,
}: {
  entry: OutreachLogEntry;
  onUpdate: (entry: OutreachLogEntry) => void;
  onRefresh: () => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);

  async function handleStatusChange(newStatus: OutreachLogEntry['status']) {
    setUpdating(newStatus);
    try {
      await api.post(`/linkedin/outreach/${entry.id}/status`, { status: newStatus });
      onUpdate({ ...entry, status: newStatus });
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch {
      toast.error('Could not update status');
    } finally {
      setUpdating(null);
    }
  }

  const messages = entry.messages ?? entry.ladder?.touches ?? [];
  const displayStatus = entry.ladder?.canAutoClose ? 'CLOSED_NO_REPLY' : entry.status;

  // A draft counts as sent once a message with that body is on the ladder.
  const sentBodies = new Set(messages.map((m: any) => (m.body ?? '').trim()).filter(Boolean));
  const nextTouchNumber = messages.length
    ? Math.max(...messages.map((m) => m.touchNumber)) + 1
    : 1;

  async function saveDraft(field: string, body: string) {
    try {
      await api.patch(`/linkedin/outreach/${entry.id}/drafts`, { [field]: body });
      onUpdate({ ...entry, [field]: body } as OutreachLogEntry);
    } catch {
      toast.error('Could not save that edit');
    }
  }

  async function markSent(body: string) {
    try {
      await api.post(`/linkedin/outreach/${entry.id}/copy`, { touchNumber: nextTouchNumber, body });
      toast.success('Logged as sent');
      onRefresh();
    } catch {
      toast.error('Could not log that message');
    }
  }

  const drafts = [
    { field: 'connectionNote', label: 'Connection request note', value: entry.connectionNote, hint: undefined },
    { field: 'firstMessage', label: 'First message after connecting', value: entry.firstMessage, hint: 'Send this once they accept your request.' },
    { field: 'followUpDraft', label: 'After-conversation follow-up', value: entry.followUpDraft, hint: 'Send within 24 hours of any real exchange.' },
    { field: 'directAskDraft', label: 'Ask for a call', value: entry.directAskDraft, hint: 'Send whenever the conversation has earned it.' },
  ].filter((d) => (d.value ?? '').trim().length > 0);

  // Messages already sent that didn't come from one of the four templates —
  // ad-hoc replies logged by hand. Shown so the thread with this person is
  // complete and copy-pasteable when they write back.
  const draftBodies = new Set(drafts.map((d) => d.value.trim()));
  const adHocSent = messages.filter((m: any) => (m.body ?? '').trim() && !draftBodies.has((m.body ?? '').trim()));

  // Determine which buttons to show based on current status
  const showRepliedButton = entry.status === 'ACTIVE';
  const showOutcomeButtons = entry.status === 'REPLIED';
  const showCloseButton = entry.status !== 'CLOSED_NO_REPLY' && entry.status !== 'CLOSED_MANUAL';

  return (
    <div
      style={{
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: warm.colors.textPrimary }}>
            {entry.personName}
          </span>
          <span style={{ fontSize: 13, color: warm.colors.textSecondary }}>· {entry.company}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageCount messages={messages} />
          <StatusChip status={displayStatus} />
        </div>
      </div>

      {entry.topic && (
        <div style={{ marginBottom: 10 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: warm.colors.textMuted,
            }}
          >
            Topic
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.5 }}>
            {entry.topic}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {showRepliedButton && (
          <button
            onClick={() => handleStatusChange('REPLIED')}
            disabled={!!updating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              border: '1px solid rgba(52,211,153,0.4)',
              background: updating === 'REPLIED' ? 'rgba(52,211,153,0.2)' : 'rgba(52,211,153,0.1)',
              color: '#34d399',
              cursor: updating ? 'default' : 'pointer',
            }}
          >
            {updating === 'REPLIED' ? (
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <MessageCircle size={12} />
            )}
            They Replied
          </button>
        )}

        {showOutcomeButtons && (
          <>
            <button
              onClick={() => handleStatusChange('CALL_BOOKED')}
              disabled={!!updating}
              title="Zoom or Google Meet — mark this once the call has actually happened"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                border: '1px solid rgba(167,139,250,0.4)',
                background: updating === 'CALL_BOOKED' ? 'rgba(167,139,250,0.2)' : 'rgba(167,139,250,0.1)',
                color: '#a78bfa',
                cursor: updating ? 'default' : 'pointer',
              }}
            >
              {updating === 'CALL_BOOKED' ? (
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Video size={12} />
              )}
              Call Happened
            </button>

            <button
              onClick={() => handleStatusChange('REFERRAL')}
              disabled={!!updating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                border: '1px solid rgba(251,191,36,0.4)',
                background: updating === 'REFERRAL' ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.1)',
                color: '#fbbf24',
                cursor: updating ? 'default' : 'pointer',
              }}
            >
              {updating === 'REFERRAL' ? (
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <UserPlus size={12} />
              )}
              Referral
            </button>
          </>
        )}

        {showCloseButton && (
          <button
            onClick={() => handleStatusChange('CLOSED_MANUAL')}
            disabled={!!updating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              border: `1px solid ${warm.colors.borderWhisper}`,
              background: 'transparent',
              color: warm.colors.textMuted,
              cursor: updating ? 'default' : 'pointer',
              marginLeft: 'auto',
            }}
          >
            {updating === 'CLOSED_MANUAL' ? (
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <X size={12} />
            )}
            Close
          </button>
        )}
      </div>

      {/* Saved drafts — the reason an outreach can be logged before the person
          accepts. Everything written for them stays retrievable here. */}
      {(drafts.length > 0 || adHocSent.length > 0) && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${warm.colors.borderWhisper}`, paddingTop: 12 }}>
          <button
            onClick={() => setShowDrafts((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
              color: warm.colors.textSecondary, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: 0,
            }}
          >
            {showDrafts ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showDrafts ? 'Hide' : 'Show'} messages for {entry.personName} ({drafts.length + adHocSent.length})
          </button>
          {showDrafts && (
            <div style={{ marginTop: 12 }}>
              {drafts.map((d) => (
                <DraftRow
                  key={d.field}
                  label={d.label}
                  value={d.value}
                  hint={d.hint}
                  sent={sentBodies.has((d.value ?? '').trim())}
                  onSave={(body) => saveDraft(d.field, body)}
                  onSend={d.field === 'connectionNote' ? undefined : markSent}
                />
              ))}

              {adHocSent.map((m: any, i: number) => (
                <ReadOnlyMessage key={`adhoc-${i}`} body={m.body} sentAt={m.copiedAt} />
              ))}

              <AddMessageRow onAdd={markSent} personName={entry.personName} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Follow-up due card with editable template
function FollowUpDueCard({
  due,
  onCopied,
}: {
  due: {
    id: string;
    personName: string;
    company: string;
    topic: string;
    specificQuestion: string;
    nextTouchNumber: number;
    daysSinceLastTouch: number;
  };
  onCopied: () => void;
}) {
  const [message, setMessage] = useState(() =>
    renderFollowUpNudge({
      firstName: due.personName.split(' ')[0],
      company: due.company,
      topic: due.topic,
    })
  );
  const [copying, setCopying] = useState(false);

  async function handleCopy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(message);
      await api.post(`/linkedin/outreach/${due.id}/copy`, {
        touchNumber: due.nextTouchNumber,
        body: message,
      });
      toast.success('Copied and logged');
      onCopied();
    } catch {
      toast.error('Could not log copy');
    } finally {
      setCopying(false);
    }
  }

  return (
    <div
      style={{
        background: 'rgba(251,191,36,0.05)',
        border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: warm.colors.textPrimary }}>
            {due.personName}
          </span>
          <span style={{ fontSize: 13, color: warm.colors.textSecondary }}> · {due.company}</span>
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
            <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
            No reply in {due.daysSinceLastTouch} days · here's a nudge to send
          </div>
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${warm.colors.borderWhisper}`,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 13,
          color: warm.colors.textPrimary,
          resize: 'vertical',
          lineHeight: 1.6,
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: 12,
        }}
      />

      <button
        onClick={handleCopy}
        disabled={copying}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          border: '1px solid rgba(251,191,36,0.4)',
          background: copying ? 'rgba(251,191,36,0.15)' : '#f59e0b',
          color: copying ? '#f59e0b' : 'white',
          cursor: copying ? 'default' : 'pointer',
        }}
      >
        {copying ? (
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Check size={13} />
        )}
        Copy & Log
      </button>
    </div>
  );
}

export const OutreachTracker: React.FC = () => {
  const [entries, setEntries] = useState<OutreachLogEntry[]>([]);
  const [dueEntries, setDueEntries] = useState<Array<{
    id: string;
    personName: string;
    company: string;
    topic: string;
    specificQuestion: string;
    nextTouchNumber: number;
    daysSinceLastTouch: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [dueLoading, setDueLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'due'>('due');

  useEffect(() => {
    loadData();
    loadDue();
  }, []);

  async function loadData() {
    try {
      const { data } = await api.get('/linkedin/outreach');
      setEntries(data.entries || []);
    } catch {
      toast.error('Could not load your outreach tracker.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDue() {
    try {
      const { data } = await api.get('/linkedin/outreach/due');
      setDueEntries(data.due || []);
    } catch {
      console.error('Could not load due follow-ups');
    } finally {
      setDueLoading(false);
    }
  }

  function handleEntrySaved(updated: OutreachLogEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  function handleDueCopied() {
    // Refresh both lists after a copy
    loadData();
    loadDue();
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: warm.colors.textSecondary,
          fontSize: 13,
          padding: '24px 0',
        }}
      >
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
        Loading your tracker…
      </div>
    );
  }

  return (
    <div>
      {entries.length > 0 && <StatsRow entries={entries} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('due')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 700,
            background: activeTab === 'due' ? '#f59e0b' : warm.colors.bgAlt,
            color: activeTab === 'due' ? 'white' : warm.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          Follow-ups Due
          {dueEntries.length > 0 && (
            <span
              style={{
                marginLeft: 6,
                padding: '2px 6px',
                borderRadius: 10,
                fontSize: 10,
                background: activeTab === 'due' ? 'rgba(255,255,255,0.2)' : '#f59e0b',
                color: activeTab === 'due' ? 'white' : 'white',
              }}
            >
              {dueEntries.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 700,
            background: activeTab === 'all' ? '#0A66C2' : warm.colors.bgAlt,
            color: activeTab === 'all' ? 'white' : warm.colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          All Outreach
          <span
            style={{
              marginLeft: 6,
              padding: '2px 6px',
              borderRadius: 10,
              fontSize: 10,
              background: activeTab === 'all' ? 'rgba(255,255,255,0.2)' : warm.colors.borderWhisper,
              color: activeTab === 'all' ? 'white' : warm.colors.textSecondary,
            }}
          >
            {entries.length}
          </span>
        </button>
      </div>

      {activeTab === 'due' && (
        <>
          {dueLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: warm.colors.textSecondary, fontSize: 13 }}>
              <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              Checking for follow-ups…
            </div>
          ) : dueEntries.length === 0 ? (
            <div
              style={{
                background: warm.colors.bgSurface,
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 16,
                padding: 28,
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: 13.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                No follow-ups due right now. Great job staying on top of your outreach!
              </p>
            </div>
          ) : (
            <>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: warm.colors.textSecondary,
                  marginBottom: 14,
                }}
              >
                {dueEntries.length} follow-up{dueEntries.length !== 1 ? 's' : ''} due
              </p>
              {dueEntries.map((due) => (
                <FollowUpDueCard key={due.id} due={due} onCopied={handleDueCopied} />
              ))}
            </>
          )}
        </>
      )}

      {activeTab === 'all' && (
        <>
          {entries.length === 0 ? (
            <div
              style={{
                background: warm.colors.bgSurface,
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 16,
                padding: 28,
                textAlign: 'center',
              }}
            >
              <p style={{ margin: 0, fontSize: 13.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                Nothing logged yet. Generate templates in the Outreach tab, send your connection request and first
                message, then tap "Log This Outreach" — it'll show up here.
              </p>
            </div>
          ) : (
            <>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: warm.colors.textSecondary,
                  marginBottom: 14,
                }}
              >
                {entries.length} logged
              </p>
              {entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} onUpdate={handleEntrySaved} onRefresh={handleDueCopied} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
};
