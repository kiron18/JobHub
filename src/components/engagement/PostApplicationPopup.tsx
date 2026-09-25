import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Check, X as XIcon, Hand } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, SPRING, prefersReducedMotion } from '../../lib/theme/motion';
import { haptic } from '../../lib/feedback';
import { applauseFor } from '../../lib/applause';
import { pickQuizQuestion, type QuizQuestion } from '../../lib/engagementContent';

/* ── PostApplicationPopup ──────────────────────────────────────────────
   THE popup. One per filed application, and the only thing that fires at
   that moment — it replaces the sidebar pill (components/shared/
   Celebration.tsx) rather than appearing alongside it, because the whole
   point of this pass was to stop three things competing for the eye.

   The congratulation half is not new copy: applause.ts already holds the
   sixty tiered lines (push / standard at five / bonus / enough / stop)
   with a no-repeat window, and this reads from it. The second half is the
   quick quiz, which only ever appears here — it has no meaning as a card
   floating on the dashboard with nothing around it.

   Click anywhere to dismiss, including the backdrop and the card itself.
   Answering the quiz is optional and never blocks the dismiss: the moment
   belongs to the application that was just filed, not to the question.

   Note for whoever changes this next: Celebration.tsx's header argues the
   opposite case — that a full-stop moment becomes a toll gate by the
   tenth application of the day. That concern is real and the answer here
   is the tier ladder, not ignoring it: at 10+ applauseFor() is already
   telling people to stop for the day, so if this ever does start to grate
   the fix is to suppress the quiz half past a tier, not to add a second
   surface somewhere else.
*/

export interface PostApplicationPopupProps {
  open: boolean;
  onClose: () => void;
  /** Applications filed today, this one included. */
  count: number;
  /** The program goal for the day, normally 5. */
  goal: number;
  /** Consecutive active days, for the streak pill. 0 hides it. */
  streak?: number;
  /** Pass a fixed question to control it (previews); omit for the bank. */
  question?: QuizQuestion;
  /** Past this many in a day, the popup stops celebrating and says why. */
  cap?: number;
}

export const PostApplicationPopup: React.FC<PostApplicationPopupProps> = ({
  open, onClose, count, goal, streak = 0, question, cap = 10,
}) => {
  const reduced = prefersReducedMotion();
  /* Past the cap this stops being a celebration. It says why, and unlike
     every other popup in this app it does not dismiss on a click-away:
     the one moment worth making somebody read is the one telling them to
     stop, so it takes a deliberate button press to leave. */
  const overCap = count > cap;

  /* The moment is identified by which application this is — so the line
     and the question are drawn once per filed application and stay put
     while the popup is up, including through its exit animation. Deriving
     them from `open` instead would blank the card the instant it starts
     closing, and resetting them in an effect would cascade a render. */
  const moment = useMemo(() => ({
    applause: applauseFor(count, goal),
    quiz: question ?? pickQuizQuestion(),
  }), [count, goal, question]);
  const { applause, quiz } = moment;

  // The answer belongs to a specific question, so a new question clears it
  // without anything having to remember to.
  const [answer, setAnswer] = useState<{ qid: string; index: number } | null>(null);
  const picked = answer && answer.qid === quiz.id ? answer.index : null;

  useEffect(() => {
    if (!open) return;
    if (!overCap) haptic('success');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, overCap]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="post-application-backdrop"
          onClick={overCap ? undefined : onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 4500,
            background: 'rgba(20,16,12,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <motion.div
            key="post-application-card"
            /* Under the cap this deliberately does NOT stop propagation:
               a click anywhere, the card included, closes. Over the cap it
               does, so the only way out is the button. */
            onClick={overCap ? e => e.stopPropagation() : undefined}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: EASE.in } }}
            transition={reduced ? { duration: 0.12 } : SPRING.arrive}
            style={{
              width: '100%', maxWidth: 360,
              /* The over-cap variant has no click-away, so if the card is
                 ever taller than the window the "Got it" button is the
                 only exit and it must stay reachable. Scroll the card,
                 never the page behind it. */
              maxHeight: '90dvh', overflowY: 'auto',
              background: warm.colors.bgSurface,
              border: `1px solid ${warm.colors.borderWhisper}`,
              borderRadius: warm.radius.card,
              boxShadow: warm.shadow.lifted,
              padding: '26px 24px 18px',
              fontFamily: warm.type.fontBody,
              cursor: overCap ? 'default' : 'pointer',
            }}
          >
          {overCap ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <span style={{
                  width: 46, height: 46, borderRadius: '50%', background: warm.colors.accentGoldSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Hand size={22} color={warm.colors.accentGold} />
                </span>
              </div>
              <p style={{
                ...warm.text.h3, margin: '0 0 12px', textAlign: 'center',
                fontWeight: warm.weight.bold, color: warm.colors.textPrimary,
              }}>
                Great job — you've sent ten high-quality applications
              </p>
              <p style={{ ...warm.text.small, margin: '0 0 12px', lineHeight: 1.6, color: warm.colors.textSecondary }}>
                We're pausing your counter here. The system is built on high-quality
                applications sent consistently, and in our experience this is where
                fatigue starts setting in — the tailoring gets thinner, the research
                gets skipped, and the tiredness that builds tonight is exactly what
                turns tomorrow into a day off.
              </p>
              <p style={{ ...warm.text.small, margin: '0 0 14px', lineHeight: 1.6, color: warm.colors.textSecondary }}>
                You may feel fine right now, but powering through more than you need to
                can leave you emotionally drained in three days — which is not where we
                want you to be.
              </p>
              <p style={{
                ...warm.text.small, margin: '0 0 8px',
                fontWeight: warm.weight.bold, color: warm.colors.textPrimary,
              }}>
                Still got energy and drive? Try one of these.
              </p>
              <ul style={{
                ...warm.text.small, margin: '0 0 18px', paddingLeft: 18,
                lineHeight: 1.7, color: warm.colors.textSecondary,
              }}>
                <li>Follow up on older applications</li>
                <li>Find networking events near you</li>
                <li>Reconnect with your university professors</li>
                <li>Record a one-minute video to attach to cover letters and stand out</li>
              </ul>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '12px 20px', borderRadius: 10, border: 'none',
                  background: warm.colors.accentPetrol, color: '#fff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Got it
              </button>
            </>
          ) : (
          <>
            {/* The tick — drawn on, one bloom, same gesture as the old pill. */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <span style={{ position: 'relative', width: 46, height: 46 }}>
                {!reduced && (
                  <motion.span
                    initial={{ scale: 0.9, opacity: 0.55 }}
                    animate={{ scale: 2.1, opacity: 0 }}
                    transition={{ duration: 0.8, ease: EASE.out, delay: 0.08 }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${warm.colors.success}` }}
                  />
                )}
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', background: warm.colors.successSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={warm.colors.success} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <motion.path
                      d="M20 6 9 17l-5-5"
                      initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={reduced ? { duration: 0 } : { duration: 0.34, ease: EASE.out, delay: 0.1 }}
                    />
                  </svg>
                </span>
              </span>
            </div>

            <p style={{
              margin: '0 0 4px', textAlign: 'center',
              fontSize: 30, fontWeight: 800, color: warm.colors.textPrimary,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
            }}>
              {count} of {goal}
            </p>
            <p style={{ margin: '0 0 12px', textAlign: 'center', fontSize: 14, lineHeight: 1.5, color: warm.colors.textSecondary }}>
              {applause.title}
            </p>

            {streak > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999,
                  fontSize: 12, fontWeight: 800, background: 'rgba(196,113,58,0.12)', color: '#C4713A',
                }}>
                  <Flame size={12} /> {streak}-day streak
                </span>
              </div>
            )}

            {/* The quiz. Same moment, below a hairline — never its own screen. */}
            <div style={{ borderTop: `1px solid ${warm.colors.borderWhisper}`, paddingTop: 14 }}>
              <p style={{ ...warm.text.micro, margin: '0 0 8px', color: warm.colors.accentGoldBright }}>
                Pop quiz
              </p>
              {/* The setting, before the question. A question with no
                  setting makes the reader guess whether this is about a
                  resume, a cover letter or a phone screen. */}
              <p style={{
                ...warm.text.small, margin: '0 0 4px',
                fontWeight: warm.weight.semibold, color: warm.colors.textMuted,
              }}>
                {quiz.context}
              </p>
              <p style={{
                ...warm.text.small, margin: '0 0 10px',
                fontWeight: warm.weight.bold, lineHeight: 1.45, color: warm.colors.textPrimary,
              }}>
                {quiz.prompt}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {quiz.choices.map((choice, i) => {
                  const answered = picked !== null;
                  const isPicked = picked === i;
                  const isCorrect = !!choice.correct;
                  let border: string = warm.colors.borderWhisper;
                  let bg: string = warm.colors.bgAlt;
                  let icon: React.ReactNode = null;
                  if (answered && isCorrect) {
                    border = warm.colors.success; bg = warm.colors.successSoft;
                    icon = <Check size={13} color={warm.colors.success} />;
                  } else if (answered && isPicked && !isCorrect) {
                    border = warm.colors.danger; bg = warm.colors.dangerSoft;
                    icon = <XIcon size={13} color={warm.colors.danger} />;
                  }
                  return (
                    <button
                      key={i}
                      onClick={e => { e.stopPropagation(); if (picked === null) setAnswer({ qid: quiz.id, index: i }); }}
                      disabled={answered}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        textAlign: 'left', padding: '8px 11px', borderRadius: 9,
                        border: `1.5px solid ${border}`, background: bg,
                        cursor: answered ? 'default' : 'pointer',
                        fontSize: 12, fontWeight: 600, color: warm.colors.textPrimary,
                      }}
                    >
                      <span>{choice.text}</span>
                      {icon}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence>
                {picked !== null && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ margin: '9px 0 0', fontSize: 11.5, lineHeight: 1.5, color: warm.colors.textSecondary, overflow: 'hidden' }}
                  >
                    {quiz.explain}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 11, color: warm.colors.textMuted }}>
              Click anywhere to close
            </p>
          </>
          )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
