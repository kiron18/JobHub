import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, X, Check, Calendar, Building2, Clock, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

type LocalExperienceType = 'VOLUNTEERING' | 'TEMP_WORK' | 'INTERNSHIP' | 'PART_TIME' | 'PROJECT' | 'COMMUNITY' | 'OTHER';

interface LocalExperienceEntry {
  id: string;
  type: LocalExperienceType;
  organisation: string;
  role: string;
  description: string;
  hoursPerWeek: number | null;
  startedAt: string;
  endedAt: string | null;
}

const TYPE_LABELS: Record<LocalExperienceType, string> = {
  VOLUNTEERING: 'Volunteering',
  TEMP_WORK: 'Temp Work',
  INTERNSHIP: 'Internship',
  PART_TIME: 'Part-time Work',
  PROJECT: 'Project / Portfolio',
  COMMUNITY: 'Community / Club',
  OTHER: 'Other',
};

const TYPE_OPTIONS: { value: LocalExperienceType; label: string }[] = [
  { value: 'VOLUNTEERING', label: TYPE_LABELS.VOLUNTEERING },
  { value: 'TEMP_WORK', label: TYPE_LABELS.TEMP_WORK },
  { value: 'INTERNSHIP', label: TYPE_LABELS.INTERNSHIP },
  { value: 'PART_TIME', label: TYPE_LABELS.PART_TIME },
  { value: 'PROJECT', label: TYPE_LABELS.PROJECT },
  { value: 'COMMUNITY', label: TYPE_LABELS.COMMUNITY },
  { value: 'OTHER', label: TYPE_LABELS.OTHER },
];

function EntryCard({ entry, onUpdate }: { entry: LocalExperienceEntry; onUpdate: () => void }) {
  const [ending, setEnding] = useState(false);

  async function handleMarkEnded() {
    setEnding(true);
    try {
      await api.patch(`/tracker/local-experience/${entry.id}`, {
        endedAt: new Date().toISOString(),
      });
      toast.success('Marked as ended');
      onUpdate();
    } catch {
      toast.error('Could not update entry');
    } finally {
      setEnding(false);
    }
  }

  const isOngoing = !entry.endedAt;

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '3px 8px',
                borderRadius: 4,
                background: isOngoing ? 'rgba(52,211,153,0.15)' : warm.colors.bgAlt,
                color: isOngoing ? '#34d399' : warm.colors.textMuted,
                border: `1px solid ${isOngoing ? 'rgba(52,211,153,0.3)' : warm.colors.borderWhisper}`,
              }}
            >
              {TYPE_LABELS[entry.type]}
            </span>
            {isOngoing && (
              <span style={{ fontSize: 11, color: '#34d399', fontWeight: 600 }}>Active</span>
            )}
          </div>

          <div style={{ fontSize: 14.5, fontWeight: 700, color: warm.colors.textPrimary, marginBottom: 4 }}>
            {entry.role}
          </div>
          <div style={{ fontSize: 13, color: warm.colors.textSecondary, marginBottom: 8 }}>
            <Building2 size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
            {entry.organisation}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: warm.colors.textMuted }}>
            <span>
              <Calendar size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
              {new Date(entry.startedAt).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
              {' — '}
              {entry.endedAt
                ? new Date(entry.endedAt).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
                : 'Present'}
            </span>
            {entry.hoursPerWeek && (
              <span>
                <Clock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
                {entry.hoursPerWeek} hrs/week
              </span>
            )}
          </div>

          {entry.description && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.5 }}>
              {entry.description}
            </p>
          )}
        </div>

        {isOngoing && (
          <button
            onClick={handleMarkEnded}
            disabled={ending}
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
              cursor: ending ? 'default' : 'pointer',
              flexShrink: 0,
            }}
          >
            {ending ? (
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Check size={12} />
            )}
            Mark Ended
          </button>
        )}
      </div>
    </div>
  );
}

export const LocalExperience: React.FC = () => {
  const [entries, setEntries] = useState<LocalExperienceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Form state
  const [type, setType] = useState<LocalExperienceType>('VOLUNTEERING');
  const [organisation, setOrganisation] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [startedAt, setStartedAt] = useState('');

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      const { data } = await api.get('/tracker/local-experience');
      setEntries(data.entries || []);
    } catch {
      toast.error('Could not load your local experience entries.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!organisation.trim() || !role.trim() || !startedAt) {
      toast.error('Please fill in organisation, role, and start date');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/tracker/local-experience', {
        type,
        organisation: organisation.trim(),
        role: role.trim(),
        description: description.trim(),
        hoursPerWeek: hoursPerWeek ? parseInt(hoursPerWeek) : null,
        startedAt,
      });
      toast.success('Entry added');
      setShowForm(false);
      resetForm();
      loadEntries();
    } catch {
      toast.error('Could not add entry');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setType('VOLUNTEERING');
    setOrganisation('');
    setRole('');
    setDescription('');
    setHoursPerWeek('');
    setStartedAt('');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    fontSize: 14,
    background: warm.colors.bgAlt,
    border: `1px solid ${warm.colors.borderWhisper}`,
    color: warm.colors.textPrimary,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    display: 'block',
    marginBottom: 6,
  };

  const activeCount = entries.filter((e) => !e.endedAt).length;

  return (
    <div>
      {/* Header with playbook link and add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: warm.colors.textSecondary }}>
            {activeCount > 0 ? (
              <>
                <span style={{ color: '#34d399', fontWeight: 600 }}>{activeCount} active</span>{' '}
                {activeCount === 1 ? 'entry' : 'entries'} · {entries.length} total
              </>
            ) : (
              <>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/local-experience-playbook')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              border: `1px solid ${warm.colors.borderWhisper}`,
              background: warm.colors.bgSurface,
              color: warm.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            <BookOpen size={14} />
            Playbook
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              border: 'none',
              background: showForm ? warm.colors.bgAlt : '#0A66C2',
              color: showForm ? warm.colors.textSecondary : 'white',
              cursor: 'pointer',
            }}
          >
            {showForm ? (
              <>
                <X size={14} /> Cancel
              </>
            ) : (
              <>
                <Plus size={14} /> Add Entry
              </>
            )}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as LocalExperienceType)} style={inputStyle}>
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Organisation</label>
              <input
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                placeholder="e.g. Australian Red Cross"
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Marketing Volunteer"
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Hours per week (optional)</label>
              <input
                type="number"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="e.g. 10"
                style={inputStyle}
                min={1}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you doing? What skills are you building?"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: submitting ? 'rgba(10,102,194,0.3)' : '#0A66C2',
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              cursor: submitting ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {submitting && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
            {submitting ? 'Adding…' : 'Add Entry'}
          </button>
        </form>
      )}

      {/* Entries list */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: warm.colors.textSecondary, fontSize: 13 }}>
          <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
          Loading entries…
        </div>
      ) : entries.length === 0 ? (
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
            No entries yet. Add your first local experience — volunteering, temp work, internships, or projects. This
            all counts as Australian experience.
          </p>
        </div>
      ) : (
        entries.map((entry) => <EntryCard key={entry.id} entry={entry} onUpdate={loadEntries} />)
      )}
    </div>
  );
};
