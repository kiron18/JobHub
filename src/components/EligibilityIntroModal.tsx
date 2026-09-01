/**
 * Shown once per account, on the first dashboard load after signing up.
 *
 * They have just watched us rebuild their resume, so the one thing they believe
 * right now is that the document was the problem. This is the only moment where
 * telling them it was not lands as good news rather than as a correction, which
 * is why it interrupts instead of sitting on the page as a card.
 *
 * One instruction, one picture, one button. It carried a six-second animation
 * of the whole select-copy-paste-answer mechanic, which taught that well and
 * took the eye off the sentence that has to land. The mechanic is learned in
 * five seconds on the screen behind this anyway.
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
import { X, ArrowRight } from 'lucide-react';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { type as landingType } from './landing/tokens';

const C = warm.colors;
const EASE = [0.25, 1, 0.5, 1] as const;

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

            <h2 style={{
              margin: '0 0 10px', fontFamily: landingType.display, fontSize: 'clamp(23px, 4.4vw, 30px)',
              fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: C.textPrimary,
            }}>
              Almost there
            </h2>

            <p style={{ margin: '0 0 22px', fontSize: 15, lineHeight: 1.6, color: C.textSecondary }}>
              Copy and paste any job in the box and see how your profile matches it. Apply for
              roles that match your profile and get more call backs.
            </p>

            <JourneyTrack />

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

/* ─── What the next screen looks like ─────────────────────────────────────── */

/**
 * A still, not a loop.
 *
 * This used to be a six-second four-beat animation: select the ad, copy, paste,
 * answer. It taught the mechanic well and cost the reader the point of the
 * modal, because a moving picture is where the eye goes and the sentence above
 * it is the thing that actually has to land. The instruction is one line of copy
 * now, and the picture only has to say where this sits in the journey.
 *
 * The composited artwork: the track at its last step, with a sample job match
 * card sitting over it. Cropped to the drawing rather than the artboard.
 */
function JourneyTrack() {
  return (
    <div style={{
      borderRadius: warm.radius.card, overflow: 'hidden',
      background: '#fff', border: `1px solid ${C.borderWhisper}`,
      aspectRatio: '1920 / 780',
    }}>
      <img
        src="/Assets/journey/step-4-with-result.png"
        alt="Your progress: four of five steps done, with a sample job match"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 10%', display: 'block' }}
      />
    </div>
  );
}
