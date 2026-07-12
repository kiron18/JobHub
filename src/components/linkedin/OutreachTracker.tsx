import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import type { OutreachLogEntry } from './types';

function EntryCard({ entry, onSaved }: { entry: OutreachLogEntry; onSaved: (entry: OutreachLogEntry) => void }) {
  const [message, setMessage] = useState(entry.firstMessage);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/linkedin/outreach/log/${entry.id}`, { firstMessage: message });
      onSaved(data.entry);
      setDirty(false);
      toast.success('Message updated');
    } catch {
      toast.error('Could not save — try again.');
    } finally {
      setSaving(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: warm.colors.textMuted, display: 'block', marginBottom: 4,
  };

  return (
    <div style={{
      background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
      borderRadius: 14, padding: 18, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: warm.colors.textPrimary }}>{entry.personName}</span>
          <span style={{ fontSize: 13, color: warm.colors.textSecondary }}> · {entry.company}</span>
        </div>
        <span style={{ fontSize: 11, color: warm.colors.textMuted, flexShrink: 0 }}>
          {new Date(entry.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: entry.specificQuestion ? '1fr 1fr' : '1fr', gap: 14, marginBottom: 14 }}>
        {entry.topic && (
          <div>
            <span style={labelStyle}>What they work on / posted about</span>
            <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.5 }}>{entry.topic}</p>
          </div>
        )}
        {entry.specificQuestion && (
          <div>
            <span style={labelStyle}>The specific question</span>
            <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.5 }}>{entry.specificQuestion}</p>
          </div>
        )}
      </div>

      <span style={labelStyle}>First message sent</span>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: warm.colors.textMuted, lineHeight: 1.4 }}>
        Defaults to our suggested template — edit this to match what you actually sent.
      </p>
      <textarea
        value={message}
        onChange={e => { setMessage(e.target.value); setDirty(true); }}
        onBlur={handleSave}
        rows={4}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${warm.colors.borderWhisper}`,
          borderRadius: 8, padding: '10px 12px', fontSize: 13,
          color: warm.colors.textPrimary, resize: 'vertical', lineHeight: 1.6,
          fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, height: 16 }}>
        {saving && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: warm.colors.textMuted }}><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</span>}
        {!saving && !dirty && message === entry.firstMessage && entry.firstMessage && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#34d399' }}><Check size={11} /> Saved</span>
        )}
      </div>
    </div>
  );
}

export const OutreachTracker: React.FC = () => {
  const [entries, setEntries] = useState<OutreachLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/linkedin/outreach/log')
      .then(({ data }) => setEntries(data.entries || []))
      .catch(() => toast.error('Could not load your outreach tracker.'))
      .finally(() => setLoading(false));
  }, []);

  function handleEntrySaved(updated: OutreachLogEntry) {
    setEntries(prev => prev.map(e => (e.id === updated.id ? updated : e)));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: warm.colors.textSecondary, fontSize: 13, padding: '24px 0' }}>
        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
        Loading your tracker…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{
        background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: 16, padding: 28, textAlign: 'center',
      }}>
        <p style={{ margin: 0, fontSize: 13.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
          Nothing logged yet. Generate templates in the Outreach tab, send your connection request and first message, then tap "Mark as Connected" — it'll show up here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{
        fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: warm.colors.textSecondary, marginBottom: 14,
      }}>
        {entries.length} logged
      </p>
      {entries.map(entry => (
        <EntryCard key={entry.id} entry={entry} onSaved={handleEntrySaved} />
      ))}
    </div>
  );
};
