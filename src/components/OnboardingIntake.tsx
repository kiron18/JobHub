import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface IntakeAnswers {
  targetRole: string;
  targetCity: string;
  seniority: string;
  industry: string;
  searchDuration: string;
  applicationsCount: string;
  channels: string[];
  channelOther: string;
  responsePattern: string;
  blockerOptions: string[];
  blockerOther: string;
  perceivedBlocker: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SENIORITY_OPTIONS = ['Graduate', 'Mid-level', 'Senior', 'Lead', 'Executive'];
const INDUSTRY_OPTIONS = [
  'Tech', 'FinTech', 'Consulting', 'Marketing', 'Finance',
  'Healthcare', 'Education', 'Government', 'Other',
];
const DURATION_OPTIONS = ['Less than a month', '1–3 months', '3–6 months', '6–12 months', 'Over a year'];
const COUNT_OPTIONS = ['Under 10', '10–30', '30–60', '60–100', '100+'];
const CHANNEL_OPTIONS = ['LinkedIn', 'Seek', 'Indeed', 'Recruiters', 'Direct applications', 'Referrals', 'Other'];
const RESPONSE_OPTIONS = [
  { value: 'mostly_silence', label: 'Mostly silence', sub: 'Applications go in and nothing comes back' },
  { value: 'mostly_rejections', label: 'Mostly rejections', sub: "Getting responses, but they're nos" },
  { value: 'interviews_stall', label: 'Interviews that stall', sub: 'Getting interviews but they go nowhere' },
  { value: 'no_offers', label: 'Interviews but no offers', sub: 'Getting far but not closing' },
  { value: 'mix', label: 'Mix of everything', sub: '' },
];
const BLOCKER_OPTIONS = [
  'Lack of Australian work experience',
  'My resume or cover letters',
  'Experience gap — targeting roles above where I am',
  'Interview nerves or performance',
];
const PROCESSING_LINES = [
  'Reading your documents...',
  'Mapping where applications are likely dropping off...',
  'Cross-referencing your experience against your targets...',
  'Building your diagnosis...',
];

// ── Design tokens ─────────────────────────────────────────────────────────────

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.58)',
  backdropFilter: 'blur(32px)',
  WebkitBackdropFilter: 'blur(32px)',
  border: '1px solid rgba(255,255,255,0.88)',
  boxShadow: '0 8px 80px rgba(0,0,0,0.07), 0 1px 0 rgba(255,255,255,0.95) inset',
  borderRadius: '28px',
};

const BLOB: React.CSSProperties = {
  background: 'radial-gradient(circle at 33% 28%, #ffffff 0%, #dde1ec 55%, #c4c9d9 100%)',
  boxShadow: [
    'inset -10px -10px 28px rgba(0,0,0,0.07)',
    'inset 5px 5px 18px rgba(255,255,255,0.95)',
    '20px 32px 80px rgba(0,0,0,0.14)',
    '4px 8px 20px rgba(0,0,0,0.06)',
  ].join(', '),
  borderRadius: '50%',
};

const INPUT: React.CSSProperties = {
  background: 'rgba(255,255,255,0.75)',
  border: '1px solid rgba(0,0,0,0.09)',
  borderRadius: '12px',
  color: '#111827',
  fontSize: '15px',
  padding: '12px 16px',
  width: '100%',
  outline: 'none',
  transition: 'box-shadow 0.2s, border-color 0.2s',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#9ca3af',
  marginBottom: '8px',
};

const BTN_PRIMARY: React.CSSProperties = {
  width: '100%',
  padding: '15px 24px',
  borderRadius: '16px',
  background: '#111827',
  color: '#ffffff',
  fontWeight: 900,
  fontSize: '16px',
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.2s, transform 0.1s, box-shadow 0.2s',
  boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
  letterSpacing: '-0.01em',
};

// ── Background scene ──────────────────────────────────────────────────────────

function Scene() {
  return (
    <>
      {/* Dot grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundColor: '#eceef4',
          backgroundImage: 'radial-gradient(circle, #c0c4d0 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* Blob — bottom left (large) */}
      <motion.div
        className="fixed pointer-events-none"
        style={{ ...BLOB, width: 380, height: 380, bottom: -80, left: -80 }}
        animate={{ x: [0, 18, -8, 0], y: [0, -14, 8, 0], scale: [1, 1.02, 0.99, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Blob — top right (medium) */}
      <motion.div
        className="fixed pointer-events-none"
        style={{ ...BLOB, width: 280, height: 280, top: -60, right: -40 }}
        animate={{ x: [0, -12, 6, 0], y: [0, 16, -6, 0], scale: [1, 1.03, 0.98, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />

      {/* Blob — center right (small) */}
      <motion.div
        className="fixed pointer-events-none"
        style={{ ...BLOB, width: 180, height: 180, top: '42%', right: -50 }}
        animate={{ x: [0, -8, 4, 0], y: [0, 12, -8, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />

      {/* Blob — top left (small) */}
      <motion.div
        className="fixed pointer-events-none"
        style={{ ...BLOB, width: 140, height: 140, top: '12%', left: '8%' }}
        animate={{ x: [0, 10, -5, 0], y: [0, -8, 6, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </>
  );
}

// ── Progress dots ─────────────────────────────────────────────────────────────

function DotProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2 items-center justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === step ? 28 : 8,
            backgroundColor: i < step ? '#d1d5db' : i === step ? '#111827' : '#e5e7eb',
          }}
          transition={{ duration: 0.3 }}
          style={{ height: 7, borderRadius: 99 }}
        />
      ))}
    </div>
  );
}

// ── Input helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span style={LABEL}>{label}</span>
      {children}
    </div>
  );
}

function TextInput({ placeholder, value, onChange }: {
  placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <input
      style={INPUT}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(17,24,39,0.12)'; e.target.style.borderColor = 'rgba(0,0,0,0.2)'; }}
      onBlur={e => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'rgba(0,0,0,0.09)'; }}
    />
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder: string;
}) {
  return (
    <select
      style={{ ...INPUT, appearance: 'none', cursor: 'pointer' }}
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(17,24,39,0.12)'; }}
      onBlur={e => { e.target.style.boxShadow = 'none'; }}
    >
      <option value="" style={{ color: '#9ca3af' }}>{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── File drop zone ────────────────────────────────────────────────────────────

function FileDropZone({ label, subtext, required, file, onFile }: {
  label: string; subtext?: string; required?: boolean;
  file: File | null; onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${file ? 'rgba(17,24,39,0.3)' : 'rgba(0,0,0,0.12)'}`,
        borderRadius: 14,
        padding: '18px 20px',
        cursor: 'pointer',
        background: file ? 'rgba(17,24,39,0.04)' : 'rgba(255,255,255,0.4)',
        transition: 'all 0.2s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={e => onFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 20, color: file ? '#111827' : '#9ca3af' }}>{file ? '✓' : '↑'}</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: file ? '#111827' : '#6b7280' }}>
            {file ? file.name : label}
            {required && !file && <span style={{ color: '#6366f1', marginLeft: 4 }}>*</span>}
          </p>
          {subtext && !file && <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Processing screen ─────────────────────────────────────────────────────────

function ProcessingScreen({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const [lineIndex, setLineIndex] = useState(0);
  useEffect(() => {
    if (failed) return;
    const iv = setInterval(() => setLineIndex(i => (i + 1) % PROCESSING_LINES.length), 3000);
    return () => clearInterval(iv);
  }, [failed]);

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6" style={{ backgroundColor: '#eceef4' }}>
      <Scene />
      <div style={{ ...GLASS_CARD, padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center', position: 'relative' }}>
        {failed ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⚠</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 10 }}>Something went wrong on our end</h2>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Your documents were saved. Refresh and we'll pick up where we left off.
            </p>
            <button onClick={onRetry} style={{ ...BTN_PRIMARY, width: 'auto', padding: '12px 28px' }}>
              Try again
            </button>
          </>
        ) : (
          <>
            <motion.div
              style={{
                width: 44, height: 44,
                borderRadius: '50%',
                border: '3px solid rgba(0,0,0,0.08)',
                borderTopColor: '#111827',
                margin: '0 auto 28px',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            />
            <AnimatePresence mode="wait">
              <motion.p
                key={lineIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                style={{ color: '#374151', fontSize: 15, fontWeight: 500 }}
              >
                {PROCESSING_LINES[lineIndex]}
              </motion.p>
            </AnimatePresence>
            <p style={{ color: '#d1d5db', fontSize: 12, marginTop: 16 }}>This takes 30–60 seconds</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <motion.span
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          display: 'inline-block',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
          color: '#9ca3af', background: 'rgba(0,0,0,0.05)', borderRadius: 99,
          padding: '6px 16px', marginBottom: 24,
        }}
      >
        Career diagnosis
      </motion.span>

      <h1 style={{ fontSize: 'clamp(30px,5vw,46px)', fontWeight: 900, color: '#111827', lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' }}>
        Your job search isn't broken.{' '}
        <span style={{ color: '#4b5563' }}>Your positioning is.</span>
      </h1>

      <p style={{ color: '#6b7280', fontSize: 16, lineHeight: 1.7, marginBottom: 12, maxWidth: 420, margin: '0 auto 12px' }}>
        In the next few minutes, we're going to figure out exactly where things are breaking down — and build you a plan to fix it.
      </p>
      <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6, marginBottom: 36 }}>
        Answer honestly. The more specific you are, the more powerful what comes next.
      </p>

      <motion.button
        onClick={onNext}
        style={BTN_PRIMARY}
        whileHover={{ scale: 1.02, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}
        whileTap={{ scale: 0.98 }}
      >
        Let's find out
      </motion.button>
    </div>
  );
}

function StepRole({ answers, onChange, onNext }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: string) => void;
  onNext: () => void;
}) {
  const valid = answers.targetRole.trim() && answers.targetCity.trim() && answers.seniority && answers.industry;
  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 6, letterSpacing: '-0.02em' }}>
        What role are you targeting — and where?
      </h2>
      <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 28 }}>Be specific. This anchors everything we generate for you.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Role">
          <TextInput placeholder="e.g. Senior Product Manager" value={answers.targetRole} onChange={v => onChange('targetRole', v)} />
          <p style={{ color: '#c4c8d2', fontSize: 12, marginTop: 6 }}>
            You can list more than one if your search is broad, though a specific focus tends to produce stronger results.
          </p>
        </Field>
        <Field label="City">
          <TextInput placeholder="e.g. Sydney" value={answers.targetCity} onChange={v => onChange('targetCity', v)} />
        </Field>
        <Field label="Seniority">
          <Select value={answers.seniority} onChange={v => onChange('seniority', v)} options={SENIORITY_OPTIONS} placeholder="Select level" />
        </Field>
        <Field label="Industry">
          <Select value={answers.industry} onChange={v => onChange('industry', v)} options={INDUSTRY_OPTIONS} placeholder="Select industry" />
        </Field>
      </div>

      <div style={{ marginTop: 28 }}>
        <motion.button
          onClick={onNext}
          disabled={!valid}
          style={{ ...BTN_PRIMARY, opacity: valid ? 1 : 0.3, cursor: valid ? 'pointer' : 'not-allowed' }}
          whileHover={valid ? { scale: 1.02, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' } : {}}
          whileTap={valid ? { scale: 0.98 } : {}}
        >
          Continue
        </motion.button>
      </div>
    </div>
  );
}

function StepTimeline({ answers, onChange, onNext }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: string | string[]) => void;
  onNext: () => void;
}) {
  const toggleChannel = (ch: string) => {
    const c = answers.channels;
    onChange('channels', c.includes(ch) ? c.filter(x => x !== ch) : [...c, ch]);
  };
  const valid = answers.searchDuration && answers.applicationsCount && answers.channels.length > 0;
  const showOther = answers.channels.includes('Other');

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 28, letterSpacing: '-0.02em' }}>
        How has your search been going?
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="How long searching">
          <Select value={answers.searchDuration} onChange={v => onChange('searchDuration', v)} options={DURATION_OPTIONS} placeholder="Select duration" />
        </Field>
        <Field label="Applications sent">
          <Select value={answers.applicationsCount} onChange={v => onChange('applicationsCount', v)} options={COUNT_OPTIONS} placeholder="Select range" />
        </Field>
        <Field label="Channels used">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CHANNEL_OPTIONS.map(ch => {
              const active = answers.channels.includes(ch);
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  style={{
                    padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${active ? '#111827' : 'rgba(0,0,0,0.12)'}`,
                    background: active ? '#111827' : 'rgba(255,255,255,0.6)',
                    color: active ? '#ffffff' : '#6b7280',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {ch}
                </button>
              );
            })}
          </div>
          {showOther && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 10 }}>
              <input
                style={{ ...INPUT }}
                placeholder="Which other channels?"
                value={answers.channelOther}
                onChange={e => onChange('channelOther', e.target.value)}
              />
            </motion.div>
          )}
        </Field>
      </div>

      <div style={{ marginTop: 28 }}>
        <motion.button
          onClick={onNext}
          disabled={!valid}
          style={{ ...BTN_PRIMARY, opacity: valid ? 1 : 0.3, cursor: valid ? 'pointer' : 'not-allowed' }}
          whileHover={valid ? { scale: 1.02, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' } : {}}
          whileTap={valid ? { scale: 0.98 } : {}}
        >
          Continue
        </motion.button>
      </div>
    </div>
  );
}

function StepResponses({ answers, onChange, onNext }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: string | string[]) => void;
  onNext: () => void;
}) {
  const toggleBlocker = (opt: string) => {
    const c = answers.blockerOptions;
    onChange('blockerOptions', c.includes(opt) ? c.filter(b => b !== opt) : [...c, opt]);
  };
  const valid = answers.responsePattern && answers.blockerOptions.length > 0;

  const optionStyle = (selected: boolean): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '14px 18px', borderRadius: 14,
    border: `1px solid ${selected ? '#111827' : 'rgba(0,0,0,0.1)'}`,
    background: selected ? '#111827' : 'rgba(255,255,255,0.55)',
    color: selected ? '#ffffff' : '#374151',
    cursor: 'pointer', transition: 'all 0.15s', display: 'block',
  });

  const checkStyle = (selected: boolean): React.CSSProperties => ({
    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
    border: `1.5px solid ${selected ? '#111827' : 'rgba(0,0,0,0.2)'}`,
    background: selected ? '#111827' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#111827', marginBottom: 4, letterSpacing: '-0.02em' }}>
          What responses are you getting?
        </h2>
        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>Pick whichever best describes your pattern.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RESPONSE_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => onChange('responsePattern', opt.value)} style={optionStyle(answers.responsePattern === opt.value)}>
              <span style={{ fontWeight: 700, fontSize: 14, display: 'block' }}>{opt.label}</span>
              {opt.sub && <span style={{ fontSize: 12, opacity: 0.6 }}>{opt.sub}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#111827', marginBottom: 4, letterSpacing: '-0.02em' }}>
          What's your biggest blocker?
        </h2>
        <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>Select everything that applies.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BLOCKER_OPTIONS.map(opt => {
            const sel = answers.blockerOptions.includes(opt);
            return (
              <button key={opt} type="button" onClick={() => toggleBlocker(opt)}
                style={{ ...optionStyle(sel), display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={checkStyle(sel)}>
                  {sel && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{opt}</span>
              </button>
            );
          })}

          {/* Other */}
          <div>
            <button type="button" onClick={() => toggleBlocker('Other')}
              style={{ ...optionStyle(answers.blockerOptions.includes('Other')), display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}
            >
              <div style={checkStyle(answers.blockerOptions.includes('Other'))}>
                {answers.blockerOptions.includes('Other') && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Something else</span>
            </button>
            {answers.blockerOptions.includes('Other') && (
              <motion.textarea
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ ...INPUT, resize: 'none', marginTop: 8 } as React.CSSProperties}
                rows={2}
                placeholder="Tell us what's getting in the way..."
                value={answers.blockerOther}
                onChange={e => onChange('blockerOther', e.target.value)}
              />
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <motion.button
          onClick={onNext}
          disabled={!valid}
          style={{ ...BTN_PRIMARY, opacity: valid ? 1 : 0.3, cursor: valid ? 'pointer' : 'not-allowed' }}
          whileHover={valid ? { scale: 1.02, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' } : {}}
          whileTap={valid ? { scale: 0.98 } : {}}
        >
          Continue
        </motion.button>
      </div>
    </div>
  );
}

function StepFiles({ resume, setResume, cl1, setCl1, cl2, setCl2, onSubmit, submitting }: {
  resume: File | null; setResume: (f: File | null) => void;
  cl1: File | null; setCl1: (f: File | null) => void;
  cl2: File | null; setCl2: (f: File | null) => void;
  onSubmit: () => void; submitting: boolean;
}) {
  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 6, letterSpacing: '-0.02em' }}>
        Now show us what you've been sending out.
      </h2>
      <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
        We're not judging the documents — we're using them to understand how you've been positioning yourself.
      </p>
      <p style={{ color: '#c4c8d2', fontSize: 12, marginBottom: 24 }}>PDF or Word accepted.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FileDropZone label="Your resume" required file={resume} onFile={setResume} />
        <FileDropZone label="A recent cover letter" subtext="If you don't have one, that's useful information too." file={cl1} onFile={setCl1} />
        <FileDropZone label="Another one if you have it" file={cl2} onFile={setCl2} />
      </div>

      <div style={{ marginTop: 28 }}>
        <motion.button
          onClick={onSubmit}
          disabled={!resume || submitting}
          style={{ ...BTN_PRIMARY, opacity: resume && !submitting ? 1 : 0.3, cursor: resume && !submitting ? 'pointer' : 'not-allowed' }}
          whileHover={resume && !submitting ? { scale: 1.02, boxShadow: '0 8px 40px rgba(0,0,0,0.22)' } : {}}
          whileTap={resume && !submitting ? { scale: 0.98 } : {}}
        >
          {submitting ? 'Sending...' : 'Build my diagnosis'}
        </motion.button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OnboardingIntake() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get('/onboarding/report').then(({ data }) => {
      if (data.status === 'PROCESSING') { setStep(5); startPolling(); }
      else if (data.status === 'FAILED') { setStep(5); setFailed(true); }
    }).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [answers, setAnswers] = useState<IntakeAnswers>({
    targetRole: '', targetCity: '', seniority: '', industry: '',
    searchDuration: '', applicationsCount: '', channels: [],
    channelOther: '', responsePattern: '',
    blockerOptions: [], blockerOther: '', perceivedBlocker: '',
  });
  const [resume, setResume] = useState<File | null>(null);
  const [cl1, setCl1] = useState<File | null>(null);
  const [cl2, setCl2] = useState<File | null>(null);

  const onChange = (k: keyof IntakeAnswers, v: string | string[]) =>
    setAnswers(prev => ({ ...prev, [k]: v }));

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data: report } = await api.get('/onboarding/report');
        if (report.status === 'COMPLETE') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
        } else if (report.status === 'FAILED') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setFailed(true);
        }
      } catch {}
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!resume) return;
    setSubmitting(true);

    const blockerParts = answers.blockerOptions.filter(b => b !== 'Other');
    if (answers.blockerOptions.includes('Other') && answers.blockerOther.trim()) {
      blockerParts.push(answers.blockerOther.trim());
    }

    const finalAnswers = {
      ...answers,
      perceivedBlocker: blockerParts.join('; '),
      channels: answers.channels.includes('Other') && answers.channelOther.trim()
        ? [...answers.channels.filter(c => c !== 'Other'), `Other: ${answers.channelOther.trim()}`]
        : answers.channels,
    };

    const formData = new FormData();
    formData.append('answers', JSON.stringify(finalAnswers));
    formData.append('resume', resume);
    if (cl1) formData.append('coverLetter1', cl1);
    if (cl2) formData.append('coverLetter2', cl2);

    try {
      // No manual Content-Type — axios sets multipart boundary automatically
      await api.post('/onboarding/submit', formData, { timeout: 30000 });
      setStep(5);
      startPolling();
    } catch (err) {
      console.error('[OnboardingIntake] Submit failed:', err);
      toast.error('Something went wrong uploading your files. Please try again.');
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    setFailed(false);
    try { await api.post('/onboarding/retry'); startPolling(); }
    catch { setFailed(true); }
  };

  if (step === 5) return <ProcessingScreen failed={failed} onRetry={handleRetry} />;

  const STEPS = [
    <StepWelcome key="welcome" onNext={() => setStep(1)} />,
    <StepRole key="role" answers={answers} onChange={onChange} onNext={() => setStep(2)} />,
    <StepTimeline key="timeline" answers={answers} onChange={onChange} onNext={() => setStep(3)} />,
    <StepResponses key="responses" answers={answers} onChange={onChange} onNext={() => setStep(4)} />,
    <StepFiles key="files" resume={resume} setResume={setResume} cl1={cl1} setCl1={setCl1} cl2={cl2} setCl2={setCl2} onSubmit={handleSubmit} submitting={submitting} />,
  ];

  return (
    <div className="min-h-screen overflow-x-hidden overflow-y-auto" style={{ backgroundColor: '#eceef4' }}>
      <Scene />

      <div className="relative min-h-screen flex items-center justify-center py-12 px-4">
        <div style={{ width: '100%', maxWidth: 520 }}>
          {step > 0 && <DotProgress step={step - 1} total={4} />}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            style={{ ...GLASS_CARD, padding: 'clamp(28px, 5vw, 48px)' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -32 }}
                transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
              >
                {STEPS[step]}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
