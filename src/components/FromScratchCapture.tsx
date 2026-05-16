import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import api from '../lib/api';

interface FromScratchCaptureProps {
  /** Called once all four prompts are submitted and saved. */
  onDone: () => void;
}

type Step = 'name' | 'role' | 'achievement' | 'target';

interface Answers {
  name: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  achievement: string;
  targetRole: string;
  targetCity: string;
}

const EMPTY: Answers = {
  name: '', company: '', title: '', startDate: '', endDate: '',
  achievement: '', targetRole: '', targetCity: '',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#f3f4f6',
  fontSize: 15,
  padding: '13px 16px',
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

export function FromScratchCapture({ onDone }: FromScratchCaptureProps) {
  const [step, setStep] = useState<Step>('name');
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Answers) => (value: string) =>
    setAnswers(prev => ({ ...prev, [key]: value }));

  const canAdvance = (() => {
    switch (step) {
      case 'name':        return answers.name.trim().length > 0;
      case 'role':        return answers.company.trim().length > 0 && answers.title.trim().length > 0;
      case 'achievement': return answers.achievement.trim().length > 0;
      case 'target':      return answers.targetRole.trim().length > 0 && answers.targetCity.trim().length > 0;
    }
  })();

  async function persistAndAdvance() {
    setError(null);
    setSaving(true);
    try {
      if (step === 'name') {
        await api.patch('/profile', { name: answers.name });
        setStep('role');
      } else if (step === 'role') {
        await api.post('/experience', {
          company: answers.company,
          role: answers.title,
          startDate: answers.startDate || null,
          endDate: answers.endDate || null,
          description: '',
        });
        setStep('achievement');
      } else if (step === 'achievement') {
        await api.patch('/profile', { professionalSummary: answers.achievement });
        setStep('target');
      } else if (step === 'target') {
        await api.patch('/profile', {
          targetRole: answers.targetRole,
          targetCity: answers.targetCity,
        });
        onDone();
      }
    } catch {
      setError('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const stepIndex = (['name', 'role', 'achievement', 'target'] as const).indexOf(step);
  const progress = ((stepIndex + 1) / 4) * 100;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080b12',
      paddingBottom: 80,
    }}>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.04)' }}>
        <motion.div
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
        />
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '64px 24px 0' }}>
        <p style={{
          margin: '0 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
          color: '#4b5563', textTransform: 'uppercase',
        }}>
          BUILDING YOUR PROFILE · Step {stepIndex + 1} of 4
        </p>
        <p style={{ margin: '0 0 32px', fontSize: 13, color: '#9ca3af', lineHeight: 1.55 }}>
          We couldn't read a resume from your file, so let's set up the basics — takes about a minute.
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
          >
            {step === 'name' && (
              <div>
                <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
                  What's your name?
                </h1>
                <label style={labelStyle}>Full name</label>
                <input
                  type="text"
                  autoFocus
                  value={answers.name}
                  onChange={e => set('name')(e.target.value)}
                  placeholder="e.g. Priya Singh"
                  style={inputStyle}
                  aria-label="Your full name"
                />
              </div>
            )}

            {step === 'role' && (
              <div>
                <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
                  What's your most recent role?
                </h1>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={labelStyle}>Company</label>
                    <input type="text" autoFocus value={answers.company} onChange={e => set('company')(e.target.value)} placeholder="e.g. Canva" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Title</label>
                    <input type="text" value={answers.title} onChange={e => set('title')(e.target.value)} placeholder="e.g. Marketing Manager" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Start date</label>
                    <input type="text" value={answers.startDate} onChange={e => set('startDate')(e.target.value)} placeholder="e.g. Jan 2022" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>End date</label>
                    <input type="text" value={answers.endDate} onChange={e => set('endDate')(e.target.value)} placeholder="e.g. Present" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {step === 'achievement' && (
              <div>
                <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
                  One thing you delivered in that role
                </h1>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: '#9ca3af', lineHeight: 1.55 }}>
                  Just one. We'll help you sharpen and add more later when you apply to your first job.
                </p>
                <label style={labelStyle}>What changed because of you?</label>
                <textarea
                  autoFocus
                  value={answers.achievement}
                  onChange={e => set('achievement')(e.target.value)}
                  rows={5}
                  placeholder="e.g. Grew Instagram from 4k to 22k followers in 6 months"
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            )}

            {step === 'target' && (
              <div>
                <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 800, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
                  What's your target?
                </h1>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Role you want</label>
                    <input type="text" autoFocus value={answers.targetRole} onChange={e => set('targetRole')(e.target.value)} placeholder="e.g. Senior Marketing Manager" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input type="text" value={answers.targetCity} onChange={e => set('targetCity')(e.target.value)} placeholder="e.g. Sydney" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p style={{ margin: '16px 0 0', fontSize: 13, color: '#fca5a5' }}>
                {error}
              </p>
            )}

            <div style={{ marginTop: 28 }}>
              <button
                onClick={persistAndAdvance}
                disabled={!canAdvance || saving}
                aria-label="Save and continue to next step"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 11,
                  padding: '14px 28px',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: (!canAdvance || saving) ? 'not-allowed' : 'pointer',
                  opacity: (!canAdvance || saving) ? 0.5 : 1,
                  letterSpacing: '-0.01em',
                  transition: 'opacity 0.15s',
                }}
              >
                {saving ? 'Saving…' : (step === 'target' ? 'Finish setup' : 'Continue')}
                {!saving && <ChevronRight size={16} />}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
