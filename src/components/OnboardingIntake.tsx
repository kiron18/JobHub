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
  trackOnboardingStepViewed,
  trackOnboardingStepCompleted,
  trackOnboardingSubmitted,
  trackDiagnosticReportViewed,
} from '../lib/analytics';

const useTheme = () => useAppTheme();

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntakeAnswers {
  targetRole: string;
  targetCity: string;
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
  { value: 'mostly_silence',    label: 'Mostly silence',            sub: 'Applications go in and nothing comes back' },
  { value: 'mostly_rejections', label: 'Mostly rejections',         sub: 'Getting responses, but all rejections' },
  { value: 'interviews_stall',  label: 'Interviews that stall',     sub: 'Getting interviews but they go nowhere' },
  { value: 'no_offers',         label: 'Interviews but no offers',  sub: 'Getting far but not closing' },
  { value: 'mix',               label: 'Mix of everything',         sub: '' },
];

// Labels shown after completing each step (shown at the top of the NEXT step)
const STEP_LABELS = ['', 'Target locked in.', 'Search pattern clear.'];

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
  if (answers.seniority)  chips.push(answers.seniority);
  if (answers.industry)   chips.push(answers.industry);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.textFaint }}>
          Building your profile
        </span>
        <span style={{ fontSize: 11, color: T.textFaint, fontWeight: 600 }}>{step} / 3</span>
      </div>
      <div style={{ height: 4, background: T.progressBg, borderRadius: 99, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: T.progressFill, borderRadius: 99 }}
          animate={{ width: `${(step / 3) * 100}%` }}
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

function PrimaryButton({ onClick, disabled, loading, label }: { onClick: () => void; disabled?: boolean; loading?: boolean; label: string }) {
  const { T } = useTheme();
  const isDisabled = disabled || loading;
  return (
    <motion.button onClick={onClick} disabled={isDisabled}
      style={{
        flex: 1, padding: '14px 20px', borderRadius: 14, border: 'none',
        background: T.btnBg, color: T.btnText, fontWeight: 800, fontSize: 15,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? (loading ? 0.7 : 0.3) : 1,
        boxShadow: isDisabled ? 'none' : T.btnShadow,
        transition: 'opacity 0.2s, box-shadow 0.2s', fontFamily: 'inherit', letterSpacing: '-0.01em',
      }}
      whileHover={!isDisabled ? { scale: 1.02, boxShadow: '0 8px 40px rgba(0,0,0,0.25)' } : {}}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
    >
      {loading ? 'Building your diagnosis…' : label}
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
        Take this free 3-minute diagnostic to find out exactly which part of your application process is costing you interviews, and what to fix first.
      </p>

      <div style={{ marginBottom: 18, textAlign: 'left' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.textFaint, textAlign: 'center', marginBottom: 10 }}>
          Your diagnosis will cover
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: 'Role targeting',        desc: 'Right roles for your level?' },
            { label: 'Document audit',         desc: 'Resume costing you interviews?' },
            { label: 'Application pipeline',   desc: 'Where things drop off?' },
            { label: 'Honest assessment',      desc: 'What your docs reveal' },
            { label: 'Three-step fix', color: '#22c55e', desc: 'Ranked by impact, written for you' },
            { label: 'How we can help',        desc: 'Tools and training available' },
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
          Before you start, grab your resume.
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

// ── Step: Auth (step 1, before questions) ────────────────────────────────────

function StepAuth({ onAuthSuccess, onBack }: {
  onAuthSuccess: () => void;
  onBack: () => void;
}) {
  const { T } = useTheme();
  const { user } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [pwError, setPwError]   = useState('');
  const [mode, setMode]         = useState<'signup' | 'signin'>('signup');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const justCalledRef = useRef(false);

  const isAuthenticated = !!user && !(user as any).is_anonymous;

  // If already authenticated (e.g. returning user), skip this step
  useEffect(() => {
    if (isAuthenticated && !justCalledRef.current) {
      justCalledRef.current = true;
      onAuthSuccess();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (isAuthenticated) return null;

  const inputStyle: React.CSSProperties = {
    background: T.inputBg, border: `1px solid ${T.inputBorder}`,
    borderRadius: 12, color: T.inputText, fontSize: 15,
    padding: '12px 16px', width: '100%', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          toast.error('Incorrect email or password.');
        }
        // onAuthStateChange fires → setUser → isAuthenticated → useEffect → onAuthSuccess()
      } else {
        if (password.length < 8 || !/[^a-zA-Z0-9]/.test(password)) {
          setPwError('Password needs 8+ characters and at least one symbol (! @ # $ …)');
          setLoading(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (signUpError) {
          const msg = signUpError.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('already been registered')) {
            setMode('signin');
            toast.error('Account already exists, sign in below.');
          } else {
            toast.error(signUpError.message || 'Sign up failed');
          }
          return;
        }
        if (!data.session) {
          if (!data.user?.identities || data.user.identities.length === 0) {
            setMode('signin');
            toast.error('Account already exists, sign in below.');
          } else {
            setAwaitingConfirmation(true);
          }
          return;
        }
        justCalledRef.current = true;
        onAuthSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === 'signup';
  const canSubmit = email.trim().length > 0 && password.length >= (isSignup ? 8 : 1) && (isSignup ? /[^a-zA-Z0-9]/.test(password) : true);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 8, letterSpacing: '-0.02em' }}>
        {isSignup ? 'Get your personalized job readiness diagnostic' : 'Welcome back'}
      </h2>
      <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
        {isSignup
          ? 'Enter your email to receive your full results, and access them anytime.'
          : 'Sign in to continue your diagnosis.'}
      </p>

      {awaitingConfirmation ? (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '14px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#a5b4fc', margin: '0 0 6px 0' }}>Check your inbox</p>
          <p style={{ fontSize: 13, color: '#c7d2fe', margin: 0, lineHeight: 1.5 }}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back here.
          </p>
          <p style={{ fontSize: 12, color: '#818cf8', margin: '6px 0 0 0' }}>Can't find it? Check spam.</p>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: T.textFaint, marginBottom: 8 }}>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required style={inputStyle} autoFocus />
          </div>
          <div style={{ marginBottom: 8 }}>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: T.textFaint, marginBottom: 8 }}>Password</span>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setPwError(''); }}
              placeholder={isSignup ? 'e.g. Hunter2!' : 'Your password'} required style={inputStyle} />
            {isSignup && password.length > 0 && (
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

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <PrimaryButton
              onClick={() => {}}
              disabled={loading || !canSubmit}
              label={loading ? (isSignup ? 'Creating account…' : 'Signing in…') : 'Continue →'}
            />
          </div>
        </form>
      )}

      <p style={{ fontSize: 13, color: T.textFaint, marginTop: 16, textAlign: 'center' }}>
        {isSignup ? 'Already have an account? ' : 'New here? '}
        <button type="button" onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setPwError(''); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.progressFill, fontWeight: 700, fontSize: 13, padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>
          {isSignup ? 'Sign in' : 'Create an account'}
        </button>
      </p>

      <div style={{ marginTop: 16 }}><BackButton onBack={onBack} /></div>
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
        What role are you targeting?
      </h2>
      <p style={{ color: T.textFaint, fontSize: 13, marginBottom: 24 }}>Be specific, this anchors your entire diagnosis to real Australian hiring conditions.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Role" hint="Vague targets produce vague diagnoses. The more specific you are, the more precisely we can flag what's off.">
          <TInput placeholder="e.g. Senior Product Manager" value={answers.targetRole} onChange={v => onChange('targetRole', v)} />
        </Field>
        <Field label="Target city" hint="Your job feed pulls live listings from this city. You can change it later in your profile.">
          <TInput placeholder="e.g. Sydney, Melbourne, Brisbane" value={answers.targetCity} onChange={v => onChange('targetCity', v)} />
        </Field>
        <Field label="Seniority" hint="We compare your positioning against what employers at this level actually expect to see.">
          <TSelect value={answers.seniority} onChange={v => onChange('seniority', v)} options={SENIORITY_OPTIONS} placeholder="Select level" />
        </Field>
        <Field label="Industry" hint="Different industries have different filtering patterns, this helps us spot what's specific to your market.">
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
        The pattern tells us exactly where in the funnel things break down, before the interview, in it, or after.
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

// ── Step: Files ───────────────────────────────────────────────────────────────

function StepFiles({ resume, setResume, cl1, setCl1, cl2, setCl2, onSubmit, onBack, marketingConsent, onMarketingConsentChange, answers, submitting }: {
  resume: File | null; setResume: (f: File | null) => void;
  cl1: File | null; setCl1: (f: File | null) => void;
  cl2: File | null; setCl2: (f: File | null) => void;
  onSubmit: () => void; onBack: () => void;
  marketingConsent: boolean; onMarketingConsentChange: (v: boolean) => void;
  answers: IntakeAnswers;
  submitting: boolean;
}) {
  const { T } = useTheme();
  return (
    <div>
      <ProfileProgress step={3} answers={answers} />
      <h2 style={{ fontSize: 24, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.02em' }}>
        Now upload your documents.
      </h2>
      <p style={{ color: T.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
        We're not judging them, we're reading them to find exactly what's holding you back.
      </p>
      <p style={{ color: T.textFaint, fontSize: 12, marginBottom: 16 }}>PDF or Word accepted.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FileDropZone label="Your resume (required)" required file={resume} onFile={setResume}
          subtext="We extract how you position yourself, structure, tone, and targeting all feed into the diagnosis." />
        <FileDropZone label="A recent cover letter" file={cl1} onFile={setCl1}
          subtext="Shows how you personalise applications. If you don't have one, that itself tells us something." />
        <FileDropZone label="A second cover letter (optional)" file={cl2} onFile={setCl2}
          subtext="Two cover letters let us spot whether you're adapting your approach or sending the same thing everywhere." />
      </div>

      <div style={{ marginTop: 24 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={marketingConsent} onChange={e => onMarketingConsentChange(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: T.btnBg, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: T.textMuted }}>Email my diagnostic report + job search tips to my account email</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <BackButton onBack={onBack} />
        <PrimaryButton onClick={onSubmit} disabled={!resume} loading={submitting} label="Build my diagnosis →" />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OnboardingIntake({ resumeMode: _resumeMode = false, initialStep }: { resumeMode?: boolean; initialStep?: number }) {
  const [step, setStep]           = useState(initialStep ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const { T, isDark, toggle: toggleDark } = useAppTheme();
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const isAuthenticated = !!user && !(user as any).is_anonymous;

  // Compute the visible step synchronously, if already authenticated, never render Welcome or Auth
  const visibleStep = isAuthenticated && step < 2 ? 2 : step;

  // Sync internal step to visibleStep once auth resolves so that goNext advances
  // from the correct position (avoids needing multiple clicks to leave step 2).
  useEffect(() => {
    if (!authLoading && isAuthenticated && step < 2) {
      setStep(2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  const [answers, setAnswers] = useState<IntakeAnswers>({
    targetRole: '', targetCity: '', seniority: '', industry: '', visaStatus: '',
    responsePattern: '', marketingEmail: '', marketingConsent: false,
  });
  const [resume, setResume] = useState<File | null>(null);
  const [cl1, setCl1]       = useState<File | null>(null);
  const [cl2, setCl2]       = useState<File | null>(null);

  const onChange = (k: keyof IntakeAnswers, v: string | boolean) =>
    setAnswers(prev => ({ ...prev, [k]: v }));

  const doSubmit = async (
    finalAnswers: IntakeAnswers,
    resumeFile: File,
    coverLetter1: File | null,
    coverLetter2: File | null,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append('answers', JSON.stringify(finalAnswers));
    fd.append('resume', resumeFile);
    if (coverLetter1) fd.append('coverLetter1', coverLetter1);
    if (coverLetter2) fd.append('coverLetter2', coverLetter2);

    try {
      trackOnboardingSubmitted();
      await api.post('/onboarding/submit', fd, { timeout: 30000 });
      setSubmitting(false);
      setStep(5);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.error || err?.message || 'Unknown error';
      console.error('[OnboardingIntake] Submit failed:', status, detail);
      if (status === 413) {
        toast.error('File too large. Please use a PDF under 5MB.');
      } else if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        toast.error('Request timed out. Try a smaller PDF.');
      } else if (!err?.response) {
        toast.error('Network error, check your connection and try again.');
      } else {
        toast.error(`Upload failed (${status ?? 'error'}): ${detail}`);
      }
      setSubmitting(false);
    }
  };

  // Called when the user clicks "Build my diagnosis →" on StepFiles
  const handleFilesSubmit = async () => {
    if (!resume) { toast.error('Resume is required.'); return; }
    await doSubmit(
      { ...answers, marketingEmail: user?.email ?? '' },
      resume, cl1, cl2,
    );
  };

  const handleRetry = async () => {
    try { await api.post('/onboarding/retry'); setStep(5); }
    catch { toast.error('Retry failed. Please refresh and try again.'); }
  };

  const STEP_NAMES = ['welcome', 'auth', 'role', 'responses', 'files', 'processing'];

  const goNext = () => {
    trackOnboardingStepCompleted(visibleStep, STEP_NAMES[visibleStep] ?? `step_${visibleStep}`);
    setStep(s => s + 1);
  };
  const goBack = () => setStep(s => Math.max(0, s - 1));

  // Track when each step becomes visible
  useEffect(() => {
    trackOnboardingStepViewed(visibleStep, STEP_NAMES[visibleStep] ?? `step_${visibleStep}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleStep]);

  // Step order: Welcome(0) → Auth(1) → Role(2) → Responses(3) → Files(4) → ProcessingScreen(5)
  const STEPS = [
    <StepWelcome key="welcome" onNext={goNext} />,
    <StepAuth key="auth" onAuthSuccess={goNext} onBack={goBack} />,
    <StepRole key="role" answers={answers} onChange={(k, v) => onChange(k, v as string)} onNext={goNext} onBack={goBack} />,
    <StepResponses key="responses" answers={answers} onChange={(k, v) => onChange(k, v as string)} onNext={goNext} onBack={goBack} />,
    <StepFiles
      key="files"
      answers={answers}
      resume={resume} setResume={setResume}
      cl1={cl1} setCl1={setCl1}
      cl2={cl2} setCl2={setCl2}
      onSubmit={handleFilesSubmit}
      onBack={goBack}
      submitting={submitting}
      marketingConsent={answers.marketingConsent}
      onMarketingConsentChange={v => setAnswers(prev => ({ ...prev, marketingConsent: v }))}
    />,
  ];

  const SignOutBtn = user && !(user as any).is_anonymous && visibleStep > 1 ? (
    <motion.button
      onClick={async () => { await signOut(); navigate('/', { replace: true }); }}
      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
      style={{
        position: 'fixed', top: 20, left: 20, zIndex: 100,
        padding: '8px 14px', borderRadius: 10, border: 'none',
        background: T.toggleBg, color: T.textMuted,
        cursor: 'pointer', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 600,
        backdropFilter: 'blur(12px)',
      }}
    >
      <LogOut size={14} />
      Sign out
    </motion.button>
  ) : null;

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg }}>
      <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  if (visibleStep === 5 || submitting) {
    return (
      <div style={{ backgroundColor: T.bg, minHeight: '100vh', transition: 'background-color 0.4s' }}>
        <Scene />
        <ThemeToggle dark={isDark} onToggle={toggleDark} />
        {SignOutBtn}
        <ProcessingScreen
          isDark={isDark} theme={T}
          email={user?.email ?? answers.marketingEmail}
          targetRole={answers.targetRole || undefined}
          onComplete={() => { trackDiagnosticReportViewed(); }}
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
            <motion.div key={visibleStep}
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
                {STEPS[visibleStep]}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
