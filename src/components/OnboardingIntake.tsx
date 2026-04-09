import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { ProcessingScreen } from './ProcessingScreen';
import { useAppTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  savePendingAnswers, saveFilesToIDB,
  loadPendingAnswers, loadFilesFromIDB,
  clearPendingAnswers, clearPendingFilesFromIDB,
} from '../lib/pendingOnboarding';

// ── Local theme alias ─────────────────────────────────────────────────────────

const useTheme = () => useAppTheme();

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntakeAnswers {
  targetRole: string; targetCity: string;
  seniority: string; industry: string;
  visaStatus: string;
  searchDuration: string; applicationsCount: string;
  channels: string[]; channelOther: string;
  responsePattern: string;
  blockerOptions: string[]; blockerOther: string;
  perceivedBlocker: string;
  marketingEmail: string;
  marketingConsent: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SENIORITY_OPTIONS = ['Graduate', 'Mid-level', 'Senior', 'Lead', 'Executive'];
const INDUSTRY_OPTIONS = ['Any', 'Tech', 'FinTech', 'Consulting', 'Marketing', 'Finance', 'Healthcare', 'Education', 'Government', 'Other'];
const VISA_STATUS_OPTIONS = [
  'Australian Citizen',
  'Permanent Resident',
  'Skilled Visa (482 / 186 / 189 / 190)',
  'Working Holiday Visa',
  'Student Visa',
  'Other / Not specified',
];
const DURATION_OPTIONS = ['Less than a month', '1-3 months', '3-6 months', '6-12 months', 'Over a year'];
const COUNT_OPTIONS = ['Under 10', '10-30', '30-60', '60-100', '100+'];
const CHANNEL_OPTIONS = ['LinkedIn', 'Seek', 'Indeed', 'Recruiters', 'Direct applications', 'Referrals', 'Other'];
const RESPONSE_OPTIONS = [
  { value: 'mostly_silence', label: 'Mostly silence', sub: 'Applications go in and nothing comes back' },
  { value: 'mostly_rejections', label: 'Mostly rejections', sub: 'Getting responses, but all rejections' },
  { value: 'interviews_stall', label: 'Interviews that stall', sub: 'Getting interviews but they go nowhere' },
  { value: 'no_offers', label: 'Interviews but no offers', sub: 'Getting far but not closing' },
  { value: 'mix', label: 'Mix of everything', sub: '' },
];
const BLOCKER_OPTIONS = [
  'Lack of Australian work experience',
  'My resume or cover letters',
  'Experience gap - targeting roles above where I am',
  'Interview nerves or performance',
];
const STEP_LABELS = [
  '',
  'Your target is locked in.',
  'Search history added.',
  'Profile almost complete.',
  'Ready to build your diagnosis.',
];

const STEP_CTAS = ['', 'Lock in my target', 'Add my history', 'Complete my profile', 'Build my diagnosis'];

// ── Scene ─────────────────────────────────────────────────────────────────────

function Scene() {
  const { T } = useTheme();
  const blobStyle: React.CSSProperties = {
    background: T.blobGrad,
    boxShadow: T.blobShadow,
    borderRadius: '50%',
    position: 'fixed',
    pointerEvents: 'none',
  };
  return (
    <>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundColor: T.bg,
        backgroundImage: `radial-gradient(circle, ${T.dotColor} 1px, transparent 1px)`,
        backgroundSize: '22px 22px',
        transition: 'background-color 0.4s',
      }} />
      <motion.div style={{ ...blobStyle, width: 380, height: 380, bottom: -80, left: -80 }}
        animate={{ x: [0, 18, -8, 0], y: [0, -14, 8, 0], scale: [1, 1.02, 0.99, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div style={{ ...blobStyle, width: 280, height: 280, top: -60, right: -40 }}
        animate={{ x: [0, -12, 6, 0], y: [0, 16, -6, 0], scale: [1, 1.03, 0.98, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }} />
      <motion.div style={{ ...blobStyle, width: 180, height: 180, top: '42%', right: -50 }}
        animate={{ x: [0, -8, 4, 0], y: [0, 12, -8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 3 }} />
      <motion.div style={{ ...blobStyle, width: 140, height: 140, top: '12%', left: '8%' }}
        animate={{ x: [0, 10, -5, 0], y: [0, -8, 6, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
    </>
  );
}

// ── Dark mode toggle ──────────────────────────────────────────────────────────

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const { T } = useTheme();
  return (
    <motion.button
      onClick={onToggle}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      style={{
        position: 'fixed', top: 20, right: 20, zIndex: 100,
        width: 40, height: 40, borderRadius: '50%', border: 'none',
        background: T.toggleBg, color: T.toggleIcon,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, transition: 'background 0.3s',
        backdropFilter: 'blur(12px)',
      }}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? '☀' : '☽'}
    </motion.button>
  );
}

// ── Profile progress header ───────────────────────────────────────────────────

function ProfileProgress({ step, answers }: { step: number; answers: IntakeAnswers }) {
  const { T } = useTheme();
  const chips: string[] = [];
  if (answers.targetRole) chips.push(answers.targetRole + (answers.targetCity ? `, ${answers.targetCity}` : ''));
  if (answers.seniority) chips.push(answers.seniority);
  if (answers.industry) chips.push(answers.industry);
  if (answers.searchDuration) chips.push(answers.searchDuration);
  if (answers.applicationsCount) chips.push(`${answers.applicationsCount} applications`);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.textFaint }}>
          Building your profile
        </span>
        <span style={{ fontSize: 11, color: T.textFaint, fontWeight: 600 }}>{step} / 4</span>
      </div>
      <div style={{ height: 4, background: T.progressBg, borderRadius: 99, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: T.progressFill, borderRadius: 99 }}
          animate={{ width: `${(step / 4) * 100}%` }}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
        />
      </div>
      {chips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}
        >
          {chips.map((chip, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, background: T.chipBg, color: T.chipText, fontWeight: 600 }}
            >
              {chip}
            </motion.span>
          ))}
        </motion.div>
      )}
      {step > 1 && (
        <p style={{ fontSize: 11, color: T.textFaint, marginTop: 8, fontStyle: 'italic' }}>
          {STEP_LABELS[step - 1]}
        </p>
      )}
    </div>
  );
}

// ── Shared input helpers ──────────────────────────────────────────────────────

function TInput({ placeholder, value, onChange, multiline, rows, type }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; rows?: number; type?: string;
}) {
  const { T } = useTheme();
  const base: React.CSSProperties = {
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 12, color: T.inputText, fontSize: 15,
    padding: '12px 16px', width: '100%', outline: 'none',
    transition: 'box-shadow 0.2s, border-color 0.2s',
    fontFamily: 'inherit', resize: multiline ? 'none' : undefined,
  };
  const handlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.target.style.boxShadow = `0 0 0 3px ${T.progressFill}22`;
      e.target.style.borderColor = T.inputText + '33';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.target.style.boxShadow = 'none';
      e.target.style.borderColor = T.inputBorder;
    },
  };
  if (multiline) return (
    <textarea style={base as React.CSSProperties} placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)} rows={rows ?? 3} {...handlers} />
  );
  return (
    <input style={base} placeholder={placeholder} value={value} type={type}
      onChange={e => onChange(e.target.value)} {...handlers} />
  );
}

function TSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  const { T } = useTheme();
  return (
    <select
      style={{
        background: T.inputBg, border: `1px solid ${T.inputBorder}`,
        borderRadius: 12, color: value ? T.inputText : T.textFaint,
        fontSize: 15, padding: '12px 16px', width: '100%', outline: 'none',
        appearance: 'none', cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        fontFamily: 'inherit',
      }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="" style={{ color: '#9ca3af' }}>{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  const { T } = useTheme();
  return (
    <div>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textFaint, marginBottom: 8 }}>
        {label}
      </span>
      {children}
      {hint && <p style={{ fontSize: 12, color: T.textFaint, marginTop: 6, lineHeight: 1.5 }}>{hint}</p>}
    </div>
  );
}

// ── File drop zone ────────────────────────────────────────────────────────────

function FileDropZone({ label, subtext, required, file, onFile }: {
  label: string; subtext?: string; required?: boolean;
  file: File | null; onFile: (f: File | null) => void;
}) {
  const { T } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <motion.div
      onClick={() => inputRef.current?.click()}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      style={{
        border: `2px dashed ${file ? T.progressFill + '55' : T.fileBorder}`,
        borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
        background: file ? T.progressFill + '08' : T.fileBg,
        transition: 'all 0.2s',
      }}
    >
      <input ref={inputRef} type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden" onChange={e => onFile(e.target.files?.[0] ?? null)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: 18, color: file ? T.text : T.textFaint, flexShrink: 0 }}>{file ? '✓' : '↑'}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            fontSize: 13, fontWeight: 600, color: file ? T.text : T.textMuted,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {file ? file.name : label}
            {required && !file && <span style={{ color: '#6366f1', marginLeft: 4 }}>*</span>}
          </p>
          {subtext && !file && <p style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>{subtext}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// ── Step: Welcome ─────────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  const { T } = useTheme();
  return (
    <div style={{ textAlign: 'center' }}>
      <motion.span initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{
          display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: T.textFaint,
          background: T.chipBg, borderRadius: 99, padding: '6px 16px', marginBottom: 28,
        }}>
        Career diagnosis
      </motion.span>

      <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 900, color: T.text, lineHeight: 1.12, marginBottom: 24, letterSpacing: '-0.025em' }}>
        YOUR JOB SEARCH<br />
        ISN'T BROKEN.
        <br />
        <span style={{ color: T.textMuted }}>YOUR POSITIONING IS.</span>
      </h1>

      <p style={{ color: T.textMuted, fontSize: 15, lineHeight: 1.7, marginBottom: 10, maxWidth: 400, margin: '0 auto 10px' }}>
        In the next few minutes, we will figure out exactly where things are breaking down and build you a plan to fix it.
      </p>
      <p style={{ color: T.textFaint, fontSize: 13, lineHeight: 1.6, marginBottom: 36 }}>
        Answer honestly. The more specific you are, the more powerful what comes next.
      </p>

      <motion.button onClick={onNext}
        style={{ background: T.btnBg, color: T.btnText, padding: '15px 36px', borderRadius: 16, border: 'none', fontWeight: 900, fontSize: 16, cursor: 'pointer', boxShadow: T.btnShadow, letterSpacing: '-0.01em', width: '100%' }}
        whileHover={{ scale: 1.02, boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}
        whileTap={{ scale: 0.97 }}>
        Let's find out
      </motion.button>
    </div>
  );
}

// ── Step: Role ────────────────────────────────────────────────────────────────

function StepRole({ answers, onChange, onNext, onBack }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: string) => void;
  onNext: () => void; onBack: () => void;
}) {
  const { T } = useTheme();
  const valid = answers.targetRole.trim() && answers.targetCity.trim() && answers.seniority && answers.industry && answers.visaStatus;
  return (
    <div>
      <ProfileProgress step={1} answers={answers} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
        What role are you targeting and where?
      </h2>
      <p style={{ color: T.textFaint, fontSize: 13, marginBottom: 24 }}>Be specific. This anchors everything we generate for you.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Role" hint="You can list more than one if your search is broad, though a specific focus tends to produce stronger results.">
          <TInput placeholder="e.g. Senior Product Manager" value={answers.targetRole} onChange={v => onChange('targetRole', v)} />
        </Field>
        <Field label="City">
          <TInput placeholder="e.g. Sydney" value={answers.targetCity} onChange={v => onChange('targetCity', v)} />
        </Field>
        <Field label="Seniority">
          <TSelect value={answers.seniority} onChange={v => onChange('seniority', v)} options={SENIORITY_OPTIONS} placeholder="Select level" />
        </Field>
        <Field label="Industry">
          <TSelect value={answers.industry} onChange={v => onChange('industry', v)} options={INDUSTRY_OPTIONS} placeholder="Select industry" />
        </Field>
        <Field label="Work rights in Australia">
          <TSelect
            value={answers.visaStatus}
            onChange={v => onChange('visaStatus', v)}
            options={VISA_STATUS_OPTIONS}
            placeholder="Select your visa status"
          />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <BackButton onBack={onBack} />
        <PrimaryButton onClick={onNext} disabled={!valid} label={STEP_CTAS[1]} />
      </div>
    </div>
  );
}

// ── Step: Timeline ────────────────────────────────────────────────────────────

function StepTimeline({ answers, onChange, onNext, onBack }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: string | string[]) => void;
  onNext: () => void; onBack: () => void;
}) {
  const { T } = useTheme();
  const toggleChannel = (ch: string) => {
    const c = answers.channels;
    onChange('channels', c.includes(ch) ? c.filter(x => x !== ch) : [...c, ch]);
  };
  const valid = answers.searchDuration && answers.applicationsCount && answers.channels.length > 0;
  const showOther = answers.channels.includes('Other');

  return (
    <div>
      <ProfileProgress step={2} answers={answers} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 24, letterSpacing: '-0.02em' }}>
        Tell us about your search so far.
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="How long have you been looking?">
          <TSelect value={answers.searchDuration} onChange={v => onChange('searchDuration', v)} options={DURATION_OPTIONS} placeholder="Select duration" />
        </Field>
        <Field label="Applications sent">
          <TSelect value={answers.applicationsCount} onChange={v => onChange('applicationsCount', v)} options={COUNT_OPTIONS} placeholder="Select range" />
        </Field>
        <Field label="Channels used">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CHANNEL_OPTIONS.map(ch => {
              const active = answers.channels.includes(ch);
              return (
                <motion.button key={ch} type="button" onClick={() => toggleChannel(ch)}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  style={{
                    padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${active ? T.pillActiveBorder : T.pillBorder}`,
                    background: active ? T.pillActiveBg : T.pillBg,
                    color: active ? T.pillActiveText : T.pillText,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  {ch}
                </motion.button>
              );
            })}
          </div>
          {showOther && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: 10 }}>
              <TInput placeholder="Which other channels?" value={answers.channelOther} onChange={v => onChange('channelOther', v)} />
            </motion.div>
          )}
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <BackButton onBack={onBack} />
        <PrimaryButton onClick={onNext} disabled={!valid} label={STEP_CTAS[2]} />
      </div>
    </div>
  );
}

// ── Step: Responses ───────────────────────────────────────────────────────────

function StepResponses({ answers, onChange, onNext, onBack }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: string | string[]) => void;
  onNext: () => void; onBack: () => void;
}) {
  const { T } = useTheme();
  const toggleBlocker = (opt: string) => {
    const c = answers.blockerOptions;
    onChange('blockerOptions', c.includes(opt) ? c.filter(b => b !== opt) : [...c, opt]);
  };
  const valid = answers.responsePattern && answers.blockerOptions.length > 0;

  const optStyle = (active: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '13px 16px', borderRadius: 12,
    border: `1px solid ${active ? T.optActiveBorder : T.optBorder}`,
    background: active ? T.optActiveBg : T.optBg,
    color: active ? T.optActiveText : T.optText,
    cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div>
      <ProfileProgress step={3} answers={answers} />

      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: T.text, marginBottom: 4, letterSpacing: '-0.02em' }}>
          What responses are you getting?
        </h2>
        <p style={{ color: T.textFaint, fontSize: 13, marginBottom: 12 }}>Pick whichever best describes your pattern.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {RESPONSE_OPTIONS.map(opt => (
            <motion.button key={opt.value} type="button" onClick={() => onChange('responsePattern', opt.value)}
              whileHover={{ x: 2 }} whileTap={{ scale: 0.99 }}
              style={optStyle(answers.responsePattern === opt.value)}>
              <span style={{ fontWeight: 700, fontSize: 14, display: 'block' }}>{opt.label}</span>
              {opt.sub && <span style={{ fontSize: 12, opacity: 0.6 }}>{opt.sub}</span>}
            </motion.button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: T.text, marginBottom: 4, letterSpacing: '-0.02em' }}>
          What's your biggest blocker?
        </h2>
        <p style={{ color: T.textFaint, fontSize: 13, marginBottom: 12 }}>Select everything that applies.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {BLOCKER_OPTIONS.map(opt => {
            const sel = answers.blockerOptions.includes(opt);
            return (
              <motion.button key={opt} type="button" onClick={() => toggleBlocker(opt)}
                whileHover={{ x: 2 }} whileTap={{ scale: 0.99 }}
                style={{ ...optStyle(sel), display: 'flex', alignItems: 'center', gap: 12 }}>
                <CheckBox checked={sel} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{opt}</span>
              </motion.button>
            );
          })}
          <div>
            <motion.button type="button" onClick={() => toggleBlocker('Other')}
              whileHover={{ x: 2 }} whileTap={{ scale: 0.99 }}
              style={{ ...optStyle(answers.blockerOptions.includes('Other')), display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <CheckBox checked={answers.blockerOptions.includes('Other')} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>Something else</span>
            </motion.button>
            {answers.blockerOptions.includes('Other') && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 8 }}>
                <TInput placeholder="Tell us what's getting in the way..." value={answers.blockerOther} onChange={v => onChange('blockerOther', v)} multiline rows={2} />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <BackButton onBack={onBack} />
        <PrimaryButton onClick={onNext} disabled={!valid} label={STEP_CTAS[3]} />
      </div>
    </div>
  );
}

// ── Step: Files ───────────────────────────────────────────────────────────────

function StepFiles({ resume, setResume, cl1, setCl1, cl2, setCl2, onNext, submitting, onBack, marketingConsent, onMarketingConsentChange }: {
  resume: File | null; setResume: (f: File | null) => void;
  cl1: File | null; setCl1: (f: File | null) => void;
  cl2: File | null; setCl2: (f: File | null) => void;
  onNext: () => void; submitting: boolean; onBack: () => void;
  marketingConsent: boolean;
  onMarketingConsentChange: (v: boolean) => void;
}) {
  const { T } = useTheme();
  return (
    <div>
      <ProfileProgress step={4} answers={{ targetRole: '', targetCity: '', seniority: '', industry: '', visaStatus: '', searchDuration: '', applicationsCount: '', channels: [], channelOther: '', responsePattern: '', blockerOptions: [], blockerOther: '', perceivedBlocker: '', marketingEmail: '', marketingConsent: true }} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
        Now show us what you've been sending out.
      </h2>
      <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
        We're not judging the documents. We're using them to understand how you've been positioning yourself.
      </p>
      <p style={{ color: T.textFaint, fontSize: 12, marginBottom: 20 }}>PDF or Word accepted.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FileDropZone label="Your resume" required file={resume} onFile={setResume} />
        <FileDropZone label="A recent cover letter" subtext="If you don't have one, that's useful information too." file={cl1} onFile={setCl1} />
        <FileDropZone label="Another cover letter if you have it" file={cl2} onFile={setCl2} />
      </div>

      {/* Marketing consent only — email captured in StepAuth */}
      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={e => onMarketingConsentChange(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: T.btnBg, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, color: T.textMuted }}>
            Send me job search tips and product updates
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <BackButton onBack={onBack} disabled={submitting} />
        <PrimaryButton
          onClick={onNext}
          disabled={!resume || submitting}
          label="Next"
        />
      </div>
    </div>
  );
}


// ── Shared button components ──────────────────────────────────────────────────

function PrimaryButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  const { T } = useTheme();
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '14px 20px', borderRadius: 14, border: 'none',
        background: T.btnBg, color: T.btnText, fontWeight: 800, fontSize: 15,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1, boxShadow: disabled ? 'none' : T.btnShadow,
        transition: 'opacity 0.2s, box-shadow 0.2s', fontFamily: 'inherit',
        letterSpacing: '-0.01em',
      }}
      whileHover={!disabled ? { scale: 1.02, boxShadow: '0 8px 40px rgba(0,0,0,0.25)' } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
    >
      {label}
    </motion.button>
  );
}

function BackButton({ onBack, disabled }: { onBack: () => void; disabled?: boolean }) {
  const { T } = useTheme();
  return (
    <motion.button
      onClick={onBack}
      disabled={disabled}
      style={{
        padding: '14px 16px', borderRadius: 14, border: `1px solid ${T.optBorder}`,
        background: T.optBg, color: T.textMuted, fontWeight: 600, fontSize: 20,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.3 : 1,
        transition: 'all 0.15s', fontFamily: 'inherit', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      ←
    </motion.button>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  const { T } = useTheme();
  return (
    <div style={{
      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
      border: `1.5px solid ${checked ? T.optActiveBg : T.optBorder}`,
      background: checked ? T.optActiveBg : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
    }}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5l2.5 2.5L8.5 2" stroke={T.optActiveText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

// ── Build final answers helper ────────────────────────────────────────────────

function buildFinalAnswers(answers: IntakeAnswers) {
  const blockerParts = answers.blockerOptions.filter(b => b !== 'Other');
  if (answers.blockerOptions.includes('Other') && answers.blockerOther.trim()) {
    blockerParts.push(answers.blockerOther.trim());
  }
  return {
    ...answers,
    perceivedBlocker: blockerParts.join('; '),
    channels: answers.channels.includes('Other') && answers.channelOther.trim()
      ? [...answers.channels.filter(c => c !== 'Other'), `Other: ${answers.channelOther.trim()}`]
      : answers.channels,
  };
}

// ── Step: Auth ────────────────────────────────────────────────────────────────

function StepAuth({ answers, resume, cl1, cl2, onAuthSuccess, submitting, onBack }: {
  answers: IntakeAnswers;
  resume: File | null;
  cl1: File | null;
  cl2: File | null;
  onAuthSuccess: () => void;
  submitting: boolean;
  onBack: () => void;
}) {
  const { T } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setAlreadyRegistered(false);
    if (password.length < 8) { setPwError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already registered')) {
          setAlreadyRegistered(true);
        } else {
          toast.error(error.message || 'Sign up failed');
        }
        return;
      }
      onAuthSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!resume) { toast.error('Resume file is missing — go back and upload it'); return; }
    try {
      const finalAnswers = buildFinalAnswers(answers);
      savePendingAnswers(finalAnswers);
      await saveFilesToIDB({ resume, cl1, cl2 });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        clearPendingAnswers();
        clearPendingFilesFromIDB().catch(() => {});
        toast.error(error.message || 'Google sign-in failed');
      }
    } catch (err: any) {
      clearPendingAnswers();
      clearPendingFilesFromIDB().catch(() => {});
      toast.error(err.message || 'Google sign-in failed');
    }
  }

  const inputStyle: React.CSSProperties = {
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 12, color: T.inputText, fontSize: 15,
    padding: '12px 16px', width: '100%', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div>
      <ProfileProgress step={4} answers={answers} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
        Last step — create your account
      </h2>
      <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
        Your diagnosis report will be sent to this email. Use one you actually check — we don't send spam.
      </p>

      {/* Google OAuth */}
      <motion.button
        onClick={handleGoogle}
        disabled={loading || submitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        style={{
          width: '100%', padding: '13px 20px', borderRadius: 14, border: `1px solid ${T.cardBorder}`,
          background: T.card, color: T.text, fontWeight: 700, fontSize: 15,
          cursor: loading || submitting ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          marginBottom: 8, fontFamily: 'inherit',
          opacity: loading || submitting ? 0.5 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </motion.button>
      <p style={{ fontSize: 11, color: T.textFaint, marginBottom: 20, textAlign: 'center' }}>
        With Google, your report goes to your Google account email.
      </p>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: T.cardBorder }} />
        <span style={{ fontSize: 12, color: T.textFaint, fontWeight: 600 }}>or</span>
        <div style={{ flex: 1, height: 1, background: T.cardBorder }} />
      </div>

      {/* Email + Password form */}
      <form onSubmit={handleSignUp}>
        <div style={{ marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: T.textFaint, marginBottom: 8 }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setAlreadyRegistered(false); }}
            placeholder="you@example.com"
            required
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: T.textFaint, marginBottom: 8 }}>Password</span>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setPwError(''); }}
            placeholder="Minimum 8 characters"
            required
            style={inputStyle}
          />
          {pwError && (
            <p style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{pwError}</p>
          )}
        </div>

        {alreadyRegistered && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 14 }}
          >
            <p style={{ fontSize: 13, color: '#fcd34d', margin: 0 }}>
              This email already has an account.{' '}
              <button
                type="button"
                onClick={() => navigate('/auth')}
                style={{ background: 'none', border: 'none', color: '#fbbf24', fontWeight: 700, cursor: 'pointer', fontSize: 13, textDecoration: 'underline', padding: 0 }}
              >
                Sign in instead.
              </button>
            </p>
          </motion.div>
        )}

        <PrimaryButton
          onClick={() => {}}
          disabled={loading || submitting || !email.trim() || !password}
          label={loading || submitting ? 'Creating account...' : 'Create account & build diagnosis'}
        />
      </form>

      <div style={{ marginTop: 16 }}>
        <BackButton onBack={onBack} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OnboardingIntake({ resumeMode = false }: { resumeMode?: boolean }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { T, isDark, toggle: toggleDark } = useAppTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/onboarding/report').then(({ data }) => {
      if (data.status === 'PROCESSING' || data.status === 'FAILED') { setStep(6); }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [answers, setAnswers] = useState<IntakeAnswers>({
    targetRole: '', targetCity: '', seniority: '', industry: '',
    visaStatus: '',
    searchDuration: '', applicationsCount: '', channels: [],
    channelOther: '', responsePattern: '',
    blockerOptions: [], blockerOther: '', perceivedBlocker: '',
    marketingEmail: '',
    marketingConsent: false,
  });
  const [resume, setResume] = useState<File | null>(null);
  const [cl1, setCl1] = useState<File | null>(null);
  const [cl2, setCl2] = useState<File | null>(null);

  const onChange = (k: keyof IntakeAnswers, v: string | string[]) =>
    setAnswers(prev => ({ ...prev, [k]: v }));

  const doSubmit = async (
    finalAnswers: ReturnType<typeof buildFinalAnswers>,
    resumeFile: File,
    coverLetter1: File | null,
    coverLetter2: File | null
  ) => {
    setSubmitting(true);

    const formData = new FormData();
    formData.append('answers', JSON.stringify(finalAnswers));
    formData.append('resume', resumeFile);
    if (coverLetter1) formData.append('coverLetter1', coverLetter1);
    if (coverLetter2) formData.append('coverLetter2', coverLetter2);

    try {
      await api.post('/onboarding/submit', formData, { timeout: 30000 });
      clearPendingAnswers();
      clearPendingFilesFromIDB().catch(() => {});
      setSubmitting(false);
      setStep(6);
    } catch (err) {
      console.error('[OnboardingIntake] Submit failed:', err);
      toast.error('Something went wrong uploading your files. Please try again.');
      setSubmitting(false);
    }
  };

  const handleAuthSuccess = async () => {
    if (!resume) {
      toast.error('Resume is missing — please go back and re-upload it.');
      return;
    }
    let userEmail = '';
    try {
      const { data } = await supabase.auth.getSession();
      userEmail = data.session?.user?.email ?? '';
    } catch {}
    doSubmit({ ...buildFinalAnswers(answers), marketingEmail: userEmail }, resume, cl1, cl2);
  };

  useEffect(() => {
    if (!resumeMode) return;
    async function loadAndSubmit() {
      setSubmitting(true);
      const pendingAnswers = loadPendingAnswers();
      const pendingFiles = await loadFilesFromIDB();
      if (!pendingAnswers || !pendingFiles.resume) {
        toast.error('Could not restore your session. Please start again.');
        setSubmitting(false);
        return;
      }
      setAnswers(pendingAnswers as IntakeAnswers);
      await doSubmit(
        pendingAnswers as ReturnType<typeof buildFinalAnswers>,
        pendingFiles.resume,
        pendingFiles.cl1,
        pendingFiles.cl2
      );
    }
    loadAndSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeMode]);

  const handleRetry = async () => {
    try {
      await api.post('/onboarding/retry');
      setStep(6); // ← was 5, fix to 6
    } catch {
      toast.error('Retry failed. Please refresh and try again.');
    }
  };

  const goNext = () => setStep(s => s + 1);
  const goBack = () => setStep(s => Math.max(0, s - 1));

  const STEPS = [
    <StepWelcome key="welcome" onNext={goNext} />,
    <StepRole key="role" answers={answers} onChange={onChange} onNext={goNext} onBack={goBack} />,
    <StepTimeline key="timeline" answers={answers} onChange={onChange} onNext={goNext} onBack={goBack} />,
    <StepResponses key="responses" answers={answers} onChange={onChange} onNext={goNext} onBack={goBack} />,
    <StepFiles
      key="files"
      resume={resume} setResume={setResume}
      cl1={cl1} setCl1={setCl1}
      cl2={cl2} setCl2={setCl2}
      onNext={goNext}
      submitting={submitting}
      onBack={goBack}
      marketingConsent={answers.marketingConsent}
      onMarketingConsentChange={v => setAnswers(prev => ({ ...prev, marketingConsent: v }))}
    />,
    <StepAuth
      key="auth"
      answers={answers}
      resume={resume}
      cl1={cl1}
      cl2={cl2}
      onAuthSuccess={handleAuthSuccess}
      submitting={submitting}
      onBack={goBack}
    />,
  ];

  const SignOutBtn = user ? (
    <motion.button
      onClick={async () => { await signOut(); navigate('/auth', { replace: true }); }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        position: 'fixed', top: 20, left: 20, zIndex: 100,
        padding: '8px 14px', borderRadius: 10, border: 'none',
        background: T.toggleBg, color: T.textMuted,
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600,
        backdropFilter: 'blur(12px)',
      }}
      title="Sign out"
    >
      <LogOut size={14} />
      Sign out
    </motion.button>
  ) : null;

  if (step === 6 || (resumeMode && submitting)) {
    return (
      <div style={{ backgroundColor: T.bg, minHeight: '100vh', transition: 'background-color 0.4s' }}>
        <Scene />
        <ThemeToggle dark={isDark} onToggle={toggleDark} />
        {SignOutBtn}
        <ProcessingScreen
          isDark={isDark}
          theme={T}
          email={answers.marketingEmail?.trim() ?? ''}
          onComplete={() => {
            // reportSeen is cleared by ProcessingScreen before invalidateQueries fires,
            // so by the time we get here the flag is already gone.
            console.log('[OnboardingIntake] onComplete called — ProcessingScreen already cleared reportSeen');
          }}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: T.bg, height: '100dvh', overflowY: 'auto', overflowX: 'hidden', transition: 'background-color 0.4s' }}>
      <Scene />
      <ThemeToggle dark={isDark} onToggle={toggleDark} />
      {SignOutBtn}

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48, paddingBottom: 48, paddingLeft: 16, paddingRight: 16, minHeight: '100%', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.26, ease: [0.25, 1, 0.5, 1] }}
              >
                <div style={{
                  background: T.card, border: `1px solid ${T.cardBorder}`,
                  boxShadow: T.cardShadow, borderRadius: 28,
                  backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
                  padding: 'clamp(24px, 5vw, 44px)',
                  transition: 'background 0.4s, border-color 0.4s',
                }}>
                  {STEPS[step]}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
  );
}
