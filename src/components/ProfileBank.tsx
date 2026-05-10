import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Pencil, Check, X, AlertTriangle, CheckCircle2, CheckCircle,
  User, Briefcase, GraduationCap,
  Award, Heart, Wrench, Star, FileText, UploadCloud, RefreshCw, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAppTheme } from '../contexts/ThemeContext';
import { ProfileAdvisorPanel } from './ProfileAdvisorPanel';
import { ActivityWidget } from './ActivityWidget';
import { BaselineResumeBanner } from './BaselineResumeBanner';
import { ManageSubscriptionModal } from './ManageSubscriptionModal';
import { AchievementVideoModal } from './AchievementVideoModal';
import { MilestoneModal } from './MilestoneModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Experience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string | null;
  type: string;
  description: string;
  coachingTips: string | null;
}

interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string | null;
  year: string | null;
  coachingTips: string | null;
}

interface Certification {
  id: string;
  name: string;
  issuingBody: string;
  year: string | null;
}

interface Volunteering {
  id: string;
  organization: string;
  role: string;
  description: string | null;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  metric: string | null;
  metricType: string | null;
  experienceId: string | null;
  coachingTips: string | null;
}

interface SkillsJson {
  technical?: string[];
  industryKnowledge?: string[];
  soft?: string[];
  softSkills?: string[];
}

interface ProfileData {
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  location: string | null;
  professionalSummary: string | null;
  skills: string | null;
  targetRole?: string | null;
  resumeFilename?: string | null;
  coverLetterFilename?: string | null;
  coverLetterFilename2?: string | null;
  documentsUpdatedAt?: string | null;
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  volunteering: Volunteering[];
  achievements: Achievement[];
  completion: {
    score: number;
    isReady: boolean;
    missingFields: string[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseSkills(raw: string | null): SkillsJson {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// ── Coaching hint derivation ───────────────────────────────────────────────────

interface Hint { type: 'warn' | 'ok'; message: string }

function hintForSummary(summary: string | null): Hint | null {
  if (!summary || summary.length < 80)
    return { type: 'warn', message: 'Lead with years of experience and your biggest achievement. Aim for 2–3 sentences.' };
  return { type: 'ok', message: 'Summary looks solid.' };
}

function hintForExperience(exp: Experience, linkedAchievements: Achievement[]): Hint | null {
  if (linkedAchievements.length === 0)
    return { type: 'warn', message: `No achievements linked to ${exp.role} at ${exp.company}. Add at least one to strengthen this role.` };
  return null;
}

function hintForAchievement(ach: Achievement): Hint | null {
  if (!ach.metric || ach.metric.trim() === '')
    return { type: 'warn', message: "Without a number here, this achievement looks the same as every other candidate's. Add one." };
  if (ach.metric === 'qualitative')
    return null;
  return null;
}

function hintForEducation(edu: Education): Hint | null {
  if (!edu.year)
    return { type: 'warn', message: 'Add the graduation year so recruiters can sequence your career.' };
  return null;
}

// ── Motion presets ────────────────────────────────────────────────────────────

const slideIn = {
  initial: { opacity: 0, height: 0, overflow: 'hidden' },
  animate: { opacity: 1, height: 'auto', overflow: 'visible' },
  exit: { opacity: 0, height: 0, overflow: 'hidden' },
  transition: { duration: 0.22, ease: [0.25, 1, 0.5, 1] as [number, number, number, number] },
};

// ── Shared input style factory ─────────────────────────────────────────────────

function inputStyle(isDark: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
    borderRadius: 8,
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    color: isDark ? '#f3f4f6' : '#111827',
    outline: 'none',
    boxSizing: 'border-box',
  };
}

// ── CoachHint ─────────────────────────────────────────────────────────────────

const CoachHint: React.FC<{ hint: Hint }> = ({ hint }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 7,
    marginTop: 6,
    padding: '6px 10px',
    borderRadius: 7,
    background: hint.type === 'warn' ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)',
    border: `1px solid ${hint.type === 'warn' ? 'rgba(217,119,6,0.2)' : 'rgba(22,163,74,0.2)'}`,
  }}>
    {hint.type === 'warn'
      ? <AlertTriangle size={13} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
      : <CheckCircle2 size={13} style={{ color: '#16a34a', flexShrink: 0, marginTop: 1 }} />}
    <span style={{ fontSize: 12, color: hint.type === 'warn' ? '#d97706' : '#16a34a', lineHeight: 1.5 }}>
      {hint.message}
    </span>
  </div>
);

// ── SectionHeader ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  isDark: boolean;
  badge?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, isDark, badge }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    paddingBottom: 12,
    marginBottom: 16,
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
  }}>
    <span style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>{icon}</span>
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: isDark ? '#6b7280' : '#9ca3af',
    }}>{title}</span>
    {badge && <span style={{ marginLeft: 'auto' }}>{badge}</span>}
  </div>
);

// ── Island ────────────────────────────────────────────────────────────────────

interface IslandProps {
  children: React.ReactNode;
  isDark: boolean;
}

const Island: React.FC<IslandProps> = ({ children, isDark }) => (
  <div style={{
    background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 14,
    padding: '20px 24px',
  }}>
    {children}
  </div>
);

// ── EditButton ────────────────────────────────────────────────────────────────

const EditButton: React.FC<{ onClick: () => void; isDark: boolean }> = ({ onClick, isDark }) => (
  <button
    onClick={onClick}
    aria-label="Edit"
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
      background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
      color: isDark ? '#9ca3af' : '#6b7280',
      flexShrink: 0,
    }}
  >
    <Pencil size={12} />
  </button>
);

// ── SaveCancelButtons ─────────────────────────────────────────────────────────

const SaveCancelButtons: React.FC<{
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isDark: boolean;
}> = ({ onSave, onCancel, saving, isDark }) => (
  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
    <button
      onClick={onSave}
      disabled={saving}
      aria-label="Save"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
        background: '#6366f1', color: '#fff', fontSize: 12, fontWeight: 700,
        opacity: saving ? 0.6 : 1,
      }}
    >
      <Check size={12} /> {saving ? 'Saving…' : 'Save'}
    </button>
    <button
      onClick={onCancel}
      aria-label="Cancel"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
        color: isDark ? '#9ca3af' : '#6b7280', fontSize: 12, fontWeight: 700,
      }}
    >
      <X size={12} /> Cancel
    </button>
  </div>
);

// ── SourceDocumentsIsland ─────────────────────────────────────────────────────

const SourceDocumentsIsland: React.FC<{ profile: ProfileData; isDark: boolean }> = ({ profile, isDark }) => {
  const qc = useQueryClient();
  const resumeRef = useRef<HTMLInputElement>(null);
  const cl1Ref    = useRef<HTMLInputElement>(null);
  const cl2Ref    = useRef<HTMLInputElement>(null);

  const [pendingResume, setPendingResume] = useState<File | null>(null);
  const [pendingCl1,    setPendingCl1]    = useState<File | null>(null);
  const [pendingCl2,    setPendingCl2]    = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const hasAny = !!(pendingResume || pendingCl1 || pendingCl2);

  async function handleUpdate() {
    if (!hasAny) return;
    setUploading(true);
    try {
      const fd = new FormData();
      if (pendingResume) fd.append('resume',       pendingResume);
      if (pendingCl1)    fd.append('coverLetter1', pendingCl1);
      if (pendingCl2)    fd.append('coverLetter2', pendingCl2);
      await api.post('/profile/source-documents', fd);
      if (pendingResume) {
        toast.success('Resume uploaded — extracting your profile. Refresh in ~30 seconds.');
        // Poll after extraction delay
        setTimeout(() => qc.invalidateQueries({ queryKey: ['profile'] }), 30_000);
      } else {
        toast.success('Cover letters updated.');
      }
      qc.invalidateQueries({ queryKey: ['profile'] });
      setPendingResume(null); setPendingCl1(null); setPendingCl2(null);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const docBg    = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const docBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const mutedText = isDark ? '#6b7280' : '#9ca3af';
  const mainText  = isDark ? '#f3f4f6' : '#111827';

  const docs = [
    {
      label:    'Resume',
      required: true,
      stored:   profile.resumeFilename,
      pending:  pendingResume,
      ref:      resumeRef,
      onPick:   (f: File) => setPendingResume(f),
    },
    {
      label:    'Cover Letter 1',
      required: false,
      stored:   profile.coverLetterFilename,
      pending:  pendingCl1,
      ref:      cl1Ref,
      onPick:   (f: File) => setPendingCl1(f),
    },
    {
      label:    'Cover Letter 2',
      required: false,
      stored:   profile.coverLetterFilename2,
      pending:  pendingCl2,
      ref:      cl2Ref,
      onPick:   (f: File) => setPendingCl2(f),
    },
  ];

  const updatedLabel = profile.documentsUpdatedAt
    ? new Date(profile.documentsUpdatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Island isDark={isDark}>
      <SectionHeader
        icon={<FileText size={13} />}
        title="Source Documents"
        isDark={isDark}
        badge={
          updatedLabel
            ? <span style={{ fontSize: 10, color: mutedText }}>Updated {updatedLabel}</span>
            : undefined
        }
      />

      <p style={{ fontSize: 12, color: mutedText, marginBottom: 16, lineHeight: 1.5 }}>
        Your resume is the source of truth for profile extraction. Cover letters are diagnostic — they show how you've been positioning yourself and feed the initial analysis, but are not used as templates for generated documents.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map(({ label, required, stored, pending, ref, onPick }) => (
          <div
            key={label}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10,
              background: pending ? (isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)') : docBg,
              border: `1px solid ${pending ? 'rgba(99,102,241,0.25)' : docBorder}`,
              transition: 'background 0.2s, border-color 0.2s',
            }}
          >
            <FileText size={14} color={pending ? '#818cf8' : mutedText} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: mutedText, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}{required && <span style={{ color: '#f87171', marginLeft: 4 }}>*</span>}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: pending ? '#a5b4fc' : (stored ? mainText : mutedText), fontWeight: pending ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pending ? pending.name : (stored ?? 'Not on file')}
              </p>
            </div>
            <input
              ref={ref}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }}
            />
            <button
              onClick={() => ref.current?.click()}
              disabled={uploading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 7, border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                color: isDark ? '#9ca3af' : '#6b7280',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}
            >
              <UploadCloud size={11} />
              {stored || pending ? 'Replace' : 'Upload'}
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {hasAny && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <button
                onClick={handleUpdate}
                disabled={uploading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 9, border: 'none',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  background: uploading ? 'rgba(99,102,241,0.4)' : '#6366f1',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  opacity: uploading ? 0.7 : 1,
                }}
              >
                <RefreshCw size={12} style={{ animation: uploading ? 'spin 0.8s linear infinite' : 'none' }} />
                {uploading ? 'Uploading…' : pendingResume ? 'Update & re-extract profile' : 'Update documents'}
              </button>
              <button
                onClick={() => { setPendingResume(null); setPendingCl1(null); setPendingCl2(null); }}
                disabled={uploading}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: mutedText, fontWeight: 600, padding: '6px 8px',
                }}
              >
                Cancel
              </button>
            </div>
            {pendingResume && (
              <p style={{ fontSize: 11, color: mutedText, marginTop: 8, lineHeight: 1.5 }}>
                Uploading a new resume will clear your existing work experience and achievements, then re-extract them from the new file. Manually added education and certifications are kept.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Island>
  );
};

// ── PersonalDetailsIsland ────────────────────────────────────────────────────

interface PersonalDetailsIslandProps {
  profile: ProfileData;
  isDark: boolean;
}

const PersonalDetailsIsland: React.FC<PersonalDetailsIslandProps> = ({ profile, isDark }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: profile.name ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    linkedin: profile.linkedin ?? '',
    location: profile.location ?? '',
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.patch('/profile', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
      toast.info('Personal details saved.');
    },
    onError: () => toast.error('Failed to save. Please try again.'),
  });

  const inp = inputStyle(isDark);
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af',
    letterSpacing: '0.06em', display: 'block', marginBottom: 4,
  };

  return (
    <Island isDark={isDark}>
      <SectionHeader icon={<User size={13} />} title="Personal Details" isDark={isDark}
        badge={<EditButton onClick={() => setEditing(e => !e)} isDark={isDark} />} />

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="edit" {...slideIn}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
              {(['name', 'email', 'phone', 'linkedin', 'location'] as const).map(field => (
                <div key={field}>
                  <label style={labelStyle}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input
                    style={inp}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={
                      field === 'linkedin' ? 'linkedin.com/in/yourhandle' :
                      field === 'email' ? 'your@email.com' : ''
                    }
                    type={field === 'email' ? 'email' : 'text'}
                  />
                </div>
              ))}
            </div>
            <SaveCancelButtons
              onSave={() => mutation.mutate(form)}
              onCancel={() => setEditing(false)}
              saving={mutation.isPending}
              isDark={isDark}
            />
          </motion.div>
        ) : (
          <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', marginBottom: 4 }}>
              {profile.name || <span style={{ color: '#d97706' }}>No name set</span>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 8 }}>
              {[
                { label: 'Email', value: profile.email },
                { label: 'Phone', value: profile.phone },
                { label: 'Location', value: profile.location },
                { label: 'LinkedIn', value: profile.linkedin },
              ].map(({ label, value }) => (
                <span key={label} style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>
                  <span style={{ fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', marginRight: 4 }}>{label}:</span>
                  {value || <span style={{ color: '#d97706' }}>missing</span>}
                </span>
              ))}
            </div>
            {!profile.phone && <CoachHint hint={{ type: 'warn', message: 'Add your phone number — many recruiters call before emailing.' }} />}
            {!profile.linkedin && <CoachHint hint={{ type: 'warn', message: 'Add your LinkedIn URL to give recruiters a quick verification path.' }} />}
          </motion.div>
        )}
      </AnimatePresence>
    </Island>
  );
};

// ── SummaryIsland ─────────────────────────────────────────────────────────────

interface SummaryIslandProps {
  profile: ProfileData;
  isDark: boolean;
}

const SummaryIsland: React.FC<SummaryIslandProps> = ({ profile, isDark }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(profile.professionalSummary ?? '');

  const mutation = useMutation({
    mutationFn: (professionalSummary: string) => api.patch('/profile', { professionalSummary }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
      toast.info('Summary saved.');
    },
    onError: () => toast.error('Failed to save. Please try again.'),
  });

  const hint = hintForSummary(profile.professionalSummary);

  return (
    <Island isDark={isDark}>
      <SectionHeader icon={<Star size={13} />} title="Professional Summary" isDark={isDark}
        badge={<EditButton onClick={() => setEditing(e => !e)} isDark={isDark} />} />

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="edit" {...slideIn}>
            <textarea
              rows={5}
              style={{ ...inputStyle(isDark), resize: 'vertical' }}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="2–3 sentences. Lead with your years of experience and single biggest achievement."
            />
            <div style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', marginTop: 4 }}>
              {text.length} chars {text.length < 80 && <span style={{ color: '#d97706' }}>(aim for 80+)</span>}
            </div>
            <SaveCancelButtons
              onSave={() => mutation.mutate(text)}
              onCancel={() => setEditing(false)}
              saving={mutation.isPending}
              isDark={isDark}
            />
          </motion.div>
        ) : (
          <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {profile.professionalSummary
              ? <p style={{ fontSize: 14, color: isDark ? '#d1d5db' : '#374151', lineHeight: 1.7 }}>{profile.professionalSummary}</p>
              : <p style={{ fontSize: 14, color: '#d97706', fontStyle: 'italic' }}>No summary yet.</p>}
            {hint && <CoachHint hint={hint} />}
          </motion.div>
        )}
      </AnimatePresence>
    </Island>
  );
};

// ── AchievementRow ────────────────────────────────────────────────────────────

interface AchievementRowProps {
  ach: Achievement;
  isDark: boolean;
}

const AchievementRow: React.FC<AchievementRowProps> = ({ ach, isDark }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showHowModal, setShowHowModal] = useState(false);
  const [form, setForm] = useState({
    title: ach.title,
    description: ach.description,
    metric: ach.metric ?? '',
    metricType: ach.metricType ?? '',
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.patch(`/achievements/${ach.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setEditing(false);
      toast.info('Achievement updated.');
    },
    onError: () => toast.error('Failed to save. Please try again.'),
  });

  const markQualitative = () => {
    api.patch(`/achievements/${ach.id}`, { metric: 'qualitative', metricType: '' })
      .then(() => qc.invalidateQueries({ queryKey: ['profile'] }))
      .catch(() => toast.error('Failed to save. Please try again.'));
  };

  const hint = hintForAchievement(ach);
  const inp = inputStyle(isDark);

  return (
    <div style={{
      padding: '12px 0',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <AnimatePresence mode="wait">
            {editing ? (
              <motion.div key="edit" {...slideIn}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" />
                  <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What you did and why it mattered." />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input style={inp} value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))} placeholder="Metric (e.g. 40%)" />
                    <input style={inp} value={form.metricType} onChange={e => setForm(f => ({ ...f, metricType: e.target.value }))} placeholder="Type (e.g. revenue growth)" />
                  </div>
                </div>
                <SaveCancelButtons onSave={() => mutation.mutate(form)} onCancel={() => setEditing(false)} saving={mutation.isPending} isDark={isDark} />
              </motion.div>
            ) : (
              <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937', marginBottom: 3 }}>{ach.title}</p>
                <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.6 }}>{ach.description}</p>
                {ach.metric && ach.metric !== 'qualitative' && (
                  <span style={{
                    display: 'inline-block', marginTop: 5,
                    padding: '2px 8px', borderRadius: 5,
                    fontSize: 11, fontWeight: 700,
                    background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}>
                    {ach.metric} {ach.metricType && `— ${ach.metricType}`}
                  </span>
                )}
                {ach.metric === 'qualitative' && (
                  <span style={{ display: 'inline-block', marginTop: 5, padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', color: isDark ? '#6b7280' : '#9ca3af', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                    Qualitative
                  </span>
                )}
                {hint && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <CoachHint hint={hint} />
                    <button
                      onClick={() => setShowHowModal(true)}
                      style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      How?
                    </button>
                  </div>
                )}
                <AchievementVideoModal
                  isOpen={showHowModal}
                  onClose={() => setShowHowModal(false)}
                  isDark={isDark}
                  achievementDescription={ach.description}
                  onMarkQualitative={markQualitative}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!editing && <EditButton onClick={() => setEditing(true)} isDark={isDark} />}
      </div>
    </div>
  );
};

// ── ExperienceIsland ──────────────────────────────────────────────────────────

interface ExperienceIslandProps {
  experience: Experience[];
  achievements: Achievement[];
  isDark: boolean;
}

const ExperienceIsland: React.FC<ExperienceIslandProps> = ({ experience, achievements, isDark }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, {
    company: string; role: string; startDate: string; endDate: string; description: string;
  }>>({});

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) =>
      api.patch(`/experience/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setEditingId(null);
      toast.info('Experience updated.');
    },
    onError: () => toast.error('Failed to save. Please try again.'),
  });

  const inp = inputStyle(isDark);
  const workEntries = experience.filter(e => !e.type || e.type === 'work');

  return (
    <Island isDark={isDark}>
      <SectionHeader icon={<Briefcase size={13} />} title="Work Experience" isDark={isDark} />
      {workEntries.length === 0 && (
        <p style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>
          No experience found. Upload a resume to populate this section.
        </p>
      )}
      {workEntries.map(exp => {
        const linked = achievements.filter(a => a.experienceId === exp.id);
        const hint = hintForExperience(exp, linked);
        const isEditing = editingId === exp.id;
        const form = forms[exp.id] ?? {
          company: exp.company, role: exp.role,
          startDate: exp.startDate, endDate: exp.endDate ?? '', description: exp.description,
        };

        return (
          <div key={exp.id} style={{
            marginBottom: 20,
            paddingBottom: 20,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit" {...slideIn}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                        {(['role', 'company', 'startDate', 'endDate'] as const).map(f => (
                          <div key={f}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                              {f === 'startDate' ? 'Start' : f === 'endDate' ? 'End' : f.charAt(0).toUpperCase() + f.slice(1)}
                            </span>
                            <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [exp.id]: { ...form, [f]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>Description</span>
                        <textarea rows={4} style={{ ...inp, resize: 'vertical' }} value={form.description}
                          onChange={e => setForms(prev => ({ ...prev, [exp.id]: { ...form, description: e.target.value } }))} />
                      </div>
                      <SaveCancelButtons
                        onSave={() => mutation.mutate({ id: exp.id, data: form })}
                        onCancel={() => setEditingId(null)}
                        saving={mutation.isPending}
                        isDark={isDark}
                      />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937' }}>{exp.role}</p>
                      <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
                        {exp.company} · {exp.startDate}–{exp.endDate ?? 'Present'}
                      </p>
                      {exp.description && (
                        <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.6, marginTop: 6 }}>{exp.description}</p>
                      )}
                      {hint && <CoachHint hint={hint} />}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <EditButton
                  onClick={() => {
                    setForms(prev => ({ ...prev, [exp.id]: { company: exp.company, role: exp.role, startDate: exp.startDate, endDate: exp.endDate ?? '', description: exp.description } }));
                    setEditingId(exp.id);
                  }}
                  isDark={isDark}
                />
              )}
            </div>

            {/* Nested achievements */}
            {linked.length > 0 && (
              <div style={{
                marginTop: 12, marginLeft: 16,
                paddingLeft: 16,
                borderLeft: `2px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.2)'}`,
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Achievements
                </p>
                {linked.map(ach => (
                  <AchievementRow key={ach.id} ach={ach} isDark={isDark} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Island>
  );
};

// ── ProjectsIsland ────────────────────────────────────────────────────────────

const ProjectsIsland: React.FC<{ experience: Experience[]; achievements: Achievement[]; isDark: boolean }> = ({ experience, achievements, isDark }) => {
  const projects = experience.filter(e => e.type === 'project');
  if (projects.length === 0) return null;

  return (
    <Island isDark={isDark}>
      <SectionHeader icon={<Briefcase size={13} />} title="Projects" isDark={isDark} />
      {projects.map(proj => {
        const linked = achievements.filter(a => a.experienceId === proj.id);
        return (
          <div key={proj.id} style={{
            marginBottom: 20, paddingBottom: 20,
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937' }}>{proj.role}</p>
            <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 2 }}>
              {proj.company} · {proj.startDate}{proj.endDate ? `–${proj.endDate}` : ''}
            </p>
            {proj.description && (
              <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.6, marginTop: 6 }}>{proj.description}</p>
            )}
            {linked.length > 0 && (
              <div style={{
                marginTop: 12, marginLeft: 16, paddingLeft: 16,
                borderLeft: `2px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.2)'}`,
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Achievements
                </p>
                {linked.map(ach => <AchievementRow key={ach.id} ach={ach} isDark={isDark} />)}
              </div>
            )}
          </div>
        );
      })}
    </Island>
  );
};

// ── EducationIsland ───────────────────────────────────────────────────────────

const EducationIsland: React.FC<{ education: Education[]; isDark: boolean }> = ({ education, isDark }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { institution: string; degree: string; field: string; year: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ institution: '', degree: '', field: '', year: '' });

  const inp = inputStyle(isDark);

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) => api.patch(`/education/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditingId(null); toast.info('Education updated.'); },
    onError: () => toast.error('Failed to save.'),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof addForm) => api.post('/education', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setIsAdding(false); setAddForm({ institution: '', degree: '', field: '', year: '' }); toast.success('Education added.'); },
    onError: () => toast.error('Failed to add education.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/education/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.info('Education removed.'); },
    onError: () => toast.error('Failed to remove.'),
  });

  return (
    <Island isDark={isDark}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<GraduationCap size={13} />} title="Education" isDark={isDark} />
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            + Add
          </button>
        )}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div key="add" {...slideIn} style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
              {(['institution', 'degree', 'field', 'year'] as const).map(f => (
                <div key={f}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </span>
                  <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
            <SaveCancelButtons onSave={() => addMutation.mutate(addForm)} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>

      {education.length === 0 && !isAdding && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#ef4444' }}>Education missing</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: isDark ? '#f87171' : '#dc2626' }}>
              No education records found. Add your degree so it appears in generated resumes — click <strong>+ Add</strong> above.
            </p>
          </div>
        </div>
      )}

      {education.map(edu => {
        const hint = hintForEducation(edu);
        const isEditing = editingId === edu.id;
        const form = forms[edu.id] ?? { institution: edu.institution, degree: edu.degree, field: edu.field ?? '', year: edu.year ?? '' };
        return (
          <div key={edu.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit" {...slideIn}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                        {(['institution', 'degree', 'field', 'year'] as const).map(f => (
                          <div key={f}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </span>
                            <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [edu.id]: { ...form, [f]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                      <SaveCancelButtons onSave={() => editMutation.mutate({ id: edu.id, data: form })} onCancel={() => setEditingId(null)} saving={editMutation.isPending} isDark={isDark} />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937' }}>{edu.degree}{edu.field && ` in ${edu.field}`}</p>
                      <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280' }}>{edu.institution}{edu.year && ` · ${edu.year}`}</p>
                      {hint && <CoachHint hint={hint} />}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <EditButton onClick={() => { setForms(prev => ({ ...prev, [edu.id]: { institution: edu.institution, degree: edu.degree, field: edu.field ?? '', year: edu.year ?? '' } })); setEditingId(edu.id); }} isDark={isDark} />
                  <button onClick={() => deleteMutation.mutate(edu.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Island>
  );
};

// ── SkillsIsland ──────────────────────────────────────────────────────────────

const SkillsIsland: React.FC<{ skills: string | null; isDark: boolean }> = ({ skills, isDark }) => {
  const qc = useQueryClient();
  const parsed = parseSkills(skills);
  const allSkills: string[] = [
    ...(parsed.technical ?? []),
    ...(parsed.industryKnowledge ?? []),
    ...(parsed.soft ?? []),
    ...(parsed.softSkills ?? []),
  ];
  const [editing, setEditing] = useState(false);
  const [localSkills, setLocalSkills] = useState<string[]>(allSkills);
  const [inputVal, setInputVal] = useState('');

  const mutation = useMutation({
    mutationFn: (skillList: string[]) => api.patch('/profile', { skills: JSON.stringify({ technical: skillList }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditing(false); toast.info('Skills updated.'); },
    onError: () => toast.error('Failed to save skills.'),
  });

  function openEdit() { setLocalSkills(allSkills); setInputVal(''); setEditing(true); }
  function addSkill() {
    const s = inputVal.trim();
    if (s && !localSkills.includes(s)) setLocalSkills(p => [...p, s]);
    setInputVal('');
  }
  function removeSkill(s: string) { setLocalSkills(p => p.filter(x => x !== s)); }

  const inp = inputStyle(isDark);

  return (
    <Island isDark={isDark}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Wrench size={13} />} title="Skills" isDark={isDark} />
        {!editing && <EditButton onClick={openEdit} isDark={isDark} />}
      </div>

      {editing ? (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {localSkills.map(s => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                {s}
                <button onClick={() => removeSkill(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#818cf8' }}><X size={10} /></button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              style={{ ...inp, flex: 1 }}
              value={inputVal}
              placeholder="Type a skill and press Enter"
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
            />
            <button onClick={addSkill} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#818cf8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
          </div>
          <SaveCancelButtons onSave={() => mutation.mutate(localSkills)} onCancel={() => setEditing(false)} saving={mutation.isPending} isDark={isDark} />
        </div>
      ) : (
        <>
          {allSkills.length === 0 ? (
            <p style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>No skills found.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allSkills.map((skill, i) => (
                <span key={i} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', color: isDark ? '#d1d5db' : '#374151', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                  {skill}
                </span>
              ))}
            </div>
          )}
          {allSkills.length < 5 && (
            <CoachHint hint={{ type: 'warn', message: `Only ${allSkills.length} skills listed. Add at least 5 to improve profile strength.` }} />
          )}
        </>
      )}
    </Island>
  );
};

// ── CertificationsIsland ──────────────────────────────────────────────────────

const CertificationsIsland: React.FC<{ certifications: Certification[]; isDark: boolean }> = ({ certifications, isDark }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { name: string; issuingBody: string; year: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', issuingBody: '', year: '' });

  const inp = inputStyle(isDark);

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) => api.patch(`/certifications/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditingId(null); toast.info('Certification updated.'); },
    onError: () => toast.error('Failed to save.'),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof addForm) => api.post('/certifications', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setIsAdding(false); setAddForm({ name: '', issuingBody: '', year: '' }); toast.success('Certification added.'); },
    onError: () => toast.error('Failed to add certification.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/certifications/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.info('Certification removed.'); },
    onError: () => toast.error('Failed to remove.'),
  });

  return (
    <Island isDark={isDark}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Award size={13} />} title="Certifications" isDark={isDark} />
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            + Add
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div key="add" {...slideIn} style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '10px 14px' }}>
              {(['name', 'issuingBody', 'year'] as const).map(f => (
                <div key={f}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                    {f === 'issuingBody' ? 'Issuing Body' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </span>
                  <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
            <SaveCancelButtons onSave={() => addMutation.mutate(addForm)} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>

      {certifications.length === 0 && !isAdding && (
        <p style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>No certifications on record.</p>
      )}

      {certifications.map(cert => {
        const isEditing = editingId === cert.id;
        const form = forms[cert.id] ?? { name: cert.name, issuingBody: cert.issuingBody, year: cert.year ?? '' };
        return (
          <div key={cert.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit" {...slideIn}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '10px 14px' }}>
                        {(['name', 'issuingBody', 'year'] as const).map(f => (
                          <div key={f}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                              {f === 'issuingBody' ? 'Issuing Body' : f.charAt(0).toUpperCase() + f.slice(1)}
                            </span>
                            <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [cert.id]: { ...form, [f]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                      <SaveCancelButtons onSave={() => editMutation.mutate({ id: cert.id, data: form })} onCancel={() => setEditingId(null)} saving={editMutation.isPending} isDark={isDark} />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937' }}>{cert.name}</p>
                      <p style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' }}>{cert.issuingBody}{cert.year && ` · ${cert.year}`}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <EditButton onClick={() => { setForms(prev => ({ ...prev, [cert.id]: { name: cert.name, issuingBody: cert.issuingBody, year: cert.year ?? '' } })); setEditingId(cert.id); }} isDark={isDark} />
                  <button onClick={() => deleteMutation.mutate(cert.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Island>
  );
};

// ── VolunteeringIsland ────────────────────────────────────────────────────────

const VolunteeringIsland: React.FC<{ volunteering: Volunteering[]; isDark: boolean }> = ({ volunteering, isDark }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { organization: string; role: string; description: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ organization: '', role: '', description: '' });

  const inp = inputStyle(isDark);

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) => api.patch(`/volunteering/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setEditingId(null); toast.info('Volunteering updated.'); },
    onError: () => toast.error('Failed to save.'),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof addForm) => api.post('/volunteering', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); setIsAdding(false); setAddForm({ organization: '', role: '', description: '' }); toast.success('Volunteering added.'); },
    onError: () => toast.error('Failed to add volunteering.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/volunteering/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profile'] }); toast.info('Volunteering removed.'); },
    onError: () => toast.error('Failed to remove.'),
  });

  return (
    <Island isDark={isDark}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Heart size={13} />} title="Volunteering" isDark={isDark} />
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            + Add
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div key="add" {...slideIn} style={{ marginBottom: 16 }}>
            {(['organization', 'role'] as const).map(f => (
              <div key={f} style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </span>
                <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>Description (optional)</span>
              <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <SaveCancelButtons onSave={() => addMutation.mutate(addForm)} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>

      {volunteering.length === 0 && !isAdding && (
        <p style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>No volunteering records.</p>
      )}

      {volunteering.map(vol => {
        const isEditing = editingId === vol.id;
        const form = forms[vol.id] ?? { organization: vol.organization, role: vol.role, description: vol.description ?? '' };
        return (
          <div key={vol.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit" {...slideIn}>
                      {(['organization', 'role'] as const).map(f => (
                        <div key={f} style={{ marginBottom: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </span>
                          <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [vol.id]: { ...form, [f]: e.target.value } }))} />
                        </div>
                      ))}
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6b7280' : '#9ca3af', display: 'block', marginBottom: 4 }}>Description (optional)</span>
                        <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={form.description} onChange={e => setForms(prev => ({ ...prev, [vol.id]: { ...form, description: e.target.value } }))} />
                      </div>
                      <SaveCancelButtons onSave={() => editMutation.mutate({ id: vol.id, data: form })} onCancel={() => setEditingId(null)} saving={editMutation.isPending} isDark={isDark} />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e5e7eb' : '#1f2937' }}>{vol.role}</p>
                      <p style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', marginBottom: vol.description ? 4 : 0 }}>{vol.organization}</p>
                      {vol.description && <p style={{ fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.6 }}>{vol.description}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <EditButton onClick={() => { setForms(prev => ({ ...prev, [vol.id]: { organization: vol.organization, role: vol.role, description: vol.description ?? '' } })); setEditingId(vol.id); }} isDark={isDark} />
                  <button onClick={() => deleteMutation.mutate(vol.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Island>
  );
};

// ── CompletionSidebar ─────────────────────────────────────────────────────────

interface CompletionSidebarProps {
  completion: ProfileData['completion'];
  isDark: boolean;
  targetRole?: string;
  plan?: string;
  planStatus?: string;
}

const CompletionSidebar: React.FC<CompletionSidebarProps> = ({ completion, isDark, targetRole, plan, planStatus }) => {
  const navigate = useNavigate();
  const [showManage, setShowManage] = useState(false);
  const { score, missingFields } = completion;

  const hasActiveSubscription = !!plan && plan !== 'free' && !!planStatus && !['cancelled', 'expired', 'free'].includes(planStatus);

  const radius = 42;
  const stroke = 7;
  const nr = radius - stroke * 2;
  const circ = nr * 2 * Math.PI;
  const offset = circ - (score / 100) * circ;

  const scoreColor = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626';

  return (
    <div style={{
      position: 'sticky',
      top: 24,
      background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 14,
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>
      {/* Score ring — pulses when score < 50 to signal open loop */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={radius * 2} height={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
            <circle stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'} fill="transparent" strokeWidth={stroke} r={nr} cx={radius} cy={radius} />
            <motion.circle
              stroke={scoreColor}
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={`${circ} ${circ}`}
              style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 1s cubic-bezier(0.25,1,0.5,1)' }}
              strokeLinecap="round"
              r={nr} cx={radius} cy={radius}
              animate={score < 50 ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
              transition={score < 50 ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : {}}
            />
          </svg>
          <span style={{ position: 'absolute', fontSize: 20, fontWeight: 800, color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>
            {score}
          </span>
        </div>
        {/* Identity label at 90%+ */}
        {score >= 90 ? (
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7c3aed', textAlign: 'center' }}>
            Exceptional Profile
          </p>
        ) : score >= 70 ? (
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6366f1', textAlign: 'center' }}>
            Prepared Candidate
          </p>
        ) : (
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isDark ? '#6b7280' : '#9ca3af', textAlign: 'center' }}>
            Profile Strength
          </p>
        )}
      </div>

      {/* Missing fields */}
      {missingFields.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: isDark ? '#6b7280' : '#9ca3af', marginBottom: 8 }}>
            Still needed
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {missingFields.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={10} style={{ color: '#d97706', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', textTransform: 'capitalize' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Advisor */}
      <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, paddingTop: 16 }}>
        <ProfileAdvisorPanel targetRole={targetRole} />
      </div>

      {/* Dynamic CTA — copy and colour shift with score tier */}
      {(() => {
        const tier = score >= 90 ? 'exceptional' : score >= 70 ? 'ready' : score >= 50 ? 'close' : 'building';
        const pointsAway = Math.max(0, 70 - score);
        const cfg = {
          exceptional: { label: 'Your profile is exceptional. Go get hired.', bg: '#7c3aed', color: '#fff', active: true },
          ready:       { label: "You're ready. Find your next role.", bg: '#6366f1', color: '#fff', active: true },
          close:       { label: `${pointsAway} point${pointsAway !== 1 ? 's' : ''} to unlock the job board. Keep going.`, bg: isDark ? 'rgba(217,119,6,0.12)' : 'rgba(217,119,6,0.1)', color: '#d97706', active: false },
          building:    { label: "Complete your profile to unlock the platform.", bg: isDark ? 'rgba(220,38,38,0.1)' : 'rgba(220,38,38,0.07)', color: '#dc2626', active: false },
        }[tier];
        return (
          <button
            onClick={() => cfg.active && navigate('/')}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 10, border: 'none',
              background: cfg.bg, color: cfg.color,
              fontSize: 13, fontWeight: 700,
              cursor: cfg.active ? 'pointer' : 'default',
              lineHeight: 1.4, textAlign: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            {cfg.label}
          </button>
        );
      })()}

      {/* Subscription management */}
      {hasActiveSubscription && (
        <>
          <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
          <button
            onClick={() => setShowManage(true)}
            style={{
              width: '100%', padding: '9px 0',
              background: 'transparent', border: 'none',
              color: isDark ? '#6b7280' : '#9ca3af',
              fontSize: 12, cursor: 'pointer',
              transition: 'color 0.14s ease',
              textAlign: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = isDark ? '#9ca3af' : '#6b7280'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = isDark ? '#6b7280' : '#9ca3af'; }}
          >
            Manage subscription
          </button>
        </>
      )}

      <ManageSubscriptionModal
        isOpen={showManage}
        onClose={() => setShowManage(false)}
        plan={plan ?? 'monthly'}
        planStatus={planStatus ?? 'active'}
      />
    </div>
  );
};

// ── ProfileBank (main export) ─────────────────────────────────────────────────

export const ProfileBank: React.FC = () => {
  const { isDark } = useAppTheme();
  const navigate = useNavigate();

  const { data: profile, isLoading, isError } = useQuery<ProfileData>({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data;
    },
    staleTime: 60_000,
  });

  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(() =>
    !localStorage.getItem('jobhub_profile_visited')
  );
  const [activeMilestone, setActiveMilestone] = useState<50 | 70 | null>(null);
  const [baselineDownloading, setBaselineDownloading] = useState(false);
  const [baselineDownloaded, setBaselineDownloaded] = useState(false);
  const prevScoreRef = useRef<number | null>(null);

  // Fire milestone modal when score crosses 50 or 70 for the first time
  React.useEffect(() => {
    if (!profile) return;
    const score = profile.completion.score;
    const prev = prevScoreRef.current;
    if (prev !== null) {
      if (prev < 70 && score >= 70 && !localStorage.getItem('jobhub_milestone_70')) {
        localStorage.setItem('jobhub_milestone_70', '1');
        setActiveMilestone(70);
      } else if (prev < 50 && score >= 50 && !localStorage.getItem('jobhub_milestone_50')) {
        localStorage.setItem('jobhub_milestone_50', '1');
        setActiveMilestone(50);
      }
    }
    prevScoreRef.current = score;
  }, [profile]);

  const dismissWelcomeModal = () => {
    localStorage.setItem('jobhub_profile_visited', '1');
    setShowWelcomeModal(false);
  };

  const handleBaselineDownload = async () => {
    if (baselineDownloading) return;
    setBaselineDownloading(true);
    try {
      const { data } = await api.get('/profile/baseline-resume');
      if (data.status === 'ready' && data.documentId) {
        const { data: doc } = await api.get(`/documents/${data.documentId}`);
        const { exportDocx } = await import('../lib/exportDocx');
        await exportDocx(doc.content, 'resume', '');
      }
    } catch {
      // silent
    } finally {
      setBaselineDownloading(false);
      setBaselineDownloaded(true);
    }
  };

  const handleRegenerateIdentity = async () => {
    setRegenerating(true);
    try {
      await api.post('/profile/regenerate-identity');
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      console.error('[ProfileBank] Regenerate identity failed:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const pageBg = isDark ? '#0d1117' : '#f0ede8';
  const textMain = isDark ? '#f3f4f6' : '#111827';

  if (isLoading) {
    return (
      <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#6b7280' : '#9ca3af' }}>
        <div style={{ width: 20, height: 20, border: `2px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}`, borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ marginLeft: 12, fontSize: 14 }}>Loading profile…</span>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div style={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <AlertTriangle size={24} style={{ color: '#d97706' }} />
        <p style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280' }}>Could not load your profile. Refresh the page to try again.</p>
      </div>
    );
  }

  return (
    <div style={{ background: pageBg, minHeight: '100%', padding: '24px 0', color: textMain, fontFamily: 'system-ui, sans-serif' }}>
      {/* First-visit modal — baseline resume gift for onboarded users, explanation otherwise */}
      <AnimatePresence>
        {showWelcomeModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: isDark ? '#080b12' : '#f8fafc', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
              style={{ background: isDark ? '#0d1117' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 24, padding: '40px 44px', maxWidth: 520, width: '100%', position: 'relative' }}
            >
              <button onClick={dismissWelcomeModal} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#4b5563' : '#9ca3af', padding: 4, lineHeight: 1 }}>
                <X size={16} />
              </button>
              {(profile as any)?.hasCompletedOnboarding ? (
                baselineDownloaded ? (
                  /* Post-download state — redirect energy toward completion */
                  <>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <CheckCircle size={24} style={{ color: '#22c55e' }} />
                      </div>
                      <h3 style={{ fontSize: 20, fontWeight: 900, color: isDark ? '#f3f4f6' : '#111827', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                        That's your resume.
                      </h3>
                      <p style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', margin: 0, lineHeight: 1.65 }}>
                        Right now it's built from what we extracted. The more you tell us, the stronger every document gets — resumes, cover letters, the lot.
                      </p>
                    </div>
                    <div style={{ background: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                      <p style={{ margin: 0, fontSize: 13, color: isDark ? '#a5b4fc' : '#4f46e5', lineHeight: 1.65, fontWeight: 500 }}>
                        Takes about 6 minutes. Walk through your profile section by section — we'll coach you on what makes the difference.
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <button
                        onClick={() => { dismissWelcomeModal(); navigate('/setup'); }}
                        style={{ width: '100%', padding: '14px 0', borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.01em' }}
                      >
                        Make it stronger →
                      </button>
                      <button
                        onClick={dismissWelcomeModal}
                        style={{ width: '100%', padding: '12px 0', borderRadius: 10, background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, color: isDark ? '#4b5563' : '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        I'll come back to it
                      </button>
                    </div>
                  </>
                ) : (
                  /* Baseline resume gift — reciprocity moment */
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(45,212,191,0.15)', border: '1px solid rgba(45,212,191,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={20} style={{ color: '#2dd4bf' }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', margin: 0, letterSpacing: '-0.01em' }}>
                          We've prepared a starting point for you.
                        </h3>
                        <p style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af', margin: '3px 0 0' }}>
                          Restructured using your diagnostic findings.
                        </p>
                      </div>
                    </div>
                    <div style={{ background: isDark ? 'rgba(45,212,191,0.05)' : 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.18)', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
                      <p style={{ margin: 0, fontSize: 13, color: isDark ? '#9ca3af' : '#6b7280', lineHeight: 1.65 }}>
                        We've taken your resume and restructured it based on what the diagnostic found. It's a solid starting point — a complete profile is what turns it into something tailored to each role.
                      </p>
                    </div>
                    <p style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af', marginBottom: 18, lineHeight: 1.6, textAlign: 'center' }}>
                      6 minutes of your time here could change the next 6 months.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <button
                        onClick={handleBaselineDownload}
                        disabled={baselineDownloading}
                        style={{ width: '100%', padding: '13px 0', borderRadius: 10, background: '#2dd4bf', border: 'none', color: '#0d1117', fontSize: 14, fontWeight: 800, cursor: baselineDownloading ? 'wait' : 'pointer', opacity: baselineDownloading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <Download size={15} />
                        {baselineDownloading ? 'Downloading…' : 'Download my resume'}
                      </button>
                      <button
                        onClick={() => { dismissWelcomeModal(); navigate('/setup'); }}
                        style={{ width: '100%', padding: '12px 0', borderRadius: 10, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}`, color: isDark ? '#9ca3af' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Let's sharpen it instead →
                      </button>
                    </div>
                  </>
                )
              ) : (
                /* Original explanation for non-onboarded users */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Star size={20} style={{ color: '#818cf8' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: isDark ? '#f3f4f6' : '#111827', margin: 0, letterSpacing: '-0.01em' }}>Your Achievement Bank</h3>
                      <p style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af', margin: '2px 0 0' }}>How to get the most out of this page</p>
                    </div>
                  </div>
                  {[
                    { num: '1', title: 'Add your experience', desc: "Enter every role you've held. The AI uses your full work history to find the right story for each application." },
                    { num: '2', title: 'Link achievements to each role', desc: 'These are the specific wins, metrics, and outcomes — the evidence behind your claims. This is the most important part.' },
                    { num: '3', title: 'Every document draws from this', desc: 'Your resume, cover letters, and interview answers are all built from this bank. Update it once and every generation improves.' },
                  ].map(step => (
                    <div key={step.num} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                      <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#818cf8' }}>
                        {step.num}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e5e7eb' : '#111827', margin: '2px 0 4px' }}>{step.title}</p>
                        <p style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280', margin: 0, lineHeight: 1.55 }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={dismissWelcomeModal}
                    style={{ marginTop: 8, width: '100%', padding: '13px 0', borderRadius: 10, background: 'rgba(99,102,241,0.9)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' }}
                  >
                    Got it, let's build →
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Milestone celebration modals */}
      <MilestoneModal
        milestone={activeMilestone}
        onClose={() => setActiveMilestone(null)}
        isDark={isDark}
      />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: textMain, margin: 0 }}>
              Profile Bank
            </h2>
            <button
              onClick={() => { window.location.href = '/?view=report'; }}
              style={{
                fontSize: 12, fontWeight: 600, color: isDark ? '#6b7280' : '#9ca3af',
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
                textDecoration: 'underline', textUnderlineOffset: 3, flexShrink: 0,
              }}
            >
              {(profile as any)?.hasCompletedOnboarding ? 'View Diagnostic' : 'Run Diagnostic'}
            </button>
          </div>
          <p style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 4 }}>
            Your achievement bank — the source of truth for every resume and cover letter JobHub generates. Complete it once, use it forever.
          </p>
        </div>

        <ActivityWidget />

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
          {/* Main column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(profile as any)?.hasCompletedOnboarding && ((profile as any)?.freeGenerationsUsed ?? 0) === 0 && (
              <BaselineResumeBanner isDark={isDark} />
            )}
            {/* Identity Cards */}
            {Array.isArray((profile as any)?.identityCards) && (profile as any).identityCards.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Roles You Should Target</h3>
                  <button
                    onClick={handleRegenerateIdentity}
                    disabled={regenerating}
                    className="text-[10px] font-bold text-slate-500 hover:text-brand-400 transition-colors disabled:opacity-40"
                  >
                    {regenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                </div>
                <div className="grid gap-3">
                  {(profile as any).identityCards.map((card: any, i: number) => (
                    <div key={`${card.label ?? ''}-${i}`} className="border border-slate-700/50 rounded-xl bg-slate-900/60 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-bold text-white">{card.label}</h4>
                        {card.evidenceBasis === 'limited' && (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full ml-2 shrink-0">
                            Limited data
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{card.summary}</p>
                      {Array.isArray(card.keyStrengths) && card.keyStrengths.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {card.keyStrengths.map((s: string) => (
                            <span key={s} className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <SourceDocumentsIsland profile={profile} isDark={isDark} />
            <PersonalDetailsIsland profile={profile} isDark={isDark} />
            <SummaryIsland profile={profile} isDark={isDark} />
            <ExperienceIsland experience={profile.experience} achievements={profile.achievements} isDark={isDark} />
            <ProjectsIsland experience={profile.experience} achievements={profile.achievements} isDark={isDark} />
            <EducationIsland education={profile.education} isDark={isDark} />
            <SkillsIsland skills={profile.skills} isDark={isDark} />
            <CertificationsIsland certifications={profile.certifications} isDark={isDark} />
            <VolunteeringIsland volunteering={profile.volunteering} isDark={isDark} />
          </div>

          {/* Sidebar */}
          <CompletionSidebar
            completion={profile.completion}
            isDark={isDark}
            targetRole={profile.targetRole ?? undefined}
            plan={(profile as any).plan}
            planStatus={(profile as any).planStatus}
          />
        </div>
      </div>
    </div>
  );
};
