/**
 * Shown once per account, on the first dashboard load after signing up.
 *
 * They have just watched us rebuild their resume, so the one thing they believe
 * right now is that the document was the problem. This is the only moment where
 * telling them it was not lands as good news rather than as a correction, which
 * is why it interrupts instead of sitting on the page as a card.
 *
 * The animation carries the instruction, not the copy. "Copy the job ad" is a
 * sentence people agree with and then get wrong, because the real question is
 * how much of the ad, and no wording answers that as fast as watching a
 * selection sweep the whole thing. Six seconds, looping, four beats: select,
 * copy, paste, answer.
 *
 * No claim about outcomes is made anywhere here. We cannot measure "increases
 * your chances of getting hired", so it says what the tool actually does, which
 * is give them a straight answer before they spend the evening on an
 * application. Same rule as FirstApplicationCelebration: no invented stats.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ArrowRight, Check, Clipboard } from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { SeekMock } from './strategy/HowToCopyJobAd';

const C = warm.colors;
const EASE = [0.25, 1, 0.5, 1] as const;

/**
 * Four beats to six seconds exactly. Selecting is the beat that teaches, so it
 * gets the most room; the answer holds longest because it is the payoff and a
 * card that flicks away before it is read teaches nothing.
 */
const BEATS = [2200, 900, 1400, 1500] as const;

/**
 * Tall enough to hold the ad's title, employer and details, which is the whole
 * lesson, and short enough that the modal still fits a laptop. The rest of the
 * mock runs on below the fold behind a fade.
 */
const STAGE_H = 218;
const CAPTIONS = [
  'Start at the title, not the description',
  'Copy it',
  'Paste it here',
  'Get a straight answer',
] as const;

export function EligibilityIntroModal() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  /*
   * The trigger is the ACCOUNT, not the browser and not the route.
   *
   * This used to hang off history state (`justOnboarded`) plus a localStorage
   * lock, which meant the modal was gone the moment either was lost: a refresh,
   * a redirect that dropped the state, a second device, a cleared browser. It
   * also meant "seen" was a fact about a machine when the thing it describes is
   * a fact about a person who just signed up.
   *
   * So it reads one field on the profile. Null means this signup has never been
   * shown it, and that is true on every device until they dismiss it once. The
   * migration backfilled everyone who existed before this shipped, so only new
   * signups meet it. `?intro=1` forces it open for a look without signing up
   * again, and deliberately does not consume the stamp.
   */
  const { data: profile } = useQuery<{ eligibilityIntroSeenAt?: string | null } | null>({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/profile')).data,
    staleTime: 5 * 60 * 1000,
  });

  const forced = new URLSearchParams(location.search).get('intro') === '1';
  const unseen = !!profile && !profile.eligibilityIntroSeenAt;

  useEffect(() => {
    if (forced || unseen) setOpen(true);
  }, [forced, unseen]);

  /**
   * Closing is what "seen" means, so this is where the stamp is spent.
   *
   * The cache is updated first so the modal cannot flash back while the request
   * is in flight, and a failed request is swallowed on purpose: showing this
   * twice is a far smaller cost than blocking someone behind an error toast for
   * a modal. The next GET /profile settles the truth either way.
   */
  function dismiss() {
    setOpen(false);
    if (forced) return;
    queryClient.setQueryData(['profile'], (old: any) =>
      old ? { ...old, eligibilityIntroSeenAt: new Date().toISOString() } : old);
    api.post('/profile/eligibility-intro-seen').catch(() => { /* see above */ });
  }

  const close = dismiss;

  /**
   * Close, and put them in the box that is already on this page.
   *
   * This used to navigate to /check. That was wrong: the eligibility check is
   * the first step of one flow that lives on the dashboard — check, generate the
   * resume, the cover letter, the selection criteria, download, follow up — and
   * sending someone to a separate screen for step one breaks the sequence and
   * hides the "Browse jobs" button that sits beside the box.
   *
   * The textarea is found by the data-process-step hook it already carries, so
   * this does not need a ref threaded through the dashboard.
   */
  function goCheck() {
    dismiss();
    window.setTimeout(() => {
      const box = document.querySelector<HTMLTextAreaElement>('[data-process-step="paste"]');
      if (!box) return;
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      box.focus({ preventScroll: true });
    }, 260);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(15,32,56,0.66)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, overflowY: 'auto',
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.35, ease: EASE }}
            role="dialog"
            aria-modal="true"
            aria-label="Check a job before you apply"
            style={{
              position: 'relative', width: '100%', maxWidth: 560, margin: 'auto',
              background: C.bgSurface,
              border: `1px solid ${C.borderDefined}`,
              borderRadius: 22,
              padding: 'clamp(28px, 5vw, 38px) clamp(22px, 4vw, 34px) clamp(24px, 4vw, 30px)',
              boxShadow: warm.shadow.lifted,
            }}
          >
            <button
              onClick={close}
              aria-label="Dismiss"
              style={{
                position: 'absolute', top: 14, right: 14,
                background: 'none', border: 'none', color: C.textMuted,
                cursor: 'pointer', padding: 8, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.bgAlt; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={16} />
            </button>

            <p style={{
              margin: '0 0 10px', fontSize: 11, fontWeight: 800,
              letterSpacing: '0.16em', textTransform: 'uppercase', color: C.accentPetrol,
            }}>
              One last thing
            </p>

            <h2 style={{
              margin: '0 0 10px', fontSize: 'clamp(21px, 4.2vw, 27px)', fontWeight: 800,
              letterSpacing: '-0.02em', lineHeight: 1.22, color: C.textPrimary,
            }}>
              Your resume is no longer what is holding you back
            </h2>

            <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.6, color: C.textSecondary }}>
              But applying for jobs you are not eligible for will lead to certain rejection.
            </p>
            <p style={{ margin: '0 0 22px', fontSize: 15, lineHeight: 1.6, color: C.textSecondary }}>
              Paste any job into the text box to check your eligibility, free.
            </p>

            <HowItWorks />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 24, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={goCheck}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 9,
                  padding: '13px 24px', background: C.accentPetrol, color: C.textOnDeep,
                  border: 'none', borderRadius: warm.radius.button,
                  fontSize: 15.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(16,24,40,0.06), 0 6px 18px rgba(18,87,196,0.20)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.accentPetrolHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.accentPetrol; }}
              >
                Check a job now <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── The six-second loop ─────────────────────────────────────────────────── */

/**
 * Four beats to six seconds: select, copy, paste, answer.
 *
 * The select and copy beats are the tutorial's own SeekMock, imported rather
 * than reimplemented. It draws a real browser Selection over a real Seek
 * imitation, which is why the highlight hugs each line and ends ragged where
 * the line ends, and it already carries the lesson that matters: start at the
 * job title, because the employer's name sits under it and a selection that
 * begins at the description leaves it behind. A second, worse mock of the same
 * thing would drift from this one the first time either changed.
 *
 * The mock is taller than a modal should be, so it sits in a clipped window
 * with the fold faded out. What stays on show is the part being taught.
 */
function HowItWorks() {
  const reduced = usePrefersReducedMotion();
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    if (reduced) { setBeat(3); return; }
    const id = window.setTimeout(() => setBeat((b) => (b + 1) % BEATS.length), BEATS[beat]);
    return () => window.clearTimeout(id);
  }, [beat, reduced]);

  const onAd = beat < 2;

  return (
    <div style={{
      border: `1px solid ${C.borderWhisper}`, borderRadius: warm.radius.card,
      background: C.bgAlt, padding: '14px 14px 11px',
    }}>
      <div style={{ position: 'relative', height: STAGE_H, borderRadius: 8, overflow: 'hidden' }}>
        {/* Mounted across beats 0 and 1 together, so changing beat does not
            restart the drag. It unmounts on the paste beat, which is what makes
            it begin again from the title on the next time round. */}
        {onAd ? (
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <SeekMock dragMs={BEATS[0]} holdMs={BEATS[1] + 400} resetMs={200} />
            <div style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, height: 52,
              background: `linear-gradient(to bottom, rgba(245,247,250,0), ${C.bgAlt})`,
              pointerEvents: 'none',
            }} />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={beat}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.26, ease: EASE }}
              style={{ position: 'absolute', inset: 0 }}
            >
              {beat === 2 ? <PasteStage /> : <ResultStage />}
            </motion.div>
          </AnimatePresence>
        )}

        {/* The two overlays, centred on the stage. They mark the two moments the
            viewer has to perform themselves, so they belong in the middle of
            what is being looked at rather than tucked into a corner. */}
        <AnimatePresence>
          {(beat === 1 || beat === 2) && (
            <motion.div
              key={beat === 1 ? 'copied' : 'pasted'}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.24, ease: EASE, delay: beat === 2 ? 0.45 : 0 }}
              style={{
                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 999,
                background: C.bgDeep, color: C.textOnDeep,
                fontSize: 13.5, fontWeight: 700,
                boxShadow: '0 6px 22px rgba(15,32,56,0.28)',
              }}>
                <Clipboard size={14} /> {beat === 1 ? 'Copied' : 'Pasted'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {BEATS.map((_, i) => (
            <span key={i} style={{
              width: i === beat ? 16 : 5, height: 5, borderRadius: 999,
              background: i === beat ? C.accentPetrol : C.borderDefined,
              transition: 'width 220ms ease, background 220ms ease',
            }} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={beat}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ fontSize: 12.5, fontWeight: 600, color: C.textSecondary }}
          >
            {CAPTIONS[beat]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Beat 3: the paste box, with the ad actually in it.
 *
 * The text is the SeekMock's own copy, so what lands in the box is visibly the
 * same thing that was just selected, title and employer included. It arrives in
 * one go rather than typing itself in, because that is what pasting looks like.
 */
function PasteStage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        flex: 1, minHeight: 0, background: C.bgSurface,
        border: `1.5px solid ${C.accentPetrol}`, borderRadius: 10,
        padding: '11px 12px', overflow: 'hidden',
      }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, delay: 0.3 }}
          style={{ fontSize: 10, lineHeight: 1.55, color: C.textSecondary }}
        >
          <p style={{ margin: '0 0 5px', fontWeight: 800, color: C.textPrimary, textTransform: 'uppercase' }}>
            Job Title
          </p>
          <p style={{ margin: '0 0 5px' }}>Company Name</p>
          <p style={{ margin: '0 0 5px' }}>Suburb, City STATE · Work Type · $00,000 - $00,000 per year</p>
          <p style={{ margin: 0 }}>
            This is the first paragraph of the job description. It explains what the role is
            and who the employer is looking for. This is the second paragraph. It describes
            the team, who you would report to, and what a typical week looks like.
          </p>
        </motion.div>
      </div>
      <div style={{
        alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '8px 15px', borderRadius: warm.radius.button,
        background: C.accentPetrol, color: C.textOnDeep, fontSize: 12.5, fontWeight: 700,
      }}>
        Find out <ArrowRight size={13} />
      </div>
    </div>
  );
}

/** Beat 4: the answer, in the shape the real report gives it. */
function ResultStage() {
  return (
    <div style={{
      height: '100%', background: C.bgSurface, border: `1px solid ${C.borderWhisper}`,
      borderRadius: 10, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 999,
          background: 'rgba(18,128,92,0.10)', color: C.success,
          fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          <Check size={11} strokeWidth={3} /> Worth applying
        </span>
        <span style={{ fontSize: 11.5, color: C.textMuted }}>Job Title, Company Name</span>
      </div>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: C.textPrimary }}>
        You cover the experience and the credential they ask for. One gap, and it is one
        you can answer in the cover letter.
      </p>

      <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
        <Column heading="You have" tone={C.success} items={['Four years in the field', 'The licence the ad names']} />
        <Column heading="Missing" tone={C.accentGold} items={['One software package they list']} />
      </div>
    </div>
  );
}

function Column({ heading, tone, items }: { heading: string; tone: string; items: string[] }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{
        margin: '0 0 5px', fontSize: 9.5, fontWeight: 800,
        letterSpacing: '0.1em', textTransform: 'uppercase', color: tone,
      }}>
        {heading}
      </p>
      {items.map((it, i) => (
        <p key={i} style={{ margin: '0 0 3px', fontSize: 11, lineHeight: 1.4, color: C.textSecondary }}>
          {it}
        </p>
      ))}
    </div>
  );
}

/** Honours the OS "reduce motion" setting, and keeps honouring it if it changes. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
