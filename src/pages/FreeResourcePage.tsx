/* ────────────────────────────────────────────────────────────────────────────
   FreeResourcePage: /free/:slug

   The lead magnet page, one per asset, all driven from src/config/freeResources.

   The order of this page is the whole idea. The asset is handed over FIRST, with
   nothing asked for it: no email, no account, no form. Only after they have
   received something does the page show them the map, and only after the map
   does it ask anything at all.

   Everything below is arranged so that every ask is smaller than the give that
   preceded it. The resume upload sits last, after four taps, because it is the
   largest ask on the page and it used to be the first thing anyone saw.

   The stepper is a MAP, not a wizard. No progress state, no completion. Its only
   job is to show that the file they just took is one of twelve, so "there is
   more, and it is all free" is something they can see rather than believe.

   Palette is local to this page on purpose: white and blue with a single gold
   accent, rather than the cream landing tokens. Do not import the landing
   palette back in without changing all of it, or the two will half-blend.
   ──────────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Download, Check, Loader2, ArrowRight, Upload, Lock } from 'lucide-react';
import {
  SYSTEM_STEPS, FREE_QUESTIONS, TOTAL_RESOURCES, CHALLENGE_TO_STEPS,
  findResource, resourcesForStep,
} from '../config/freeResources';
import { trackFreeResourceDownloaded, trackFreeResourceRegistered } from '../lib/analytics';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

/** White and blue, one gold accent. Scoped here, not shared with the landing. */
const C = {
  bg: '#FFFFFF',
  alt: '#F4F8FB',
  deep: '#0F2438',
  onDeep: '#F2F7FB',
  ink: '#0F1E2B',
  ink2: '#4A5A68',
  ink3: '#8496A4',
  line: '#E2EAF1',
  lineStrong: '#C6D4E0',
  blue: '#1857A0',
  blueDark: '#10406F',
  blueTint: '#EAF2F9',
  gold: '#B8863B',
  goldTint: '#FBF3E3',
  danger: '#B4432F',
  good: '#1E8A5F',
  /* The handwriting red. Deliberately not the error red and not the gold: it
     reads as something scrawled on top of the page rather than part of the
     brand, which is exactly the job. Used once, nowhere else. */
  marker: '#D63B26',
};

const DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
const BODY = "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif";

export default function FreeResourcePage() {
  const { slug } = useParams<{ slug: string }>();
  const resource = useMemo(() => findResource(slug), [slug]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [skoolUrl, setSkoolUrl] = useState('');
  // Returned by the registration. Rides on the community link so the click that
  // follows can be stamped against this person on the sales board.
  const [leadId, setLeadId] = useState('');
  const [whenLabel, setWhenLabel] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/session-signup/next`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.startsAt) return;
        const when = new Date(d.startsAt);
        if (Number.isNaN(when.getTime())) return;
        setWhenLabel(when.toLocaleString(undefined, {
          weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
        }));
      })
      .catch(() => {});
  }, []);

  // A mistyped or stale slug. Send them somewhere real rather than a dead end.
  if (!resource) return <Navigate to="/session" replace />;

  const litSteps = CHALLENGE_TO_STEPS[answers.challenge] ?? [];
  const asked = FREE_QUESTIONS.filter((q) => q.required);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev); next.delete(id); return next;
    });
  }

  async function submit() {
    const missing = new Set<string>();
    for (const q of asked) if (!answers[q.id]?.trim()) missing.add(q.id);
    if (!name.trim()) missing.add('name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) missing.add('email');

    if (missing.size) {
      setErrors(missing);
      document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    setServerError('');
    try {
      // Reuses the workshop registration endpoint rather than adding a second
      // pipeline: same people, same room, one roster.
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('email', email.trim().toLowerCase());
      fd.append('answers', JSON.stringify({ ...answers, source_asset: resource!.slug }));
      fd.append('questionSchema', JSON.stringify([
        ...asked.map((q) => ({ id: q.id, label: q.label, type: 'choice' })),
        { id: 'source_asset', label: 'Came in through', type: 'choice' },
      ]));
      // Optional, and the only thing on this page that is. Without it they still
      // attend, they just cannot be sent a diagnostic afterwards.
      if (file) fd.append('resume', file);

      const res = await fetch(`${API_BASE}/session-signup/register`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setServerError(data?.error || 'Something went wrong. Please try again.'); return; }

      trackFreeResourceRegistered(resource!.slug, answers.challenge ?? '');
      setSkoolUrl(data?.skoolUrl || '/community');
      setLeadId(typeof data?.leadId === 'string' ? data.leadId : '');
      setDone(true);
    } catch {
      setServerError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const page: React.CSSProperties = {
    // Fixed height plus internal scroll: the app shell constrains its children,
    // so a page that sets only minHeight is clipped at the fold.
    height: '100vh', overflowY: 'auto',
    background: C.bg, color: C.ink, fontFamily: BODY,
    padding: 'clamp(24px, 5vw, 48px) clamp(16px, 5vw, 28px) 96px',
    boxSizing: 'border-box',
  };
  const shell: React.CSSProperties = {
    maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'clamp(40px, 6vw, 60px)',
  };
  const eyebrow: React.CSSProperties = {
    fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.16em',
    textTransform: 'uppercase', color: C.ink3, margin: 0,
  };
  const h2: React.CSSProperties = {
    fontFamily: DISPLAY, fontWeight: 600, fontSize: 'clamp(1.375rem, 4vw, 1.75rem)',
    letterSpacing: '-0.015em', margin: 0, color: C.ink,
  };
  const inputStyle = (bad: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box', fontFamily: BODY, fontSize: '1rem',
    padding: '13px 15px', borderRadius: 9,
    border: `1.5px solid ${bad ? C.danger : C.lineStrong}`,
    background: C.bg, color: C.ink,
  });

  // ── The payoff ─────────────────────────────────────────────────────────────
  if (done) {
    const base = skoolUrl || '/community';
    const href =
      `${base}${base.includes('?') ? '&' : '?'}src=confirm` +
      (leadId ? `&lead=${encodeURIComponent(leadId)}` : '');
    return (
      <div style={page}>
        <div style={{ ...shell, maxWidth: 620 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 54, height: 54, borderRadius: '50%', background: C.good,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <Check size={27} color="#fff" strokeWidth={2.5} />
            </div>
            <h1 style={{ ...h2, fontSize: 'clamp(1.75rem, 6vw, 2.25rem)', marginBottom: 12 }}>
              You're in{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''}.
            </h1>
            <p style={{ fontSize: '1.0625rem', color: C.ink2, lineHeight: 1.65, margin: 0 }}>
              {whenLabel
                ? `Your seat is saved for ${whenLabel}.`
                : 'Your seat is saved.'}{' '}
              The other {TOTAL_RESOURCES - 1} resources are waiting in the group. Join for free and
              download them from the classroom section. The videos tell you how to use each one and
              why it exists.
            </p>
          </div>

          <div style={{
            background: C.alt, border: `1px solid ${C.line}`, borderRadius: 14,
            padding: 'clamp(20px, 4vw, 26px)', display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <p style={{ ...eyebrow, color: C.blue }}>Get your questions answered</p>
            <p style={{ fontSize: '1rem', color: C.ink, lineHeight: 1.65, margin: 0 }}>
              Drop your question as a comment on this week's webinar post, which is pinned at the
              top of the group. That is how I know what to cover, and I answer them by name.
            </p>
            <p style={{ fontSize: '1rem', color: C.ink, lineHeight: 1.65, margin: 0 }}>
              <b>One question per person.</b> If someone has already asked yours, like theirs
              instead. The most liked questions get answered first, so that is genuinely the
              faster way to get yours in.
            </p>
            <img
              src="/free/skool-community.png"
              alt="The Aussie Grad Careers group, showing the Webinar Questions tab where questions are posted"
              style={{
                width: '100%', maxWidth: '100%', height: 'auto', display: 'block',
                borderRadius: 10, border: `1px solid ${C.line}`,
              }}
            />
          </div>

          <a
            href={href}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: C.blue, color: '#fff', padding: '17px 28px', borderRadius: 11,
              textDecoration: 'none', fontWeight: 650, fontSize: '1.0625rem',
              boxShadow: '0 2px 6px rgba(24,87,160,0.20), 0 10px 26px rgba(24,87,160,0.18)',
            }}
          >
            Join the group and claim all resources
            <ArrowRight size={19} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <style>{`
        .agc-map { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
        .agc-node { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .agc-rail { display: flex; align-items: center; width: 100%; justify-content: center; }
        .agc-line { flex: 1; height: 2px; }
        .agc-line--spacer { visibility: hidden; }
        @media (max-width: 720px) {
          .agc-map { grid-template-columns: 1fr; gap: 20px; }
          .agc-node { text-align: center; }
          .agc-rail { width: auto; }
          .agc-line { display: none; }
        }
        .agc-opt:focus-visible { outline: 2px solid ${C.blue}; outline-offset: 2px; }
      `}</style>

      <div style={shell}>

        {/* ── 1. The asset, handed over before anything is asked ──────────── */}
        <section style={{
          background: C.deep, color: C.onDeep, borderRadius: 18,
          padding: 'clamp(26px, 5vw, 44px)', display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: '0 2px 6px rgba(15,36,56,0.16), 0 22px 60px rgba(15,36,56,0.20)',
        }}>
          <p style={{ ...eyebrow, color: 'rgba(242,247,251,0.55)' }}>Yours, free, right now</p>
          <h1 style={{
            fontFamily: DISPLAY, fontWeight: 600, margin: 0,
            fontSize: 'clamp(1.875rem, 6vw, 2.75rem)', lineHeight: 1.1,
            letterSpacing: '-0.02em', color: C.onDeep,
          }}>
            {resource.name}
          </h1>
          <p style={{ fontSize: '1.0625rem', lineHeight: 1.6, margin: 0, color: 'rgba(242,247,251,0.80)', maxWidth: '34rem' }}>
            {resource.promise}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
            {resource.files.map((f) => (
              <a
                key={f.href}
                href={f.href}
                download
                onClick={() => trackFreeResourceDownloaded(resource.slug, f.label)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: C.gold, color: '#20180A',
                  padding: '15px 24px', borderRadius: 10, textDecoration: 'none',
                  fontWeight: 700, fontSize: '1rem',
                }}
              >
                <Download size={18} />
                {f.label}
              </a>
            ))}
          </div>

          <p style={{
            fontSize: '0.9375rem', lineHeight: 1.65, margin: 0, color: 'rgba(242,247,251,0.76)',
            paddingTop: 18, borderTop: '1px solid rgba(242,247,251,0.18)',
          }}>
            Having the right resume helps, but it is one piece of a much larger puzzle.
            Download all the assets and get the foolproof system to land your first job
            in Australia.
          </p>
        </section>

        {/* ── 2. The map ──────────────────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 26, textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={eyebrow}>The whole system</p>
            {/* "free" is set as an annotation, not as part of the heading: a
                different face, off the baseline, slightly rotated. It reads as
                something added by hand afterwards, which is why it carries more
                weight than the same word set in the heading's own type. */}
            <h2 style={h2}>
              Get the full system{' '}
              <span style={{
                fontFamily: "'Caveat', 'Segoe Script', 'Bradley Hand', cursive",
                color: C.marker, fontWeight: 700,
                fontSize: '1.5em', lineHeight: 0.8,
                display: 'inline-block', transform: 'rotate(-7deg)',
                margin: '0 0 0 6px', verticalAlign: 'baseline',
              }}>
                free
              </span>
            </h2>
          </div>

          <div className="agc-map">
            {SYSTEM_STEPS.map((step, i) => {
              const isAssetStep = step.n === resource.step;
              const isLit = isAssetStep || litSteps.includes(step.n);
              return (
                <div className="agc-node" key={step.n}>
                  <div className="agc-rail">
                    {/* Spacers keep every dot on the same axis, so the rail reads
                        as one continuous line rather than five staggered ones. */}
                    <span className={`agc-line ${i === 0 ? 'agc-line--spacer' : ''}`}
                          style={{ background: C.line }} />
                    <span style={{
                      width: 30, height: 30, borderRadius: '50%', flex: '0 0 auto',
                      background: isLit ? C.blue : C.bg,
                      border: `2px solid ${isLit ? C.blue : C.lineStrong}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8125rem', fontWeight: 700,
                      color: isLit ? '#fff' : C.ink3,
                    }}>{step.n}</span>
                    <span className={`agc-line ${i === SYSTEM_STEPS.length - 1 ? 'agc-line--spacer' : ''}`}
                          style={{ background: C.line }} />
                  </div>

                  <div style={{ paddingTop: 12, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.35,
                      color: isLit ? C.ink : C.ink3,
                    }}>{step.title}</p>
                    <p style={{
                      margin: '6px 0 0', fontSize: '0.75rem', lineHeight: 1.5,
                      color: C.ink3,
                    }}>{step.blurb}</p>

                    <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {resourcesForStep(step.n).map((r) => {
                        const isThisOne = r.slug === resource.slug;
                        return (
                          <li key={r.slug} style={{
                            fontSize: '0.75rem', lineHeight: 1.4,
                            color: isThisOne ? C.blue : C.ink3,
                            fontWeight: isThisOne ? 700 : 400,
                            opacity: isThisOne ? 1 : 0.55,
                          }}>
                            {r.name}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3. The ask ──────────────────────────────────────────────────── */}
        <section style={{
          background: C.alt, border: `1px solid ${C.line}`, borderRadius: 16,
          padding: 'clamp(24px, 4vw, 34px)', display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <h2 style={h2}>The reality of getting hired in Australia as a migrant</h2>
          <p style={{ fontSize: '1.0625rem', color: C.ink2, lineHeight: 1.7, margin: 0 }}>
            You have reworked your resume a thousand times, applied for everything, and followed
            every piece of advice you were given. None of it moved.
          </p>
          <p style={{ fontSize: '1.0625rem', color: C.ink2, lineHeight: 1.7, margin: 0 }}>
            I have been exactly where you are, and I built a system out of getting myself out of
            it. It is tried, it is tested, and all of it is free.
          </p>
          <p style={{ fontSize: '1.0625rem', color: C.ink, lineHeight: 1.7, margin: 0, fontWeight: 600 }}>
            So how badly do you want this, and are you willing to commit?
          </p>
          <p style={{ fontSize: '1.0625rem', color: C.ink2, lineHeight: 1.7, margin: 0 }}>
            The resources you already have are yours to keep. Join me in the group to see how to
            use them, and come to the weekly webinar where I go through the biggest gaps people in
            your exact situation are making, and how to close them.
          </p>
          <p style={{
            fontSize: '1rem', color: C.ink, lineHeight: 1.65, margin: 0,
            borderLeft: `3px solid ${C.gold}`, paddingLeft: 15,
          }}>
            Send your resume through with the questions below and I will look at it before the
            call, so what I cover is about you rather than about everyone.
          </p>
        </section>

        {/* ── 4. The questions ────────────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {asked.map((q) => (
            <div key={q.id} data-error={errors.has(q.id)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: '1rem', fontWeight: 650, lineHeight: 1.4, display: 'block', color: C.ink }}>
                  {q.label}
                </label>
                {q.help && (
                  <p style={{ fontSize: '0.8125rem', color: C.ink3, margin: '3px 0 0', lineHeight: 1.5 }}>
                    {q.help}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {q.options!.map((opt) => {
                  const selected = answers[q.id] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      className="agc-opt"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAnswer(q.id, opt)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        fontFamily: BODY, fontSize: '0.875rem', textAlign: 'left',
                        padding: '9px 14px', borderRadius: 999, cursor: 'pointer',
                        lineHeight: 1.35,
                        border: `1.5px solid ${selected ? C.blue : errors.has(q.id) ? C.danger : C.lineStrong}`,
                        background: selected ? C.blueTint : C.bg,
                        color: selected ? C.blueDark : C.ink2,
                        fontWeight: selected ? 650 : 400,
                      }}
                    >
                      <span style={{
                        width: 13, height: 13, borderRadius: '50%', flex: '0 0 auto',
                        border: `1.5px solid ${selected ? C.blue : C.lineStrong}`,
                        background: selected ? C.blue : 'transparent',
                        boxShadow: selected ? `inset 0 0 0 2.5px ${C.bg}` : 'none',
                      }} />
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* The one question that is deliberately not asked here.
              Asking it in the group is what fills the pinned webinar post, and
              that post is what decides the running order of the call. Moving it
              off this page is the point, not an oversight. */}
          <div style={{
            position: 'relative', borderRadius: 12, overflow: 'hidden',
            border: `1.5px dashed ${C.lineStrong}`, background: C.alt,
            padding: '16px 18px',
          }}>
            <label style={{ fontSize: '1rem', fontWeight: 650, color: C.ink3, display: 'block' }}>
              If you get one thing answered on the call, what is it?
            </label>
            <p style={{
              fontSize: '0.9375rem', color: C.ink3, margin: '10px 0 0', lineHeight: 1.5,
              fontStyle: 'italic',
            }}>
              e.g. is my visa actually the reason I'm getting rejected?
            </p>
            <p style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              margin: '14px 0 0', fontSize: '0.8125rem', fontWeight: 700,
              color: C.gold, background: C.goldTint, borderRadius: 999, padding: '6px 13px',
            }}>
              <Lock size={13} />
              Ask this inside the free group
            </p>
          </div>

          {/* Resume. The largest ask on the page, so it is the last thing on it. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: '1rem', fontWeight: 650, color: C.ink, display: 'block' }}>
                Your resume <span style={{ color: C.ink3, fontWeight: 400 }}>(optional)</span>
              </label>
              <p style={{ fontSize: '0.8125rem', color: C.ink3, margin: '3px 0 0', lineHeight: 1.5 }}>
                Send it and I will read it before the call, then send you your own breakdown
                afterwards. Skip it and you still get everything else.
              </p>
            </div>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '16px', borderRadius: 10, cursor: 'pointer',
              border: `1.5px dashed ${file ? C.good : C.lineStrong}`,
              background: file ? 'rgba(30,138,95,0.06)' : C.bg,
              color: file ? C.good : C.ink2, fontSize: '0.9375rem', fontWeight: 500,
            }}>
              {file ? <Check size={17} /> : <Upload size={17} />}
              {file ? file.name : 'Upload your resume (PDF, DOCX or TXT)'}
              <input
                type="file"
                accept=".pdf,.docx,.doc,.txt"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div data-error={errors.has('name')} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <label style={{ fontSize: '1rem', fontWeight: 650, color: C.ink }}>Your first name</label>
            <input
              style={inputStyle(errors.has('name'))}
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = new Set(p); n.delete('name'); return n; }); }}
              placeholder="What should I call you on the call?"
              autoComplete="given-name"
            />
          </div>

          <div data-error={errors.has('email')} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <label style={{ fontSize: '1rem', fontWeight: 650, color: C.ink }}>Email</label>
            <input
              style={inputStyle(errors.has('email'))}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => { const n = new Set(p); n.delete('email'); return n; }); }}
              placeholder="you@email.com"
              type="email"
              autoComplete="email"
            />
            <p style={{ fontSize: '0.8125rem', color: C.ink3, margin: 0, lineHeight: 1.5 }}>
              Where the call link goes. Use the one you actually check.
            </p>
          </div>

          {serverError && (
            <p style={{
              fontSize: '0.9375rem', color: C.danger, background: 'rgba(180,67,47,0.07)',
              padding: '12px 14px', borderRadius: 10, margin: 0, lineHeight: 1.5,
            }}>
              {serverError}
            </p>
          )}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            style={{
              width: '100%', background: C.blue, color: '#fff',
              padding: '17px 32px', borderRadius: 11, border: 'none',
              fontWeight: 650, fontSize: '1.0625rem', fontFamily: BODY,
              cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              boxShadow: '0 2px 6px rgba(24,87,160,0.20), 0 10px 26px rgba(24,87,160,0.18)',
            }}
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            {submitting ? 'Saving…' : 'I want access to the system + free webinar'}
          </button>
        </section>

      </div>
    </div>
  );
}
