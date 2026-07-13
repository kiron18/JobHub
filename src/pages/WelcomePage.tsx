import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Loader2, UploadCloud, ArrowRight, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { colors, type as T } from '../components/landing/tokens';

// Subtle film grain over a solid, for the "brief" screen. Self-contained SVG.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")";

type Step = 'upload' | 'loading' | 'brief' | 'roles' | 'finishing';

const EASE = [0.25, 1, 0.5, 1] as const;

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState('');
  const [firstName, setFirstName] = useState('');
  const [brief, setBrief] = useState('');
  const [roles, setRoles] = useState<string[]>(['']);
  const [city, setCity] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadResume(f: File) {
    setStep('loading');
    try {
      const fd = new FormData();
      fd.append('resume', f);
      const { data } = await api.post('/welcome/brief', fd, {
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setToken(data.token);
      setFirstName(data.firstName || '');
      setBrief(data.brief || '');
      setStep('brief');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not read your resume, please try again.');
      setStep('upload');
    }
  }

  async function finish() {
    const clean = roles.map(r => r.trim()).filter(Boolean).slice(0, 3);
    if (clean.length === 0) { toast.error('Add at least one target role.'); return; }
    setStep('finishing');
    try {
      await api.post('/welcome/finish', { token, targetRoles: clean, targetCity: city.trim() || null });
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not complete setup, please try again.');
      setStep('roles');
    }
  }

  // ── Not signed in: they should arrive via their set-up link ──────────────────
  if (!authLoading && !user) {
    return (
      <Shell>
        <Eyebrow>Welcome</Eyebrow>
        <Display>Open your set-up link</Display>
        <p style={bodyText}>Use the link from your welcome email to get started, or sign in if you already have a password.</p>
        <PrimaryBtn label="Sign in" onClick={() => navigate('/auth')} />
      </Shell>
    );
  }

  // ── Step: brief (the grained solid) ──────────────────────────────────────────
  if (step === 'brief') {
    return (
      <div style={{ minHeight: '100vh', background: colors.bgDeep, backgroundImage: GRAIN, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
          style={{ width: '100%', maxWidth: 640, textAlign: 'left' }}
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
              onClick={() => setStep('roles')}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              style={{ fontFamily: T.body, fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '15px 28px', borderRadius: 14, border: 'none', background: colors.accentGold, color: colors.bgDeep, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              We fix this together <ArrowRight size={18} />
            </motion.button>
            <span style={{ fontFamily: T.body, fontSize: 13.5, color: 'rgba(250,247,242,0.6)' }}>Next: your target roles.</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Step: roles ──────────────────────────────────────────────────────────────
  if (step === 'roles' || step === 'finishing') {
    return (
      <Shell>
        <Eyebrow>Step 2 of your setup</Eyebrow>
        <Display>Where are we aiming?</Display>
        <p style={bodyText}>Tell us the roles you want to land. This points your feed, your matches and everything we build with you.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {roles.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input
                value={r}
                onChange={e => setRoles(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="e.g. Marketing Coordinator"
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
          <PrimaryBtn label={step === 'finishing' ? '' : 'Finish setup'} onClick={finish} loading={step === 'finishing'} />
        </div>
      </Shell>
    );
  }

  // ── Step: upload / loading ───────────────────────────────────────────────────
  return (
    <Shell>
      <Eyebrow>Welcome · Step 1 of your setup</Eyebrow>
      <Display>Let's get you set up.</Display>
      <p style={bodyText}>Start with your current resume. We read it, show you plainly where it stands, then fix it together. No scores, no judgement.</p>

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
const inputStyle: React.CSSProperties = {
  flex: 1, width: '100%', boxSizing: 'border-box', fontFamily: T.body, fontSize: 15, padding: '13px 16px',
  borderRadius: 12, border: `1px solid ${colors.borderDefined}`, background: colors.bgSurface, color: colors.textPrimary, outline: 'none',
};
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: T.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 8 };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: colors.bgCanvas, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
        style={{ width: '100%', maxWidth: 520 }}>
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

function PrimaryBtn({ label, onClick, loading }: { label: string; onClick: () => void; loading?: boolean }) {
  return (
    <motion.button onClick={onClick} disabled={loading} whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.98 }}
      style={{ fontFamily: T.body, fontSize: 16, fontWeight: 700, cursor: loading ? 'default' : 'pointer', padding: '15px 28px', borderRadius: 14, border: 'none', background: colors.accentPetrol, color: colors.textOnDeep, display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 150, justifyContent: 'center' }}>
      {loading ? <Loader2 size={18} className="animate-spin" /> : <>{label} <ArrowRight size={18} /></>}
    </motion.button>
  );
}
