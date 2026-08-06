/* ────────────────────────────────────────────────────────────────────────────
   SessionSignupPage — registration + qualifying questions for the live group call
   Route: /session  (public)

   ⚠️ TO CHANGE THE QUESTIONS: edit the QUESTIONS array below. That is the only
   place they live. The backend stores answers as a blob keyed by question `id`,
   so adding, removing or rewording a question needs no server change and no
   migration. Keep the ids stable if you want answers to line up across sessions.

   Pull the answers before the workshop:
     /api/session-signup/export?key=…            the pre-call read (counts + quotes)
     /api/session-signup/export?key=…&format=csv the spreadsheet
   ──────────────────────────────────────────────────────────────────────────── */
import { useState } from 'react';
import { Upload, Check, X, Loader2 } from 'lucide-react';
import { colors, type as typeTokens, spacing } from '../components/landing/tokens';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

// ── The workshop ──────────────────────────────────────────────────────────────
const SESSION = {
  title: '"Your first Aussie Job" Workshop',
  when: 'Today',
  portrait: '/Assets/kiron-workshop.png',
  // Deliberately no em dashes anywhere in this copy.
  blurb: [
    'Hi, thanks for showing interest in the workshop.',
    'I want you to leave knowing exactly where your gaps are, and with actionable steps you can take to bridge them. Generic advice is plentiful online, so to make sure you get a good return on your time, I have prepared a short list of questions that lets me personalise the workshop to your specific needs.',
    'It shouldn’t take more than a minute to fill out, but it will really help me know exactly where you need help.',
  ],
};

/**
 * Require the resume to submit. Set to false to let people through without one.
 * Even when true, the form offers a deliberate escape (they must type a reason),
 * because a registration with a reason is worth more than a bounce.
 */
const RESUME_REQUIRED = true;

// ── The questions ─────────────────────────────────────────────────────────────
type Question =
  | { id: string; type: 'choice'; label: string; help?: string; options: string[]; required?: boolean }
  | { id: string; type: 'multi'; label: string; help?: string; options: string[]; required?: boolean }
  | { id: string; type: 'text'; label: string; help?: string; placeholder?: string; long?: boolean; required?: boolean };

const QUESTIONS: Question[] = [
  {
    id: 'stage',
    type: 'choice',
    label: 'What stage of the job application process are you currently at?',
    options: [
      'I am studying in Australia',
      'I have graduated and looking for my first Australian job',
      'I am currently working but looking for a better role',
      'I am outside Australia and planning my move',
      'Other',
    ],
    required: true,
  },
  {
    id: 'challenge',
    type: 'choice',
    label: 'What is your biggest challenge right now in getting a job in Australia?',
    options: [
      'No interviews',
      'Resume not working',
      'Don’t know how to network',
      'Getting rejected',
      'Don’t understand Australian job market',
      'All of the above',
    ],
    required: true,
  },
  {
    id: 'timeline',
    type: 'choice',
    label: 'How soon are you hoping to secure a job?',
    options: ['Within 1 month', 'Within 3 months', 'Within 6 months', 'Just exploring'],
    required: true,
  },
  {
    id: 'hours_per_week',
    type: 'choice',
    label: 'How much time are you currently spending each week searching/applying for jobs?',
    options: ['Less than 5 hours', '5–10 hours', '10+ hours'],
    required: true,
  },
  {
    id: 'willing_to_invest',
    type: 'choice',
    label:
      'If you knew exactly what was stopping you from getting interviews, would you be willing to invest time and effort into fixing it?',
    options: ['Yes', 'Maybe', 'No'],
    required: true,
  },
  {
    id: 'wants_info',
    type: 'choice',
    label:
      'Would you like me to share information about how I personally help people implement this strategy after the workshop?',
    options: ['Yes, I’d like to learn more', 'Maybe', 'No, I’m only attending for the information'],
    required: true,
  },
  // ── Added, not in the original list. Optional on purpose: every other question
  // is multiple choice, so without this the 4pm pull is six bar charts and
  // nothing you can read out loud. Delete this block if you don't want it.
  {
    id: 'one_answer',
    type: 'text',
    label: 'If you get one thing answered in this workshop, what is it?',
    help: 'Optional — but this is the one I read out. Ask the real question.',
    placeholder: 'e.g. is my visa actually the reason I’m getting rejected?',
    long: true,
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontFamily: typeTokens.body,
  fontSize: '1.0625rem',
  fontWeight: 600,
  color: colors.textPrimary,
  lineHeight: 1.4,
  display: 'block',
};

const helpStyle: React.CSSProperties = {
  fontFamily: typeTokens.body,
  fontSize: '0.875rem',
  color: colors.textMuted,
  lineHeight: 1.5,
  marginTop: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: `1px solid ${colors.borderDefined}`,
  background: colors.bgSurface,
  fontFamily: typeTokens.body,
  fontSize: '1rem',
  color: colors.textPrimary,
  outline: 'none',
  boxSizing: 'border-box',
};

function Field({ children, label, help, error }: {
  children: React.ReactNode; label: string; help?: string; error?: boolean;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <label style={labelStyle}>{label}</label>
      {help && <p style={helpStyle}>{help}</p>}
      <div style={{ marginTop: 12 }}>{children}</div>
      {error && (
        <p style={{ ...helpStyle, color: '#B4432F', marginTop: 8 }}>This one’s needed.</p>
      )}
    </div>
  );
}

function Chip({ selected, onClick, children }: {
  selected: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 16px',
        borderRadius: 999,
        border: `1px solid ${selected ? colors.accentPetrol : colors.borderDefined}`,
        background: selected ? colors.accentPetrol : colors.bgSurface,
        color: selected ? colors.textOnDeep : colors.textSecondary,
        fontFamily: typeTokens.body,
        fontSize: '0.9375rem',
        fontWeight: selected ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 160ms cubic-bezier(0.25, 1, 0.5, 1)',
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SessionSignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [file, setFile] = useState<File | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState('');

  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);

  const setAnswer = (id: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleMulti = (id: string, option: string) => {
    const current = (answers[id] as string[]) || [];
    setAnswer(id, current.includes(option) ? current.filter((o) => o !== option) : [...current, option]);
  };

  const resumeSatisfied = !!file || (skipOpen && skipReason.trim().length > 2);

  const validate = () => {
    const bad = new Set<string>();
    if (!name.trim()) bad.add('name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) bad.add('email');
    for (const q of QUESTIONS) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty = Array.isArray(v) ? v.length === 0 : !v || !String(v).trim();
      if (empty) bad.add(q.id);
    }
    if (RESUME_REQUIRED && !resumeSatisfied) bad.add('resume');
    setErrors(bad);
    return bad.size === 0;
  };

  const submit = async () => {
    setServerError('');
    if (!validate()) {
      // Send them to the first thing they missed rather than making them hunt.
      const first = document.querySelector('[data-error="true"]');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('email', email.trim());
      fd.append('answers', JSON.stringify(answers));
      // Sent so the export can label and aggregate the answers correctly without
      // having to infer a question's type from the answers it received.
      // An ordered array, not an object: Postgres jsonb does not preserve object
      // key order, so an object here makes the export list the questions in an
      // order that doesn't match this form.
      fd.append(
        'questionSchema',
        JSON.stringify(QUESTIONS.map((q) => ({ id: q.id, label: q.label, type: q.type }))),
      );
      if (file) fd.append('resume', file);
      else if (skipReason.trim()) fd.append('resumeSkipReason', skipReason.trim());

      const res = await fetch(`${API_BASE}/session-signup/register`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const page: React.CSSProperties = {
    minHeight: '100vh',
    background: colors.bgCanvas,
    padding: '56px 20px 96px',
    fontFamily: typeTokens.body,
  };
  const shell: React.CSSProperties = { maxWidth: spacing.containerReadable, margin: '0 auto' };

  if (done) {
    return (
      <div style={page}>
        <div style={{ ...shell, textAlign: 'center', paddingTop: 64 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: colors.success,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <Check size={28} color="#fff" strokeWidth={2.5} />
          </div>
          <h1 style={{
            fontFamily: typeTokens.display, fontWeight: 500, fontSize: '2rem',
            color: colors.textPrimary, letterSpacing: '-0.015em', margin: '0 0 12px',
          }}>
            You’re in.
          </h1>
          <p style={{ fontSize: '1.0625rem', color: colors.textSecondary, lineHeight: 1.6, margin: 0 }}>
            I read every one of these before the workshop. If your question is a common one, you’ll hear it answered.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <div style={shell}>
        {/* Header. Portrait sits beside the copy on desktop and drops above it
            on narrow screens, which is why this wraps rather than using a grid. */}
        <div style={{
          marginBottom: 40, display: 'flex', flexWrap: 'wrap-reverse',
          // wrap-reverse flips the cross axis, so flex-end is the visual top.
          // It also puts the portrait above the copy once this wraps on mobile.
          gap: 28, alignItems: 'flex-end',
        }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <span style={{
              fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: colors.textMuted,
            }}>
              {SESSION.when}
            </span>
            <h1 style={{
              fontFamily: typeTokens.display, fontWeight: 500, fontSize: '2.25rem',
              color: colors.textPrimary, letterSpacing: '-0.015em', margin: '10px 0 14px',
              fontVariationSettings: "'SOFT' 50, 'WONK' 1",
            }}>
              {SESSION.title}
            </h1>
            {SESSION.blurb.map((para, i) => (
              <p key={i} style={{
                fontSize: '1.0625rem', color: colors.textSecondary, lineHeight: 1.6,
                margin: i === 0 ? '0 0 12px' : '0 0 12px',
              }}>
                {para}
              </p>
            ))}
          </div>

          <img
            src={SESSION.portrait}
            alt="Kiron, who runs the workshop"
            style={{
              width: 'clamp(112px, 20vw, 176px)',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              // The headshot sits high in the frame, so bias the crop upward.
              objectPosition: 'center 18%',
              borderRadius: '50%',
              background: colors.bgSurface,
              border: `1px solid ${colors.borderWhisper}`,
              flex: '0 0 auto',
              marginTop: 6,
            }}
          />
        </div>

        <div style={{
          background: colors.bgSurface, borderRadius: 16, padding: '32px 28px',
          border: `1px solid ${colors.borderWhisper}`,
          boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 8px 28px rgba(26,24,20,0.05)',
        }}>
          {/* Identity */}
          <div data-error={errors.has('name')}>
            <Field label="Your name" error={errors.has('name')}>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = new Set(p); n.delete('name'); return n; }); }}
                placeholder="First and last"
                autoComplete="name"
              />
            </Field>
          </div>

          <div data-error={errors.has('email')}>
            <Field
              label="Email"
              help="Where the workshop link goes. Use the one you actually check."
              error={errors.has('email')}
            >
              <input
                style={inputStyle}
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => { const n = new Set(p); n.delete('email'); return n; }); }}
                placeholder="you@email.com"
                type="email"
                autoComplete="email"
              />
            </Field>
          </div>

          <hr style={{ border: 'none', borderTop: `1px solid ${colors.borderWhisper}`, margin: '8px 0 32px' }} />

          {/* Questions */}
          {QUESTIONS.map((q) => (
            <div key={q.id} data-error={errors.has(q.id)}>
              <Field label={q.label} help={q.help} error={errors.has(q.id)}>
                {q.type === 'text' ? (
                  q.long ? (
                    <textarea
                      style={{ ...inputStyle, minHeight: 88, resize: 'vertical', lineHeight: 1.5 }}
                      value={(answers[q.id] as string) || ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                    />
                  ) : (
                    <input
                      style={inputStyle}
                      value={(answers[q.id] as string) || ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.placeholder}
                    />
                  )
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {q.options.map((opt) => (
                      <Chip
                        key={opt}
                        selected={
                          q.type === 'multi'
                            ? ((answers[q.id] as string[]) || []).includes(opt)
                            : answers[q.id] === opt
                        }
                        onClick={() => (q.type === 'multi' ? toggleMulti(q.id, opt) : setAnswer(q.id, opt))}
                      >
                        {opt}
                      </Chip>
                    ))}
                  </div>
                )}
              </Field>
            </div>
          ))}

          <hr style={{ border: 'none', borderTop: `1px solid ${colors.borderWhisper}`, margin: '8px 0 32px' }} />

          {/* Resume */}
          <div data-error={errors.has('resume')}>
            <Field
              label="Your resume"
              help="This is the part that makes the workshop about you rather than about people in general. I read them beforehand and the examples I use come out of them."
              error={errors.has('resume')}
            >
              {file ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  borderRadius: 10, background: colors.bgAlt, border: `1px solid ${colors.borderWhisper}`,
                }}>
                  <Check size={18} color={colors.success} />
                  <span style={{ flex: 1, fontSize: '0.9375rem', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                    aria-label="Remove file"
                  >
                    <X size={16} color={colors.textMuted} />
                  </button>
                </div>
              ) : (
                <>
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    padding: '20px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px dashed ${errors.has('resume') ? '#B4432F' : colors.borderDefined}`,
                    background: colors.bgCanvas, color: colors.textSecondary, fontSize: '0.9375rem', fontWeight: 500,
                  }}>
                    <Upload size={18} />
                    Upload your resume — PDF, DOCX or TXT
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setFile(f);
                        if (f) {
                          setSkipOpen(false);
                          setSkipReason('');
                          setErrors((p) => { const n = new Set(p); n.delete('resume'); return n; });
                        }
                      }}
                    />
                  </label>

                  {/* The escape. Deliberately small, and it costs a sentence —
                      a reason is itself a qualifying signal, and a registration
                      with a reason beats a bounce. */}
                  {!skipOpen ? (
                    <button
                      type="button"
                      onClick={() => setSkipOpen(true)}
                      style={{
                        background: 'none', border: 'none', padding: '10px 0 0', cursor: 'pointer',
                        fontFamily: typeTokens.body, fontSize: '0.8125rem', color: colors.textMuted,
                        textDecoration: 'underline', textUnderlineOffset: 3,
                      }}
                    >
                      I can’t upload it right now
                    </button>
                  ) : (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ ...helpStyle, marginTop: 0, marginBottom: 8 }}>
                        No problem — tell me why in one line and I’ll still take the registration.
                      </p>
                      <input
                        style={inputStyle}
                        value={skipReason}
                        onChange={(e) => {
                          setSkipReason(e.target.value);
                          setErrors((p) => { const n = new Set(p); n.delete('resume'); return n; });
                        }}
                        placeholder="e.g. it’s on my laptop and I’m on my phone"
                        autoFocus
                      />
                    </div>
                  )}
                </>
              )}
            </Field>
          </div>

          {serverError && (
            <p style={{
              fontSize: '0.9375rem', color: '#B4432F', background: 'rgba(180,67,47,0.07)',
              padding: '12px 14px', borderRadius: 10, margin: '0 0 20px',
            }}>
              {serverError}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            style={{
              width: '100%', background: colors.accentPetrol, color: colors.textOnDeep,
              padding: '16px 32px', borderRadius: 10, border: 'none',
              fontWeight: 600, fontSize: '1.0625rem', fontFamily: typeTokens.body,
              cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              boxShadow: '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
            }}
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            {submitting ? 'Saving…' : 'Save my spot'}
          </button>

          <p style={{ ...helpStyle, textAlign: 'center', marginTop: 14 }}>
            Takes about two minutes. Your resume isn’t shared with anyone.
          </p>
        </div>
      </div>
    </div>
  );
}
