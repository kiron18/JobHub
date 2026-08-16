/* ────────────────────────────────────────────────────────────────────────────
   SessionSignupPage — registration + qualifying questions for the live group call
   Route: /session  (public)

   ⚠️ TO CHANGE THE QUESTIONS: edit the QUESTIONS array below. That is the only
   place they live. The backend stores answers as a blob keyed by question `id`,
   so adding, removing or rewording a question needs no server change and no
   migration. Keep the ids stable if you want answers to line up across sessions.

   ⚠️ TO CHANGE WHAT THEY UNLOCK: edit the PACK array. It is the payoff screen
   and nothing else reads it.

   The shape of this page is deliberate:
     resume first  → so the email can be pre-filled from it rather than asked for
     progress bar  → the gift is promised up front and the bar keeps it in view
     payoff screen → the group is the single door to the pack, the schedule and
                     the room, and the first thing they do inside it is post

   Pull the answers before the workshop:
     /api/session-signup/export?key=…            the pre-call read (counts + quotes)
     /api/session-signup/export?key=…&format=csv the spreadsheet
   ──────────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from 'react';
import { Upload, Check, X, Loader2, Gift, ArrowRight, MessageCircle } from 'lucide-react';
import { colors, type as typeTokens, spacing } from '../components/landing/tokens';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

// ── The workshop ──────────────────────────────────────────────────────────────
const SESSION = {
  title: '"Your first Aussie Job" Workshop',
  // No `when` here on purpose. The date comes from /session-signup/next so it
  // follows the weekly schedule instead of going stale the day after it is set.
  portrait: '/Assets/kiron-workshop.png',
  // Deliberately no em dashes anywhere in this copy.
  blurb: [
    'Hi, thanks for showing interest in the workshop.',
    'I want you to leave knowing exactly where your gaps are, and with actionable steps you can take to bridge them. Generic advice is plentiful online, so to make sure you get a good return on your time, I have prepared a short list of questions that lets me personalise the workshop to your specific needs.',
  ],
};

/**
 * What they unlock. Shown twice: as a promise above the form, and itemised on
 * the payoff screen.
 *
 * The values are anchors, not invoices. Keep them defensible. This audience is
 * being sold trust before anything else, and an inflated number is the fastest
 * way to lose it.
 */
const PACK: { item: string; value: number }[] = [
  { item: 'Australian resume template, pre-filled, plus an annotated before and after', value: 120 },
  { item: 'Interview scripts and the question bank', value: 140 },
  { item: 'Cover letter template with a worked example', value: 80 },
  { item: 'Selection criteria and STAR worksheet', value: 80 },
  { item: 'LinkedIn outreach templates', value: 60 },
  { item: 'Networking pack', value: 60 },
  { item: 'Application tracker, built for the 25 a week cadence', value: 60 },
  { item: 'Follow-up email swipe file', value: 40 },
  { item: 'Australian market rules cheat sheet', value: 40 },
  { item: 'Starter kit and the system templates', value: 100 },
];
const SEAT_VALUE = 250;
const PACK_TOTAL = PACK.reduce((n, p) => n + p.value, 0) + SEAT_VALUE;

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
    help: 'Optional, but this is the one I read out. Ask the real question.',
    placeholder: 'e.g. is my visa actually the reason I’m getting rejected?',
    long: true,
  },
];

/**
 * What the progress bar counts. Everything that stands between them and the
 * pack, in the order they meet it. The optional question is left out on
 * purpose: a bar that cannot reach 100% is worse than no bar.
 */
const REQUIRED_QUESTIONS = QUESTIONS.filter((q) => q.required);
const TOTAL_STEPS = REQUIRED_QUESTIONS.length + (RESUME_REQUIRED ? 1 : 0) + 2; // + name + email

/** Nudges keyed to how far along they are. Index by band, not by exact count. */
function encouragementFor(pct: number): string {
  if (pct === 0) return 'Two minutes, and everything below is yours at the end.';
  if (pct < 34) return 'Good start. Keep going.';
  if (pct < 67) return 'Over halfway. Nearly there.';
  if (pct < 100) return 'Almost done. One more push and the pack unlocks.';
  return 'That’s everything. Hit the button and I’ll open it up.';
}

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

  // Set when the email came off the resume rather than out of their keyboard,
  // so the field can ask them to confirm it instead of silently trusting a regex.
  const [emailFromResume, setEmailFromResume] = useState(false);
  const [parsing, setParsing] = useState(false);

  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  // Both come back from the register call so there is one source of truth for
  // each link, shared with the confirmation email.
  const [meetLink, setMeetLink] = useState('');
  const [skoolUrl, setSkoolUrl] = useState('');
  // Returned by the registration. Rides on the community link so the click that
  // follows can be stamped against this person on the sales board.
  const [leadId, setLeadId] = useState('');

  /**
   * The real date of the next workshop, asked for on load.
   *
   * This is fetched rather than written into the page because the schedule now
   * rolls itself weekly on the server. A date typed in here would be right once
   * and quietly wrong every week after, which is the failure this whole change
   * exists to remove.
   */
  const [startsAt, setStartsAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/session-signup/next`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.startsAt) return;
        const parsed = new Date(d.startsAt);
        if (!Number.isNaN(parsed.getTime())) setStartsAt(parsed);
      })
      // A missing date costs the eyebrow its specificity and nothing else. The
      // form still works, so this must never surface as an error.
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /**
   * Rendered in the reader's own timezone, not in ours.
   *
   * A good share of this audience is still offshore. "7:00 pm AEST" makes them
   * do the arithmetic and some of them get it wrong and miss the room, so the
   * browser converts it and names the zone it converted to.
   */
  const whenLabel = useMemo(() => {
    if (!startsAt) return 'Live workshop';
    const now = new Date();
    const sameDay = startsAt.toDateString() === now.toDateString();
    const time = startsAt.toLocaleTimeString(undefined, {
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
    if (sameDay) return `Today, ${time}`;
    const day = startsAt.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    return `${day}, ${time}`;
  }, [startsAt]);

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

  const progress = useMemo(() => {
    let done = 0;
    if (name.trim()) done += 1;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) done += 1;
    if (RESUME_REQUIRED && resumeSatisfied) done += 1;
    for (const q of REQUIRED_QUESTIONS) {
      const v = answers[q.id];
      const empty = Array.isArray(v) ? v.length === 0 : !v || !String(v).trim();
      if (!empty) done += 1;
    }
    return Math.round((done / TOTAL_STEPS) * 100);
  }, [name, email, resumeSatisfied, answers]);

  /**
   * Read the resume the moment it is picked, and pre-fill whatever it gives us.
   * Never overwrite something they typed themselves, and never block on this:
   * the file is already held in state, so a slow or failed parse costs them
   * nothing but the convenience.
   */
  const parseResume = async (f: File) => {
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('resume', f);
      const res = await fetch(`${API_BASE}/session-signup/parse-resume`, { method: 'POST', body: fd });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data.email && !email.trim()) {
        setEmail(String(data.email));
        setEmailFromResume(true);
        setErrors((p) => { const n = new Set(p); n.delete('email'); return n; });
      }
      if (data.name && !name.trim()) {
        setName(String(data.name));
        setErrors((p) => { const n = new Set(p); n.delete('name'); return n; });
      }
    } catch {
      // Silent on purpose. They fill the two fields the old way.
    } finally {
      setParsing(false);
    }
  };

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
      if (data.meetLink) setMeetLink(data.meetLink);
      if (data.skoolUrl) setSkoolUrl(data.skoolUrl);
      if (typeof data.leadId === 'string') setLeadId(data.leadId);
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // index.css sets `body { overflow: hidden }` and pins #root to 100vh, so the
  // app is a fixed-viewport shell and every public page has to own its own
  // scroll container. minHeight alone silently makes the page unscrollable.
  const page: React.CSSProperties = {
    height: '100vh',
    overflowY: 'auto',
    background: colors.bgCanvas,
    padding: '56px 20px 96px',
    fontFamily: typeTokens.body,
    boxSizing: 'border-box',
  };
  const shell: React.CSSProperties = { maxWidth: spacing.containerReadable, margin: '0 auto' };

  // ── The payoff ──────────────────────────────────────────────────────────────
  if (done) {
    const community = skoolUrl || 'https://www.aussiegradcareers.com.au/community';
    return (
      <div style={page}>
        <div style={shell}>
          <div style={{ textAlign: 'center' }}>
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
              You’re in{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''}.
            </h1>
            <p style={{ fontSize: '1.0625rem', color: colors.textSecondary, lineHeight: 1.6, margin: '0 auto', maxWidth: 560 }}>
              Your seat is saved and I have your resume. Now the part I promised you.
            </p>
          </div>

          {/* The stack. Itemised because "a resource pack" is a shrug and a list
              of ten things with numbers against them is not. */}
          <div style={{
            marginTop: 32, padding: '28px 26px', borderRadius: 16,
            background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`,
            boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 8px 28px rgba(26,24,20,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Gift size={20} color={colors.accentPetrol} />
              <h2 style={{
                fontFamily: typeTokens.display, fontWeight: 500, fontSize: '1.375rem',
                color: colors.textPrimary, margin: 0, letterSpacing: '-0.01em',
              }}>
                What you just unlocked
              </h2>
            </div>
            <p style={{ ...helpStyle, marginTop: 0, marginBottom: 20 }}>
              All of it free, all of it in one place, none of it cut down.
            </p>

            {PACK.map((p) => (
              <div
                key={p.item}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 12,
                  padding: '9px 0', borderBottom: `1px solid ${colors.borderWhisper}`,
                }}
              >
                <Check size={15} color={colors.success} style={{ flex: '0 0 auto', transform: 'translateY(2px)' }} />
                <span style={{ flex: 1, fontSize: '0.9375rem', color: colors.textPrimary, lineHeight: 1.5 }}>
                  {p.item}
                </span>
                <span style={{ fontSize: '0.875rem', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                  ${p.value}
                </span>
              </div>
            ))}

            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 12,
              padding: '9px 0', borderBottom: `1px solid ${colors.borderWhisper}`,
            }}>
              <Check size={15} color={colors.success} style={{ flex: '0 0 auto', transform: 'translateY(2px)' }} />
              <span style={{ flex: 1, fontSize: '0.9375rem', color: colors.textPrimary, lineHeight: 1.5, fontWeight: 600 }}>
                Your seat at the live workshop, where I go through all of it with you
              </span>
              <span style={{ fontSize: '0.875rem', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                ${SEAT_VALUE}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingTop: 16 }}>
              <span style={{ flex: 1, fontSize: '1rem', fontWeight: 600, color: colors.textPrimary }}>
                Yours today
              </span>
              <span style={{ fontSize: '0.9375rem', color: colors.textMuted, textDecoration: 'line-through' }}>
                ${PACK_TOTAL}
              </span>
              <span style={{ fontSize: '1.125rem', fontWeight: 700, color: colors.accentPetrol }}>
                $0
              </span>
            </div>
          </div>

          {/* The door. One button, and it is the only button on this screen. */}
          <a
            href={
              `${community}${community.includes('?') ? '&' : '?'}src=confirm` +
              (leadId ? `&lead=${encodeURIComponent(leadId)}` : '')
            }
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 24, width: '100%', boxSizing: 'border-box',
              background: colors.accentPetrol, color: colors.textOnDeep,
              padding: '18px 32px', borderRadius: 12, border: 'none',
              fontWeight: 600, fontSize: '1.125rem', fontFamily: typeTokens.body,
              cursor: 'pointer', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: '0 1px 2px rgba(26,24,20,0.06), 0 6px 20px rgba(45,90,110,0.22)',
            }}
          >
            Open the group and get everything
            <ArrowRight size={20} />
          </a>
          <p style={{ ...helpStyle, textAlign: 'center', marginTop: 12 }}>
            The pack, the workshop times and the community all live in there. Takes 20 seconds to join.
          </p>

          {/* The first action. This is what turns a member into a participant,
              and it is also how the workshop gets its running order. */}
          <div style={{
            marginTop: 28, padding: '24px 24px', borderRadius: 16,
            background: colors.bgAlt, border: `1px solid ${colors.borderWhisper}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <MessageCircle size={19} color={colors.accentPetrol} />
              <h3 style={{
                fontFamily: typeTokens.display, fontWeight: 500, fontSize: '1.1875rem',
                color: colors.textPrimary, margin: 0,
              }}>
                Do this the moment you’re in
              </h3>
            </div>
            <ol style={{
              margin: 0, paddingLeft: 20, fontSize: '0.9375rem',
              color: colors.textSecondary, lineHeight: 1.7,
            }}>
              <li style={{ marginBottom: 8 }}>
                <strong style={{ color: colors.textPrimary }}>Post the one thing that is actually stopping you.</strong>{' '}
                One paragraph is plenty. Be specific, because specific is what gets answered.
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong style={{ color: colors.textPrimary }}>Read the others and like the ones you recognise.</strong>{' '}
                If somebody has written your problem better than you could, add your detail underneath it instead of starting a new one.
              </li>
              <li>
                <strong style={{ color: colors.textPrimary }}>The most liked problems get answered live.</strong>{' '}
                I build the running order from that thread, so what you post is what the session becomes.
              </li>
            </ol>
          </div>

          {meetLink && (
            <div style={{
              marginTop: 24, padding: '18px 20px', borderRadius: 14,
              background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`,
            }}>
              <p style={{ ...helpStyle, marginTop: 0, marginBottom: 8 }}>
                Your join link is on its way to your inbox. Here it is as well, in case it lands in spam:
              </p>
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '1rem', fontWeight: 600, color: colors.accentPetrol,
                  wordBreak: 'break-all', textDecoration: 'none',
                }}
              >
                {meetLink}
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── The form ────────────────────────────────────────────────────────────────
  return (
    <div style={page}>
      <div style={shell}>
        {/* Header. Portrait sits beside the copy on desktop and drops above it
            on narrow screens, which is why this wraps rather than using a grid. */}
        <div style={{
          marginBottom: 28, display: 'flex', flexWrap: 'wrap-reverse',
          // wrap-reverse flips the cross axis, so flex-end is the visual top.
          // It also puts the portrait above the copy once this wraps on mobile.
          gap: 28, alignItems: 'flex-end',
        }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <span style={{
              fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: colors.textMuted,
            }}>
              {whenLabel}
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
                margin: '0 0 12px',
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

        {/* The promise, made before the first question rather than after the
            last one. The bar below is the only thing that keeps it credible. */}
        <div style={{
          marginBottom: 20, padding: '18px 20px', borderRadius: 14,
          background: colors.bgAlt, border: `1px solid ${colors.borderWhisper}`,
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <Gift size={20} color={colors.accentPetrol} style={{ flex: '0 0 auto', marginTop: 2 }} />
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: '1rem', fontWeight: 600, color: colors.textPrimary, lineHeight: 1.45,
            }}>
              There is a gift waiting at the end of this form
            </p>
            <p style={{ ...helpStyle, marginTop: 6 }}>
              Ten resources worth about ${PACK_TOTAL}, yours free the second you finish. I know forms are
              tedious, so I have kept this one to about two minutes.
            </p>
          </div>
        </div>

        {/* Progress. Sticky so it stays with them on a long scroll, which is the
            only reason a bar beats a plain counter. */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          background: colors.bgCanvas, paddingBottom: 12, marginBottom: 8,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 8, gap: 12,
          }}>
            <span style={{ fontSize: '0.875rem', color: colors.textSecondary, fontWeight: 500 }}>
              {encouragementFor(progress)}
            </span>
            <span style={{
              fontSize: '0.875rem', fontWeight: 700,
              color: progress === 100 ? colors.success : colors.accentPetrol,
              whiteSpace: 'nowrap',
            }}>
              {progress}%
            </span>
          </div>
          <div style={{
            height: 8, borderRadius: 999, background: colors.borderWhisper, overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`, height: '100%', borderRadius: 999,
              background: progress === 100 ? colors.success : colors.accentPetrol,
              transition: 'width 320ms cubic-bezier(0.25, 1, 0.5, 1), background 200ms',
            }} />
          </div>
        </div>

        <div style={{
          background: colors.bgSurface, borderRadius: 16, padding: '32px 28px',
          border: `1px solid ${colors.borderWhisper}`,
          boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 8px 28px rgba(26,24,20,0.05)',
        }}>
          {/* Resume first. It is the heaviest ask, so it goes where motivation is
              highest, and it is what lets the two fields below fill themselves in. */}
          <div data-error={errors.has('resume')}>
            <Field
              label="Start with your resume"
              help="This is the part that makes the workshop about you rather than about people in general. I read them beforehand and the examples I use come out of them. It also saves you filling in the rest of this by hand."
              error={errors.has('resume')}
            >
              {file ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                  borderRadius: 10, background: colors.bgAlt, border: `1px solid ${colors.borderWhisper}`,
                }}>
                  {parsing
                    ? <Loader2 size={18} className="animate-spin" color={colors.textMuted} />
                    : <Check size={18} color={colors.success} />}
                  <span style={{ flex: 1, fontSize: '0.9375rem', color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {parsing ? 'Reading it…' : file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setFile(null); setEmailFromResume(false); }}
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
                    Upload your resume (PDF, DOCX or TXT)
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
                          void parseResume(f);
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
                        No problem, tell me why in one line and I’ll still take the registration.
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

          <hr style={{ border: 'none', borderTop: `1px solid ${colors.borderWhisper}`, margin: '8px 0 32px' }} />

          {/* Identity. Pre-filled from the resume where we could read it, but
              never trusted silently: the email is the key everything else joins
              on, so it gets confirmed by a human before it is stored. */}
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
              help={
                emailFromResume
                  ? 'I found this on your resume. If it is not the inbox you actually check, change it now, because this is where the pack and the link go.'
                  : 'Where the workshop link goes. Use the one you actually check.'
              }
              error={errors.has('email')}
            >
              <input
                style={{
                  ...inputStyle,
                  ...(emailFromResume ? { borderColor: colors.accentPetrol, background: colors.bgAlt } : {}),
                }}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailFromResume(false);
                  setErrors((p) => { const n = new Set(p); n.delete('email'); return n; });
                }}
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
            {submitting ? 'Saving…' : progress === 100 ? 'Save my spot and unlock the pack' : 'Save my spot'}
          </button>

          <p style={{ ...helpStyle, textAlign: 'center', marginTop: 14 }}>
            Your resume isn’t shared with anyone.
          </p>
        </div>
      </div>
    </div>
  );
}
