import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Loader2, UploadCloud, ArrowRight, Plus, X, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { colors, type as T } from '../components/landing/tokens';

// Subtle film grain over a solid, for the "brief" screen. Self-contained SVG.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";

// The resume is built BEFORE we ask for an email — they see the finished thing,
// then decide to save it. Email/code only appear if they aren't already signed in.
type Step =
  | 'upload' | 'loading' | 'brief' | 'roles'
  | 'questions' | 'building' | 'resume'
  | 'email' | 'code' | 'finishing';

const EASE = [0.25, 1, 0.5, 1] as const;

const ROLE_PLACEHOLDERS = ['e.g. Marketing Coordinator', 'e.g. Business Analyst', 'e.g. Registered Nurse', 'e.g. Software Engineer', 'e.g. Project Manager', 'e.g. Graphic Designer'];

// Supabase's email OTP length is a project setting (6-10 digits) that can be
// changed in the dashboard without touching this code. It was 6, is currently 8,
// and a hardcoded 6 here silently truncated the code so sign-in could never
// succeed. Never hardcode the length again — accept the whole range and let
// Supabase reject a wrong code.
const OTP_MIN = 6;
const OTP_MAX = 10;

interface IntakeQuestion {
  id: string;
  anchor: string;
  question: string;
  why: string;
  example: string;
  kind: 'number' | 'text';
  ranges: string[];
  hint: string;
}

type AnswerStatus = 'answered' | 'later' | 'unknown';
type Answers = Record<string, { status: AnswerStatus; value: string }>;

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState('');
  const [firstName, setFirstName] = useState('');
  const [brief, setBrief] = useState('');
  const [roles, setRoles] = useState<string[]>(['']);
  const [city, setCity] = useState('');

  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [draft, setDraft] = useState('');
  // Questions where they've said "I don't know" once and we've shown the help.
  // We push exactly once, then accept whatever they give us.
  const [pushed, setPushed] = useState<Record<string, boolean>>({});

  const [cleanResume, setCleanResume] = useState('');
  const [outstanding, setOutstanding] = useState(0);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = questions[qIndex];
  const isPushed = current ? !!pushed[current.id] : false;

  function cleanRoles() {
    return roles.map(r => r.trim()).filter(Boolean).slice(0, 3);
  }

  async function uploadResume(f: File) {
    setStep('loading');
    try {
      const fd = new FormData();
      fd.append('resume', f);
      const { data } = await api.post('/welcome/brief', fd, {
        timeout: 180000,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setToken(data.token);
      setFirstName(data.firstName || '');
      setBrief(data.brief || '');
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      if (data.currentRole) setRoles([data.currentRole]);
      setStep('brief');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not read your resume, please try again.');
      setStep('upload');
    }
  }

  // The brief ends with "I need a few facts from you before I rewrite it", so
  // the questions must be the very next thing. Sending them to a target-role
  // form here reads as a broken promise.
  function startQuestions() {
    if (questions.length === 0) { setStep('roles'); return; }
    setQIndex(0);
    setDraft('');
    setStep('questions');
  }

  // Roles are asked after the questions, immediately before the rebuild, because
  // the rewrite uses the target role for positioning.
  function onRolesContinue() {
    if (cleanRoles().length === 0) { toast.error('Add at least one target role.'); return; }
    void buildResume(answers);
  }

  function commitAnswer(status: AnswerStatus, value: string) {
    if (!current) return;
    const next: Answers = { ...answers, [current.id]: { status, value } };
    setAnswers(next);
    setDraft('');

    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1);
    } else {
      setStep('roles');
    }
  }

  // "I don't know" is not accepted the first time. We show them where to look and
  // offer coarse ranges, because an honest estimate beats a blank bullet. Only
  // after that push do we let it go.
  function onDontKnow() {
    if (!current) return;
    if (!isPushed) { setPushed(prev => ({ ...prev, [current.id]: true })); return; }
    commitAnswer('unknown', '');
  }

  async function buildResume(finalAnswers: Answers) {
    setStep('building');
    try {
      const { data } = await api.post('/welcome/build', {
        token,
        answers: finalAnswers,
        targetRole: cleanRoles()[0] ?? null,
      }, { timeout: 240000 });
      setCleanResume(data.resume || '');
      setOutstanding(Array.isArray(data.outstanding) ? data.outstanding.length : 0);
      setStep('resume');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not build your resume, please try again.');
      setStep('roles');
    }
  }

  // From the finished resume: signed-in users save immediately, everyone else
  // goes through email + code, which doubles as registration.
  function onSaveResume() {
    if (user) { void finishNow(); return; }
    setStep('email');
  }

  // Send the login code. shouldCreateUser makes this double as sign-up: an
  // existing client just signs in, a new email becomes their registration.
  async function sendCode() {
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { toast.error('Enter a valid email address.'); return; }
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: addr,
        options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/welcome` },
      });
      if (error) throw error;
      setEmail(addr);
      setCode('');
      setStep('code');
    } catch (err: any) {
      toast.error(err?.message || 'Could not send your code, please try again.');
    } finally {
      setSending(false);
    }
  }

  async function verifyAndFinish() {
    const otp = code.trim();
    if (otp.length < OTP_MIN) { toast.error('Enter the full code from your email.'); return; }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: otp, type: 'email' });
      if (error) throw error;
      await finishNow();
    } catch (err: any) {
      toast.error(err?.message || "That code didn't match. Check it and try again.");
      setVerifying(false);
    }
  }

  async function finishNow() {
    const clean = cleanRoles();
    if (clean.length === 0) { toast.error('Add at least one target role.'); setStep('roles'); return; }
    setStep('finishing');
    try {
      await api.post('/welcome/finish', { token, targetRoles: clean, targetCity: city.trim() || null });
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not complete setup, please try again.');
      setStep(user ? 'resume' : 'code');
      setVerifying(false);
    }
  }

  // ── Step: brief (the grained solid) ──────────────────────────────────────────
  if (step === 'brief') {
    return (
      <div style={{ height: '100dvh', overflowY: 'auto', background: colors.bgDeep, backgroundImage: GRAIN, display: 'flex', padding: '48px 24px', boxSizing: 'border-box' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
          style={{ width: '100%', maxWidth: 640, textAlign: 'left', margin: 'auto' }}
        >
          <span style={{ fontFamily: T.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: colors.accentGold }}>
            {firstName ? `${firstName}, here is where we start` : 'Here is where we start'}
          </span>
          <div style={{ height: 1, background: 'rgba(232,215,176,0.35)', margin: '20px 0 28px', maxWidth: 80 }} />
          <p style={{ fontFamily: T.display, fontSize: 'clamp(21px, 3vw, 27px)', lineHeight: 1.5, color: colors.textOnDeep, margin: 0, whiteSpace: 'pre-line' }}>
            {brief}
          </p>
          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <motion.button
              onClick={() => startQuestions()}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              style={{ fontFamily: T.body, fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '15px 28px', borderRadius: 14, border: 'none', background: colors.accentGold, color: colors.bgDeep, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              We fix this together <ArrowRight size={18} />
            </motion.button>
            <span style={{ fontFamily: T.body, fontSize: 13.5, color: 'rgba(250,247,242,0.6)' }}>
              {questions.length > 0 ? `Next: ${questions.length} quick questions.` : 'Next: your target roles.'}
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Step: roles ──────────────────────────────────────────────────────────────
  if (step === 'roles') {
    return (
      <Shell>
        <Eyebrow>Last thing before we rebuild it</Eyebrow>
        <Display>Where are we aiming?</Display>
        <p style={bodyText}>Tell us the roles you want to land. This points your feed, your matches and everything we build with you.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {roles.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input
                value={r}
                onChange={e => setRoles(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={ROLE_PLACEHOLDERS[i % ROLE_PLACEHOLDERS.length]}
                style={inputStyle}
                autoFocus={i === 0}
              />
              {roles.length > 1 && (
                <button onClick={() => setRoles(prev => prev.filter((_, j) => j !== i))} aria-label="Remove role"
                  style={{ background: 'transparent', border: `1px solid ${colors.borderDefined}`, borderRadius: 12, cursor: 'pointer', color: colors.textMuted, padding: '0 12px' }}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {roles.length < 3 && (
            <button onClick={() => setRoles(prev => [...prev, ''])}
              style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', color: colors.accentPetrol, fontFamily: T.body, fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
              <Plus size={15} /> Add another role
            </button>
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <span style={labelStyle}>Target city (optional)</span>
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Sydney, Melbourne, Brisbane" style={inputStyle} />
        </div>

        <div style={{ marginTop: 26 }}>
          <PrimaryBtn label="Build my resume" onClick={onRolesContinue} />
        </div>
      </Shell>
    );
  }

  // ── Step: questions ──────────────────────────────────────────────────────────
  if (step === 'questions' && current) {
    const canSubmit = draft.trim().length > 0;
    return (
      <Shell>
        <Eyebrow>Question {qIndex + 1} of {questions.length}</Eyebrow>

        {/* Progress bar — people answer more when they can see the end. */}
        <div style={{ height: 4, borderRadius: 99, background: colors.borderDefined, marginBottom: 22, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${(qIndex / questions.length) * 100}%` }}
            transition={{ duration: 0.4, ease: EASE }}
            style={{ height: '100%', background: colors.accentPetrol }}
          />
        </div>

        {qIndex === 0 && (
          <p style={{ ...bodyText, marginBottom: 18 }}>
            This is the only time we ask. Every number you give here makes every application we build after this stronger.
          </p>
        )}

        {current.anchor && (
          <div style={{ borderLeft: `3px solid ${colors.borderDefined}`, padding: '2px 0 2px 14px', margin: '0 0 18px' }}>
            <span style={{ ...labelStyle, marginBottom: 4 }}>From your resume</span>
            <span style={{ fontFamily: T.body, fontSize: 14.5, lineHeight: 1.5, color: colors.textSecondary, fontStyle: 'italic' }}>
              {current.anchor}
            </span>
          </div>
        )}

        <h1 style={{ fontFamily: T.display, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.25, color: colors.textPrimary, fontSize: 'clamp(21px, 3vw, 27px)', margin: '0 0 10px' }}>
          {current.question}
        </h1>
        {current.why && (
          <p style={{ fontFamily: T.body, fontSize: 14, lineHeight: 1.6, color: colors.textMuted, margin: '0 0 20px' }}>
            {current.why}
          </p>
        )}

        <input
          value={draft}
          autoFocus
          inputMode={current.kind === 'number' ? 'numeric' : 'text'}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canSubmit) commitAnswer('answered', draft.trim()); }}
          placeholder={current.example || 'Your answer'}
          style={inputStyle}
        />

        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <PrimaryBtn
            label={qIndex + 1 === questions.length ? 'Done' : 'Next'}
            onClick={() => canSubmit && commitAnswer('answered', draft.trim())}
            dim={!canSubmit}
          />
          <button onClick={onDontKnow}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontFamily: T.body, fontSize: 13.5, fontWeight: 700, padding: 0 }}>
            I don't know
          </button>
        </div>

        {/* The push. Shown once, after the first "I don't know". */}
        <AnimatePresence>
          {isPushed && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              style={{ marginTop: 24, padding: 18, borderRadius: 14, background: colors.bgAlt, border: `1px solid ${colors.borderDefined}` }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: colors.accentPetrol, flexShrink: 0, marginTop: 2 }}><Search size={17} /></span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: T.body, fontSize: 14.5, fontWeight: 600, color: colors.textPrimary, margin: '0 0 6px' }}>
                    You don't need the exact figure.
                  </p>
                  <p style={{ fontFamily: T.body, fontSize: 14, lineHeight: 1.6, color: colors.textSecondary, margin: 0 }}>
                    {current.hint
                      ? `An honest estimate is a real answer and it beats leaving this line bare. ${current.hint}`
                      : 'An honest estimate is a real answer and it beats leaving this line bare. Think about a normal week and round.'}
                  </p>
                </div>
              </div>

              {current.ranges.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                  {current.ranges.map(r => (
                    <button key={r} onClick={() => commitAnswer('answered', r)}
                      style={{ fontFamily: T.body, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: '9px 15px', borderRadius: 99, border: `1px solid ${colors.accentPetrol}`, background: 'transparent', color: colors.accentPetrol }}>
                      {r}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 20, marginTop: 18, flexWrap: 'wrap' }}>
                <button onClick={() => commitAnswer('later', '')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.accentPetrol, fontFamily: T.body, fontSize: 13.5, fontWeight: 700, padding: 0 }}>
                  I'll find out and add it later
                </button>
                <button onClick={() => commitAnswer('unknown', '')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontFamily: T.body, fontSize: 13.5, fontWeight: 700, padding: 0 }}>
                  Leave this one out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Shell>
    );
  }

  // ── Step: building ───────────────────────────────────────────────────────────
  if (step === 'building') {
    return (
      <Shell>
        <Eyebrow>Almost there</Eyebrow>
        <Display>Building your resume.</Display>
        <p style={bodyText}>Cleaning the formatting, leading with your outcomes, and working in everything you just told us. This takes up to a minute.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: colors.textSecondary, fontFamily: T.body, fontSize: 15 }}>
          <Loader2 size={20} className="animate-spin" style={{ color: colors.accentPetrol }} />
          Writing it now...
        </div>
      </Shell>
    );
  }

  // ── Step: resume (the payoff, still anonymous) ───────────────────────────────
  if (step === 'resume') {
    return (
      <Shell wide>
        <style>{RESUME_PAPER_CSS}</style>
        <Eyebrow>Your achievement bank</Eyebrow>
        <Display>{firstName ? `${firstName}, this is your bank.` : 'This is your bank.'}</Display>

        {/*
          The single most important idea in the whole flow, and the one people get
          wrong: this is NOT the document they send. It is the store we draw from.
          Short stacked sentences, one idea each, so the conclusion lands on its own
          rather than being asserted at them.
        */}
        <div style={{ margin: '0 0 26px' }}>
          <p style={bankLine}>This is <strong style={{ color: colors.textPrimary }}>not</strong> the resume you send out.</p>
          <p style={bankLine}>It is a bank of everything you have done.</p>
          <p style={bankLine}>Every job ad asks for something different.</p>
          <p style={bankLine}>So every resume you send should be different too.</p>
          <p style={bankLine}>Your achievements do not change. They sit safely in here.</p>
          <p style={{ ...bankLine, color: colors.textPrimary, fontWeight: 600 }}>
            When you apply for a job, we pick the ones that match that job, and build you a fresh resume for it.
          </p>
          <p style={{ ...bankLine, marginTop: 14, color: colors.textMuted, fontSize: 14.5 }}>
            One bank. A new resume every time.
          </p>
        </div>

        {outstanding > 0 && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', padding: '13px 16px', marginBottom: 22,
            borderRadius: 12, background: colors.bgAlt, border: `1px solid ${colors.borderDefined}`,
          }}>
            <span style={{ color: colors.accentPetrol, flexShrink: 0, marginTop: 1 }}><Search size={16} /></span>
            <span style={{ fontFamily: T.body, fontSize: 14, lineHeight: 1.55, color: colors.textSecondary }}>
              {outstanding === 1 ? 'One answer is' : `${outstanding} answers are`} still missing. We saved{' '}
              {outstanding === 1 ? 'it' : 'them'} to your dashboard. Adding {outstanding === 1 ? 'it' : 'them'} makes
              every resume we build stronger.
            </span>
          </div>
        )}

        {/* Rendered as a page, not a text box — people trust what looks like a document. */}
        <div className="bank-paper">
          <ReactMarkdown>{cleanResume}</ReactMarkdown>
        </div>

        <div style={{ marginTop: 24 }}>
          <PrimaryBtn label={user ? 'Save my bank' : 'Save my bank'} onClick={onSaveResume} />
        </div>
        {!user && (
          <p style={{ fontFamily: T.body, fontSize: 13.5, color: colors.textMuted, margin: '14px 0 0' }}>
            We'll ask for your email next, so your bank is here waiting whenever you log back in.
          </p>
        )}
      </Shell>
    );
  }

  // ── Step: email (sign up or sign in — same door) ──────────────────────────────
  if (step === 'email') {
    return (
      <Shell>
        <Eyebrow>Last step · save your resume</Eyebrow>
        <Display>Where should we save this?</Display>
        <p style={bodyText}>Enter your email and we'll send you a login code. If you've been here before this signs you straight back in. If you haven't, this creates your account.</p>

        <input
          type="email" inputMode="email" autoComplete="email" autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !sending) sendCode(); }}
          placeholder="you@email.com"
          style={inputStyle}
        />

        <div style={{ marginTop: 22 }}>
          <PrimaryBtn label={sending ? '' : 'Email me a code'} onClick={sendCode} loading={sending} />
        </div>
      </Shell>
    );
  }

  // ── Step: code (verify) ──────────────────────────────────────────────────────
  if (step === 'code') {
    return (
      <Shell>
        <Eyebrow>Check your inbox</Eyebrow>
        <Display>Enter your code</Display>
        <p style={bodyText}>We sent a login code to <strong style={{ color: colors.textPrimary }}>{email}</strong>. Type it in below to finish. It can take a minute to arrive, and it is worth checking spam just in case.</p>

        <input
          inputMode="numeric" autoComplete="one-time-code" autoFocus
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_MAX))}
          onKeyDown={e => { if (e.key === 'Enter' && !verifying) verifyAndFinish(); }}
          placeholder="Your login code"
          style={{ ...inputStyle, fontSize: 22, letterSpacing: '0.3em', fontWeight: 700 }}
        />

        <div style={{ marginTop: 22 }}>
          <PrimaryBtn label={verifying ? '' : 'Verify and finish'} onClick={verifyAndFinish} loading={verifying} />
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 20 }}>
          <button onClick={sendCode} disabled={sending}
            style={{ background: 'transparent', border: 'none', cursor: sending ? 'default' : 'pointer', color: colors.accentPetrol, fontFamily: T.body, fontSize: 13.5, fontWeight: 700, padding: 0 }}>
            {sending ? 'Sending…' : 'Resend code'}
          </button>
          <button onClick={() => { setCode(''); setStep('email'); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, fontFamily: T.body, fontSize: 13.5, fontWeight: 700, padding: 0 }}>
            Use a different email
          </button>
        </div>
      </Shell>
    );
  }

  // ── Step: finishing ──────────────────────────────────────────────────────────
  if (step === 'finishing') {
    return (
      <Shell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: colors.textSecondary, fontFamily: T.body, fontSize: 15.5 }}>
          <Loader2 size={20} className="animate-spin" style={{ color: colors.accentPetrol }} />
          Saving your resume…
        </div>
      </Shell>
    );
  }

  // ── Step: upload / loading ───────────────────────────────────────────────────
  return (
    <Shell>
      <Eyebrow>Welcome · Step 1 of your setup</Eyebrow>
      <Display>Let's get you set up.</Display>
      <p style={bodyText}>Start with your current resume. We read it, show you plainly where it stands, ask you the few things only you can tell us, then rebuild it properly. No scores, no judgement.</p>

      <AnimatePresence mode="wait">
        {step === 'loading' ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, color: colors.textSecondary, fontFamily: T.body, fontSize: 15 }}>
            <Loader2 size={20} className="animate-spin" style={{ color: colors.accentPetrol }} />
            Reading your resume...
          </motion.div>
        ) : (
          <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              onClick={() => inputRef.current?.click()}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                padding: '20px', borderRadius: 16, cursor: 'pointer',
                border: `2px dashed ${file ? colors.accentPetrol : colors.borderDefined}`,
                background: file ? 'rgba(45,90,110,0.05)' : colors.bgAlt,
              }}
            >
              <span style={{ color: file ? colors.accentPetrol : colors.textMuted, flexShrink: 0 }}>
                <UploadCloud size={26} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: T.body, fontSize: 15, fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file ? file.name : 'Upload your resume'}
                </span>
                <span style={{ display: 'block', fontFamily: T.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 }}>PDF or Word, up to 5MB.</span>
              </span>
            </button>
            <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) uploadResume(f); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
};

// ── Small shared building blocks (kept local to this page) ─────────────────────

const bodyText: React.CSSProperties = { fontFamily: T.body, fontSize: 15.5, lineHeight: 1.65, color: colors.textSecondary, margin: '0 0 24px' };

/** One short sentence per line, so the bank idea builds instead of being asserted. */
const bankLine: React.CSSProperties = {
  fontFamily: T.body, fontSize: 16, lineHeight: 1.5, color: colors.textSecondary, margin: '0 0 7px',
};

/**
 * The bank renders as a page, not a text dump. Markdown lists need explicit
 * styling because the app's CSS reset strips list markers, which is why the
 * bullets were coming out as flat lines.
 */
const RESUME_PAPER_CSS = `
.bank-paper {
  max-height: 62vh; overflow-y: auto;
  padding: 40px 44px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid ${colors.borderDefined};
  box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 12px 32px -12px rgba(16,24,40,.14);
  font-family: ${T.body}; font-size: 14.5; line-height: 1.65; color: #1a2230;
}
.bank-paper > *:first-child { margin-top: 0; }
.bank-paper > *:last-child { margin-bottom: 0; }
.bank-paper h1 {
  font-family: ${T.display}; font-size: 24px; font-weight: 600; letter-spacing: .01em;
  margin: 0 0 4px; color: #101828;
}
.bank-paper h2 {
  font-family: ${T.body}; font-size: 11.5px; font-weight: 700;
  letter-spacing: .13em; text-transform: uppercase; color: ${colors.accentPetrol};
  margin: 26px 0 10px; padding-bottom: 6px;
  border-bottom: 1px solid ${colors.borderDefined};
}
.bank-paper h3 { font-family: ${T.body}; font-size: 15px; font-weight: 700; margin: 16px 0 2px; color: #101828; }
.bank-paper p { margin: 0 0 10px; font-size: 14.5px; line-height: 1.65; }
.bank-paper strong { font-weight: 700; color: #101828; }
.bank-paper em { color: #475467; }
.bank-paper ul, .bank-paper ol { margin: 8px 0 14px; padding-left: 22px; }
.bank-paper ul { list-style: disc; }
.bank-paper ol { list-style: decimal; }
.bank-paper li { margin: 0 0 7px; font-size: 14.5px; line-height: 1.6; padding-left: 3px; }
.bank-paper li::marker { color: ${colors.accentPetrol}; }
.bank-paper hr { border: 0; border-top: 1px solid ${colors.borderDefined}; margin: 20px 0; }
.bank-paper a { color: ${colors.accentPetrol}; text-decoration: none; }
@media (max-width: 640px) { .bank-paper { padding: 24px 20px; max-height: 56vh; } }
`;
const inputStyle: React.CSSProperties = {
  flex: 1, width: '100%', boxSizing: 'border-box', fontFamily: T.body, fontSize: 15, padding: '13px 16px',
  borderRadius: 12, border: `1px solid ${colors.borderDefined}`, background: colors.bgSurface, color: colors.textPrimary, outline: 'none',
};
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: T.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 8 };

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ height: '100dvh', overflowY: 'auto', background: colors.bgCanvas, display: 'flex', padding: '48px 24px', boxSizing: 'border-box' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
        style={{ width: '100%', maxWidth: wide ? 720 : 520, margin: 'auto' }}>
        {children}
      </motion.div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '6px 12px', borderRadius: 99, background: 'rgba(45,90,110,0.10)', border: '1px solid rgba(45,90,110,0.22)' }}>
      <span style={{ fontFamily: T.body, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.accentPetrol }}>{children}</span>
    </div>
  );
}

function Display({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ fontFamily: T.display, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, color: colors.textPrimary, fontSize: 'clamp(28px, 4.4vw, 40px)', margin: '0 0 12px' }}>
      {children}
    </h1>
  );
}

function PrimaryBtn({ label, onClick, loading, dim }: { label: string; onClick: () => void; loading?: boolean; dim?: boolean }) {
  const inert = loading || dim;
  return (
    <motion.button onClick={onClick} disabled={loading} whileHover={{ scale: inert ? 1 : 1.02 }} whileTap={{ scale: inert ? 1 : 0.98 }}
      style={{ fontFamily: T.body, fontSize: 16, fontWeight: 700, cursor: loading ? 'default' : 'pointer', padding: '15px 28px', borderRadius: 14, border: 'none', background: colors.accentPetrol, color: colors.textOnDeep, display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 150, justifyContent: 'center', opacity: dim ? 0.45 : 1, transition: 'opacity 0.2s' }}>
      {loading ? <Loader2 size={18} className="animate-spin" /> : <>{label} <ArrowRight size={18} /></>}
    </motion.button>
  );
}
