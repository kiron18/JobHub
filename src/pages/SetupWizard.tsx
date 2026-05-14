import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle, ArrowRight, Briefcase, FileText, Award, GraduationCap, Zap, Heart } from 'lucide-react';
import api from '../lib/api';
import { trackBaselineResumeDownloadedFromWizard } from '../lib/analytics';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProfileData {
  professionalSummary?: string;
  skills?: string;
  experience?: ExperienceEntry[];
  achievements?: AchievementEntry[];
  education?: EducationEntry[];
  certifications?: CertEntry[];
  volunteering?: VolEntry[];
}

interface ExperienceEntry {
  id: string;
  company?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

interface AchievementEntry {
  id: string;
  title?: string;
  metric?: string;
  description?: string;
}

interface EducationEntry {
  id: string;
  institution?: string;
  degree?: string;
  year?: string;
}

interface CertEntry {
  id: string;
  name?: string;
  issuingBody?: string;
  year?: string;
}

interface VolEntry {
  id: string;
  organization?: string;
  role?: string;
  description?: string;
}

type StepType = 'summary' | 'experience' | 'achievements' | 'education' | 'certifications' | 'volunteering' | 'skills' | 'complete';

interface WizardStep {
  type: StepType;
  label: string;
  optional: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseSkills(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.join(', ');
    if (typeof parsed === 'object' && parsed !== null) return Object.values(parsed).flat().join(', ');
  } catch { /* not JSON */ }
  return raw;
}

type BaselineResumeState =
  | { status: 'unknown' }
  | { status: 'generating' }
  | { status: 'ready'; documentId: string }
  | { status: 'error' };

async function fetchBaselineState(): Promise<BaselineResumeState> {
  try {
    const { data } = await api.get('/profile/baseline-resume');
    if (data?.status === 'ready' && data?.documentId) {
      return { status: 'ready', documentId: data.documentId };
    }
    if (data?.status === 'generating' || data?.status === 'pending') return { status: 'generating' };
    if (data?.status === 'error') return { status: 'error' };
    return { status: 'unknown' };
  } catch {
    return { status: 'error' };
  }
}

function buildSteps(_profile: ProfileData): WizardStep[] {
  return [
    { type: 'summary',        label: 'Summary',        optional: false },
    { type: 'experience',     label: 'Work Experience', optional: false },
    { type: 'achievements',   label: 'Achievements',    optional: true  },
    { type: 'education',      label: 'Education',       optional: true  },
    { type: 'certifications', label: 'Certifications',  optional: true  },
    { type: 'volunteering',   label: 'Volunteering',    optional: true  },
    { type: 'skills',         label: 'Skills',          optional: false },
    { type: 'complete',       label: 'Complete',        optional: false },
  ];
}

function parseBullets(description: string): string[] {
  const lines = (description ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines : [''];
}

// ─── Coaching content ────────────────────────────────────────────────────────

const COACHING: Record<string, { headline: string; body: string; tipsLabel?: string; tips?: string[] }> = {
  summary: {
    headline: 'The 6-second filter.',
    body: "A recruiter scans your summary before reading anything else. Numbers stand out on a wall of text, drop in one concrete figure (a %, $, headcount, or timeframe) and you've already beaten most candidates. Lead with your title and seniority, anchor with that proof point, end with where you're heading.",
    tipsLabel: 'WHAT MAKES IT LAND',
    tips: [
      'A number that proves your impact (%, $, scale, or time)',
      "Specific role + level (not just 'professional')",
      "Forward-facing, what you're targeting next",
    ],
  },
  experience: {
    headline: 'Duties are invisible. Outcomes get interviews.',
    body: "For every line you've written, ask: what changed because of me? 'Managed social media' is a duty. 'Grew Instagram from 4k to 22k followers in 6 months' is an outcome. One gets filtered out. The other gets a call.",
    tipsLabel: 'QUICK FIXES',
    tips: [
      "Replace 'responsible for' with what you delivered",
      'Start every bullet with an action verb',
      'Add a number wherever you can, even an estimate',
    ],
  },
  achievements: {
    headline: "We've isolated your achievements.",
    body: "These stand-out moments have been pulled from your work experience. Now add a metric to each, 'Helped grow the team' and 'grew the team from 4 to 11 in 9 months' describe the same work. One proves it. An estimate is better than nothing.",
    tipsLabel: "IF YOU'RE STUCK",
    tips: [
      'How many people were involved or affected?',
      'What changed, percentage, volume, or time?',
      'What was the scope, budget, timeline, or stakeholders?',
    ],
  },
  education: {
    headline: 'Spelling errors here are automatic red flags.',
    body: "ATS systems filter on exact institution and degree names. A typo in 'University of Melbourne' or 'Bachelor of Commerce' can invisibly exclude your application. Confirm these are exact.",
  },
  certifications: {
    headline: 'Certifications signal initiative.',
    body: "A relevant certification, whether it's a Google Analytics badge or a PMP, tells a recruiter you invested in your own skills. If you have any, add them. If not, skip ahead.",
  },
  volunteering: {
    headline: "Volunteering reveals character.",
    body: "Hiring managers use this section to understand who you are outside of work. It also demonstrates skills you may not have had the chance to use professionally yet. If you have nothing to add, that's completely fine, skip ahead.",
  },
  skills: {
    headline: 'Generic skills are invisible.',
    body: "'Communication' means nothing to a recruiter who reads it 300 times a day. 'Stakeholder reporting to C-suite across 5 departments' is evidence. Be specific. Include tools, software, platforms, and methodologies you actually use.",
    tipsLabel: 'WHAT TO INCLUDE',
    tips: [
      'Software and platforms (Salesforce, Jira, Figma)',
      'Methodologies (Agile, Six Sigma, PRINCE2)',
      'Technical skills specific to your role',
    ],
  },
};

const FALLBACK_MESSAGES: Partial<Record<StepType, string>> = {
  summary: 'Strong opening. A recruiter reading this knows your value immediately.',
  experience: 'Good. That role tells a story now.',
  achievements: 'These will make a difference. Metrics are what make screening software and humans stop.',
  education: 'Confirmed. Clean and accurate.',
  certifications: 'Any credential on your profile reinforces your credibility.',
  volunteering: 'Done. Character on the page.',
  skills: "Skills logged. Your profile is complete and ready to match against roles.",
};

const COMPETITIVE_PROGRESS: Partial<Record<StepType, { strength: string; label: string }>> = {
  summary:        { strength: '5/10', label: "Summary added. Recruiters read this in 6 seconds, yours now makes them stop." },
  experience:     { strength: '6/10', label: "You're now ahead of 60% of applicants. Most stop here." },
  achievements:   { strength: '8/10', label: "Quantified achievements are what move applications from screened-out to shortlisted." },
  education:      { strength: '8/10', label: "Most applicants stop here. You're going further." },
  certifications: { strength: '8.5/10', label: "Any credential adds credibility, and most don't have one." },
  volunteering:   { strength: '9/10', label: "Hiring managers notice this section. Most candidates leave it blank." },
  skills:         { strength: '9.5/10', label: "Profile complete. Every section a recruiter looks for is filled in." },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function CoachingPanel({ type }: { type: StepType }) {
  const content = COACHING[type];
  if (!content) return null;

  return (
    <div style={{
      background: 'rgba(99,102,241,0.06)',
      border: '1px solid rgba(99,102,241,0.15)',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: '#e0e7ff', letterSpacing: '-0.01em' }}>
        {content.headline}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: '#a5b4fc', lineHeight: 1.65 }}>
        {content.body}
      </p>
      {content.tipsLabel && content.tips && (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#6366f1', textTransform: 'uppercase' }}>
            {content.tipsLabel}
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {content.tips.map((tip, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#a5b4fc', lineHeight: 1.5 }}>
                <span style={{ color: '#6366f1', fontWeight: 800, flexShrink: 0, marginTop: 1 }}>·</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#f3f4f6',
  fontSize: 14,
  padding: '11px 14px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#6b7280',
  textTransform: 'uppercase',
  marginBottom: 6,
};

// ─── Step forms ─────────────────────────────────────────────────────────────

function SummaryForm({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>Professional Summary</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={7}
        placeholder="e.g. Marketing manager with 5 years driving acquisition growth for B2C SaaS brands. Grew email revenue from $0 to $1.2M at Canva. Now focused on scaling lifecycle marketing at a Series B or C company."
        style={{ ...inputStyle, resize: 'vertical' }}
        aria-label="Professional summary"
      />
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
        {value.length} characters · Aim for 300–600
      </p>
    </div>
  );
}

// A bullet is "duty-like" when it reads as a job responsibility (no measurable
// outcome). Heuristic: no digits, no monetary marker, and opens with one of
// the classic duty phrasings. Kept conservative, better to under-flag than to
// outline a legitimate achievement.
function isDutyLikeBullet(bullet: string): boolean {
  const text = (bullet ?? '').trim();
  if (text.length < 8) return false;
  if (/\d/.test(text)) return false;
  if (/[$%]/.test(text)) return false;
  const lower = text.toLowerCase();
  const dutyOpeners = [
    'responsible for', 'managed', 'worked on', 'assisted', 'helped',
    'supported', 'was involved', 'collaborated', 'participated', 'contributed',
    'led', 'conducted', 'provided', 'delivered', 'performed', 'handled',
    'oversaw', 'coordinated',
  ];
  return dutyOpeners.some(opener => lower.startsWith(opener) || lower.includes(' ' + opener + ' '));
}

// Real metric: not empty, not the literal string "qualitative", and not one of
// the LLM-extracted placeholders that masquerade as values ("None", "N/A", etc.).
function isRealMetric(metric: string | null | undefined): boolean {
  if (!metric) return false;
  const trimmed = metric.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed === 'qualitative') return false;
  if (['none', 'n/a', 'na', '-', '–', 'tbd', 'null', 'undefined'].includes(trimmed)) return false;
  return true;
}

function ExperienceEntryCard({
  entry,
  onChange,
  showDivider,
}: {
  entry: ExperienceEntry;
  onChange: (updated: ExperienceEntry) => void;
  showDivider: boolean;
}) {
  const [bullets, setBullets] = useState<string[]>(() => parseBullets(entry.description ?? ''));

  const set = (field: keyof ExperienceEntry) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...entry, [field]: e.target.value });

  const updateBullet = (i: number, val: string) => {
    const updated = bullets.map((b, idx) => idx === i ? val : b);
    setBullets(updated);
    onChange({ ...entry, description: updated.filter(Boolean).join('\n') });
  };

  const addBullet = () => setBullets(prev => [...prev, '']);

  const removeBullet = (i: number) => {
    const updated = bullets.filter((_, idx) => idx !== i);
    const final = updated.length > 0 ? updated : [''];
    setBullets(final);
    onChange({ ...entry, description: final.filter(Boolean).join('\n') });
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '20px', marginBottom: showDivider ? 16 : 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Company</label>
          <input type="text" value={entry.company ?? ''} onChange={set('company')} style={inputStyle} aria-label="Company name" />
        </div>
        <div>
          <label style={labelStyle}>Role / Title</label>
          <input type="text" value={entry.role ?? ''} onChange={set('role')} style={inputStyle} aria-label="Role or title" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Start Date</label>
          <input type="text" value={entry.startDate ?? ''} onChange={set('startDate')} placeholder="e.g. Jan 2022" style={inputStyle} aria-label="Start date" />
        </div>
        <div>
          <label style={labelStyle}>End Date</label>
          <input type="text" value={entry.endDate ?? ''} onChange={set('endDate')} placeholder="e.g. Mar 2024 or Present" style={inputStyle} aria-label="End date" />
        </div>
      </div>
      <div>
        <label style={labelStyle}>What you delivered, one outcome per line</label>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#6b7280', lineHeight: 1.55 }}>
          Start each bullet with an action verb. Add a number wherever you can, even an estimate.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bullets.map((bullet, i) => {
            const flagged = isDutyLikeBullet(bullet);
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: flagged ? '#fbbf24' : '#6366f1', fontWeight: 800, fontSize: 14, flexShrink: 0, marginTop: 12 }}>·</span>
                <div style={{ flex: 1 }}>
                  <textarea
                    value={bullet}
                    onChange={e => updateBullet(i, e.target.value)}
                    placeholder="e.g. Grew Instagram from 4k to 22k followers in 6 months"
                    rows={2}
                    style={{
                      ...inputStyle,
                      width: '100%',
                      resize: 'none',
                      lineHeight: 1.5,
                      ...(flagged ? {
                        border: '1px solid rgba(251,191,36,0.55)',
                        boxShadow: '0 0 0 1px rgba(251,191,36,0.18)',
                        background: 'rgba(245,158,11,0.04)',
                      } : {}),
                    }}
                    aria-label={`Bullet ${i + 1}`}
                    aria-invalid={flagged}
                  />
                  {flagged && (
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#fbbf24', lineHeight: 1.4 }}>
                      Sounds like a duty, add a number or outcome to turn this into an achievement.
                    </p>
                  )}
                </div>
                {bullets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBullet(i)}
                    style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 16, padding: '4px', lineHeight: 1, marginTop: 8 }}
                    aria-label="Remove bullet"
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addBullet}
          style={{ marginTop: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#a5b4fc', cursor: 'pointer' }}
        >
          + Add bullet
        </button>
      </div>
    </div>
  );
}

function ExperienceForm({
  entries,
  onChange,
}: {
  entries: ExperienceEntry[];
  onChange: (id: string, updated: ExperienceEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65, margin: '0 0 4px' }}>
          We didn't find work experience in your resume.
        </p>
        <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
          You can add it in your Profile Bank and revisit the wizard to refine it.
        </p>
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry, i) => (
        <ExperienceEntryCard
          key={entry.id}
          entry={entry}
          onChange={updated => onChange(entry.id, updated)}
          showDivider={i < entries.length - 1}
        />
      ))}
    </div>
  );
}

function AchievementsForm({
  achievements,
  onChange,
}: {
  achievements: AchievementEntry[];
  onChange: (updated: AchievementEntry[]) => void;
}) {
  const visible = achievements.filter((a) => a.metric !== 'qualitative');

  const updateMetric = (id: string, metric: string) => {
    onChange(achievements.map((a) => (a.id === id ? { ...a, metric } : a)));
  };

  // Framing questions, not examples. We're trying to steer the user's
  // thinking toward their own outcome, not have them copy a generic
  // sentence that doesn't match their achievement. The label above
  // already lists the metric types (%, time, $, count); the placeholder
  // is now a coaching prompt.
  const metricPlaceholders = [
    'What changed because of you, by how much?',
    'How many people, teams, or stakeholders did this affect?',
    'Compared to before: what improved, grew, or shrank?',
    'How much time or money was saved?',
    'What was the scale: budget, reach, or volume?',
    'What dropped, rose, or got faster?',
  ];

  if (visible.length === 0) {
    return (
      <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
        No quantifiable achievements found. You can skip this step.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {visible.map((ach, i) => (
        <div
          key={ach.id}
          style={{
            paddingTop: i > 0 ? 18 : 0,
            paddingBottom: 18,
            borderBottom: i < visible.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}
        >
          <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 700, color: '#e5e7eb' }}>
            {ach.title ?? 'Achievement'}
          </p>
          {ach.description && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
              {ach.description}
            </p>
          )}
          <label style={{
            ...labelStyle,
            color: isRealMetric(ach.metric) ? '#22c55e' : '#d97706',
          }}>
            {isRealMetric(ach.metric) ? '✓ Metric' : '⚠ Add a measurable result, a %, time saved, $ impact, or count'}
          </label>
          <input
            type="text"
            value={isRealMetric(ach.metric) ? (ach.metric ?? '') : ''}
            onChange={(e) => updateMetric(ach.id, e.target.value)}
            placeholder={metricPlaceholders[i % metricPlaceholders.length]}
            style={inputStyle}
            aria-label={`Metric for ${ach.title ?? 'achievement'}`}
          />
        </div>
      ))}
    </div>
  );
}

function EducationForm({
  education,
  onChange,
}: {
  education: EducationEntry[];
  onChange: (updated: EducationEntry[]) => void;
}) {
  const updateField = (id: string, field: keyof EducationEntry) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(education.map((ed) => (ed.id === id ? { ...ed, [field]: e.target.value } : ed)));
  };

  if (education.length === 0) {
    return (
      <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
        No education records found. You can skip this step or add entries in your Profile Bank later.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {education.map((ed, i) => (
        <div
          key={ed.id}
          style={{
            paddingTop: i > 0 ? 20 : 0,
            paddingBottom: 20,
            borderBottom: i < education.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Institution</label>
            <input
              type="text"
              value={ed.institution ?? ''}
              onChange={updateField(ed.id, 'institution')}
              style={inputStyle}
              aria-label="Institution name"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Degree</label>
              <input
                type="text"
                value={ed.degree ?? ''}
                onChange={updateField(ed.id, 'degree')}
                style={inputStyle}
                aria-label="Degree"
              />
            </div>
            <div>
              <label style={labelStyle}>Year</label>
              <input
                type="text"
                value={ed.year ?? ''}
                onChange={updateField(ed.id, 'year')}
                style={inputStyle}
                aria-label="Graduation year"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CertificationsForm({
  value,
  onChange,
}: {
  value: CertEntry[];
  onChange: (v: CertEntry[]) => void;
}) {
  const updateField = (id: string, field: keyof CertEntry) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(value.map(c => c.id === id ? { ...c, [field]: e.target.value } : c));
  };

  const addNew = () => {
    onChange([...value, { id: `new-${Date.now()}`, name: '', issuingBody: '', year: '' }]);
  };

  if (value.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.65 }}>
          No certifications on file. If you have any, add them below, or skip ahead if not.
        </p>
        <button
          type="button"
          onClick={addNew}
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, color: '#a5b4fc', cursor: 'pointer' }}
        >
          + Add a certification
        </button>
      </div>
    );
  }

  return (
    <div>
      {value.map((cert, i) => (
        <div key={cert.id} style={{ marginBottom: i < value.length - 1 ? 20 : 0, paddingBottom: i < value.length - 1 ? 20 : 0, borderBottom: i < value.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Certification name</label>
              <input type="text" value={cert.name ?? ''} onChange={updateField(cert.id, 'name')} placeholder="e.g. Google Analytics Certified" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Issuing body</label>
              <input type="text" value={cert.issuingBody ?? ''} onChange={updateField(cert.id, 'issuingBody')} placeholder="e.g. Google" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Year</label>
              <input type="text" value={cert.year ?? ''} onChange={updateField(cert.id, 'year')} placeholder="e.g. 2023" style={inputStyle} />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addNew}
        style={{ marginTop: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#a5b4fc', cursor: 'pointer' }}
      >
        + Add another
      </button>
    </div>
  );
}

function VolunteeringForm({
  value,
  onChange,
}: {
  value: VolEntry[];
  onChange: (v: VolEntry[]) => void;
}) {
  const updateField = (id: string, field: keyof VolEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(value.map(v => v.id === id ? { ...v, [field]: e.target.value } : v));
  };

  const addNew = () => {
    onChange([...value, { id: `new-${Date.now()}`, organization: '', role: '', description: '' }]);
  };

  if (value.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.65 }}>
          No volunteering on file. If you have any, add it below, or skip ahead if not.
        </p>
        <button
          type="button"
          onClick={addNew}
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, color: '#a5b4fc', cursor: 'pointer' }}
        >
          + Add volunteering
        </button>
      </div>
    );
  }

  return (
    <div>
      {value.map((vol, i) => (
        <div key={vol.id} style={{ marginBottom: i < value.length - 1 ? 20 : 0, paddingBottom: i < value.length - 1 ? 20 : 0, borderBottom: i < value.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Organisation</label>
              <input type="text" value={vol.organization ?? ''} onChange={updateField(vol.id, 'organization')} placeholder="e.g. Red Cross" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <input type="text" value={vol.role ?? ''} onChange={updateField(vol.id, 'role')} placeholder="e.g. Fundraising coordinator" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>What you did (optional)</label>
            <textarea value={vol.description ?? ''} onChange={updateField(vol.id, 'description')} rows={3} placeholder="e.g. Organised monthly fundraising events, managed a team of 8 volunteers" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addNew}
        style={{ marginTop: 12, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#a5b4fc', cursor: 'pointer' }}
      >
        + Add another
      </button>
    </div>
  );
}

function SkillsForm({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>Skills</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="e.g. Google Analytics, Salesforce, Stakeholder management, SQL, PRINCE2, Agile, Jira, Campaign strategy"
        style={{ ...inputStyle, resize: 'vertical' }}
        aria-label="Skills"
      />
      <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
        Include tools, software, methodologies, and soft skills specific to your role.
      </p>
    </div>
  );
}

// ─── Reward overlay ──────────────────────────────────────────────────────────

function RewardOverlay({ message, visible, onDismiss }: { message: string | null; visible: boolean; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(8,11,18,0.92)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          aria-live="polite"
          aria-label="Step saved"
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
            style={{ textAlign: 'center', maxWidth: 360 }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              {message ? <CheckCircle size={32} color="#22c55e" /> : (
                <div style={{
                  width: 28, height: 28,
                  border: '3px solid rgba(34,197,94,0.2)',
                  borderTopColor: '#22c55e',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
              )}
            </div>
            {message ? (
              <>
                <motion.p
                  key={message}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ margin: '0 0 24px', fontSize: 16, fontWeight: 700, color: '#f3f4f6', lineHeight: 1.5, letterSpacing: '-0.01em' }}
                >
                  {message}
                </motion.p>
                <motion.button
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.15 }}
                  onClick={onDismiss}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700,
                    color: '#d1d5db', cursor: 'pointer', letterSpacing: '-0.01em',
                  }}
                >
                  Continue →
                </motion.button>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Saving…</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Step icon map ───────────────────────────────────────────────────────────

const STEP_ICONS: Record<StepType, React.ReactNode> = {
  summary: <FileText size={14} />,
  experience: <Briefcase size={14} />,
  achievements: <Award size={14} />,
  education: <GraduationCap size={14} />,
  certifications: <Award size={14} />,
  volunteering: <Heart size={14} />,
  skills: <Zap size={14} />,
  complete: <CheckCircle size={14} />,
};

// ─── Main component ──────────────────────────────────────────────────────────

export function SetupWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [steps, setSteps] = useState<WizardStep[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [rewardVisible, setRewardVisible] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const resolveRewardRef = useRef<(() => void) | null>(null);
  const initialContentRef = useRef<Partial<Record<StepType, string>>>({});

  // Per-step local edit state
  const [summaryText, setSummaryText] = useState('');
  const [showDutyWarning, setShowDutyWarning] = useState(false);
  const [experienceEdits, setExperienceEdits] = useState<Record<string, ExperienceEntry>>({});
  const [achievementEdits, setAchievementEdits] = useState<AchievementEntry[]>([]);
  const [educationEdits, setEducationEdits] = useState<EducationEntry[]>([]);
  const [certEdits, setCertEdits] = useState<CertEntry[]>([]);
  const [volEdits, setVolEdits] = useState<VolEntry[]>([]);
  const [skillsText, setSkillsText] = useState('');

  const [baselineState, setBaselineState] = useState<BaselineResumeState>({ status: 'unknown' });
  const [downloadingBaseline, setDownloadingBaseline] = useState(false);

  // On mount: do a single status fetch so we know what we're starting from.
  useEffect(() => {
    let cancelled = false;
    fetchBaselineState().then(state => {
      if (!cancelled) setBaselineState(state);
    });
    return () => { cancelled = true; };
  }, []);

  // Whenever state is "generating" or "unknown", poll until it resolves.
  // This restarts naturally after a retry click (which sets state back to
  // "generating") and gives every active generation a fresh 30-attempt cap.
  useEffect(() => {
    if (baselineState.status !== 'generating' && baselineState.status !== 'unknown') {
      return;
    }
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      const next = await fetchBaselineState();
      if (cancelled) return;
      setBaselineState(next);
      if (next.status === 'generating' || next.status === 'unknown') {
        attempts += 1;
        if (attempts < 30) {
          timer = setTimeout(tick, 6000);
        } else if (!cancelled) {
          setBaselineState({ status: 'error' });
        }
      }
    };
    timer = setTimeout(tick, 6000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [baselineState.status]);

  const handleDownloadBaseline = async () => {
    if (downloadingBaseline) return;
    if (baselineState.status === 'error' || baselineState.status === 'unknown') {
      setDownloadingBaseline(true);
      try {
        await api.post('/profile/baseline-resume/generate');
        setBaselineState({ status: 'generating' });
      } catch (err) {
        console.error('[SetupWizard] retry baseline failed:', err);
        setBaselineState({ status: 'error' });
      } finally {
        setDownloadingBaseline(false);
      }
      return;
    }
    if (baselineState.status === 'ready') {
      setDownloadingBaseline(true);
      try {
        const { data: doc } = await api.get(`/documents/${baselineState.documentId}`);
        const { exportDocx } = await import('../lib/exportDocx');
        trackBaselineResumeDownloadedFromWizard();
        await exportDocx(doc.content, 'resume', '');
      } catch (err) {
        console.error('[SetupWizard] download baseline failed:', err);
      } finally {
        setDownloadingBaseline(false);
      }
    }
  };

  const isReturning = localStorage.getItem('jobhub_setup_complete') === '1';

  // Load profile on mount
  useEffect(() => {
    api.get('/profile')
      .then(({ data }) => {
        if (!data) { navigate('/'); return; }
        setProfile(data);
        const builtSteps = buildSteps(data);
        setSteps(builtSteps);

        // Seed local state from profile
        setSummaryText(data.professionalSummary ?? '');
        setSkillsText(parseSkills(data.skills ?? ''));

        const expMap: Record<string, ExperienceEntry> = {};
        (data.experience ?? []).forEach((exp: ExperienceEntry) => { expMap[exp.id] = { ...exp }; });
        setExperienceEdits(expMap);

        setAchievementEdits((data.achievements ?? []).map((a: AchievementEntry) => ({ ...a })));
        setEducationEdits((data.education ?? []).map((e: EducationEntry) => ({ ...e })));
        setCertEdits((data.certifications ?? []).map((c: CertEntry) => ({ ...c })));
        setVolEdits((data.volunteering ?? []).map((v: VolEntry) => ({ ...v })));

        // Snapshot initial content per step so we can detect "no changes" on save
        // and skip the reward screen when the user simply clicked through.
        const initialExp = Object.values(expMap).map(e => ({ company: e.company, role: e.role, description: e.description }));
        const initialAch = (data.achievements ?? []).map((a: AchievementEntry) => ({ title: a.title, metric: a.metric, description: a.description }));
        initialContentRef.current = {
          summary: JSON.stringify(data.professionalSummary ?? ''),
          experience: JSON.stringify(initialExp),
          achievements: JSON.stringify(initialAch),
          education: JSON.stringify(data.education ?? []),
          certifications: JSON.stringify(data.certifications ?? []),
          volunteering: JSON.stringify(data.volunteering ?? []),
          skills: JSON.stringify(parseSkills(data.skills ?? '')),
        };
      })
      .catch(() => navigate('/'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStep = steps[currentIndex];
  const totalSteps = steps.length;
  const progress = totalSteps > 1 ? currentIndex / (totalSteps - 1) : 0;

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const showReward = useCallback(async (type: StepType, content: any) => {
    setRewardMessage(null);
    setRewardVisible(true);

    const feedbackPromise = api.post('/wizard/step-feedback', { stepType: type, content })
      .then((res: any) => res.data?.feedback ?? FALLBACK_MESSAGES[type] ?? '')
      .catch(() => FALLBACK_MESSAGES[type] ?? '');

    const feedback = await Promise.race([
      feedbackPromise,
      new Promise<string>(resolve => setTimeout(() => resolve(FALLBACK_MESSAGES[type] ?? ''), 2000)),
    ]);

    setRewardMessage(feedback as string);

    await new Promise<void>(resolve => {
      resolveRewardRef.current = resolve;
    });
    resolveRewardRef.current = null;
    setRewardVisible(false);
  }, []);

  const advance = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= steps.length) return;
    setCurrentIndex(nextIndex);
    setShowDutyWarning(false);
    scrollTop();
  }, [currentIndex, steps.length, scrollTop]);

  const goBack = useCallback(() => {
    if (currentIndex <= 0 || saving) return;
    setCurrentIndex(currentIndex - 1);
    setShowDutyWarning(false);
    scrollTop();
  }, [currentIndex, saving, scrollTop]);

  const handleSave = useCallback(async () => {
    if (!currentStep || saving) return;
    setSaving(true);
    try {
      const type = currentStep.type;

      if (type === 'summary') {
        await api.patch('/profile', { professionalSummary: summaryText });

      } else if (type === 'experience') {
        // Duty-language gate: check before saving
        if (!showDutyWarning) {
          const allDescriptions = Object.values(experienceEdits)
            .map(e => e.description ?? '')
            .join(' ');
          const digitCount = (allDescriptions.match(/\d/g) ?? []).length;
          const charCount = allDescriptions.replace(/\s/g, '').length;
          const lowNumberDensity = charCount > 0 && digitCount / charCount < (1 / 80);
          const dutyWords = ['responsible for', 'managed', 'worked on', 'assisted', 'helped', 'supported', 'was involved'];
          const hasDutyLanguage = dutyWords.some(w => allDescriptions.toLowerCase().includes(w));
          if (lowNumberDensity && hasDutyLanguage) {
            setShowDutyWarning(true);
            setSaving(false);
            return;
          }
        }

        await Promise.all(
          Object.entries(experienceEdits).map(([id, edits]) =>
            api.patch(`/experience/${id}`, {
              company: edits.company,
              role: edits.role,
              startDate: edits.startDate,
              endDate: edits.endDate,
              description: edits.description,
            })
          )
        );

      } else if (type === 'achievements') {
        await Promise.all(
          achievementEdits
            .filter((a) => a.metric && a.metric !== 'qualitative')
            .map((a) => api.patch(`/achievements/${a.id}`, { metric: a.metric, description: a.description }))
        );

      } else if (type === 'education') {
        await Promise.all(
          educationEdits.map((e) =>
            api.patch(`/education/${e.id}`, {
              institution: e.institution,
              degree: e.degree,
              year: e.year,
            })
          )
        );

      } else if (type === 'certifications') {
        await Promise.all(
          certEdits
            .filter(c => c.name?.trim())
            .map(c => c.id.startsWith('new-')
              ? api.post('/certifications', { name: c.name, issuingBody: c.issuingBody || 'Self', year: c.year })
              : api.patch(`/certifications/${c.id}`, { name: c.name, issuingBody: c.issuingBody, year: c.year })
            )
        );

      } else if (type === 'volunteering') {
        await Promise.all(
          volEdits
            .filter(v => v.organization?.trim() && v.role?.trim())
            .map(v => v.id.startsWith('new-')
              ? api.post('/volunteering', { organization: v.organization, role: v.role, description: v.description })
              : api.patch(`/volunteering/${v.id}`, { organization: v.organization, role: v.role, description: v.description })
            )
        );

      } else if (type === 'skills') {
        await api.patch('/profile', { skills: skillsText });
      }

      const contentForCurrentStep: any =
        type === 'summary' ? summaryText :
        type === 'experience' ? Object.values(experienceEdits).map(e => ({ company: e.company, role: e.role, description: e.description })) :
        type === 'achievements' ? achievementEdits.map(a => ({ title: a.title, metric: a.metric, description: a.description })) :
        type === 'education' ? educationEdits :
        type === 'certifications' ? certEdits :
        type === 'volunteering' ? volEdits :
        type === 'skills' ? skillsText :
        null;

      const currentSnapshot = JSON.stringify(contentForCurrentStep);
      const hasChanges = initialContentRef.current[type] !== currentSnapshot;
      if (hasChanges) {
        await showReward(type, contentForCurrentStep);
        initialContentRef.current[type] = currentSnapshot;
      }
      advance();
    } catch {
      // silent, user can retry
    } finally {
      setSaving(false);
    }
  }, [currentStep, saving, summaryText, showDutyWarning, experienceEdits, achievementEdits, educationEdits, certEdits, volEdits, skillsText, showReward, advance]);

  const handleSkip = useCallback(() => {
    advance();
  }, [advance]);

  const handleComplete = useCallback(() => {
    localStorage.setItem('jobhub_setup_complete', '1');
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    navigate('/');
  }, [queryClient, navigate]);

  if (!profile || steps.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#080b12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(99,102,241,0.2)',
          borderTopColor: '#6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  const stepCountLabel = currentStep?.type === 'complete'
    ? null
    : `PROFILE SETUP · Step ${currentIndex + 1} of ${totalSteps - 1}`;

  return (
    <div style={{ height: '100vh', overflowY: 'auto', background: '#080b12', paddingBottom: 80 }}>
      {/* Baseline resume download link, fixed top-right */}
      <button
        onClick={handleDownloadBaseline}
        disabled={downloadingBaseline}
        style={{
          position: 'fixed', top: 16, right: 20, zIndex: 30,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 999, padding: '8px 14px',
          fontSize: 12, fontWeight: 600,
          color: baselineState.status === 'ready' ? '#a5b4fc' : '#9ca3af',
          cursor: downloadingBaseline ? 'wait' : 'pointer',
          letterSpacing: '0.01em',
          backdropFilter: 'blur(8px)',
        }}
      >
        {(() => {
          if (downloadingBaseline) return 'Downloading…';
          if (baselineState.status === 'generating') return 'Generating baseline resume…';
          if (baselineState.status === 'ready')      return 'Download my baseline resume';
          if (baselineState.status === 'error')      return 'Retry baseline resume';
          return 'Generating baseline resume…';
        })()}
      </button>

      {/* Reward overlay */}
      <RewardOverlay
        visible={rewardVisible}
        message={rewardMessage}
        onDismiss={() => { resolveRewardRef.current?.(); }}
      />

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', width: '100%' }}>
        <motion.div
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '40px 24px 0' }}>
        {/* Step counter + competitive indicator */}
        {stepCountLabel && (
          <div style={{ marginBottom: 24 }}>
            <p style={{
              margin: '0 0 6px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#4b5563',
              textTransform: 'uppercase',
            }}>
              {isReturning ? 'REVIEWING YOUR PROFILE' : stepCountLabel}
            </p>
            {currentIndex > 0 && (() => {
              const prevStep = steps[currentIndex - 1];
              const prog = prevStep ? COMPETITIVE_PROGRESS[prevStep.type] : null;
              if (!prog) return null;
              return (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
                  style={{
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#818cf8', letterSpacing: '-0.01em', flexShrink: 0 }}>
                    {prog.strength}
                  </span>
                  <span style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600, lineHeight: 1.4 }}>
                    {prog.label}
                  </span>
                </motion.div>
              );
            })()}
          </div>
        )}

        {/* Animated step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`step-${currentIndex}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
          >
            {currentStep?.type !== 'complete' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 20,
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                  flexShrink: 0,
                }}>
                  {STEP_ICONS[currentStep?.type ?? 'summary']}
                </div>
                <h1 style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#f3f4f6',
                  letterSpacing: '-0.02em',
                }}>
                  {currentStep?.label}
                </h1>
              </div>
            )}

            {/* Coaching panel */}
            {currentStep?.type !== 'complete' && <CoachingPanel type={currentStep?.type ?? 'summary'} />}

            {/* Content card */}
            {currentStep?.type === 'complete' ? (
              <CompleteScreen onComplete={handleComplete} />
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '24px',
                marginBottom: 20,
              }}>
                {currentStep?.type === 'summary' && (
                  <SummaryForm value={summaryText} onChange={setSummaryText} />
                )}
                {currentStep?.type === 'experience' && (
                  <ExperienceForm
                    entries={Object.values(experienceEdits)}
                    onChange={(id, updated) =>
                      setExperienceEdits(prev => ({ ...prev, [id]: updated }))
                    }
                  />
                )}
                {currentStep?.type === 'achievements' && (
                  <AchievementsForm
                    achievements={achievementEdits}
                    onChange={setAchievementEdits}
                  />
                )}
                {currentStep?.type === 'education' && (
                  <EducationForm
                    education={educationEdits}
                    onChange={setEducationEdits}
                  />
                )}
                {currentStep?.type === 'certifications' && (
                  <CertificationsForm value={certEdits} onChange={setCertEdits} />
                )}
                {currentStep?.type === 'volunteering' && (
                  <VolunteeringForm value={volEdits} onChange={setVolEdits} />
                )}
                {currentStep?.type === 'skills' && (
                  <SkillsForm value={skillsText} onChange={setSkillsText} />
                )}
              </div>
            )}

            {/* Duty language warning (experience step only) */}
            {currentStep?.type === 'experience' && showDutyWarning && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  marginBottom: 16,
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: '#fbbf24', letterSpacing: '-0.01em' }}>
                  Hold up, these look like job duties, not achievements.
                </p>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#d97706', lineHeight: 1.55 }}>
                  "Managed social media" reads as a duty. "Grew Instagram from 4k to 22k in 6 months" reads as an outcome. Add a number or result to at least one bullet to make this work harder.
                </p>
                <button
                  onClick={() => setShowDutyWarning(false)}
                  style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  I've added outcomes, continue →
                </button>
              </motion.div>
            )}

            {/* CTAs */}
            {currentStep?.type !== 'complete' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {currentIndex > 0 && (
                  <button
                    onClick={goBack}
                    disabled={saving}
                    aria-label="Go back to previous step"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'none',
                      color: '#9ca3af',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 11,
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.5 : 1,
                      letterSpacing: '-0.01em',
                      transition: 'opacity 0.15s, color 0.15s',
                    }}
                  >
                    <ChevronLeft size={16} />
                    Back
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  aria-label="Save and continue to next step"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 11,
                    padding: '13px 24px',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: saving ? 'wait' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                    letterSpacing: '-0.01em',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {saving ? 'Saving…' : 'Save & continue'}
                  {!saving && <ChevronRight size={16} />}
                </button>

                {currentStep?.optional && (
                  <button
                    onClick={handleSkip}
                    aria-label="Skip this step"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4b5563',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '13px 8px',
                    }}
                  >
                    Skip
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Complete screen ─────────────────────────────────────────────────────────

function CompleteScreen({ onComplete }: { onComplete: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0 32px' }}>
      <div style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        background: 'rgba(197,160,89,0.14)',
        border: '1px solid rgba(197,160,89,0.32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 28px',
      }}>
        <CheckCircle size={36} color="#C5A059" />
      </div>
      <h1 style={{
        margin: '0 0 10px',
        fontSize: 28,
        fontWeight: 800,
        color: '#E0E0E0',
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
      }}>
        Your Profile is All Set!
      </h1>
      <p style={{
        margin: '0 0 6px',
        fontSize: 15,
        fontWeight: 700,
        color: '#C5A059',
        letterSpacing: '-0.01em',
        lineHeight: 1.45,
      }}>
        Every section a recruiter checks? Done. Optimised. Ready.
      </p>
      <p style={{
        margin: '0 0 14px',
        fontSize: 14,
        fontWeight: 600,
        color: '#A0A4A8',
        letterSpacing: '-0.01em',
      }}>
        Now let's get you hired.
      </p>
      <p style={{
        margin: '0 0 36px',
        fontSize: 14,
        color: '#A0A4A8',
        lineHeight: 1.65,
        maxWidth: 440,
        marginInline: 'auto',
      }}>
        Paste any job description below. We'll generate a tailored resume and cover letter that cuts through the noise, in under 3 minutes.
      </p>
      <button
        onClick={onComplete}
        aria-label="Start generating applications"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#2D5A6E',
          color: '#E0E0E0',
          border: 'none',
          borderRadius: 12,
          padding: '15px 28px',
          fontSize: 15,
          fontWeight: 800,
          cursor: 'pointer',
          letterSpacing: '-0.01em',
          marginBottom: 14,
          boxShadow: '0 4px 24px rgba(45,90,110,0.35)',
        }}
      >
        Start Generating Applications <ArrowRight size={16} />
      </button>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#4b5563' }}>
        You can update your profile anytime from Profile & Achievements.
      </p>
      <p style={{ margin: 0, fontSize: 12, color: '#374151' }}>
        You can revisit this wizard anytime from the Profile & Achievements section.
      </p>
    </div>
  );
}
