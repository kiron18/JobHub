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
  loadPendingAnswers, loadFilesFromIDB,
  clearPendingAnswers, clearPendingFilesFromIDB,
} from '../lib/pendingOnboarding';

const useTheme = () => useAppTheme();

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntakeAnswers {
  targetRole: string;
  seniority: string;
  industry: string;
  visaStatus: string;
  responsePattern: string;
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
  'Graduate Work Visa (Subclass 485)',
  'Working Holiday Visa',
  'Student Visa',
  'Other / Not specified',
];
const RESPONSE_OPTIONS = [
  { value: 'mostly_silence', label: 'Mostly silence', sub: 'Applications go in and nothing comes back' },
  { value: 'mostly_rejections', label: 'Mostly rejections', sub: 'Getting responses, but all rejections' },
  { value: 'interviews_stall', label: 'Interviews that stall', sub: 'Getting interviews but they go nowhere' },
  { value: 'no_offers', label: 'Interviews but no offers', sub: 'Getting far but not closing' },
  { value: 'mix', label: 'Mix of everything', sub: '' },
];

const STEP_LABELS = [
  '',
  'Target locked in.',
  'Search pattern clear.',
  'Account created.',
  '',
];

// ── Scene ─────────────────────────────────────────────────────────────────────

function Scene() {
  const { T } = useTheme();
  const blobStyle: React.CSSProperties = {
    background: T.blobGrad, boxShadow: T.blobShadow,
    borderRadius: '50%', position: 'fixed', pointerEvents: 'none',
  };
  return (
    <>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundColor: T.bg,
        backgroundImage: `radial-gradient(circle, ${T.dotColor} 1px, transparent 1px)`,
        backgroundSize: '22px 22px', transition: 'background-color 0.4s',
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

function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const { T } = useTheme();
  return (
    <motion.button onClick={onToggle} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
      style={{
        position: 'fixed', top: 20, right: 20, zIndex: 100,
        width: 40, height: 40, borderRadius: '50%', border: 'none',
        background: T.toggleBg, color: T.toggleIcon,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, transition: 'background 0.3s', backdropFilter: 'blur(12px)',
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
  if (answers.targetRole) chips.push(answers.targetRole);
  if (answers.seniority) chips.push(answers.seniority);
  if (answers.industry) chips.push(answers.industry);

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
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}
        >
          {chips.map((chip, i) => (
            <motion.span key={i} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
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

function TInput({ placeholder, value, onChange, type }: {
  placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  const { T } = useTheme();
  const base: React.CSSProperties = {
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 12, color: T.inputText, fontSize: 15,
    padding: '12px 16px', width: '100%', outline: 'none',
    transition: 'box-shadow 0.2s, border-color 0.2s', fontFamily: 'inherit',
  };
  return (
    <input style={base} placeholder={placeholder} value={value} type={type}
      onChange={e => onChange(e.target.value)}
      onFocus={e => { e.target.style.boxShadow = `0 0 0 3px ${T.progressFill}22`; e.target.style.borderColor = T.inputText + '33'; }}
      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = T.inputBorder; }}
    />
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
        transition: 'box-shadow 0.2s, border-color 0.2s', fontFamily: 'inherit',
      }}
      value={value} onChange={e => onChange(e.target.value)}
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
    <motion.div onClick={() => inputRef.current?.click()} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
      style={{
        border: `2px dashed ${file ? T.progressFill + '55' : T.fileBorder}`,
        borderRadius: 14, padding: '16px 18px', cursor: 'pointer',
        background: file ? T.progressFill + '08' : T.fileBg, transition: 'all 0.2s',
      }}
    >
      <input ref={inputRef} type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden" onChange={e => onFile(e.target.files?.[0] ?? null)} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: 18, color: file ? T.text : T.textFaint, flexShrink: 0 }}>{file ? '✓' : '↑'}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: file ? T.text : T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file ? file.name : label}
            {required && !file && <span style={{ color: '#6366f1', marginLeft: 4 }}>*</span>}
          </p>
          {subtext && !file && <p style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>{subtext}</p>}
        </div>
      </div>
    </motion.div>
  );
}

// ── Shared buttons ────────────────────────────────────────────────────────────

function PrimaryButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  const { T } = useTheme();
  return (
    <motion.button onClick={onClick} disabled={disabled}
      style={{
        flex: 1, padding: '14px 20px', borderRadius: 14, border: 'none',
        background: T.btnBg, color: T.btnText, fontWeight: 800, fontSize: 15,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1, boxShadow: disabled ? 'none' : T.btnShadow,
        transition: 'opacity 0.2s, box-shadow 0.2s', fontFamily: 'inherit', letterSpacing: '-0.01em',
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
    <motion.button onClick={onBack} disabled={disabled}
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


// ── Step: Welcome ─────────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  const { T } = useTheme();
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: 'center' }}>
      <motion.span initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{
          display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: T.textFaint,
          background: T.chipBg, borderRadius: 99, padding: '6px 16px', marginBottom: 18,
        }}>
        Career diagnosis
      </motion.span>

      <h1 style={{ fontSize: 'clamp(22px, 4.5vw, 32px)', fontWeight: 900, color: T.text, lineHeight: 1.2, marginBottom: 12, letterSpacing: '-0.02em' }}>
        Applying for months in Australia.<br />Getting nothing back?
      </h1>

      <p style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.65, maxWidth: 420, margin: '0 auto 18px' }}>
        Take this free 3-minute diagnostic to find out exactly which part of your application process is costing you interviews — and what to fix first.
      </p>

      <div style={{ marginBottom: 18, textAlign: 'left' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textFaint, textAlign: 'center', marginBottom: 10 }}>
          Your diagnosis will cover
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: 'Role targeting', desc: 'Right roles for your level?' },
            { label: 'Document audit', desc: 'Resume costing you interviews?' },
            { label: 'Application pipeline', desc: 'Where things drop off?' },
            { label: 'Honest assessment', desc: 'What your docs reveal' },
            { label: 'Three-step fix', color: '#22c55e', desc: 'Ranked by impact, written for you' },
            { label: 'How we can help', desc: 'Tools and training available' },
          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px',
                borderRadius: 10, border: `1px solid ${T.inputBorder}`, background: T.inputBg,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 4, background: item.color || T.progressFill }} />
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.color || T.text, display: 'block' }}>{item.label}</span>
                <span style={{ fontSize: 11, color: T.textFaint }}>{item.desc}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div style={{
        marginBottom: 18, padding: '12px 16px', borderRadius: 12,
        background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
        textAlign: 'left',
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#fde047', margin: '0 0 4px' }}>
          Before you start — grab your resume.
        </p>
        <p style={{ fontSize: 12, color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
          This diagnostic reads your actual documents to identify what's costing you interviews. Resume is required. Cover letters help if you have them.
        </p>
      </div>

      <motion.button onClick={onNext}
        style={{
          background: 'linear-gradient(135deg, #16a34a, #15803d)',
          color: 'white', padding: '15px 36px', borderRadius: 16, border: 'none',
          fontWeight: 900, fontSize: 16, cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(22,163,74,0.35)',
          letterSpacing: '-0.01em', width: '100%',
        }}
        animate={{ boxShadow: ['0 4px 24px rgba(22,163,74,0.35)', '0 4px 36px rgba(22,163,74,0.6)', '0 4px 24px rgba(22,163,74,0.35)'] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={{ scale: 1.02, boxShadow: '0 8px 40px rgba(22,163,74,0.55)' }}
        whileTap={{ scale: 0.97 }}>
        Start my diagnosis →
      </motion.button>
      <p style={{ fontSize: 12, color: T.textFaint, marginTop: 10 }}>Takes about 3 minutes · Free</p>
      <p style={{ fontSize: 12, color: T.textFaint, marginTop: 16 }}>
        Already have an account?{' '}
        <button onClick={() => navigate('/auth')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', fontWeight: 700, fontSize: 12, padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>
          Log in
        </button>
      </p>
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
  const valid = answers.targetRole.trim() && answers.seniority && answers.industry && answers.visaStatus;
  return (
    <div>
      <ProfileProgress step={1} answers={answers} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
        What role are you targeting?
      </h2>
      <p style={{ color: T.textFaint, fontSize: 13, marginBottom: 24 }}>Be specific — this anchors your entire diagnosis to real Australian hiring conditions.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Role" hint="Vague targets produce vague diagnoses. The more specific you are, the more precisely we can flag what's off.">
          <TInput placeholder="e.g. Senior Product Manager" value={answers.targetRole} onChange={v => onChange('targetRole', v)} />
        </Field>
        <Field label="Seniority" hint="We compare your positioning against what employers at this level actually expect to see.">
          <TSelect value={answers.seniority} onChange={v => onChange('seniority', v)} options={SENIORITY_OPTIONS} placeholder="Select level" />
        </Field>
        <Field label="Industry" hint="Different industries have different filtering patterns — this helps us spot what's specific to your market.">
          <TSelect value={answers.industry} onChange={v => onChange('industry', v)} options={INDUSTRY_OPTIONS} placeholder="Select industry" />
        </Field>
        <Field label="Work rights in Australia" hint="Visa status is often a quiet screening filter. We flag when it's likely affecting your results before you even get a look.">
          <TSelect value={answers.visaStatus} onChange={v => onChange('visaStatus', v)} options={VISA_STATUS_OPTIONS} placeholder="Select your visa status" />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <BackButton onBack={onBack} />
        <PrimaryButton onClick={onNext} disabled={!valid} label="Lock in my target →" />
      </div>
    </div>
  );
}

// ── Step: Response pattern ────────────────────────────────────────────────────

function StepResponses({ answers, onChange, onNext, onBack }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: string) => void;
  onNext: () => void; onBack: () => void;
}) {
  const { T } = useTheme();
  const valid = !!answers.responsePattern;

  const optStyle = (active: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '13px 16px', borderRadius: 12,
    border: `1px solid ${active ? T.optActiveBorder : T.optBorder}`,
    background: active ? T.optActiveBg : T.optBg,
    color: active ? T.optActiveText : T.optText,
    cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div>
      <ProfileProgress step={2} answers={answers} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 4, letterSpacing: '-0.02em' }}>
        What are you getting back?
      </h2>
      <p style={{ color: T.textFaint, fontSize: 13, marginBottom: 20 }}>
        The pattern tells us exactly where in the funnel things break down — before the interview, in it, or after.
      </p>
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

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <BackButton onBack={onBack} />
        <PrimaryButton onClick={onNext} disabled={!valid} label="Continue →" />
      </div>
    </div>
  );
}

// ── Step: Auth ────────────────────────────────────────────────────────────────

function StepAuth({ answers, onAuthSuccess, onBack }: {
  answers: IntakeAnswers;
  onAuthSuccess: (email: string) => void;
  onBack: () => void;
}) {
  const { T } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const isAuthenticated = !!user;
  if (isAuthenticated) {
    return (
      <div>
        <ProfileProgress step={3} answers={answers} />
        <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
          You're already signed in
        </h2>
        <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
          Signed in as <strong style={{ color: T.text }}>{user.email}</strong>. Continue to upload your documents.
        </p>
        <PrimaryButton onClick={() => onAuthSuccess(user.email ?? '')} disabled={false} label="Continue →" />
        <div style={{ marginTop: 16 }}><BackButton onBack={onBack} /></div>
      </div>
    );
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setAlreadyRegistered(false);
    if (password.length < 8 || !/[^a-zA-Z0-9]/.test(password)) {
      setPwError('Password must be at least 8 characters and include at least one symbol (e.g. ! @ # $)');
      return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('already been registered') || msg.includes('email address is already')) {
          setAlreadyRegistered(true);
        } else {
          toast.error(signUpError.message || 'Sign up failed');
        }
        return;
      }
      if (!data.session) {
        toast.error('Could not create session. Please try again.');
        return;
      }
      onAuthSuccess(email.trim());
    } catch (err: any) {
      toast.error(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
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
      <ProfileProgress step={3} answers={answers} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
        Create your free account
      </h2>
      <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
        We'll save your progress and send your full diagnosis report to this email.
      </p>
      <p style={{ color: T.textFaint, fontSize: 12, lineHeight: 1.5, marginBottom: 20 }}>
        No spam — just your diagnosis and occasional job search tips if you opt in.
      </p>

      <form onSubmit={handleSignUp}>
        <div style={{ marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: T.textFaint, marginBottom: 8 }}>Email</span>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setAlreadyRegistered(false); }}
            placeholder="you@example.com" required style={inputStyle} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: T.textFaint, marginBottom: 8 }}>Password</span>
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setPwError(''); }}
            placeholder="e.g. Hunter2!" required style={inputStyle} />
          {password.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: password.length >= 8 ? '#4ade80' : '#f87171' }}>
                {password.length >= 8 ? '✓' : '✗'} 8+ characters
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: /[^a-zA-Z0-9]/.test(password) ? '#4ade80' : '#f87171' }}>
                {/[^a-zA-Z0-9]/.test(password) ? '✓' : '✗'} 1 symbol (! @ # $ …)
              </span>
            </div>
          )}
          {pwError && <p style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{pwError}</p>}
        </div>

        {alreadyRegistered && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: '#fcd34d', margin: 0 }}>
              This email already has an account.{' '}
              <button type="button" onClick={() => navigate('/auth')}
                style={{ background: 'none', border: 'none', color: '#fbbf24', fontWeight: 700, cursor: 'pointer', fontSize: 13, textDecoration: 'underline', padding: 0 }}>
                Sign in instead.
              </button>
            </p>
          </motion.div>
        )}

        <PrimaryButton
          onClick={() => {}}
          disabled={loading || !email.trim() || password.length < 8 || !/[^a-zA-Z0-9]/.test(password)}
          label={loading ? 'Setting up your account...' : 'Continue →'}
        />
      </form>

      <div style={{ marginTop: 16 }}><BackButton onBack={onBack} /></div>
    </div>
  );
}

// ── Step: Files ───────────────────────────────────────────────────────────────

function StepFiles({ resume, setResume, cl1, setCl1, cl2, setCl2, onSubmit, onBack, marketingConsent, onMarketingConsentChange, answers, emailSent }: {
  resume: File | null; setResume: (f: File | null) => void;
  cl1: File | null; setCl1: (f: File | null) => void;
  cl2: File | null; setCl2: (f: File | null) => void;
  onSubmit: () => void; onBack: () => void;
  marketingConsent: boolean; onMarketingConsentChange: (v: boolean) => void;
  answers: IntakeAnswers;
  emailSent: string;
}) {
  const { T } = useTheme();
  return (
    <div>
      <ProfileProgress step={4} answers={answers} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
        Now upload your documents.
      </h2>
      <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
        We're not judging them — we're reading them to find exactly what's holding you back.
      </p>
      <p style={{ color: T.textFaint, fontSize: 12, marginBottom: 12 }}>PDF or Word accepted.</p>

      {emailSent && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)',
        }}>
          <p style={{ fontSize: 12, color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
            Account created for <strong style={{ color: T.text }}>{emailSent}</strong>. A confirmation email is on its way — check your spam folder if it doesn't arrive in a minute.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FileDropZone label="Your resume (required)" required file={resume} onFile={setResume}
          subtext="We extract how you position yourself — structure, tone, and targeting all feed into the diagnosis." />
        <FileDropZone label="A recent cover letter" file={cl1} onFile={setCl1}
          subtext="Shows how you personalise applications. If you don't have one, that itself tells us something." />
        <FileDropZone label="A second cover letter (optional)" file={cl2} onFile={setCl2}
          subtext="Two cover letters let us spot whether you're adapting your approach or sending the same thing everywhere." />
      </div>

      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={marketingConsent} onChange={e => onMarketingConsentChange(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: T.btnBg, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: T.textMuted }}>Send me job search tips and product updates</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <BackButton onBack={onBack} />
        <PrimaryButton onClick={onSubmit} disabled={!resume} label="Build my diagnosis →" />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OnboardingIntake({ resumeMode = false }: { resumeMode?: boolean }) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const { T, isDark, toggle: toggleDark } = useAppTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/onboarding/report').then(({ data }) => {
      if (data.status === 'PROCESSING' || data.status === 'FAILED') { setStep(5); }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [answers, setAnswers] = useState<IntakeAnswers>({
    targetRole: '', seniority: '', industry: '', visaStatus: '',
    responsePattern: '', marketingEmail: '', marketingConsent: false,
  });
  const [resume, setResume] = useState<File | null>(null);
  const [cl1, setCl1] = useState<File | null>(null);
  const [cl2, setCl2] = useState<File | null>(null);

  const onChange = (k: keyof IntakeAnswers, v: string | boolean) =>
    setAnswers(prev => ({ ...prev, [k]: v }));

  const doSubmit = async (
    finalAnswers: IntakeAnswers,
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
      setStep(5);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error || err?.response?.data?.details || err?.message || 'Unknown error';
      console.error('[OnboardingIntake] Submit failed:', status, detail, err);
      if (status === 401) {
        toast.error(`Authentication failed (401): ${detail}. Please refresh and try again.`);
      } else if (status === 413) {
        toast.error('File too large. Please use a PDF under 5MB.');
      } else if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        toast.error('Request timed out. Your files may be too large — try a smaller PDF.');
      } else if (!err?.response) {
        toast.error('Network error — cannot reach the server. Check your connection.');
      } else {
        toast.error(`Upload failed (${status ?? 'error'}): ${detail}`);
      }
      setSubmitting(false);
    }
  };

  const handleAuthAndContinue = (email: string) => {
    setPendingEmail(email);
    goNext();
  };

  const handleFilesSubmit = async () => {
    if (!resume) { toast.error('Resume is missing — please upload it.'); return; }
    let userEmail = pendingEmail;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.email) userEmail = data.session.user.email;
    } catch {}
    await doSubmit({ ...answers, marketingEmail: userEmail }, resume, cl1, cl2);
  };

  // resumeMode: fired when user returns after email confirmation with IDB files saved
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
      setAnswers(pendingAnswers as unknown as IntakeAnswers);
      let userEmail = '';
      try {
        const { data } = await supabase.auth.getSession();
        userEmail = data.session?.user?.email ?? '';
      } catch {}
      await doSubmit(
        { ...(pendingAnswers as unknown as IntakeAnswers), marketingEmail: userEmail },
        pendingFiles.resume, pendingFiles.cl1, pendingFiles.cl2
      );
    }
    loadAndSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeMode]);

  const handleRetry = async () => {
    try { await api.post('/onboarding/retry'); setStep(5); }
    catch { toast.error('Retry failed. Please refresh and try again.'); }
  };

  const goNext = () => setStep(s => s + 1);
  const goBack = () => setStep(s => Math.max(0, s - 1));

  const STEPS = [
    <StepWelcome key="welcome" onNext={goNext} />,
    <StepRole key="role" answers={answers} onChange={(k, v) => onChange(k, v as string)} onNext={goNext} onBack={goBack} />,
    <StepResponses key="responses" answers={answers} onChange={(k, v) => onChange(k, v as string)} onNext={goNext} onBack={goBack} />,
    <StepAuth key="auth" answers={answers} onAuthSuccess={handleAuthAndContinue} onBack={goBack} />,
    <StepFiles
      key="files"
      answers={answers}
      resume={resume} setResume={setResume}
      cl1={cl1} setCl1={setCl1}
      cl2={cl2} setCl2={setCl2}
      onSubmit={handleFilesSubmit}
      onBack={goBack}
      marketingConsent={answers.marketingConsent}
      onMarketingConsentChange={v => setAnswers(prev => ({ ...prev, marketingConsent: v }))}
      emailSent={pendingEmail}
    />,
  ];

  const SignOutBtn = user && step > 0 ? (
    <motion.button
      onClick={async () => { await signOut(); navigate('/auth', { replace: true }); }}
      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
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

  if (step === 5 || (resumeMode && submitting)) {
    return (
      <div style={{ backgroundColor: T.bg, minHeight: '100vh', transition: 'background-color 0.4s' }}>
        <Scene />
        <ThemeToggle dark={isDark} onToggle={toggleDark} />
        {SignOutBtn}
        <ProcessingScreen
          isDark={isDark} theme={T}
          email={answers.marketingEmail?.trim() || pendingEmail}
          onComplete={() => { console.log('[OnboardingIntake] onComplete called'); }}
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
            <motion.div key={step}
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
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
