import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, prefersReducedMotion } from '../../lib/theme/motion';
import { PulsingBrainIcon } from './PulsingBrainIcon';

/* ── StreakHeading ─────────────────────────────────────────────────────
   The biggest line on the page, so it has to earn itself.

   "Challenge - 4 day streak" is gone: "Challenge" was filler, and naming
   a number does not ask for anything. "Keep your 4-day streak" names what
   is at stake and what to do about it in the same four words.

   At zero it must not read "0-day streak" — a streak you have just lost
   is not something to put in 26px type. It becomes an invitation instead.

   The forward-looking version ("3 days to a 7-day streak") is the more
   motivating line but it is also the more tiring one, so it is not
   allowed to live here permanently: when a milestone is close it slides
   in under the heading, holds for a few seconds, and leaves.
*/

const MILESTONES = [3, 7, 14, 30, 60, 90];
/** How near a milestone has to be before it is worth mentioning. */
const NUDGE_WITHIN_DAYS = 3;

const NUDGE_IN_MS = 1200;
const NUDGE_HOLD_MS = 4400;

function nextMilestone(streak: number): number | null {
  const next = MILESTONES.find(m => m > streak);
  if (next === undefined) return null;
  return next - streak <= NUDGE_WITHIN_DAYS ? next : null;
}

export interface StreakHeadingProps {
  streak: number;
  /** Streak freezes in hand. Undefined hides the chip (older server). */
  freezes?: number;
  /** Today already counted. False with a live streak means it is at risk. */
  todayDone?: boolean;
  /** Applications that count a day toward the streak. */
  floor?: number;
  onBrainClick: () => void;
}

const FREEZE_HELP =
  'Streak freezes: a missed weekday uses one automatically, so your streak survives. ' +
  'You earn one for every 5 days in a row and can hold 2.';

export const StreakHeading: React.FC<StreakHeadingProps> = ({ streak, freezes, todayDone, floor, onBrainClick }) => {
  const reduced = prefersReducedMotion();
  const milestone = nextMilestone(streak);
  const [nudgeVisible, setNudgeVisible] = useState(false);

  useEffect(() => {
    if (milestone === null || reduced) return;
    // setState from a timer, not from the effect body: this is the thing
    // arriving later on purpose, not a render cascade.
    const show = setTimeout(() => setNudgeVisible(true), NUDGE_IN_MS);
    const hide = setTimeout(() => setNudgeVisible(false), NUDGE_IN_MS + NUDGE_HOLD_MS);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [milestone, reduced]);

  const heading = streak > 0 ? `Keep your ${streak}-day streak` : 'Start a new streak today';

  return (
    <div>
      <h1 style={{
        margin: '0 0 10px', fontSize: 26, fontWeight: 700, letterSpacing: '-0.018em',
        color: warm.colors.textPrimary, lineHeight: 1.2,
      }}>
        {heading}{' '}
        <PulsingBrainIcon streak={streak} onClick={onBrainClick} size={20} variant="inline" />
      </h1>

      {freezes !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '-2px 0 10px' }}>
          <span
            title={FREEZE_HELP}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999,
              fontSize: 12.5, fontWeight: 700, lineHeight: 1.4,
              background: freezes > 0 ? '#E6F4FC' : warm.colors.bgAlt,
              color: freezes > 0 ? '#1F7AB0' : warm.colors.textMuted,
              border: `1px solid ${freezes > 0 ? '#BFE3F7' : warm.colors.borderWhisper}`,
            }}
          >
            <Snowflake size={13} strokeWidth={2.4} />
            {freezes === 0 ? 'No streak freezes' : `${freezes} streak freeze${freezes === 1 ? '' : 's'}`}
          </span>
          {streak > 0 && todayDone === false && floor !== undefined && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: warm.colors.accentGoldBright }}>
              Send {floor} today to make it {streak + 1} days
            </span>
          )}
        </div>
      )}

      <AnimatePresence>
        {nudgeVisible && milestone !== null && (
          <motion.p
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0, transition: { duration: 0.3, ease: EASE.in } }}
            transition={{ duration: 0.35, ease: EASE.out }}
            style={{
              margin: '-4px 0 8px', overflow: 'hidden',
              fontSize: 13, fontWeight: 600, color: warm.colors.accentGoldBright,
            }}
          >
            {milestone - streak === 1
              ? `One more day to a ${milestone}-day streak`
              : `${milestone - streak} days to a ${milestone}-day streak`}
          </motion.p>
        )}
      </AnimatePresence>

      <div style={{ height: 1, background: warm.colors.borderWhisper, marginBottom: 12 }} />
    </div>
  );
};
