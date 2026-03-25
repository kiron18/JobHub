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
  responsePattern: string;
  perceivedBlocker: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SENIORITY_OPTIONS = ['Graduate', 'Mid-level', 'Senior', 'Lead', 'Executive'];
const INDUSTRY_OPTIONS = ['Tech', 'FinTech', 'Consulting', 'Marketing', 'Finance', 'Healthcare', 'Education', 'Government', 'Other'];
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

const PROCESSING_LINES = [
  'Reading your documents...',
  'Mapping where applications are likely dropping off...',
  'Cross-referencing your experience against your targets...',
  'Building your diagnosis...',
];

// ── Shared style primitives ──────────────────────────────────────────────────

const glassCard = `
  relative rounded-2xl border border-white/10
  bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/50
`;

const inputBase = `
  w-full rounded-xl border border-white/10 bg-white/5
  px-4 py-3 text-white placeholder-white/30
  focus:outline-none focus:ring-2 focus:ring-indigo-500/60
  transition-all duration-200
`;

const labelText = 'block text-xs font-bold tracking-[0.15em] uppercase text-white/50 mb-2';

// ── Sub-components ───────────────────────────────────────────────────────────

function DotProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-2 items-center justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === step ? 24 : 8,
            backgroundColor: i <= step ? '#6366f1' : 'rgba(255,255,255,0.15)',
          }}
          transition={{ duration: 0.3 }}
          className="h-2 rounded-full"
        />
      ))}
    </div>
  );
}

function FileDropZone({
  label,
  subtext,
  required,
  file,
  onFile,
}: {
  label: string;
  subtext?: string;
  required?: boolean;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={`
        relative rounded-xl border-2 border-dashed cursor-pointer
        px-6 py-5 transition-all duration-200 group
        ${file
          ? 'border-indigo-500/60 bg-indigo-500/10'
          : 'border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/5'
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-3">
        <div className={`text-2xl ${file ? 'text-indigo-400' : 'text-white/30'}`}>
          {file ? '✓' : '↑'}
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">
            {file ? file.name : label}
            {required && !file && <span className="text-indigo-400 ml-1">*</span>}
          </p>
          {subtext && !file && (
            <p className="text-xs text-white/40 mt-0.5">{subtext}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Processing Screen ────────────────────────────────────────────────────────

function ProcessingScreen({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (failed) return;
    const interval = setInterval(() => {
      setLineIndex((i) => (i + 1) % PROCESSING_LINES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [failed]);

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-6">
        <div className={`${glassCard} p-10 max-w-md w-full text-center`}>
          <div className="text-4xl mb-4">⚠</div>
          <h2 className="text-xl font-bold text-white mb-3">Something went wrong on our end</h2>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            Your documents were saved. Refresh the page and we'll pick up where we left off.
          </p>
          <button
            onClick={onRetry}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className={`${glassCard} p-10 max-w-md w-full text-center relative`}>
        <motion.div
          className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full mx-auto mb-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />

        <AnimatePresence mode="wait">
          <motion.p
            key={lineIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="text-white/70 text-base font-medium"
          >
            {PROCESSING_LINES[lineIndex]}
          </motion.p>
        </AnimatePresence>

        <p className="text-white/25 text-xs mt-4">This takes 30–60 seconds</p>
      </div>
    </div>
  );
}

// ── Step Components ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="max-w-xl w-full mx-auto px-6 flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <motion.h1
          className="text-4xl md:text-5xl font-black text-white leading-tight mb-6"
        >
          Your job search isn't broken.{' '}
          <span className="text-indigo-400">Your positioning is.</span>
        </motion.h1>

        <p className="text-white/60 text-lg leading-relaxed mb-4">
          In the next few minutes, we're going to figure out exactly where things are breaking down — and build you a plan to fix it.
        </p>

        <p className="text-white/40 text-sm leading-relaxed mb-10">
          Answer honestly. The more specific you are, the more powerful what comes next.
        </p>

        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg tracking-tight shadow-lg shadow-indigo-600/30 transition-colors"
        >
          Let's find out
        </motion.button>
      </motion.div>
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
    <div className="max-w-xl w-full mx-auto px-6">
      <h2 className="text-3xl font-black text-white mb-2">What roles + which city are you targeting?</h2>
      <p className="text-white/40 text-sm mb-8">Be specific — this anchors everything we generate for you.</p>

      <div className="space-y-5">
        <div>
          <label className={labelText}>Role</label>
          <input className={inputBase} placeholder="e.g. Senior Product Manager" value={answers.targetRole} onChange={e => onChange('targetRole', e.target.value)} />
        </div>
        <div>
          <label className={labelText}>City</label>
          <input className={inputBase} placeholder="e.g. Sydney" value={answers.targetCity} onChange={e => onChange('targetCity', e.target.value)} />
        </div>
        <div>
          <label className={labelText}>Seniority</label>
          <select className={inputBase} value={answers.seniority} onChange={e => onChange('seniority', e.target.value)}>
            <option value="">Select level</option>
            {SENIORITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelText}>Industry</label>
          <select className={inputBase} value={answers.industry} onChange={e => onChange('industry', e.target.value)}>
            <option value="">Select industry</option>
            {INDUSTRY_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!valid}
        className="mt-8 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-base transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function StepTimeline({ answers, onChange, onNext }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: string | string[]) => void;
  onNext: () => void;
}) {
  const toggleChannel = (ch: string) => {
    const current = answers.channels;
    onChange('channels', current.includes(ch) ? current.filter(c => c !== ch) : [...current, ch]);
  };
  const valid = answers.searchDuration && answers.applicationsCount && answers.channels.length > 0;

  return (
    <div className="max-w-xl w-full mx-auto px-6">
      <h2 className="text-3xl font-black text-white mb-2">How long applying + roughly how many applications + main channels?</h2>
      <p className="text-white/40 text-sm mb-8">This tells us whether it's a volume problem, a targeting problem, or something else.</p>

      <div className="space-y-5">
        <div>
          <label className={labelText}>How long searching</label>
          <select className={inputBase} value={answers.searchDuration} onChange={e => onChange('searchDuration', e.target.value)}>
            <option value="">Select duration</option>
            {DURATION_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelText}>Applications sent</label>
          <select className={inputBase} value={answers.applicationsCount} onChange={e => onChange('applicationsCount', e.target.value)}>
            <option value="">Select range</option>
            {COUNT_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelText}>Channels used</label>
          <div className="flex flex-wrap gap-2">
            {CHANNEL_OPTIONS.map(ch => (
              <button
                key={ch}
                type="button"
                onClick={() => toggleChannel(ch)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  answers.channels.includes(ch)
                    ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!valid}
        className="mt-8 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-base transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function StepResponses({ answers, onChange, onNext }: {
  answers: IntakeAnswers;
  onChange: (k: keyof IntakeAnswers, v: string) => void;
  onNext: () => void;
}) {
  const valid = answers.responsePattern && answers.perceivedBlocker.trim();

  return (
    <div className="max-w-xl w-full mx-auto px-6">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white mb-2">What responses are you getting?</h2>
        <p className="text-white/40 text-sm mb-4">Pick whichever best describes your pattern.</p>
        <div className="space-y-2">
          {RESPONSE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange('responsePattern', opt.value)}
              className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${
                answers.responsePattern === opt.value
                  ? 'bg-indigo-600/20 border-indigo-500/60 text-white'
                  : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/25'
              }`}
            >
              <span className="font-bold block">{opt.label}</span>
              {opt.sub && <span className="text-xs text-white/40">{opt.sub}</span>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-black text-white mb-2">What's your biggest blocker right now?</h2>
        <textarea
          className={`${inputBase} resize-none`}
          rows={3}
          placeholder="Be honest — is it your resume? Your experience? Interview nerves? There's no wrong answer here."
          value={answers.perceivedBlocker}
          onChange={e => onChange('perceivedBlocker', e.target.value)}
        />
      </div>

      <button
        onClick={onNext}
        disabled={!valid}
        className="mt-8 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-base transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

function StepFiles({
  resume, setResume,
  cl1, setCl1,
  cl2, setCl2,
  onSubmit, submitting,
}: {
  resume: File | null; setResume: (f: File | null) => void;
  cl1: File | null; setCl1: (f: File | null) => void;
  cl2: File | null; setCl2: (f: File | null) => void;
  onSubmit: () => void; submitting: boolean;
}) {
  return (
    <div className="max-w-xl w-full mx-auto px-6">
      <h2 className="text-3xl font-black text-white mb-2">Now show us what you've been sending out.</h2>
      <p className="text-white/40 text-sm mb-2">
        We're not judging the documents. We're using them to understand how you've been positioning yourself — and where the gap is.
      </p>
      <p className="text-white/25 text-xs mb-8">PDF or Word accepted.</p>

      <div className="space-y-3">
        <FileDropZone label="Your resume" required file={resume} onFile={setResume} />
        <FileDropZone
          label="A recent cover letter"
          subtext="If you don't have one, that's useful information too."
          file={cl1}
          onFile={setCl1}
        />
        <FileDropZone label="Another one if you have it" file={cl2} onFile={setCl2} />
      </div>

      <motion.button
        onClick={onSubmit}
        disabled={!resume || submitting}
        whileHover={resume && !submitting ? { scale: 1.02 } : {}}
        whileTap={resume && !submitting ? { scale: 0.98 } : {}}
        className="mt-8 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-lg tracking-tight shadow-lg shadow-indigo-600/30 transition-colors"
      >
        {submitting ? 'Sending...' : 'Build my diagnosis'}
      </motion.button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OnboardingIntake() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.get('/onboarding/report').then(({ data }) => {
      if (data.status === 'PROCESSING') {
        setStep(5);
        startPolling();
      } else if (data.status === 'FAILED') {
        setStep(5);
        setFailed(true);
      }
    }).catch(() => {
      // No report found — fresh intake
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [answers, setAnswers] = useState<IntakeAnswers>({
    targetRole: '', targetCity: '', seniority: '', industry: '',
    searchDuration: '', applicationsCount: '', channels: [],
    responsePattern: '', perceivedBlocker: '',
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
      } catch {
        // Transient errors — keep polling
      }
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!resume) return;
    setSubmitting(true);

    const formData = new FormData();
    formData.append('answers', JSON.stringify(answers));
    formData.append('resume', resume);
    if (cl1) formData.append('coverLetter1', cl1);
    if (cl2) formData.append('coverLetter2', cl2);

    try {
      await api.post('/onboarding/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
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
    try {
      await api.post('/onboarding/retry');
      startPolling();
    } catch {
      setFailed(true);
    }
  };

  if (step === 5) {
    return <ProcessingScreen failed={failed} onRetry={handleRetry} />;
  }

  const STEPS = [
    <StepWelcome key="welcome" onNext={() => setStep(1)} />,
    <StepRole key="role" answers={answers} onChange={onChange} onNext={() => setStep(2)} />,
    <StepTimeline key="timeline" answers={answers} onChange={onChange} onNext={() => setStep(3)} />,
    <StepResponses key="responses" answers={answers} onChange={onChange} onNext={() => setStep(4)} />,
    <StepFiles
      key="files"
      resume={resume} setResume={setResume}
      cl1={cl1} setCl1={setCl1}
      cl2={cl2} setCl2={setCl2}
      onSubmit={handleSubmit}
      submitting={submitting}
    />,
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden py-12">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-900/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-900/20 rounded-full blur-3xl" />
      </div>

      {step > 0 && <DotProgress step={step - 1} total={4} />}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="w-full"
        >
          {STEPS[step]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
