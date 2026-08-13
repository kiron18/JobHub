/* ────────────────────────────────────────────────────────────────────────────
   FreeResourcePage — /free/:slug

   The lead magnet page, one per asset, all driven from src/config/freeResources.

   The order of this page is the whole idea. The asset is handed over FIRST, with
   nothing asked for it: no email, no account, no form. Only after they have
   received something does the page show them the map, and only after the map
   does it ask anything at all.

   The previous version of this funnel opened with a resume upload and six
   questions before giving anything, which is an enormous ask of someone who
   clicked a link for one free file. Everything below is arranged so that every
   ask is smaller than the give that preceded it.

   The stepper is a MAP, not a wizard. It carries no progress state and no
   completion. Its only job is to show that the file they just downloaded is one
   of eleven, so that "there is more, and it is all free" is something they can
   see rather than something they have to believe.
   ──────────────────────────────────────────────────────────────────────────── */
import { useEffect, useMemo, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Download, Check, Loader2, ArrowRight } from 'lucide-react';
import { colors, type as typeTokens } from '../components/landing/tokens';
import {
  SYSTEM_STEPS, FREE_QUESTIONS, TOTAL_RESOURCES, CHALLENGE_TO_STEPS,
  findResource, resourcesForStep,
} from '../config/freeResources';
import { trackFreeResourceDownloaded, trackFreeResourceRegistered } from '../lib/analytics';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

export default function FreeResourcePage() {
  const { slug } = useParams<{ slug: string }>();
  const resource = useMemo(() => findResource(slug), [slug]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [skoolUrl, setSkoolUrl] = useState('');
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

  // An unknown slug is a mistyped or stale link. Send them to the registration
  // page rather than showing a dead end, since they clearly meant to be here.
  if (!resource) return <Navigate to="/session" replace />;

  /** Which steps the reader's own answer just pointed at. */
  const litSteps = CHALLENGE_TO_STEPS[answers.challenge] ?? [];

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev); next.delete(id); return next;
    });
  }

  async function submit() {
    const missing = new Set<string>();
    for (const q of FREE_QUESTIONS) {
      if (q.required && !answers[q.id]?.trim()) missing.add(q.id);
    }
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
      // pipeline: these are the same people, headed for the same room, and the
      // roster has to be one list. The resume is deliberately absent here and
      // asked for later, once they have received far more than they have given.
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('email', email.trim().toLowerCase());
      fd.append('answers', JSON.stringify({ ...answers, source_asset: resource!.slug }));
      fd.append('questionSchema', JSON.stringify([
        ...FREE_QUESTIONS.map((q) => ({ id: q.id, label: q.label, type: q.text ? 'text' : 'choice' })),
        { id: 'source_asset', label: 'Came in through', type: 'choice' },
      ]));

      const res = await fetch(`${API_BASE}/session-signup/register`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setServerError(data?.error || 'Something went wrong. Please try again.'); return; }

      trackFreeResourceRegistered(resource!.slug, answers.challenge ?? '');
      setSkoolUrl(data?.skoolUrl || '/community');
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setServerError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Shared style objects ───────────────────────────────────────────────────
  const page: React.CSSProperties = {
    // Fixed height plus internal scroll: the app shell constrains its children,
    // so a page that only sets minHeight is clipped at the fold.
    height: '100vh', overflowY: 'auto',
    background: colors.bgCanvas, color: colors.textPrimary,
    fontFamily: typeTokens.body, padding: 'clamp(24px, 5vw, 48px) clamp(16px, 5vw, 28px) 96px',
    boxSizing: 'border-box',
  };
  const shell: React.CSSProperties = {
    maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'clamp(36px, 6vw, 56px)',
  };
  const eyebrow: React.CSSProperties = {
    fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.16em',
    textTransform: 'uppercase', color: colors.textMuted, margin: 0,
  };
  const h2: React.CSSProperties = {
    fontFamily: typeTokens.display, fontWeight: 600,
    fontSize: 'clamp(1.375rem, 4vw, 1.75rem)', letterSpacing: '-0.015em', margin: 0,
  };
  const inputStyle = (bad: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box', fontFamily: typeTokens.body, fontSize: '1rem',
    padding: '14px 15px', borderRadius: 10,
    border: `1.5px solid ${bad ? '#B4432F' : colors.borderDefined}`,
    background: colors.bgSurface, color: colors.textPrimary,
  });

  // ── The payoff ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={page}>
        <div style={{ ...shell, textAlign: 'center', maxWidth: 560 }}>
          <div>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: colors.success,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
            }}>
              <Check size={28} color="#fff" strokeWidth={2.5} />
            </div>
            <h1 style={{ ...h2, fontSize: 'clamp(1.75rem, 6vw, 2.25rem)', marginBottom: 12 }}>
              You're in{name.trim() ? `, ${name.trim().split(/\s+/)[0]}` : ''}.
            </h1>
            <p style={{ fontSize: '1.0625rem', color: colors.textSecondary, lineHeight: 1.6, margin: 0 }}>
              {whenLabel
                ? `Your seat is saved for ${whenLabel}. The other ${TOTAL_RESOURCES - 1} resources are waiting in the group.`
                : `Your seat is saved. The other ${TOTAL_RESOURCES - 1} resources are waiting in the group.`}
            </p>
          </div>
          <a
            href={`${skoolUrl || '/community'}${(skoolUrl || '').includes('?') ? '&' : '?'}src=confirm`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: colors.accentPetrol, color: colors.textOnDeep,
              padding: '17px 28px', borderRadius: 12, textDecoration: 'none',
              fontWeight: 650, fontSize: '1.0625rem',
              boxShadow: '0 2px 6px rgba(45,90,110,0.22), 0 10px 26px rgba(45,90,110,0.20)',
            }}
          >
            Open the group and get all {TOTAL_RESOURCES}
            <ArrowRight size={19} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      {/* Scoped so the map can stack on a phone. Everything else on this page is
          inline-styled like the rest of the app; this needs a media query. */}
      <style>{`
        .agc-map { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
        .agc-map-node { display: flex; flex-direction: column; align-items: center; text-align: center; }
        .agc-map-rail { display: flex; align-items: center; width: 100%; }
        @media (max-width: 700px) {
          .agc-map { grid-template-columns: 1fr; gap: 22px; }
          .agc-map-node { flex-direction: row; align-items: flex-start; text-align: left; gap: 14px; }
          .agc-map-rail { width: auto; flex-direction: column; align-self: stretch; }
          .agc-map-line { width: 2px !important; height: auto !important; flex: 1; min-height: 18px; }
          .agc-map-body { padding-bottom: 4px; }
        }
      `}</style>

      <div style={shell}>

        {/* ── 1. The asset, handed over before anything is asked ──────────── */}
        <section style={{
          background: colors.bgDeep, color: colors.textOnDeep, borderRadius: 18,
          padding: 'clamp(26px, 5vw, 44px)', display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: '0 2px 4px rgba(26,24,20,0.08), 0 20px 56px rgba(26,24,20,0.14)',
        }}>
          <p style={{ ...eyebrow, color: 'rgba(250,247,242,0.55)' }}>Yours, free, right now</p>
          <h1 style={{
            fontFamily: typeTokens.display, fontWeight: 600, margin: 0,
            fontSize: 'clamp(1.875rem, 6vw, 2.75rem)', lineHeight: 1.1,
            letterSpacing: '-0.02em', color: colors.textOnDeep,
          }}>
            {resource.name}
          </h1>
          <p style={{ fontSize: '1.0625rem', lineHeight: 1.6, margin: 0, color: 'rgba(250,247,242,0.78)', maxWidth: '34rem' }}>
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
                  background: colors.textOnDeep, color: colors.bgDeep,
                  padding: '15px 24px', borderRadius: 11, textDecoration: 'none',
                  fontWeight: 650, fontSize: '1rem',
                }}
              >
                <Download size={18} />
                {f.label}
              </a>
            ))}
          </div>

          <p style={{
            fontSize: '0.9375rem', lineHeight: 1.6, margin: 0, color: 'rgba(250,247,242,0.72)',
            paddingTop: 18, borderTop: '1px solid rgba(250,247,242,0.16)',
          }}>
            No email needed, it is already downloading. But this is one piece of{' '}
            {TOTAL_RESOURCES}, and on its own it fixes one stage of a five stage
            problem. The whole set is free too. Keep reading.
          </p>
        </section>

        {/* ── 2. The map ──────────────────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={eyebrow}>The whole system</p>
            <h2 style={h2}>Get the full system</h2>
          </div>

          <div className="agc-map">
            {SYSTEM_STEPS.map((step, i) => {
              const isAssetStep = step.n === resource.step;
              const isLit = isAssetStep || litSteps.includes(step.n);
              const dot = isLit ? colors.accentPetrol : colors.borderDefined;
              return (
                <div className="agc-map-node" key={step.n}>
                  <div className="agc-map-rail">
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', flex: '0 0 auto',
                      background: isLit ? dot : colors.bgAlt,
                      border: `2px solid ${dot}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700,
                      color: isLit ? colors.textOnDeep : colors.textMuted,
                    }}>{step.n}</span>
                    {i < SYSTEM_STEPS.length - 1 && (
                      <span className="agc-map-line" style={{
                        flex: 1, height: 2, background: colors.borderDefined,
                      }} />
                    )}
                  </div>

                  <div className="agc-map-body" style={{ paddingTop: 10, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.35,
                      color: isLit ? colors.textPrimary : colors.textMuted,
                    }}>{step.title}</p>

                    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {resourcesForStep(step.n).map((r) => {
                        const isThisOne = r.slug === resource.slug;
                        return (
                          <li key={r.slug} style={{
                            fontSize: '0.75rem', lineHeight: 1.4,
                            color: isThisOne ? colors.accentPetrol : colors.textMuted,
                            fontWeight: isThisOne ? 700 : 400,
                            opacity: isThisOne ? 1 : 0.62,
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
          background: colors.bgSurface, border: `1px solid ${colors.borderWhisper}`,
          borderRadius: 16, padding: 'clamp(24px, 4vw, 34px)',
          display: 'flex', flexDirection: 'column', gap: 14,
          boxShadow: '0 1px 2px rgba(26,24,20,0.05), 0 10px 32px rgba(26,24,20,0.055)',
        }}>
          <h2 style={h2}>Take the other {TOTAL_RESOURCES - 1} as well.</h2>
          <p style={{ fontSize: '1.0625rem', color: colors.textSecondary, lineHeight: 1.65, margin: 0 }}>
            All {TOTAL_RESOURCES} live in the free group, along with a live call where I go
            through the biggest gaps in your resume and exactly how to close them.
            You also get the members-only material that never goes public.
          </p>
          <p style={{ fontSize: '1.0625rem', color: colors.textPrimary, lineHeight: 1.65, margin: 0, fontWeight: 600 }}>
            Four questions and you're in. No payment, ever, for any of this.
          </p>
        </section>

        {/* ── 4. The questions ────────────────────────────────────────────── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
          {FREE_QUESTIONS.map((q) => (
            <div key={q.id} data-error={errors.has(q.id)} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <label style={{ fontSize: '1.0625rem', fontWeight: 600, lineHeight: 1.4, display: 'block' }}>
                  {q.label}
                  {!q.required && <span style={{ color: colors.textMuted, fontWeight: 400 }}> (optional)</span>}
                </label>
                {q.help && (
                  <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: '4px 0 0', lineHeight: 1.5 }}>
                    {q.help}
                  </p>
                )}
              </div>

              {q.text ? (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  placeholder="e.g. is my visa actually the reason I'm getting rejected?"
                  style={{ ...inputStyle(false), minHeight: 84, resize: 'vertical', lineHeight: 1.5 }}
                />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
                  {q.options!.map((opt) => {
                    const selected = answers[q.id] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(q.id, opt)}
                        style={{
                          fontFamily: typeTokens.body, fontSize: '0.9375rem', textAlign: 'left',
                          padding: '12px 17px', borderRadius: 10, cursor: 'pointer',
                          minHeight: 44, lineHeight: 1.4,
                          border: `1.5px solid ${selected ? colors.accentPetrol : errors.has(q.id) ? '#B4432F' : colors.borderDefined}`,
                          background: selected ? colors.accentPetrol : colors.bgSurface,
                          color: selected ? colors.textOnDeep : colors.textPrimary,
                          fontWeight: selected ? 600 : 400,
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <div data-error={errors.has('name')} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <label style={{ fontSize: '1.0625rem', fontWeight: 600 }}>Your first name</label>
            <input
              style={inputStyle(errors.has('name'))}
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = new Set(p); n.delete('name'); return n; }); }}
              placeholder="What should I call you on the call?"
              autoComplete="given-name"
            />
          </div>

          <div data-error={errors.has('email')} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <label style={{ fontSize: '1.0625rem', fontWeight: 600 }}>Email</label>
            <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: '-6px 0 0', lineHeight: 1.5 }}>
              Where the call link goes. Use the one you actually check.
            </p>
            <input
              style={inputStyle(errors.has('email'))}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => { const n = new Set(p); n.delete('email'); return n; }); }}
              placeholder="you@email.com"
              type="email"
              autoComplete="email"
            />
          </div>

          {serverError && (
            <p style={{
              fontSize: '0.9375rem', color: '#B4432F', background: 'rgba(180,67,47,0.07)',
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
              width: '100%', background: colors.accentPetrol, color: colors.textOnDeep,
              padding: '17px 32px', borderRadius: 12, border: 'none',
              fontWeight: 650, fontSize: '1.0625rem', fontFamily: typeTokens.body,
              cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              boxShadow: '0 2px 6px rgba(45,90,110,0.22), 0 10px 26px rgba(45,90,110,0.20)',
            }}
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            {submitting ? 'Saving…' : `Send me all ${TOTAL_RESOURCES} and save my seat`}
          </button>
        </section>

      </div>
    </div>
  );
}
