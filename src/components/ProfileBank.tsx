import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pencil, Check, X, AlertTriangle, CheckCircle2,
  User, Briefcase, GraduationCap,
  Award, Heart, Wrench, FileText, UploadCloud, RefreshCw, HelpCircle,
  Heading2, List, Pilcrow,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { SectionIntroBanner } from './processStrip';
import { ProfileExplainerModal, hasSeenProfileExplainer } from './ProfileExplainerModal';
import { AchievementVideoModal } from './AchievementVideoModal';
import { trackAchievementAdded } from '../lib/analytics';
import { toggleEmphasis, type EmphasisMarker } from '../lib/toggleEmphasis';
import { toggleLinePrefix, continueList, lineStyleOf, type LineStyle } from '../lib/toggleLinePrefix';

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

function inputStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
    borderRadius: 8,
    border: `1px solid ${'rgba(0,0,0,0.12)'}`,
    background: 'rgba(0,0,0,0.03)',
    color: '#111827',
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
  badge?: React.ReactNode;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, badge }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    paddingBottom: 12,
    marginBottom: 16,
    borderBottom: `1px solid ${'rgba(0,0,0,0.07)'}`,
  }}>
    <span style={{ color: '#9ca3af' }}>{icon}</span>
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: '#9ca3af',
    }}>{title}</span>
    {badge && <span style={{ marginLeft: 'auto' }}>{badge}</span>}
  </div>
);

// ── Island ────────────────────────────────────────────────────────────────────

interface IslandProps {
  children: React.ReactNode;
}

const Island: React.FC<IslandProps> = ({ children }) => (
  <div style={{
    background: '#ffffff',
    border: `1px solid ${'rgba(0,0,0,0.08)'}`,
    borderRadius: 14,
    padding: '20px 24px',
  }}>
    {children}
  </div>
);

// ── EditButton ────────────────────────────────────────────────────────────────

const EditButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    aria-label="Edit"
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
      background: 'rgba(0,0,0,0.05)',
      color: '#6b7280',
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
}> = ({ onSave, onCancel, saving }) => (
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
        background: 'rgba(0,0,0,0.06)',
        color: '#6b7280', fontSize: 12, fontWeight: 700,
      }}
    >
      <X size={12} /> Cancel
    </button>
  </div>
);

// ── SourceDocumentsIsland ─────────────────────────────────────────────────────

// ── BankIsland ────────────────────────────────────────────────────────────────

/**
 * The bank itself — `profile.resumeRawText`, the document every generated
 * resume and cover letter is built from.
 *
 * Deliberately one plain textarea rather than per-field forms. The structured
 * islands below edit database rows that generation does not read, which is why
 * their save buttons were disconnected in June. This edits the actual document,
 * so a change here reaches every future application.
 *
 * Free-form is also simply easier to use: no ambiguity about which line was
 * meant, no dead ends on repeated lines, and a person can fix anything they can
 * see. The safety is not in restricting the edit, it is that the previous
 * version is snapshotted before every save, so Undo always works.
 */
const BankIsland: React.FC = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  // Real page count from the PDF renderer, not an estimate. Debounced, because
  // each measurement is a full render.
  const [pages, setPages] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ text: string; hasBank: boolean; versions: number }>({
    queryKey: ['profile-bank'],
    queryFn: async () => (await api.get('/profile/bank')).data,
  });

  const save = useMutation({
    mutationFn: (text: string) => api.put('/profile/bank', { text }),
    onSuccess: ({ data: res }) => {
      setEditing(false);
      setNotice(res.warning ? `${res.summary} ${res.warning}` : res.summary);
      qc.setQueryData(['profile-bank'], (old: any) => ({ ...old, text: res.text }));
      qc.invalidateQueries({ queryKey: ['profile-bank'] });
    },
    onError: (e: any) => setNotice(e?.response?.data?.error ?? 'Could not save.'),
  });

  const undo = useMutation({
    mutationFn: () => api.post('/profile/bank/undo'),
    onSuccess: ({ data: res }) => {
      setNotice('Reverted to the previous version.');
      qc.setQueryData(['profile-bank'], (old: any) => ({ ...old, text: res.text }));
      qc.invalidateQueries({ queryKey: ['profile-bank'] });
    },
    onError: (e: any) => setNotice(e?.response?.data?.error ?? 'Nothing to undo.'),
  });

  const text = data?.text ?? '';

  // Measure whatever is currently on screen: the draft while editing, the saved
  // document otherwise. Debounced at 600ms so typing stays responsive.
  const measured = editing ? draft : text;
  useEffect(() => {
    if (!measured.trim()) { setPages(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { countResumePages } = await import('../lib/exportPdf');
        const n = await countResumePages(measured);
        if (!cancelled) setPages(n);
      } catch {
        if (!cancelled) setPages(null);   // never let a failed measure block editing
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [measured]);

  const startEditing = () => {
    setDraft(text);
    setNotice(null);
    setActiveLineStyle(lineStyleOf(currentLine(text, 0)));
    setEditing(true);
  };

  /* ── Formatting toolbar ────────────────────────────────────────────────
     Same behaviour as the draft editor in the apply flow, over the same two
     pure modules. This editor had no toolbar at all, so every heading and
     bullet here had to be typed by hand from the instructions above it.   */

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);
  const [activeLineStyle, setActiveLineStyle] = useState<LineStyle>('body');

  const currentLine = (value: string, position: number) => {
    const start = position <= 0 ? 0 : value.lastIndexOf('\n', position - 1) + 1;
    const newline = value.indexOf('\n', position);
    return value.slice(start, newline === -1 ? value.length : newline);
  };

  const syncActiveLineStyle = () => {
    const textarea = editorRef.current;
    if (!textarea) return;
    setActiveLineStyle(lineStyleOf(currentLine(textarea.value, textarea.selectionStart)));
  };

  const applyEmphasis = (marker: EmphasisMarker) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const result = toggleEmphasis(draft, textarea.selectionStart, textarea.selectionEnd, marker);
    if (result.text === draft) return;
    pendingSelection.current = [result.selectionStart, result.selectionEnd];
    setDraft(result.text);
  };

  const applyLineStyle = (style: LineStyle) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const result = toggleLinePrefix(draft, textarea.selectionStart, textarea.selectionEnd, style);
    if (result.text === draft) return;
    pendingSelection.current = [result.selectionStart, result.selectionEnd];
    setDraft(result.text);
    setActiveLineStyle(lineStyleOf(currentLine(result.text, result.selectionStart)));
  };

  // Restore the caret after React has re-rendered with the new draft, so the
  // marked text stays selected and pressing the button again undoes it.
  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    const textarea = editorRef.current;
    if (!pending || !textarea) return;
    pendingSelection.current = null;
    textarea.focus();
    textarea.setSelectionRange(pending[0], pending[1]);
  }, [draft]);

  return (
    <Island>
      <SectionHeader
        icon={<FileText size={13} />}
        title="Your bank"
        badge={!editing && data?.hasBank ? <EditButton onClick={startEditing} /> : undefined}
      />

      <p style={{ fontSize: 13, lineHeight: 1.6, color: '#6b7280', margin: '0 0 12px' }}>
        This is what every resume and cover letter we build for you is written from.
        Edit anything here and the next application picks it up.
      </p>

      {/*
        The length signal. Measured from the real PDF renderer, so it is the
        page count they will actually get - not a guess from line counts, which
        cannot account for wrapping, headings or bold runs.
      */}
      {pages !== null && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 14,
          padding: '7px 12px', borderRadius: 8,
          background: pages > 2 ? 'rgba(196,72,48,0.08)' : 'rgba(16,133,80,0.07)',
          border: `1px solid ${pages > 2 ? 'rgba(196,72,48,0.28)' : 'rgba(16,133,80,0.22)'}`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: pages > 2 ? '#9b2c1a' : '#0f6b41' }}>
            {pages} {pages === 1 ? 'page' : 'pages'}
          </span>
          <span style={{ fontSize: 12.5, color: pages > 2 ? '#9b2c1a' : '#4b5563' }}>
            {pages > 2
              ? 'Too long. Recruiters rarely read past two - trim it back.'
              : 'Good length.'}
          </span>
        </div>
      )}

      {notice && (
        <div style={{
          fontSize: 13, lineHeight: 1.5, color: '#374151', background: 'rgba(0,0,0,0.04)',
          border: '1px solid rgba(0,0,0,0.07)', borderRadius: 9, padding: '9px 12px', marginBottom: 14,
        }}>
          {notice}
          {(data?.versions ?? 0) > 0 && (
            <button
              onClick={() => undo.mutate()}
              disabled={undo.isPending}
              style={{
                marginLeft: 10, background: 'transparent', border: 'none', padding: 0,
                cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#2563eb',
              }}
            >
              {undo.isPending ? 'Undoing…' : 'Undo'}
            </button>
          )}
        </div>
      )}

      {isLoading && <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading…</div>}

      {!isLoading && !data?.hasBank && (
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          You do not have a bank yet. Upload your resume above and we will build one.
        </div>
      )}

      {!isLoading && data?.hasBank && !editing && (
        <pre style={{
          margin: 0, padding: '16px 18px', borderRadius: 10,
          background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.06)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12.5, lineHeight: 1.65, color: '#111827',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          maxHeight: 460, overflowY: 'auto',
        }}>{text}</pre>
      )}

      {editing && (
        <>
          {/*
            Above the textarea, not below it: the format is only obvious once
            you know it, and someone who types a heading without "##" gets a
            line of body text with no warning that anything went wrong.
          */}
          <div style={{
            marginBottom: 14, padding: '14px 16px', borderRadius: 10,
            background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.16)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
              Two rules, and everything works
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>
              <div style={{ marginBottom: 4 }}>
                Put the cursor on a line and use the buttons below: <strong>heading</strong> for a
                new section, <strong>list</strong> for a point, <strong>¶</strong> for ordinary text.
                The lit-up button tells you what the line already is.
              </div>
              <div style={{ marginBottom: 10 }}>
                Press <strong>Enter</strong> at the end of a point and the next one starts itself.
                Press it on an empty point to finish the list.
              </div>
              <pre style={{
                margin: 0, padding: '11px 13px', borderRadius: 8,
                background: '#fff', border: '1px solid rgba(0,0,0,0.09)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12.5, lineHeight: 1.7, color: '#111827', whiteSpace: 'pre-wrap',
              }}>{'## Hobbies\n- Long distance running\n- Volunteer surf lifesaving'}</pre>
              <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 9 }}>
                Typing the marks by hand works too — that is all the buttons do.
              </div>
            </div>
          </div>

          {/* Toolbar. Sits directly on top of the textarea and shares its
              border, so the two read as one editor rather than two boxes.
              `onMouseDown` is prevented so clicking a button never pulls focus
              out of the textarea, which would drop the selection before the
              toggle could act on it. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 8px',
            borderRadius: '10px 10px 0 0',
            border: '1px solid rgba(0,0,0,0.18)',
            borderBottom: 'none',
            background: '#f9fafb',
          }}>
            {([
              { style: 'heading' as LineStyle, Icon: Heading2, title: 'Section heading' },
              { style: 'bullet' as LineStyle, Icon: List, title: 'Bullet point' },
              { style: 'body' as LineStyle, Icon: Pilcrow, title: 'Plain paragraph' },
            ]).map(({ style, Icon, title }) => {
              const active = activeLineStyle === style;
              return (
                <button
                  key={style}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => applyLineStyle(style)}
                  title={title}
                  aria-label={title}
                  aria-pressed={active}
                  style={{
                    width: 28, height: 26,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? 'rgba(37,99,235,0.10)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(37,99,235,0.55)' : 'rgba(0,0,0,0.10)'}`,
                    borderRadius: 6,
                    color: active ? '#2563eb' : '#6b7280',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  <Icon size={14} strokeWidth={active ? 2.4 : 2} />
                </button>
              );
            })}

            <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.12)', margin: '0 3px' }} />

            {([
              { marker: '**' as EmphasisMarker, label: 'B', title: 'Bold (Ctrl+B)', weight: 800, fontStyle: 'normal' as const },
              { marker: '*' as EmphasisMarker, label: 'I', title: 'Italic (Ctrl+I)', weight: 500, fontStyle: 'italic' as const },
            ]).map(({ marker, label, title, weight, fontStyle }) => (
              <button
                key={label}
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyEmphasis(marker)}
                title={title}
                aria-label={title}
                style={{
                  width: 26, height: 26,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent',
                  border: '1px solid rgba(0,0,0,0.10)',
                  borderRadius: 6,
                  color: '#6b7280',
                  fontSize: 13, fontWeight: weight, fontStyle, lineHeight: 1,
                  cursor: 'pointer', padding: 0,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <textarea
            ref={editorRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onSelect={syncActiveLineStyle}
            onClick={syncActiveLineStyle}
            onKeyUp={syncActiveLineStyle}
            onKeyDown={e => {
              // Enter carries the list on, so a section of points costs one
              // `- ` rather than one per line. Shift+Enter is left alone as
              // the way to break out mid-point.
              if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const textarea = e.currentTarget;
                const carried = continueList(draft, textarea.selectionStart, textarea.selectionEnd);
                if (carried) {
                  e.preventDefault();
                  pendingSelection.current = [carried.selectionStart, carried.selectionEnd];
                  setDraft(carried.text);
                  setActiveLineStyle(lineStyleOf(currentLine(carried.text, carried.selectionStart)));
                }
                return;
              }
              if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
              const key = e.key.toLowerCase();
              if (key !== 'b' && key !== 'i') return;
              e.preventDefault();
              applyEmphasis(key === 'b' ? '**' : '*');
            }}
            spellCheck
            style={{
              width: '100%', boxSizing: 'border-box', minHeight: 460, resize: 'vertical',
              padding: '16px 18px', borderRadius: '0 0 10px 10px',
              border: '1px solid rgba(0,0,0,0.18)', background: '#fff', color: '#111827',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12.5, lineHeight: 1.65, outline: 'none',
              display: 'block',
            }}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <button
              onClick={() => save.mutate(draft)}
              disabled={save.isPending || draft === text}
              style={{
                padding: '9px 18px', borderRadius: 9, border: 'none',
                background: draft === text ? 'rgba(0,0,0,0.12)' : '#111827',
                color: '#fff', fontSize: 13.5, fontWeight: 600,
                cursor: save.isPending || draft === text ? 'default' : 'pointer',
              }}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setNotice(null); }}
              style={{
                padding: '9px 14px', borderRadius: 9, border: 'none', background: 'transparent',
                color: '#6b7280', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
              Saved automatically to history — you can undo.
            </span>
          </div>
        </>
      )}
    </Island>
  );
};

const SourceDocumentsIsland: React.FC<{ profile: ProfileData }> = ({ profile }) => {
  const qc = useQueryClient();
  const resumeRef = useRef<HTMLInputElement>(null);

  const [pendingResume, setPendingResume] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const hasAny = !!pendingResume;

  async function handleUpdate() {
    if (!hasAny) return;
    setUploading(true);
    try {
      const fd = new FormData();
      if (pendingResume) fd.append('resume', pendingResume);
      const { data } = await api.post('/profile/source-documents', fd, { timeout: 180_000 });

      if (data.status === 'extracted') {
        toast.success('Profile re-extracted from your new resume.');
        qc.invalidateQueries({ queryKey: ['profile'] });
      } else if (data.status === 'raw_saved_extract_failed') {
        toast.warning('Your resume was saved and will be used for generation, but the profile view failed to refresh. Try re-uploading.');
        qc.invalidateQueries({ queryKey: ['profile'] });
      } else {
        toast.success('Updated.');
        qc.invalidateQueries({ queryKey: ['profile'] });
      }
      setPendingResume(null);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const docBg    = 'rgba(0,0,0,0.03)';
  const docBorder = 'rgba(0,0,0,0.08)';
  const mutedText = '#9ca3af';
  const mainText  = '#111827';

  const docs = [
    {
      label:    'Resume',
      required: true,
      stored:   profile.resumeFilename,
      pending:  pendingResume,
      ref:      resumeRef,
      onPick:   (f: File) => setPendingResume(f),
    },
  ];

  const updatedLabel = profile.documentsUpdatedAt
    ? new Date(profile.documentsUpdatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Island>
      <SectionHeader
        icon={<FileText size={13} />}
        title="Your Resume"
                badge={
          updatedLabel
            ? <span style={{ fontSize: 10, color: mutedText }}>Updated {updatedLabel}</span>
            : undefined
        }
      />

      <p style={{ fontSize: 12, color: mutedText, marginBottom: 16, lineHeight: 1.5 }}>
        Your resume is the source of truth. Everything on this page is extracted from it, and you can edit any of it below. Upload a new resume any time to replace what is stored.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map(({ label, required, stored, pending, ref, onPick }) => (
          <div
            key={label}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10,
              background: pending ? ('rgba(99,102,241,0.05)') : docBg,
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
                background: 'rgba(0,0,0,0.06)',
                color: '#6b7280',
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
                onClick={() => { setPendingResume(null); }}
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
}

const PersonalDetailsIsland: React.FC<PersonalDetailsIslandProps> = ({ profile }) => {
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

  const inp = inputStyle();
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#9ca3af',
    letterSpacing: '0.06em', display: 'block', marginBottom: 4,
  };

  return (
    <Island>
      <SectionHeader icon={<User size={13} />} title="Personal Details"         badge={<EditButton onClick={() => setEditing(e => !e)} />} />

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
                          />
          </motion.div>
        ) : (
          <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
              {profile.name || <span style={{ color: '#d97706' }}>No name set</span>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 8 }}>
              {[
                { label: 'Email', value: profile.email },
                { label: 'Phone', value: profile.phone },
                { label: 'Location', value: profile.location },
                { label: 'LinkedIn', value: profile.linkedin },
              ].map(({ label, value }) => (
                <span key={label} style={{ fontSize: 13, color: '#6b7280' }}>
                  <span style={{ fontWeight: 700, color: '#9ca3af', marginRight: 4 }}>{label}:</span>
                  {value || <span style={{ color: '#d97706' }}>missing</span>}
                </span>
              ))}
            </div>
            {!profile.phone && <CoachHint hint={{ type: 'warn', message: 'Add your phone number, many recruiters call before emailing.' }} />}
            {!profile.linkedin && <CoachHint hint={{ type: 'warn', message: 'Add your LinkedIn URL to give recruiters a quick verification path.' }} />}
          </motion.div>
        )}
      </AnimatePresence>
    </Island>
  );
};

/*
 * SummaryIsland removed 2026-08-02.
 *
 * `professionalSummary` had exactly two readers left, and neither runs:
 * buildTemplateResume, which /generate/:type now answers 410 for, and
 * profileToCoverLetterData, which has no callers at all. Editing the summary
 * changed nothing a candidate could see.
 *
 * The column and its data are untouched — only the editor is gone.
 */

// ── AchievementRow ────────────────────────────────────────────────────────────

interface AchievementRowProps {
  ach: Achievement;
}

const AchievementRow: React.FC<AchievementRowProps> = ({ ach }) => {
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
  const inp = inputStyle();

  return (
    <div style={{
      padding: '12px 0',
      borderBottom: `1px solid ${'rgba(0,0,0,0.05)'}`,
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
                <SaveCancelButtons onSave={() => mutation.mutate(form)} onCancel={() => setEditing(false)} saving={mutation.isPending} />
              </motion.div>
            ) : (
              <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', marginBottom: 3 }}>{ach.title}</p>
                <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{ach.description}</p>
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
                  <span style={{ display: 'inline-block', marginTop: 5, padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.04)', color: '#9ca3af', border: `1px solid ${'rgba(0,0,0,0.08)'}` }}>
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
                  isDark={false}
                  achievementDescription={ach.description}
                  onMarkQualitative={markQualitative}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!editing && <EditButton onClick={() => setEditing(true)} />}
      </div>
    </div>
  );
};

// ── AddAchievementForm ────────────────────────────────────────────────────────
// Inline "+ Add achievement" affordance shown under each role. Self-contained
// so it can drop into both ExperienceIsland and ProjectsIsland. POSTs with
// experienceId so the new entry nests under the role it was added from.

const AddAchievementForm: React.FC<{ experienceId: string }> = ({ experienceId }) => {
  const qc = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', metric: '', metricType: '' });
  const inp = inputStyle();

  const reset = () => {
    setForm({ title: '', description: '', metric: '', metricType: '' });
    setIsAdding(false);
  };

  const addMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/achievements', { ...data, experienceId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      trackAchievementAdded();
      reset();
      toast.success('Achievement added.');
    },
    onError: () => toast.error('Failed to add achievement.'),
  });

  const submit = () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Add a title and a short description first.');
      return;
    }
    addMutation.mutate(form);
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
      >
        + Add achievement
      </button>
    );
  }

  return (
    <motion.div key="add-achievement" {...slideIn} style={{ marginTop: 4 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <input autoFocus style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title" />
        <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What you did and why it mattered." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input style={inp} value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))} placeholder="Metric (e.g. 40%)" />
          <input style={inp} value={form.metricType} onChange={e => setForm(f => ({ ...f, metricType: e.target.value }))} placeholder="Type (e.g. revenue growth)" />
        </div>
      </div>
      <SaveCancelButtons onSave={submit} onCancel={reset} saving={addMutation.isPending} />
    </motion.div>
  );
};

// ── ExperienceIsland ──────────────────────────────────────────────────────────

interface ExperienceIslandProps {
  experience: Experience[];
  achievements: Achievement[];
}

const ExperienceIsland: React.FC<ExperienceIslandProps> = ({ experience, achievements }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, {
    company: string; role: string; startDate: string; endDate: string; description: string;
  }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ role: '', company: '', startDate: '', endDate: '', description: '' });

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

  const addMutation = useMutation({
    mutationFn: (data: typeof addForm) => api.post('/experience', { ...data, type: 'work' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      setIsAdding(false);
      setAddForm({ role: '', company: '', startDate: '', endDate: '', description: '' });
      toast.success('Experience added.');
    },
    onError: () => toast.error('Failed to add experience.'),
  });

  const submitAdd = () => {
    if (!addForm.role.trim() || !addForm.company.trim() || !addForm.startDate.trim()) {
      toast.error('Role, company and start date are required.');
      return;
    }
    addMutation.mutate(addForm);
  };

  const inp = inputStyle();
  const workEntries = experience.filter(e => !e.type || e.type === 'work');

  return (
    <Island>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Briefcase size={13} />} title="Work Experience" />
        {!isAdding && (
          <button onClick={() => setIsAdding(true)} style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
            + Add
          </button>
        )}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div key="add-experience" {...slideIn} style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
              {(['role', 'company', 'startDate', 'endDate'] as const).map(f => (
                <div key={f}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                    {f === 'startDate' ? 'Start' : f === 'endDate' ? 'End' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </span>
                  <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Description</span>
              <textarea rows={4} style={{ ...inp, resize: 'vertical' }} value={addForm.description}
                onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <SaveCancelButtons onSave={submitAdd} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} />
          </motion.div>
        )}
      </AnimatePresence>

      {workEntries.length === 0 && !isAdding && (
        <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
          No experience yet. Upload a resume, or click <strong>+ Add</strong> above.
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
            borderBottom: `1px solid ${'rgba(0,0,0,0.06)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <AnimatePresence mode="wait">
                  {isEditing ? (
                    <motion.div key="edit" {...slideIn}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                        {(['role', 'company', 'startDate', 'endDate'] as const).map(f => (
                          <div key={f}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                              {f === 'startDate' ? 'Start' : f === 'endDate' ? 'End' : f.charAt(0).toUpperCase() + f.slice(1)}
                            </span>
                            <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [exp.id]: { ...form, [f]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Description</span>
                        <textarea rows={4} style={{ ...inp, resize: 'vertical' }} value={form.description}
                          onChange={e => setForms(prev => ({ ...prev, [exp.id]: { ...form, description: e.target.value } }))} />
                      </div>
                      <SaveCancelButtons
                        onSave={() => mutation.mutate({ id: exp.id, data: form })}
                        onCancel={() => setEditingId(null)}
                        saving={mutation.isPending}
                                              />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>{exp.role}</p>
                      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                        {exp.company} · {exp.startDate}–{exp.endDate ?? 'Present'}
                      </p>
                      {exp.description && (
                        <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginTop: 6 }}>{exp.description}</p>
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
                                  />
              )}
            </div>

            {/* Nested achievements */}
            <div style={{
              marginTop: 12, marginLeft: 16,
              paddingLeft: 16,
              borderLeft: `2px solid ${'rgba(99,102,241,0.2)'}`,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Achievements
              </p>
              {linked.map(ach => (
                <AchievementRow key={ach.id} ach={ach} />
              ))}
              <AddAchievementForm experienceId={exp.id} />
            </div>
          </div>
        );
      })}
    </Island>
  );
};

// ── ProjectsIsland ────────────────────────────────────────────────────────────

const ProjectsIsland: React.FC<{ experience: Experience[]; achievements: Achievement[] }> = ({ experience, achievements }) => {
  const projects = experience.filter(e => e.type === 'project');
  if (projects.length === 0) return null;

  return (
    <Island>
      <SectionHeader icon={<Briefcase size={13} />} title="Projects" />
      {projects.map(proj => {
        const linked = achievements.filter(a => a.experienceId === proj.id);
        return (
          <div key={proj.id} style={{
            marginBottom: 20, paddingBottom: 20,
            borderBottom: `1px solid ${'rgba(0,0,0,0.06)'}`,
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>{proj.role}</p>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              {proj.company} · {proj.startDate}{proj.endDate ? `–${proj.endDate}` : ''}
            </p>
            {proj.description && (
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginTop: 6 }}>{proj.description}</p>
            )}
            <div style={{
              marginTop: 12, marginLeft: 16, paddingLeft: 16,
              borderLeft: `2px solid ${'rgba(99,102,241,0.2)'}`,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Achievements
              </p>
              {linked.map(ach => <AchievementRow key={ach.id} ach={ach} />)}
              <AddAchievementForm experienceId={proj.id} />
            </div>
          </div>
        );
      })}
    </Island>
  );
};

// ── EducationIsland ───────────────────────────────────────────────────────────

const EducationIsland: React.FC<{ education: Education[] }> = ({ education }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { institution: string; degree: string; field: string; year: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ institution: '', degree: '', field: '', year: '' });

  const inp = inputStyle();

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
    <Island>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<GraduationCap size={13} />} title="Education" />
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
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </span>
                  <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
            <SaveCancelButtons onSave={() => addMutation.mutate(addForm)} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} />
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
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#dc2626' }}>
              No education records found. Add your degree so it appears in generated resumes, click <strong>+ Add</strong> above.
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
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                              {f.charAt(0).toUpperCase() + f.slice(1)}
                            </span>
                            <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [edu.id]: { ...form, [f]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                      <SaveCancelButtons onSave={() => editMutation.mutate({ id: edu.id, data: form })} onCancel={() => setEditingId(null)} saving={editMutation.isPending} />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{edu.degree}{edu.field && ` in ${edu.field}`}</p>
                      <p style={{ fontSize: 13, color: '#6b7280' }}>{edu.institution}{edu.year && ` · ${edu.year}`}</p>
                      {hint && <CoachHint hint={hint} />}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <EditButton onClick={() => { setForms(prev => ({ ...prev, [edu.id]: { institution: edu.institution, degree: edu.degree, field: edu.field ?? '', year: edu.year ?? '' } })); setEditingId(edu.id); }} />
                  <button onClick={() => deleteMutation.mutate(edu.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
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

const SkillsIsland: React.FC<{ skills: string | null }> = ({ skills }) => {
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

  const inp = inputStyle();

  return (
    <Island>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Wrench size={13} />} title="Skills" />
        {!editing && <EditButton onClick={openEdit} />}
      </div>

      {editing ? (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {localSkills.map(s => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
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
          <SaveCancelButtons onSave={() => mutation.mutate(localSkills)} onCancel={() => setEditing(false)} saving={mutation.isPending} />
        </div>
      ) : (
        <>
          {allSkills.length === 0 ? (
            <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No skills found.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allSkills.map((skill, i) => (
                <span key={i} style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, background: 'rgba(0,0,0,0.05)', color: '#374151', border: `1px solid ${'rgba(0,0,0,0.08)'}` }}>
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

const CertificationsIsland: React.FC<{ certifications: Certification[] }> = ({ certifications }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { name: string; issuingBody: string; year: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', issuingBody: '', year: '' });

  const inp = inputStyle();

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
    <Island>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Award size={13} />} title="Certifications" />
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
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                    {f === 'issuingBody' ? 'Issuing Body' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </span>
                  <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
            <SaveCancelButtons onSave={() => addMutation.mutate(addForm)} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} />
          </motion.div>
        )}
      </AnimatePresence>

      {certifications.length === 0 && !isAdding && (
        <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No certifications on record.</p>
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
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                              {f === 'issuingBody' ? 'Issuing Body' : f.charAt(0).toUpperCase() + f.slice(1)}
                            </span>
                            <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [cert.id]: { ...form, [f]: e.target.value } }))} />
                          </div>
                        ))}
                      </div>
                      <SaveCancelButtons onSave={() => editMutation.mutate({ id: cert.id, data: form })} onCancel={() => setEditingId(null)} saving={editMutation.isPending} />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{cert.name}</p>
                      <p style={{ fontSize: 12, color: '#6b7280' }}>{cert.issuingBody}{cert.year && ` · ${cert.year}`}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <EditButton onClick={() => { setForms(prev => ({ ...prev, [cert.id]: { name: cert.name, issuingBody: cert.issuingBody, year: cert.year ?? '' } })); setEditingId(cert.id); }} />
                  <button onClick={() => deleteMutation.mutate(cert.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
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

const VolunteeringIsland: React.FC<{ volunteering: Volunteering[] }> = ({ volunteering }) => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { organization: string; role: string; description: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({ organization: '', role: '', description: '' });

  const inp = inputStyle();

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
    <Island>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionHeader icon={<Heart size={13} />} title="Volunteering" />
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
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </span>
                <input style={inp} value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Description (optional)</span>
              <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <SaveCancelButtons onSave={() => addMutation.mutate(addForm)} onCancel={() => setIsAdding(false)} saving={addMutation.isPending} />
          </motion.div>
        )}
      </AnimatePresence>

      {volunteering.length === 0 && !isAdding && (
        <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No volunteering records.</p>
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
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                          </span>
                          <input style={inp} value={form[f]} onChange={e => setForms(prev => ({ ...prev, [vol.id]: { ...form, [f]: e.target.value } }))} />
                        </div>
                      ))}
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>Description (optional)</span>
                        <textarea rows={3} style={{ ...inp, resize: 'vertical' }} value={form.description} onChange={e => setForms(prev => ({ ...prev, [vol.id]: { ...form, description: e.target.value } }))} />
                      </div>
                      <SaveCancelButtons onSave={() => editMutation.mutate({ id: vol.id, data: form })} onCancel={() => setEditingId(null)} saving={editMutation.isPending} />
                    </motion.div>
                  ) : (
                    <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1f2937' }}>{vol.role}</p>
                      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: vol.description ? 4 : 0 }}>{vol.organization}</p>
                      {vol.description && <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{vol.description}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {!isEditing && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <EditButton onClick={() => { setForms(prev => ({ ...prev, [vol.id]: { organization: vol.organization, role: vol.role, description: vol.description ?? '' } })); setEditingId(vol.id); }} />
                  <button onClick={() => deleteMutation.mutate(vol.id)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${'rgba(0,0,0,0.08)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
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

// ── ProfileBank (main export) ─────────────────────────────────────────────────

export const ProfileBank: React.FC = () => {
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
  const [explainerOpen, setExplainerOpen] = useState(() => !hasSeenProfileExplainer());

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

  const pageBg = warm.colors.bgCanvas;
  const textMain = warm.colors.textPrimary;

  if (isLoading) {
    return (
      <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
        <div style={{ width: 20, height: 20, border: `2px solid ${'rgba(99,102,241,0.2)'}`, borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ marginLeft: 12, fontSize: 14 }}>Loading profile…</span>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div style={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <AlertTriangle size={24} style={{ color: '#d97706' }} />
        <p style={{ fontSize: 14, color: '#6b7280' }}>Could not load your profile. Refresh the page to try again.</p>
      </div>
    );
  }

  return (
    <div style={{ background: pageBg, minHeight: '100%', padding: '24px 0', color: textMain, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <SectionIntroBanner sectionId="profile">
          Your master profile. Update it once and every future application pulls from here — no more rewriting your story.
        </SectionIntroBanner>
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: textMain, margin: 0 }}>
                Profile Bank
              </h2>
              <button
                onClick={() => setExplainerOpen(true)}
                aria-label="How the Profile Bank works"
                title="How the Profile Bank works"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: warm.colors.textMuted,
                  padding: 4,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <HelpCircle size={16} />
              </button>
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            Your achievement bank, the source of truth for every resume and cover letter JobHub generates. Complete it once, use it forever.
          </p>
        </div>

        <ProfileExplainerModal open={explainerOpen} onClose={() => setExplainerOpen(false)} />

        {/* Single-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, alignItems: 'start' }}>
          {/* Main column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Identity Cards */}
            {Array.isArray((profile as any)?.identityCards) && (profile as any).identityCards.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: warm.colors.textSecondary,
                    margin: 0,
                  }}>
                    Roles You Should Target
                  </h3>
                  <button
                    onClick={handleRegenerateIdentity}
                    disabled={regenerating}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: warm.colors.textMuted,
                      background: 'transparent',
                      border: 'none',
                      cursor: regenerating ? 'not-allowed' : 'pointer',
                      opacity: regenerating ? 0.4 : 1,
                      padding: 0,
                    }}
                  >
                    {regenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(profile as any).identityCards.map((card: any, i: number) => (
                    <div
                      key={`${card.label ?? ''}-${i}`}
                      style={{
                        border: `1px solid ${warm.colors.borderWhisper}`,
                        borderRadius: 12,
                        background: warm.colors.bgSurface,
                        padding: 18,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          color: warm.colors.textPrimary,
                        }}>
                          {card.label}
                        </h4>
                        {card.evidenceBasis === 'limited' && (
                          <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: warm.colors.accentGold,
                            background: 'rgba(197,160,89,0.10)',
                            padding: '2px 8px',
                            borderRadius: 999,
                            marginLeft: 8,
                            flexShrink: 0,
                            lineHeight: '16px',
                          }}>
                            Limited data
                          </span>
                        )}
                      </div>
                      <p style={{
                        margin: '0 0 10px',
                        fontSize: 12.5,
                        color: warm.colors.textSecondary,
                        lineHeight: 1.6,
                      }}>
                        {card.summary}
                      </p>
                      {Array.isArray(card.keyStrengths) && card.keyStrengths.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {card.keyStrengths.map((s: string) => (
                            <span
                              key={s}
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: warm.colors.textSecondary,
                                background: warm.colors.bgAlt,
                                padding: '2px 8px',
                                borderRadius: 999,
                                lineHeight: '18px',
                              }}
                            >
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
            <BankIsland />
            <SourceDocumentsIsland profile={profile} />
            <PersonalDetailsIsland profile={profile} />
            <ExperienceIsland experience={profile.experience} achievements={profile.achievements} />
            <ProjectsIsland experience={profile.experience} achievements={profile.achievements} />
            <EducationIsland education={profile.education} />
            <SkillsIsland skills={profile.skills} />
            <CertificationsIsland certifications={profile.certifications} />
            <VolunteeringIsland volunteering={profile.volunteering} />
          </div>

        </div>
      </div>
    </div>
  );
};
