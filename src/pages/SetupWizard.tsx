import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, CheckCircle, ArrowRight, ExternalLink, Briefcase, FileText, Award, GraduationCap, Zap } from 'lucide-react';
import api from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProfileData {
  professionalSummary?: string;
  skills?: string;
  experience?: ExperienceEntry[];
  achievements?: AchievementEntry[];
  education?: EducationEntry[];
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

type StepType = 'summary' | 'experience' | 'achievements' | 'education' | 'skills' | 'complete';

interface WizardStep {
  type: StepType;
  label: string;
  optional: boolean;
  experienceEntry?: ExperienceEntry;
  experienceIndex?: number;
  experienceTotal?: number;
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

function buildSteps(profile: ProfileData): WizardStep[] {
  const steps: WizardStep[] = [];

  steps.push({ type: 'summary', label: 'Summary', optional: false });

  const experiences = profile.experience ?? [];
  experiences.forEach((exp, i) => {
    steps.push({
      type: 'experience',
      label: exp.company ?? `Job ${i + 1}`,
      optional: false,
      experienceEntry: exp,
      experienceIndex: i,
      experienceTotal: experiences.length,
    });
  });

  if ((profile.achievements ?? []).length > 0) {
    steps.push({ type: 'achievements', label: 'Achievements', optional: true });
  }

  if ((profile.education ?? []).length > 0) {
    steps.push({ type: 'education', label: 'Education', optional: true });
  }

  steps.push({ type: 'skills', label: 'Skills', optional: false });
  steps.push({ type: 'complete', label: 'Complete', optional: false });

  return steps;
}

// ─── Coaching content ────────────────────────────────────────────────────────

const COACHING: Record<string, { headline: string; body: string; tipsLabel?: string; tips?: string[] }> = {
  summary: {
    headline: 'The 6-second filter.',
    body: "A recruiter scans your summary before reading anything else. If it doesn't immediately signal your value, they move on. Lead with your title and seniority. Add your strongest proof point. End with where you're heading.",
    tipsLabel: 'WHAT MAKES IT LAND',
    tips: [
      "Specific role + level (not just 'professional')",
      'One measurable result from your career',
      "Forward-facing — what you're targeting next",
    ],
  },
  experience: {
    headline: 'Duties are invisible. Outcomes get interviews.',
    body: "For every line you've written, ask: what changed because of me? 'Managed social media' is a duty. 'Grew Instagram from 4k to 22k followers in 6 months' is an outcome. One gets filtered out. The other gets a call.",
    tipsLabel: 'QUICK FIXES',
    tips: [
      "Replace 'responsible for' with what you delivered",
      'Start every bullet with an action verb',
      'Add a number wherever you can — even an estimate',
    ],
  },
  achievements: {
    headline: 'A metric turns a duty into evidence.',
    body: "'Helped grow the team' and 'grew the team from 4 to 11 in 9 months' describe the same work. One proves it. Add a number — revenue, percentage, headcount, time saved. An estimate is better than nothing.",
    tipsLabel: "IF YOU'RE STUCK",
    tips: [
      'How many people were involved or affected?',
      'What changed — percentage, volume, or time?',
      'What was the scope — budget, timeline, or stakeholders?',
    ],
  },
  education: {
    headline: 'Spelling errors here are automatic red flags.',
    body: "ATS systems filter on exact institution and degree names. A typo in 'University of Melbourne' or 'Bachelor of Commerce' can invisibly exclude your application. Confirm these are exact.",
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

const REWARD_MESSAGES: Record<StepType, string> = {
  summary: 'Strong opening. A recruiter reading this knows your value immediately.',
  experience: 'Good. That role tells a story now.',
  achievements: 'These will make a difference. Metrics are what make screening software and humans stop.',
  education: 'Confirmed. Clean and accurate.',
  skills: 'Done. Your profile is ready.',
  complete: '',
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

function ExperienceForm({
  value,
  onChange,
}: {
  value: ExperienceEntry;
  onChange: (v: ExperienceEntry) => void;
}) {
  const set = (field: keyof ExperienceEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [field]: e.target.value });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Company</label>
          <input
            type="text"
            value={value.company ?? ''}
            onChange={set('company')}
            style={inputStyle}
            aria-label="Company name"
          />
        </div>
        <div>
          <label style={labelStyle}>Role / Title</label>
          <input
            type="text"
            value={value.role ?? ''}
            onChange={set('role')}
            style={inputStyle}
            aria-label="Role or title"
          />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Start Date</label>
          <input
            type="text"
            value={value.startDate ?? ''}
            onChange={set('startDate')}
            placeholder="e.g. Jan 2022"
            style={inputStyle}
            aria-label="Start date"
          />
        </div>
        <div>
          <label style={labelStyle}>End Date</label>
          <input
            type="text"
            value={value.endDate ?? ''}
            onChange={set('endDate')}
            placeholder="e.g. Mar 2024 or Present"
            style={inputStyle}
            aria-label="End date"
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Description / Bullets</label>
        <textarea
          value={value.description ?? ''}
          onChange={set('description')}
          rows={6}
          style={{ ...inputStyle, resize: 'vertical' }}
          aria-label="Job description and bullet points"
        />
      </div>
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
            color: ach.metric && ach.metric !== 'qualitative' ? '#22c55e' : '#d97706',
          }}>
            {ach.metric && ach.metric !== 'qualitative' ? '✓ Metric' : '⚠ Add a metric (e.g. \'Reduced onboarding time by 40%\')'}
          </label>
          <input
            type="text"
            value={ach.metric && ach.metric !== 'qualitative' ? ach.metric : ''}
            onChange={(e) => updateMetric(ach.id, e.target.value)}
            placeholder="e.g. Reduced onboarding time by 40%"
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

function RewardOverlay({ message, visible }: { message: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8,11,18,0.92)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle size={32} color="#22c55e" />
            </div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f3f4f6', lineHeight: 1.5, letterSpacing: '-0.01em' }}>
              {message}
            </p>
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
  const [rewardMessage, setRewardMessage] = useState('');

  // Per-step local edit state
  const [summaryText, setSummaryText] = useState('');
  const [experienceEdits, setExperienceEdits] = useState<Record<string, ExperienceEntry>>({});
  const [achievementEdits, setAchievementEdits] = useState<AchievementEntry[]>([]);
  const [educationEdits, setEducationEdits] = useState<EducationEntry[]>([]);
  const [skillsText, setSkillsText] = useState('');

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
      })
      .catch(() => navigate('/'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStep = steps[currentIndex];
  const totalSteps = steps.length;
  const progress = totalSteps > 1 ? currentIndex / (totalSteps - 1) : 0;

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const showReward = useCallback((message: string) => {
    setRewardMessage(message);
    setRewardVisible(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setRewardVisible(false);
        resolve();
      }, 1300);
    });
  }, []);

  const advance = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= steps.length) return;
    setCurrentIndex(nextIndex);
    scrollTop();
  }, [currentIndex, steps.length, scrollTop]);

  const handleSave = useCallback(async () => {
    if (!currentStep || saving) return;
    setSaving(true);
    try {
      const type = currentStep.type;

      if (type === 'summary') {
        await api.patch('/profile', { professionalSummary: summaryText });

      } else if (type === 'experience' && currentStep.experienceEntry) {
        const id = currentStep.experienceEntry.id;
        const edits = experienceEdits[id];
        if (edits) {
          await api.patch(`/experience/${id}`, {
            company: edits.company,
            role: edits.role,
            startDate: edits.startDate,
            endDate: edits.endDate,
            description: edits.description,
          });
        }

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

      } else if (type === 'skills') {
        await api.patch('/profile', { skills: skillsText });
      }

      await showReward(REWARD_MESSAGES[type]);
      advance();
    } catch {
      // silent — user can retry
    } finally {
      setSaving(false);
    }
  }, [currentStep, saving, summaryText, experienceEdits, achievementEdits, educationEdits, skillsText, showReward, advance]);

  const handleSkip = useCallback(() => {
    advance();
  }, [advance]);

  const handleComplete = useCallback(() => {
    localStorage.setItem('jobhub_setup_complete', '1');
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    navigate('/application-workspace?firstTime=true');
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
    <div style={{ minHeight: '100vh', background: '#080b12', paddingBottom: 80 }}>
      {/* Reward overlay */}
      <RewardOverlay visible={rewardVisible} message={rewardMessage} />

      {/* Top banner */}
      <div style={{
        background: 'rgba(99,102,241,0.08)',
        borderBottom: '1px solid rgba(99,102,241,0.18)',
        padding: '11px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#a5b4fc', fontWeight: 600 }}>
          Already have a specific job to apply to?
        </p>
        <a
          href="/application-workspace"
          style={{
            color: '#818cf8',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Go to workspace <ExternalLink size={12} />
        </a>
      </div>

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
        {/* Step counter */}
        {stepCountLabel && (
          <p style={{
            margin: '0 0 24px',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: '#4b5563',
            textTransform: 'uppercase',
          }}>
            {isReturning ? 'REVIEWING YOUR PROFILE' : stepCountLabel}
          </p>
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
                  {currentStep?.type === 'experience'
                    ? `${currentStep.experienceEntry?.company ?? 'Work Experience'}${(currentStep.experienceTotal ?? 0) > 1 ? ` (${(currentStep.experienceIndex ?? 0) + 1} of ${currentStep.experienceTotal})` : ''}`
                    : currentStep?.label}
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
                {currentStep?.type === 'experience' && currentStep.experienceEntry && (
                  <ExperienceForm
                    value={experienceEdits[currentStep.experienceEntry.id] ?? currentStep.experienceEntry}
                    onChange={(updated) =>
                      setExperienceEdits((prev) => ({ ...prev, [currentStep.experienceEntry!.id]: updated }))
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
                {currentStep?.type === 'skills' && (
                  <SkillsForm value={skillsText} onChange={setSkillsText} />
                )}
              </div>
            )}

            {/* CTAs */}
            {currentStep?.type !== 'complete' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        background: 'rgba(99,102,241,0.12)',
        border: '1px solid rgba(99,102,241,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 28px',
      }}>
        <CheckCircle size={36} color="#6366f1" />
      </div>
      <h1 style={{
        margin: '0 0 12px',
        fontSize: 26,
        fontWeight: 800,
        color: '#f3f4f6',
        letterSpacing: '-0.02em',
      }}>
        Your profile is ready.
      </h1>
      <p style={{
        margin: '0 0 36px',
        fontSize: 15,
        color: '#9ca3af',
        lineHeight: 1.65,
        maxWidth: 400,
        marginInline: 'auto',
      }}>
        Now paste a job description and we'll generate your tailored resume and cover letter in 60 seconds.
      </p>
      <button
        onClick={onComplete}
        aria-label="Find your first job to apply to"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: 12,
          padding: '15px 28px',
          fontSize: 15,
          fontWeight: 800,
          cursor: 'pointer',
          letterSpacing: '-0.01em',
          marginBottom: 14,
        }}
      >
        Find my first job to apply to <ArrowRight size={16} />
      </button>
      <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
        Takes you to the workspace — paste any job description and we'll handle the rest.
      </p>
    </div>
  );
}
