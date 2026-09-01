import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, UploadCloud, ArrowRight, Plus, X, Check, ChevronDown, AlertTriangle, ListChecks, PencilLine, Sparkles, FileText } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { trackWelcomeStep, trackWelcomeFailed, trackWelcomeCompleted } from '../lib/analytics';
import { colors, type as T } from '../components/landing/tokens';
import { SALES_PAGE_URL } from '../lib/salesPage';

// The resume is built BEFORE we ask for an email — they see the finished thing,
// then decide to save it. Email/code only appear if they aren't already signed in.
type Step =
  | 'upload' | 'loading' | 'brief' | 'roles'
  | 'building' | 'resume'
  | 'email' | 'code' | 'finishing';

const EASE = [0.25, 1, 0.5, 1] as const;

/**
 * Where "See how" and the front door's "Find out how" both go. NOT BUILT YET:
 * this route does not exist, so both links open in a new tab deliberately: a
 * 404 must not take someone out of a half-finished onboarding they cannot get
 * back into. Point this at the real page when it lands, and drop the
 * target="_blank" if you would rather it navigate in place.
 */
const POSITIONING_EXPLAINER_URL = SALES_PAGE_URL;

const ROLE_PLACEHOLDERS = ['e.g. Marketing Coordinator', 'e.g. Business Analyst', 'e.g. Registered Nurse', 'e.g. Software Engineer', 'e.g. Project Manager', 'e.g. Graphic Designer'];

// Supabase's email OTP length is a project setting (6-10 digits) that can be
// changed in the dashboard without touching this code. It was 6, is currently 8,
// and a hardcoded 6 here silently truncated the code so sign-in could never
// succeed. Never hardcode the length again — accept the whole range and let
// Supabase reject a wrong code.
const OTP_MIN = 6;
const OTP_MAX = 10;

/**
 * Domain typos, and what they were meant to be.
 *
 * Real mistyping clusters in the domain, not the name — people have typed their
 * own username thousands of times and the domain is the bit they fumble. This
 * list is short on purpose: it only holds mistakes common enough to be worth
 * interrupting someone over, and a wrong suggestion is worse than none.
 */
const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gamil.com': 'gmail.com', 'gmail.cm': 'gmail.com',
  'hotnail.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'outlok.com': 'outlook.com', 'outllook.com': 'outlook.com', 'outlook.co': 'outlook.com',
  'iclould.com': 'icloud.com', 'icloud.co': 'icloud.com',
};

/** The corrected address, or null when it already looks right. */
function suggestEmailFix(value: string): string | null {
  const at = value.lastIndexOf('@');
  if (at < 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase().trim();
  const fixed = DOMAIN_TYPOS[domain];
  return fixed ? `${local}@${fixed}` : null;
}
// Supabase rejects anything under 6 by default; keep the client in step with it
// so people find out before the round trip rather than after.
const PASSWORD_MIN = 8;

type FindingOwner = 'we_fix' | 'needs_you' | 'worth_knowing';

interface IntakeFinding {
  title: string;
  detail: string;
  owner: FindingOwner;
  severity: 'critical' | 'important' | 'minor';
}

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
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('upload');

  const [password, setPassword] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [resumeEmail, setResumeEmail] = useState('');

  // One event per step the user actually reaches. Done as an effect on `step`
  // rather than at each setStep call site so a new step can never be added
  // without being tracked — this funnel ran blind until 2026-08-07 and the
  // whole point is that it stays measured.
  useEffect(() => { trackWelcomeStep(step); }, [step]);

  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState('');
  const [firstName, setFirstName] = useState('');
  const [brief, setBrief] = useState('');
  const [roles, setRoles] = useState<string[]>(['']);
  const [city, setCity] = useState('');

  const [findings, setFindings] = useState<IntakeFinding[]>([]);
  const [strengths, setStrengths] = useState<string[]>([]);
  // Which diagnosis card is expanded. One at a time, and the row arrives
  // closed: three shut tiles read as a short menu, where one already-open panel
  // reads as a wall of text with two afterthoughts beside it.
  const [openCard, setOpenCard] = useState<DiagnosisCardId | null>(null);
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  // Which question is open for answering on the diagnosis screen, and what has
  // been typed into it. Answers land in the same `answers` map the one-at-a-time
  // step writes to, so the two ways of answering are interchangeable.
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState('');

  const [cleanResume, setCleanResume] = useState('');
  /** Real page count of the rendered PDF, from the server. Null if it could not render. */
  const [pageCount, setPageCount] = useState<number | null>(null);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  // Set only when a password submit proves the address already has an account.
  // Until then the code link stays off the screen.
  const [needsCode, setNeedsCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      // The address on their own resume. Pre-fills the field at the end, and is
      // what we compare against if they type something different.
      setResumeEmail(typeof data.resumeEmail === 'string' ? data.resumeEmail : '');
      if (data.resumeEmail && !email) setEmail(data.resumeEmail);
      setFirstName(data.firstName || '');
      setBrief(data.brief || '');
      setFindings(Array.isArray(data.findings) ? data.findings : []);
      setStrengths(Array.isArray(data.strengths) ? data.strengths : []);
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      // Seeded from suggestedTargetRole, not currentRole: the target is where
      // they are going, and a current title like "Data Analyst (Intern)" would
      // otherwise aim the whole rebuild at another internship.
      const seed = data.suggestedTargetRole || data.currentRole;
      if (seed) setRoles([seed]);
      setStep('brief');
    } catch (err: any) {
      trackWelcomeFailed('loading', 'brief_failed');
      toast.error(err?.response?.data?.error || 'Could not read your resume, please try again.');
      setStep('upload');
    }
  }

  /** The first question with no answer yet, or -1 when they are all done. */
  function nextUnanswered(from: number, given: Answers): number {
    for (let i = from; i < questions.length; i++) {
      if (!given[questions[i].id]) return i;
    }
    return -1;
  }

  /**
   * "Fix all of this" opens the questions where they already are, with the
   * first unanswered one expanded and ready to type into.
   *
   * It used to push them into a separate screen that asked one question at a
   * time. That screen had to exist because the panel was a table of contents,
   * but the panel now holds the real questions, so the wizard was a second copy
   * of the same list with the list hidden. Everything is on one screen and
   * nobody is walked through it.
   */
  function startQuestions() {
    const first = nextUnanswered(0, answers);
    if (first === -1) { setStep('roles'); return; }
    const q = questions[first];
    setOpenCard('need');
    setOpenQ(q.id);
    setInlineDraft(answers[q.id]?.value ?? '');
    // The panel opens below the tiles, so bring it into view rather than
    // leaving them looking at a button that appeared to do nothing.
    window.setTimeout(() => {
      document.getElementById('welcome-questions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  /**
   * Skip one question and move to the next unanswered one.
   *
   * Recorded as 'unknown' rather than left blank, so it counts as dealt with and
   * the rebuild is told to write that line with no figure at all rather than
   * inventing one or deleting the line.
   */
  function skipInline(q: IntakeQuestion) {
    const next: Answers = { ...answers, [q.id]: { status: 'unknown', value: '' } };
    setAnswers(next);
    setInlineDraft('');
    const following = questions.find(x => !next[x.id]);
    setOpenQ(following?.id ?? null);
    if (following) setInlineDraft(next[following.id]?.value ?? '');
  }

  /** Save an answer given on the diagnosis screen, without leaving it. */
  function saveInline(q: IntakeQuestion, value: string) {
    const v = value.trim();
    if (!v) return;
    setAnswers(prev => ({ ...prev, [q.id]: { status: 'answered', value: v } }));
    setOpenQ(null);
    setInlineDraft('');
  }

  // Roles are asked after the questions, immediately before the rebuild, because
  // the rewrite uses the target role for positioning.
  function onRolesContinue() {
    if (cleanRoles().length === 0) { toast.error('Add at least one target role.'); return; }
    void buildResume(answers);
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
      // The response also carries `retention` and `outstanding`. The screen no
      // longer shows either: they were two more paragraphs on a page whose job
      // is to hand over the document. The server keeps sending them, so putting
      // them back is a render, not a round trip.
      setPageCount(typeof data.pageCount === 'number' ? data.pageCount : null);
      setStep('resume');
    } catch (err: any) {
      trackWelcomeFailed('building', 'build_failed');
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

  /**
   * Email + password, one submit, for both new and returning people.
   *
   * Sign-in is tried FIRST. That single ordering is what removes the "do you
   * already have an account?" question — which people get wrong about
   * themselves — and it means we never have to expose an endpoint that reveals
   * whether an address is registered. Three outcomes:
   *
   *   signs in            -> returning member, straight through
   *   no such credentials -> try to create the account
   *   already registered  -> right email, wrong password: say exactly that
   *
   * Supabase has mailer_autoconfirm on, so signUp returns a live session and
   * nobody has to leave for their inbox. If that setting is ever turned off,
   * signUp comes back with no session and the code fallback below is the path.
   */
  async function submitPassword() {
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { toast.error('Enter a valid email address.'); return; }
    if (password.length < PASSWORD_MIN) { toast.error(`Your password needs at least ${PASSWORD_MIN} characters.`); return; }

    setSending(true);
    try {
      const signIn = await supabase.auth.signInWithPassword({ email: addr, password });
      if (!signIn.error && signIn.data.session) {
        setEmail(addr);
        await finishNow();
        return;
      }

      const signUp = await supabase.auth.signUp({ email: addr, password });

      if (signUp.error) {
        const known = /registered|already/i.test(signUp.error.message);
        if (known) setNeedsCode(true);
        const msg = known
          ? 'That email already has an account and the password did not match. Try again, or have us email you a code.'
          : signUp.error.message;
        trackWelcomeFailed('email', 'signup_rejected');
        toast.error(msg);
        return;
      }

      if (!signUp.data.session) {
        // Email confirmation is on: no session yet, so fall back to the code.
        trackWelcomeFailed('email', 'confirmation_required');
        toast.info('Almost there — we need to verify your email. Sending you a code.');
        await sendCode();
        return;
      }

      setEmail(addr);
      await finishNow();
    } catch (err: any) {
      trackWelcomeFailed('email', 'unexpected');
      toast.error(err?.message || 'Could not save your resume, please try again.');
    } finally {
      setSending(false);
    }
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
      // Terminal success: from here they have an account AND a resume on file.
      trackWelcomeCompleted(!user);

      // Refetch the profile BEFORE leaving, and wait for it.
      //
      // The dashboard sits behind OnboardingGate, which renders the "Complete
      // your profile" intake whenever profile.hasCompletedOnboarding is falsy.
      // Both readers of ['profile'] cache it (the gate for 30s, ReportOrDashboard
      // for 5 minutes) and nothing invalidated it after this write, so anyone who
      // had already loaded the dashboard in this browser still had their
      // pre-onboarding profile in the cache and got sent through onboarding a
      // second time on data the server had already superseded.
      //
      // refetchQueries, not invalidateQueries: invalidate only marks it dirty,
      // and the gate can still mount and read the old value first.
      await queryClient.refetchQueries({ queryKey: ['profile'] });

      // No flag is carried across. The dashboard's eligibility intro fires off
      // the profile's own eligibilityIntroSeenAt column, so it belongs to the
      // signup rather than to this navigation, and it survives the refresh that
      // used to eat it.
      navigate('/', { replace: true });
    } catch (err: any) {
      trackWelcomeFailed('finishing', 'finish_failed');
      toast.error(err?.response?.data?.error || 'Could not complete setup, please try again.');
      setStep(user ? 'resume' : 'code');
      setVerifying(false);
    }
  }

  // ── Step: brief (the grained solid) ──────────────────────────────────────────
  if (step === 'brief') {
    // Everything below is presentation only. `brief`, `findings` and `strengths`
    // arrive from the intake endpoint already shaped; nothing here reorders or
    // rewrites them. The tiles are containers for that same payload, so the
    // diagnosis can be re-styled without touching how it is generated.
    //
    // The split is by WHO ACTS, not by severity. Severity ranks pain but says
    // nothing about what happens next, and a section headed "minor" just gets
    // skipped. Splitting by owner carries the reassurance structurally: the
    // biggest pile is the one we handle, already ticked, so the candidate can
    // see at a glance that they are not being handed a to-do list.
    const forUs = findings.filter(f => f.owner === 'we_fix');
    const worthKnowing = findings.filter(f => f.owner === 'worth_knowing');
    // The tile counts what is still owed, so it goes down as they answer.
    const outstandingQs = questions.filter(q => !answers[q.id]).length;

    const tiles: Array<{ id: DiagnosisCardId; title: string; blurb: string; count?: number; tone: DiagnosisTone }> = [
      { id: 'gap', title: 'Your biggest gap', blurb: 'The one thing holding this resume back.', tone: 'alert' },
      { id: 'found', title: 'Everything we found', blurb: 'Read line by line. Not yours to fix.', count: findings.length, tone: 'neutral' },
      { id: 'need', title: 'What we need to fix', blurb: outstandingQs > 0 ? 'Only you can tell us these.' : 'All answered. Nothing waiting on you.', count: outstandingQs, tone: 'action' },
    ];

    return (
      <Shell wide>
        {/*
          Sans, not the display face.

          This sentence is long, and set in Fraunces at display size it ran to
          three lines and took the whole screen before a single finding was
          visible. The tiles under it are the thing to look at; this only has to
          say what we found and that there is a way out of it.
        */}
        <p style={{
          fontFamily: T.body, fontWeight: 700, letterSpacing: '-0.01em',
          fontSize: 'clamp(17px, 2.6vw, 21px)', lineHeight: 1.35,
          color: colors.textPrimary, margin: '0 0 22px',
        }}>
          {firstName
            ? `Hey ${firstName}, we've found where you're losing interviews and have a plan to fix it.`
            : "We've found where you're losing interviews and have a plan to fix it."}
        </p>

        {/* Three tiles, not one scroll. Someone landing here has just been told
            their resume has problems; meeting that with a wall of findings is
            how you lose them. Each tile answers one question, and only the one
            they pick opens, in a single panel underneath the row. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginTop: 4 }}>
          {tiles.map(t => (
            <DiagnosisTile
              key={t.id}
              {...t}
              open={openCard === t.id}
              onToggle={setOpenCard}
            />
          ))}
        </div>

        <AnimatePresence initial={false}>
          {openCard && (
            <motion.div
              key={openCard}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ height: { duration: 0.34, ease: EASE }, opacity: { duration: 0.22 } }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginTop: 14, padding: '22px 24px', borderRadius: 16, background: colors.bgSurface, border: `1px solid ${colors.borderDefined}`, boxShadow: '0 10px 30px -18px rgba(26,24,20,0.30)' }}>
                {openCard === 'gap' && <BriefProse text={brief} />}

                {openCard === 'found' && (
                  <>
                    {forUs.length > 0 && (
                      <FindingGroup
                        heading="We fix these for you"
                        note="Already handled. You do not need to do anything with these."
                        items={forUs}
                        ticked
                      />
                    )}
                    {worthKnowing.length > 0 && (
                      <FindingGroup
                        heading="Worth knowing"
                        note="Not a job for today. Just so you know it is there."
                        items={worthKnowing}
                      />
                    )}
                    {strengths.length > 0 && (
                      <div style={{ marginTop: 24, padding: '18px 20px', borderRadius: 12, background: 'rgba(42,157,111,0.06)', border: '1px solid rgba(42,157,111,0.20)' }}>
                        <span style={{ ...labelStyle, color: colors.success, marginBottom: 10 }}>What already works</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                          {strengths.map((str, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ color: colors.success, flexShrink: 0, marginTop: 3 }}><Check size={14} strokeWidth={3} /></span>
                              <span style={{ fontFamily: T.body, fontSize: 14.5, lineHeight: 1.55, color: colors.textSecondary }}>{str}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/*
                  Every question, here, now. They used to be listed as findings
                  with a promise that we would ask on the next screen, which made
                  this panel a table of contents for homework. The questions are
                  the homework, so they are the list, and each one can be
                  answered where it is read.
                */}
                {openCard === 'need' && (
                  questions.length > 0 ? (
                    <div id="welcome-questions" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontFamily: T.body, fontSize: 16, lineHeight: 1.55, color: colors.textPrimary, margin: '0 0 10px' }}>
                        Your current resume lacks clarity. Answer what you can below and we fix the
                        gaps that are costing you interviews.
                      </p>

                      {/*
                        The reason answering is worth the five minutes: these are
                        not answers for one application. They go into the base
                        resume every future application is written from, so the
                        work is done once and reused, which is the opposite of
                        what anyone expects from a form on a signup screen.
                      */}
                      <p style={{
                        display: 'flex', gap: 9, alignItems: 'flex-start',
                        fontFamily: T.body, fontSize: 14, lineHeight: 1.5,
                        color: colors.textSecondary, margin: '0 0 14px',
                        padding: '11px 13px', borderRadius: 10,
                        background: 'rgba(197,160,89,0.09)',
                        border: `1px solid rgba(197,160,89,0.28)`,
                      }}>
                        <Sparkles size={15} style={{ flexShrink: 0, marginTop: 2, color: colors.accentGold }} />
                        <span>
                          Fix it once and our system intelligently positions it for every job after that.{' '}
                          <a
                            href={POSITIONING_EXPLAINER_URL}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: colors.accentPetrol, fontWeight: 700, textUnderlineOffset: 3 }}
                          >
                            See how
                          </a>
                        </span>
                      </p>
                      {questions.map(q => (
                        <QuestionRow
                          key={q.id}
                          question={q}
                          answer={answers[q.id]}
                          open={openQ === q.id}
                          draft={inlineDraft}
                          onDraft={setInlineDraft}
                          onToggle={() => {
                            const next = openQ === q.id ? null : q.id;
                            setOpenQ(next);
                            setInlineDraft(next ? (answers[q.id]?.value ?? '') : '');
                          }}
                          onSave={value => saveInline(q, value)}
                          onSkip={() => skipInline(q)}
                        />
                      ))}

                      {/*
                        The way out, at the end of the questions rather than at
                        the foot of the page. Below the main button it was under
                        the whole list and nobody ever scrolled to it, which is
                        the same as not offering it.
                      */}
                      {outstandingQs > 0 && (
                        <button
                          type="button"
                          onClick={() => setStep('roles')}
                          style={{
                            alignSelf: 'center', marginTop: 4,
                            fontFamily: T.body, fontSize: 13.5, color: colors.textMuted,
                            background: 'none', border: 'none', padding: '6px 4px',
                            textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer',
                          }}
                        >
                          Skip these and rebuild it anyway
                        </button>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontFamily: T.body, fontSize: 15, lineHeight: 1.6, color: colors.textSecondary, margin: 0 }}>
                      Everything we found is ours to handle. Nothing is waiting on you.
                    </p>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <motion.button
            className="agc-cta-pulse"
            onClick={() => startQuestions()}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            style={{ fontFamily: T.body, fontSize: 16.5, fontWeight: 700, cursor: 'pointer', padding: '16px 30px', borderRadius: 14, border: 'none', background: colors.accentPetrol, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            Fix all of this <ArrowRight size={18} />
          </motion.button>
          <span style={{ fontFamily: T.body, fontSize: 13.5, color: colors.textMuted }}>
            {outstandingQs > 0
              ? `${outstandingQs} quick ${outstandingQs === 1 ? 'question' : 'questions'}, then we rebuild it.`
              : 'Next: your target roles.'}
          </span>
        </div>

        <style>{`
          @keyframes agcCtaPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(45,90,110,0.34); }
            50%      { box-shadow: 0 0 0 13px rgba(45,90,110,0); }
          }
          .agc-cta-pulse { animation: agcCtaPulse 2.6s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .agc-cta-pulse { animation: none !important; } }
        `}</style>
      </Shell>
    );
  }

  // ── Step: roles ──────────────────────────────────────────────────────────────
  if (step === 'roles') {
    return (
      <Shell>
        <Eyebrow>Last thing before we rebuild it</Eyebrow>
        <Display>What roles are you targeting?</Display>
        <p style={bodyText}>Applying to the jobs you are most likely to get hired for is half the challenge. Set your target role and location and we set you up with high quality applications that get you hired.</p>

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

  // The one-question-at-a-time wizard used to live here. It was a second copy
  // of the list that is now on the diagnosis screen, shown with the list
  // hidden, so answering meant being walked through questions you had already
  // read. Everything is answered in place now; 'questions' is no longer a step.

  // ── Step: building ───────────────────────────────────────────────────────────
  if (step === 'building') {
    return (
      <Shell>
        <Eyebrow>Almost there</Eyebrow>
        <Display>Building your resume.</Display>
        <p style={bodyText}>Cleaning the formatting, leading with your outcomes, and working in everything you just told us. This takes up to a minute.</p>
        <CyclingStatus lines={BUILDING_LINES} />
      </Shell>
    );
  }

  // ── Step: resume (the payoff, still anonymous) ───────────────────────────────
  if (step === 'resume') {
    return (
      <Shell wide>
        <style>{RESUME_PAPER_CSS}</style>
        {/*
          One heading, then the document.

          This screen used to say the same thing four times over: a pill reading
          "your rebuilt resume", a headline saying the same, a line promising it
          was free, another telling them to press the button, and a third further
          down repeating that we would email it. The document is the point, so
          everything that is not the document waits until after they have read it.
        */}
        <div style={{ marginBottom: 30 }}>
          <Display>
            {firstName
              ? `Hey ${firstName}, check out your new and improved resume!`
              : 'Check out your new and improved resume!'}
          </Display>
        </div>

        {/* Rendered as a page, not a text box — people trust what looks like a document. */}
        <div className="bank-paper" style={{ position: 'relative' }}>
          {/*
            The length, on the document rather than in a card above it.

            Two pages is the Australian norm and the single thing people most
            often get wrong, so the number earns its place. It is the real count
            off the same renderer that produces the emailed PDF, not a guess from
            character count, which is wrong the moment somebody has a long
            education section. Sitting on the page corner it reads as a property
            of the document, which is what it is.
          */}
          {pageCount !== null && (
            <span style={{
              position: 'absolute', top: 14, right: 14,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 11px', borderRadius: 99,
              background: colors.bgAlt, border: `1px solid ${colors.borderDefined}`,
              fontFamily: T.body, fontSize: 11.5, fontWeight: 700,
              letterSpacing: '0.04em', color: colors.textSecondary, whiteSpace: 'nowrap',
            }}>
              <FileText size={12} /> {pageCount} page{pageCount === 1 ? '' : 's'}
            </span>
          )}
          <ReactMarkdown>{cleanResume}</ReactMarkdown>
        </div>

        {/*
          The claim, then the picture of it, then the one thing to do next.

          The line is sized to hold on one line down to a 520px shell, which is
          why the clamp tops out where it does: broken across two lines it reads
          as two half-thoughts, and this one only works said in a single breath.
        */}
        <p style={{
          fontFamily: T.display, fontWeight: 600, letterSpacing: '-0.015em',
          fontSize: 'clamp(15px, 2.35vw, 21px)', lineHeight: 1.3,
          color: colors.textPrimary, margin: '34px 0 0',
          textAlign: 'center', whiteSpace: 'nowrap',
        }}>
          You're two steps away from landing your dream job in Australia.
        </p>

        <JourneyTrack src="/Assets/journey/step-3-of-5.png" />

        <div style={{ marginTop: 22 }}>
          <PrimaryBtn label="See my next steps" onClick={onSaveResume} />
        </div>
        <p style={{ fontFamily: T.body, fontSize: 13.5, color: colors.textMuted, margin: '14px 0 0' }}>
          Your resume will be sent as a PDF to your email address.
        </p>
      </Shell>
    );
  }

  // ── Step: email + password (sign up or sign in — same door) ───────────────────
  const emailFix = suggestEmailFix(email.trim());
  // Only worth raising once what they've typed is a complete, different address —
  // nagging mid-typing would fire on every keystroke of a legitimate new one.
  const showResumeEmailNudge = Boolean(
    resumeEmail &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) &&
    email.trim().toLowerCase() !== resumeEmail.toLowerCase(),
  );

  if (step === 'email') {
    return (
      <Shell>
        {/* No step pill. The heading says what this screen is for, and the line
            under it says what they get, which is the part worth the sentence. */}
        <Display>Claim your resume</Display>
        <p style={{ ...bodyText, marginBottom: 22 }}>
          and see which jobs you have the best chance to get hired for.
        </p>

        <input
          type="email" inputMode="email" autoComplete="email" autoFocus
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') passwordRef.current?.focus(); }}
          placeholder="you@email.com"
          style={inputStyle}
        />

        {/* Two quiet corrections, both one tap. Neither blocks anyone. */}
        {emailFix && (
          <button onClick={() => setEmail(emailFix)}
            style={typoNudgeStyle}>
            Did you mean <strong style={{ fontWeight: 700 }}>{emailFix}</strong>?
          </button>
        )}
        {!emailFix && showResumeEmailNudge && (
          <button onClick={() => setEmail(resumeEmail)}
            style={typoNudgeStyle}>
            Your resume lists <strong style={{ fontWeight: 700 }}>{resumeEmail}</strong> — send it there instead?
          </button>
        )}

        <input
          ref={passwordRef}
          type="password" autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !sending) void submitPassword(); }}
          placeholder="Create a password"
          style={{ ...inputStyle, marginTop: 12 }}
        />
        <p style={{ ...bodyText, fontSize: 13, margin: '8px 0 0' }}>At least {PASSWORD_MIN} characters.</p>

        {/* What happens after the send, said before they press it. The resume
            was the reason they came; the jobs are the reason they stay, and
            this is the only place in the flow where that hand-off gets named. */}
        <p style={{ fontFamily: T.body, fontSize: 14, lineHeight: 1.55, color: colors.textSecondary, margin: '10px 0 0' }}>
          <strong style={{ fontWeight: 700, color: colors.textPrimary }}>Next:</strong> See which jobs match my profile.
        </p>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
          <PrimaryBtn label={sending ? '' : 'Next'} onClick={() => void submitPassword()} loading={sending} />
        </div>

        {/* The code path is no longer offered up front — it was a second door on
            a screen that only needs one. It appears the moment it is the actual
            answer: a real account whose password did not match. */}
        {needsCode && (
          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <button onClick={sendCode} disabled={sending}
              style={{ background: 'transparent', border: 'none', cursor: sending ? 'default' : 'pointer', color: colors.accentPetrol, fontFamily: T.body, fontSize: 13.5, fontWeight: 700, padding: 0 }}>
              Email me a code instead
            </button>
          </div>
        )}
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
  // This is the front door of the site, not just a step. Signed-out visitors at
  // aussiegradcareers.com.au land here, so the promise and the dropzone are the
  // whole screen: one headline, one target, nothing else to decide.
  return (
    <>
      <TestimonialWash />
      <Shell wide onWash>
      {/* A panel with an edge, not a glow. The testimonials behind used to be
          hidden under a radial white bloom, which left the content floating in
          a soft-edged smear with nothing to say where the page began. A solid
          card with a thin stroke does the same job of lifting the copy off the
          marquee, and it has a boundary you can actually see. */}
      <div style={{
        background: colors.bgSurface,
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: 22,
        padding: 'clamp(28px, 5vh, 44px) clamp(22px, 4vw, 40px)',
        boxShadow: '0 1px 2px rgba(26,24,20,0.05), 0 26px 60px -34px rgba(26,24,20,0.45)',
      }}>
      <div style={{ textAlign: 'center' }}>
        <BrandLockup />
        <Display>Find out what's costing you interviews.</Display>
      </div>

      <AnimatePresence mode="wait">
        {step === 'loading' ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ marginTop: 8 }}>
            <CyclingStatus lines={READING_LINES} align="center" />
          </motion.div>
        ) : (
          <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              className="agc-dropzone"
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); if (!dragging) setDragging(true); }}
              onDragLeave={e => { e.preventDefault(); setDragging(false); }}
              onDrop={e => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0] ?? null;
                if (f) { setFile(f); void uploadResume(f); }
              }}
              style={{
                width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 13, textAlign: 'center',
                /* Smaller than it was. The box was tall enough that the label
                   sat marooned in the middle of it; at this height the words
                   have room without the target becoming the whole screen. */
                padding: 'clamp(26px, 5.5vh, 46px) 26px', borderRadius: 16, cursor: 'pointer',
                /* One thin solid stroke. Dashed plus a pulsing glow read as an
                   unfinished placeholder, which is the opposite of what the
                   only thing to click on the page should look like. */
                border: `1px solid ${dragging || file ? colors.accentPetrol : PANEL_BORDER}`,
                background: dragging || file ? 'rgba(45,90,110,0.06)' : colors.bgAlt,
                transition: 'border-color .15s ease, background .15s ease',
              }}
            >
              <span style={{ color: dragging || file ? colors.accentPetrol : colors.textMuted }}>
                <UploadCloud size={42} strokeWidth={1.5} />
              </span>
              <span style={{ minWidth: 0, maxWidth: '100%' }}>
                <span style={{ display: 'block', fontFamily: T.display, fontSize: 'clamp(19px, 2.4vw, 24px)', fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file ? file.name : dragging ? 'Drop it here' : 'Upload your resume'}
                </span>
                <span style={{ display: 'block', fontFamily: T.body, fontSize: 14, color: colors.textMuted, marginTop: 7 }}>
                  Drag it in, or click to browse. PDF or Word, up to 5MB.
                </span>
              </span>
            </button>
            <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) uploadResume(f); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Said after the box, not before it. The headline names the problem and
          the box is the thing to do about it; this is the promise they carry
          away once they have already acted.

          The promise stays a promise here and does not argue for itself. An
          earlier draft made the case on this screen ("a good resume is only the
          baseline") and that is the wrong screen for it: it devalues the thing
          they are about to be given, before they have been given it. The
          argument now lives where it costs nothing, on the rebuilt resume and
          the fit check. */}
      <p style={{ fontFamily: T.display, fontStyle: 'italic', textAlign: 'center', fontSize: 'clamp(15px, 1.9vw, 17.5px)', lineHeight: 1.5, color: colors.accentPetrol, maxWidth: 560, margin: '22px auto 0' }}>
        High quality applications consistently personalised to every job.
      </p>
      {/* Deliberately quieter than the promise above it, and a new tab. This is
          the only screen whose whole job is getting the file into the box, so a
          second thing to click must not compete with the dropzone and must not
          navigate them away from it. */}
      <p style={{ textAlign: 'center', margin: '10px 0 0' }}>
        <a
          href={POSITIONING_EXPLAINER_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: T.body, fontSize: 13.5, color: colors.textMuted,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          Find out how
        </a>
      </p>
      </div>
      </Shell>
    </>
  );
};

// ── Small shared building blocks (kept local to this page) ─────────────────────

/**
 * The stroke on the front door's panel and dropzone. A step darker than
 * `borderDefined` because both of these sit over the testimonial marquee, where
 * the site's usual whisper of an edge disappears against a photo.
 */
const PANEL_BORDER = 'rgba(26, 24, 20, 0.28)';

const bodyText: React.CSSProperties = { fontFamily: T.body, fontSize: 15.5, lineHeight: 1.65, color: colors.textSecondary, margin: '0 0 24px' };

/**
 * The bank renders as a page, not a text dump. Markdown lists need explicit
 * styling because the app's CSS reset strips list markers, which is why the
 * bullets were coming out as flat lines.
 */
/**
 * The one accent on the rendered page.
 *
 * Section headings used to be the petrol blue the rest of the site runs on,
 * and blue section headings are the single most recognisable tell of a resume
 * that came out of a generator — every free AI builder ships that same trick.
 * A deep graphite reads as typeset rather than templated, and nothing about a
 * resume needs a second colour to be legible.
 */
const RESUME_INK = '#24211C';

/**
 * The two waits, narrated.
 *
 * A single frozen "Reading your resume..." for twenty or forty seconds reads as
 * a hung page, and the person sitting in front of it has nothing to do but
 * wonder whether it broke. These lists give the wait a shape: each line names
 * something that is genuinely happening on the server, in the order it happens,
 * so the time passes as progress rather than as delay.
 *
 * Fixed lists, walked once. Nothing repeats and nothing loops back to the top,
 * because a line you have already read coming round again is the clearest
 * possible signal that the thing is stuck. The last line simply holds until the
 * step ends, so a slow run trails off on a sentence that is still true rather
 * than on a promise the next line would have broken.
 *
 * Keep every line honest to what the backend actually does. If a stage is ever
 * removed from the pipeline, take its line out of the list with it.
 */
const READING_LINES = [
  'Reading your resume.',
  'Pulling out your roles, dates and education.',
  'Looking for the outcomes buried in your duties.',
  'Checking what a recruiter sees in the first six seconds.',
  'Measuring it against what employers ask for.',
  'Working out what is costing you interviews.',
] as const;

const BUILDING_LINES = [
  'Cleaning up the formatting.',
  'Keeping every role and date exactly as you had them.',
  'Rewriting your duties as outcomes.',
  'Working in the answers you just gave us.',
  'Putting numbers to the results you named.',
  'Setting it in a layout that survives an automated screen.',
  'Checking nothing from your original resume was dropped.',
  'Almost there. Putting it on the page.',
] as const;

/**
 * How long each line holds. Long enough to read a sentence twice without
 * hurrying, short enough that the screen never looks frozen.
 */
const STATUS_LINE_MS = 4200;

/**
 * One line at a time out of a fixed list, with the spinner beside it.
 *
 * The reserved height matters: without it the panel jumps every time a line of
 * a different length swaps in, and a jumping page looks broken in exactly the
 * moment we are trying to look busy.
 */
function CyclingStatus({ lines, align = 'left', intervalMs = STATUS_LINE_MS }: {
  lines: readonly string[];
  align?: 'left' | 'center';
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    // The last line holds. Nothing to schedule once we are on it.
    if (i >= lines.length - 1) return;
    const id = window.setTimeout(() => setI((n) => n + 1), intervalMs);
    return () => window.clearTimeout(id);
  }, [i, lines.length, intervalMs]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, minHeight: 24,
      justifyContent: align === 'center' ? 'center' : 'flex-start',
      color: colors.textSecondary, fontFamily: T.body, fontSize: 15,
    }}>
      <Loader2 size={20} className="animate-spin" style={{ color: colors.accentPetrol, flexShrink: 0 }} />
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          {lines[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

const RESUME_PAPER_CSS = `
.bank-paper {
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
  letter-spacing: .13em; text-transform: uppercase; color: ${RESUME_INK};
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
.bank-paper li::marker { color: ${RESUME_INK}; }
.bank-paper hr { border: 0; border-top: 1px solid ${colors.borderDefined}; margin: 20px 0; }
.bank-paper a { color: ${RESUME_INK}; text-decoration: none; }
@media (max-width: 640px) { .bank-paper { padding: 24px 20px; max-height: 56vh; } }
`;
const inputStyle: React.CSSProperties = {
  flex: 1, width: '100%', boxSizing: 'border-box', fontFamily: T.body, fontSize: 15, padding: '13px 16px',
  borderRadius: 12, border: `1px solid ${colors.borderDefined}`, background: colors.bgSurface, color: colors.textPrimary, outline: 'none',
};
const labelStyle: React.CSSProperties = { display: 'block', fontFamily: T.body, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: colors.textMuted, marginBottom: 8 };

/** The one-tap address correction. A suggestion, never a blocker. */
const typoNudgeStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', marginTop: 10,
  padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
  background: 'rgba(45,90,110,0.07)', border: '1px solid rgba(45,90,110,0.22)',
  fontFamily: T.body, fontSize: 13.5, color: colors.accentPetrol, fontWeight: 600,
};

type DiagnosisCardId = 'gap' | 'found' | 'need';
type DiagnosisTone = 'alert' | 'action' | 'neutral';

/**
 * Placeholder icons, one per tile. Swap the component here when the real
 * artwork arrives — nothing else needs to change.
 */
const DIAGNOSIS_ICONS: Record<DiagnosisCardId, LucideIcon> = {
  gap: AlertTriangle,
  found: ListChecks,
  need: PencilLine,
};

/**
 * One square tile in the diagnosis row.
 *
 * The face of the tile always says enough to stand alone — icon, title, a short
 * blurb and a count — so a candidate who never opens one still leaves knowing
 * what we found and who is doing what about it. Opening is for detail, not for
 * the point.
 */
function DiagnosisTile({
  id, title, blurb, count, tone, open, onToggle,
}: {
  id: DiagnosisCardId;
  title: string;
  blurb: string;
  count?: number;
  tone: DiagnosisTone;
  open: boolean;
  onToggle: (id: DiagnosisCardId | null) => void;
}) {
  const accent = tone === 'alert' ? colors.accentGold : tone === 'action' ? colors.accentPetrol : colors.textMuted;
  const Icon = DIAGNOSIS_ICONS[id];

  return (
    <motion.button
      onClick={() => onToggle(open ? null : id)}
      aria-expanded={open}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: EASE }}
      style={{
        /* Square-ish, and the same height across the row whatever the blurb
           does, so the three read as one set rather than three panels. */
        position: 'relative',
        aspectRatio: '1 / 1', minHeight: 180,
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        gap: 8, padding: '22px 18px 20px', cursor: 'pointer', borderRadius: 18,
        background: colors.bgSurface,
        border: `1px solid ${open ? accent : colors.borderDefined}`,
        boxShadow: open ? '0 10px 30px -18px rgba(26,24,20,0.32)' : 'none',
        transition: 'border-color .2s ease, box-shadow .2s ease',
      }}
    >
      {/* Out of the flow entirely. It used to share a justify-between row with
          the icon, which is what stopped the icon from being centred, and it
          cannot sit beside the title either: a title long enough to wrap pushes
          it onto a line of its own where it reads as a stray number. */}
      {typeof count === 'number' && count > 0 && (
        <span style={{
          position: 'absolute', top: 14, right: 14,
          fontFamily: T.body, fontSize: 12.5, fontWeight: 700, color: colors.textSecondary,
          background: colors.bgAlt, borderRadius: 99, padding: '3px 10px',
        }}>
          {count}
        </span>
      )}

      <span style={{
        width: 56, height: 56, borderRadius: 16, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: open ? accent : colors.bgAlt,
        color: open ? '#fff' : accent,
        transition: 'background .2s ease, color .2s ease',
      }}>
        <Icon size={28} strokeWidth={2} />
      </span>

      {/*
        The title follows the icon directly. It used to carry `marginTop: auto`,
        which pushed it down by however much room the blurb left over, so the
        tile with the one-line blurb sat its heading lower than the other two and
        the row looked broken. The spacer now lives on the row below, where a
        difference in blurb length belongs.
      */}
      <span style={{ fontFamily: T.display, fontSize: 'clamp(16px, 2vw, 18.5px)', fontWeight: 600, color: colors.textPrimary, lineHeight: 1.25, marginTop: 6 }}>
        {title}
      </span>

      <span style={{ fontFamily: T.body, fontSize: 13.5, lineHeight: 1.5, color: colors.textMuted }}>
        {blurb}
      </span>

      <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: T.body, fontSize: 13, fontWeight: 700, color: accent }}>
        {open ? 'Hide' : 'Show me'}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease: EASE }} style={{ display: 'inline-flex' }}>
          <ChevronDown size={15} />
        </motion.span>
      </span>
    </motion.button>
  );
}
/**
 * One question on the diagnosis screen, answerable where it is read.
 *
 * Closed, it is a line of a checklist. Open, it is the same question the
 * one-at-a-time step would have asked, with the same ranges, example and hint,
 * writing to the same answers map. Someone who fills all of them in here walks
 * straight past that step; someone who fills in none of them sees it unchanged.
 */
function QuestionRow({ question, answer, open, draft, onDraft, onToggle, onSave, onSkip }: {
  question: IntakeQuestion;
  answer?: { status: AnswerStatus; value: string };
  open: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onToggle: () => void;
  onSave: (value: string) => void;
  onSkip: () => void;
}) {
  const answered = answer?.status === 'answered';
  const skipped = !!answer && answer.status !== 'answered';

  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${open ? colors.accentPetrol : colors.borderDefined}`,
      background: colors.bgSurface,
      transition: 'border-color .2s ease',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 14px' }}>
        {/*
          Nothing is drawn until the question is answered. An empty box reads as
          a control, so people clicked it waiting for something to happen. This
          is a receipt, not an input: it only ever appears, filled, once the
          answer is in.
        */}
        <span style={{
          flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          // The slot is always here so the question text does not jump sideways
          // when an answer lands. Only the circle itself is conditional.
          background: answered ? colors.success : 'transparent',
          color: '#fff',
        }}>
          {answered && <Check size={13} strokeWidth={3.5} />}
        </span>

        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontFamily: T.body, fontSize: 14.5, fontWeight: 600, color: colors.textPrimary, lineHeight: 1.45 }}>
            {question.question}
          </span>
          {answered ? (
            <span style={{ display: 'block', marginTop: 3, fontFamily: T.body, fontSize: 13.5, lineHeight: 1.5, color: colors.success, fontWeight: 600 }}>
              {answer!.value}
            </span>
          ) : skipped ? (
            // Said so plainly, so a skipped question does not look like one they
            // simply have not reached yet. Edit brings it back.
            <span style={{ display: 'block', marginTop: 3, fontFamily: T.body, fontSize: 13.5, lineHeight: 1.5, color: colors.textMuted }}>
              Skipped
            </span>
          ) : (
            question.why && (
              <span style={{ display: 'block', marginTop: 3, fontFamily: T.body, fontSize: 13, lineHeight: 1.5, color: colors.textMuted }}>
                {question.why}
              </span>
            )
          )}
        </span>

        <button
          onClick={onToggle}
          style={{
            flexShrink: 0, cursor: 'pointer',
            padding: '6px 14px', borderRadius: 99,
            border: `1px solid ${answered ? colors.borderDefined : colors.accentPetrol}`,
            background: 'transparent',
            color: answered ? colors.textSecondary : colors.accentPetrol,
            fontFamily: T.body, fontSize: 13, fontWeight: 700,
          }}
        >
          {open ? 'Close' : answered ? 'Edit' : 'Fix'}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.26, ease: EASE }, opacity: { duration: 0.18 } }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 14px 46px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {question.ranges.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {question.ranges.map(r => (
                    <button
                      key={r}
                      onClick={() => onSave(r)}
                      style={{
                        cursor: 'pointer', padding: '7px 13px', borderRadius: 99,
                        border: `1px solid ${colors.borderDefined}`, background: colors.bgAlt,
                        fontFamily: T.body, fontSize: 13, fontWeight: 600, color: colors.textSecondary,
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  inputMode={question.kind === 'number' ? 'numeric' : 'text'}
                  value={draft}
                  onChange={e => onDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') onSave(draft); }}
                  placeholder={question.example || 'Your answer'}
                  style={inputStyle}
                />
                <button
                  onClick={() => onSave(draft)}
                  disabled={!draft.trim()}
                  style={{
                    flexShrink: 0, cursor: draft.trim() ? 'pointer' : 'not-allowed',
                    padding: '0 18px', borderRadius: 12, border: 'none',
                    background: colors.accentPetrol, color: colors.textOnDeep,
                    fontFamily: T.body, fontSize: 14, fontWeight: 700,
                    opacity: draft.trim() ? 1 : 0.45,
                  }}
                >
                  Save
                </button>
              </div>

              {question.hint && (
                <span style={{ fontFamily: T.body, fontSize: 12.5, lineHeight: 1.5, color: colors.textMuted }}>
                  {question.hint}
                </span>
              )}

              {/*
                Every question is skippable on its own. A single skip at the foot
                of the list is all or nothing, and the real case is someone who
                can answer four of six and is stuck on the fifth. Being stuck on
                one should never cost us the other four.
              */}
              <button
                type="button"
                onClick={onSkip}
                style={{
                  alignSelf: 'flex-start', marginTop: 2,
                  fontFamily: T.body, fontSize: 13, color: colors.textMuted,
                  background: 'none', border: 'none', padding: '4px 2px',
                  textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer',
                }}
              >
                Skip this one
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The brief, each problem opened by a drop cap carrying its number.
 *
 * A drop cap, not a marker in a gutter: the chip floats INSIDE the paragraph
 * and the prose wraps around it, so the count is part of the reading rather
 * than a list rail running alongside it. The last paragraph is the closing ask
 * for facts, not a problem, so it never takes one.
 *
 * Nothing here touches the prompt. The number is derived from paragraph
 * position at render time, is never requested in the JSON and is never stored,
 * so the model spends no attention on it and a brief that comes back in a
 * different shape degrades to plain prose instead of breaking.
 */
function BriefProse({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  // The brief always ends by asking for the facts, but nothing forces the model
  // to give that its own paragraph, and the prompt is deliberately not told to.
  // Length is the tell: the ask is a couple of sentences, a problem is a
  // hundred words. When the last paragraph is long it is a third problem with
  // the ask folded into it, so there is no separate closing to box.
  const last = paras[paras.length - 1] ?? '';
  const hasClosing = paras.length >= 2 && last.split(/\s+/).length <= 70;

  const problems = hasClosing ? paras.slice(0, -1) : paras;
  const closing = hasClosing ? last : null;

  // A count needs something to count. One problem is a legitimate brief, and a
  // lone chip reading "1" looks like a list that lost its other items.
  if (problems.length < 2) {
    return (
      <p style={{ fontFamily: T.display, fontSize: 'clamp(17px, 2.2vw, 20px)', lineHeight: 1.55, color: colors.textPrimary, margin: 0, whiteSpace: 'pre-line' }}>
        {text}
      </p>
    );
  }

  const prose: React.CSSProperties = {
    fontFamily: T.display,
    fontSize: 'clamp(17px, 2.2vw, 20px)',
    lineHeight: 1.55,
    color: colors.textPrimary,
    margin: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {problems.map((p, i) => (
        // Each paragraph is a flex item, which establishes its own formatting
        // context and so contains its own float. Without that a short paragraph
        // would let the chip hang down into the next problem's text.
        //
        // The dotted rule opens each problem rather than separating pairs of
        // them, so the first one gets it too. Dotted reads lighter than solid at
        // the same alpha, which is why it can carry borderDefined without
        // becoming a divider that competes with the chips.
        <p key={i} style={{ ...prose, borderTop: `1px dotted ${colors.borderDefined}`, paddingTop: 'clamp(18px, 2.4vw, 24px)' }}>
          <span
            aria-hidden
            style={{
              float: 'left',
              width: 'clamp(48px, 7vw, 60px)',
              height: 'clamp(48px, 7vw, 60px)',
              marginRight: 'clamp(12px, 1.6vw, 16px)',
              marginBottom: 6,
              // Optical, not metric: the chip's top edge has to meet the cap
              // height of the first line, and the line box sits above it.
              marginTop: 3,
              borderRadius: 14,
              background: colors.accentGold,
              color: '#FFFFFF',
              fontFamily: T.display,
              fontSize: 'clamp(27px, 3.8vw, 34px)',
              fontWeight: 700,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontVariantNumeric: 'lining-nums tabular-nums',
              userSelect: 'none',
            }}
          >
            {i + 1}
          </span>
          {p}
        </p>
      ))}

      {/* The closing is not a problem, it is the handover to the questions, so
          it leaves the numbered run entirely and sits in its own box. No chip,
          no dotted rule: the count has already closed above it. */}
      {closing && (
        <div style={{
          marginTop: 6,
          padding: 'clamp(18px, 2.4vw, 22px) clamp(18px, 2.4vw, 24px)',
          borderRadius: 14,
          background: colors.bgAlt,
          border: `1px solid ${colors.borderWhisper}`,
        }}>
          <p style={{ ...prose, fontSize: 'clamp(16px, 2vw, 18.5px)', color: colors.textSecondary }}>
            {closing}
          </p>
        </div>
      )}
    </div>
  );
}

/** A run of findings under one heading. Same rows as before, on the light canvas. */
function FindingGroup({ heading, note, items, ticked }: {
  heading?: string; note: string; items: IntakeFinding[]; ticked?: boolean;
}) {
  return (
    <div style={{ marginTop: heading ? 20 : 0 }}>
      {heading && (
        <span style={{ display: 'block', fontFamily: T.body, fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>
          {heading}
        </span>
      )}
      <p style={{ fontFamily: T.body, fontSize: 13.5, lineHeight: 1.5, color: colors.textMuted, margin: '3px 0 14px' }}>
        {note}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            {/*
              Pre-ticked for anything we handle. A checkbox the user must click
              would be theatre, since we fix these either way - a tick that is
              already done says the same thing honestly.
            */}
            <span style={{
              flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: ticked ? colors.success : 'transparent',
              border: ticked ? 'none' : `1.5px solid ${colors.borderDefined}`,
              color: '#fff',
            }}>
              {ticked && <Check size={13} strokeWidth={3.5} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: T.body, fontSize: 15, fontWeight: 600, color: colors.textPrimary, lineHeight: 1.4 }}>
                {f.title}
                {f.severity === 'critical' && (
                  <span style={{ fontFamily: T.body, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#9B3B22', background: 'rgba(196,72,48,0.12)', padding: '2px 6px', borderRadius: 4, marginLeft: 8, verticalAlign: 'middle' }}>
                    Biggest
                  </span>
                )}
              </span>
              {f.detail && (
                <span style={{ display: 'block', fontFamily: T.body, fontSize: 14, lineHeight: 1.55, color: colors.textSecondary, marginTop: 2 }}>
                  {f.detail}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The eight testimonial cards, in the order they sit in public/Assets. */
const TESTIMONIAL_CARDS = Array.from({ length: 8 }, (_, i) => `/Assets/testimonials/card_${i + 1}.jpg`);

/**
 * How much white sits over the testimonials. They are proof, not the pitch, so
 * they read as texture behind the upload box rather than something to stop and
 * read. Turn this down to show more of them, up to hide them further. It went
 * up when the centre bloom came out: that gradient used to be doing most of
 * the muting, and without it a bare wash left the cards shouting.
 */
const WASH_OPACITY = 0.62;

/**
 * How many times the eight-card run is repeated inside one half of a marquee
 * strip. The half has to be at least as wide as the widest screen this opens
 * on, because the animation slides a full half out of view: eight cards are
 * 8 x (168 + 18) = 1488px, so two runs give 2976px of cover. Raise it if this
 * ever has to hold an ultrawide.
 */
const COPIES_PER_HALF = 2;

/**
 * How long one row takes to travel a full half of its strip, in seconds.
 *
 * Slower than it was (68s + 9 per row). The wall is texture behind the upload
 * box, and anything quick enough to track with your eye competes with the one
 * thing on the page you are meant to read. Each row is a little slower than the
 * one above it so the three never lock into a single moving block.
 */
const MARQUEE_SECONDS = 84;
const MARQUEE_ROW_STEP = 11;

/**
 * Two rows of testimonials crawling in opposite directions behind the page.
 *
 * The loop works by rendering each row's cards twice and sliding the strip
 * exactly half its width, so the second copy lands where the first began and
 * the seam never shows. The second row starts from a rotated copy of the same
 * eight and is nudged half a card sideways, so no card ever sits directly
 * above its twin.
 */
function TestimonialWash() {
  /*
    Three rows, not two, and stacked from the top rather than centred.
    Two rows of 342px came to about 700px, so on any ordinary laptop the
    marquee floated in the middle of the viewport with bare canvas above and
    below it. A third row covers the fold on every screen this is opened on,
    and the rows are anchored to the top so the overflow falls off the bottom
    edge instead of leaving a gap there.

    Each row starts from a different rotation of the same eight cards so no
    card ever sits directly above its twin, and each is rendered twice so the
    strip can slide exactly half its width and land back where it began.

    The half is COPIES_PER_HALF runs wide, not one. Eight cards come to 1488px,
    so a half of one run left the strip only 1488px of covered ground: a row
    animating to -50% (or starting there, which the right-moving rows do) ran
    its tail past the viewport and opened bare canvas on the right, which is
    exactly the hole that showed in the middle row on a 1920px screen. Two runs
    per half covers 2976px, so every row stays full edge to edge on any display
    up to that width, and all three rows are built the same way.
  */
  const rows = [0, 3, 6].map((offset) => {
    const rotated = [...TESTIMONIAL_CARDS.slice(offset), ...TESTIMONIAL_CARDS.slice(0, offset)];
    const half = Array.from({ length: COPIES_PER_HALF }, () => rotated).flat();
    return [...half, ...half];
  });

  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none', background: colors.bgCanvas }}>
      <div style={{ position: 'absolute', top: -40, left: 0, right: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {rows.map((row, r) => (
          <div key={r} style={{ display: 'flex', width: 'max-content', gap: 18, marginLeft: r * -84, animation: `agcMarquee${r % 2 === 0 ? 'L' : 'R'} ${MARQUEE_SECONDS + r * MARQUEE_ROW_STEP}s linear infinite` }} className="agc-marquee-row">
            {row.map((src, i) => (
              <img key={`${r}-${i}`} src={src} alt="" loading="lazy" draggable={false}
                style={{ width: 168, height: 342, objectFit: 'cover', borderRadius: 12, flexShrink: 0, boxShadow: '0 8px 24px -14px rgba(26,24,20,0.35)' }} />
            ))}
          </div>
        ))}
      </div>

      {/* An even wash, and nothing else. The bloom that used to sit on top of
          this carried the contrast for the headline, and it did it by fading a
          pool of white out into the cards — which is exactly the feathered edge
          the panel now replaces. The panel owns the contrast; this only has to
          keep the marquee quiet. */}
      <div style={{ position: 'absolute', inset: 0, background: colors.bgSurface, opacity: WASH_OPACITY }} />

      <style>{`
        @keyframes agcMarqueeL { from { transform: translateX(0); }    to { transform: translateX(-50%); } }
        @keyframes agcMarqueeR { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) {
          .agc-marquee-row { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/** Who this is, said once at the top. Branding, not a nav bar. */
function BrandLockup() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 11, marginBottom: 28 }}>
      <img src="/Logo.svg" alt="" width={34} height={34} style={{ borderRadius: 9, objectFit: 'contain' }} />
      <span style={{ fontFamily: T.body, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.textSecondary }}>
        Aussie Grad Careers
      </span>
    </div>
  );
}

/**
 * `onWash` lets the page paint its own background behind the shell (the upload
 * screen puts the testimonial marquee there). Everything else keeps the flat
 * canvas it has always had.
 */
function Shell({ children, wide, onWash }: { children: React.ReactNode; wide?: boolean; onWash?: boolean }) {
  return (
    <div style={{ position: 'relative', zIndex: 1, height: '100dvh', overflowY: 'auto', background: onWash ? 'transparent' : colors.bgCanvas, display: 'flex', padding: '48px 24px', boxSizing: 'border-box' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
        style={{ width: '100%', maxWidth: wide ? 720 : 520, margin: 'auto' }}>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * The five-step "you are here" track, on a white card.
 *
 * The source PNGs are 16:9 with the drawing sitting in the top two thirds, so
 * shown whole they come with a band of empty white underneath that reads as a
 * layout bug. The wrapper crops to the drawing instead of the artboard, which is
 * why the aspect ratio and the object-position are what they are: the window
 * keeps everything from the thought-bubble down to the "Searching" and "HIRED!"
 * captions, and throws away the blank half.
 *
 * If the artwork is ever re-exported tighter, drop the wrapper and render the
 * image directly rather than tuning these numbers again.
 */
function JourneyTrack({ src }: { src: string }) {
  return (
    <div style={{
      marginTop: 14, borderRadius: 14, overflow: 'hidden',
      background: '#fff', border: `1px solid ${colors.borderDefined}`,
      aspectRatio: '1920 / 820', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto',
    }}>
      <img
        src={src}
        alt="Your progress: three of five steps done, on the way to hired"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 38%', display: 'block' }}
      />
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
