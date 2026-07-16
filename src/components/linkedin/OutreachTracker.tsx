import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Check, Phone, UserPlus, X, MessageCircle, Clock } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import type { OutreachLogEntry } from './types';
import { renderTemplate } from '../../data/outreachTemplates';

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
  CALL_BOOKED: 'Call Booked',
  REFERRAL: 'Referral',
  CLOSED_NO_REPLY: 'No Reply',
  CLOSED_MANUAL: 'Closed',
};

function LadderDots({ messages, nextTouchNumber, status }: { messages: Array<{ touchNumber: number }>; nextTouchNumber: number | null; status: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[1, 2, 3].map((touch) => {
        const isSent = messages.some((m) => m.touchNumber === touch);
        const isNext = nextTouchNumber === touch;
        const color = isSent ? '#34d399' : isNext ? '#fbbf24' : '#e2e8f0';
        return (
          <div
            key={touch}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: color,
              border: isNext ? '2px solid #f59e0b' : 'none',
            }}
            title={`Touch ${touch}: ${isSent ? 'Sent' : isNext ? 'Due' : 'Pending'}`}
          />
        );
      })}
    </div>
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

function EntryCard({
  entry,
  onUpdate,
}: {
  entry: OutreachLogEntry;
  onUpdate: (entry: OutreachLogEntry) => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  async function handleStatusChange(newStatus: OutreachLogEntry['status']) {
    setUpdating(newStatus);
    try {
      await api.post(`/outreach/${entry.id}/status`, { status: newStatus });
      onUpdate({ ...entry, status: newStatus });
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
    } catch {
      toast.error('Could not update status');
    } finally {
      setUpdating(null);
    }
  }

  const messages = entry.messages ?? entry.ladder?.touches ?? [];
  const nextTouchNumber = entry.ladder?.nextTouchNumber ?? messages.length + 1;
  const displayStatus = entry.ladder?.canAutoClose ? 'CLOSED_NO_REPLY' : entry.status;

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
          <LadderDots messages={messages} nextTouchNumber={nextTouchNumber} status={entry.status} />
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
                <Phone size={12} />
              )}
              Call Booked
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
    renderTemplate(due.nextTouchNumber, {
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
      await api.post(`/outreach/${due.id}/copy`, {
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

  const touchLabel = due.nextTouchNumber === 2 ? 'Touch 2: Friendly bump' : 'Touch 3: Graceful close';

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
            {due.daysSinceLastTouch} days since last touch · {touchLabel}
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
      const { data } = await api.get('/outreach');
      setEntries(data.entries || []);
    } catch {
      toast.error('Could not load your outreach tracker.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDue() {
    try {
      const { data } = await api.get('/outreach/due');
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
                message, then tap "Mark as Connected" — it'll show up here.
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
                <EntryCard key={entry.id} entry={entry} onUpdate={handleEntrySaved} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
};
