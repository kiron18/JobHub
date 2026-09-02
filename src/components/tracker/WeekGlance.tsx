import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, DUR, SPRING, prefersReducedMotion } from '../../lib/theme/motion';

/* ── WeekGlance ────────────────────────────────────────────────────────
   A glimpse of the tracker on the page you start from.

   Home is the paste box and it stays the paste box: the full board, the
   status columns and the twelve month grid all live in Your tracker.

   Deliberately only two numbers. WeekStrip already sits beside this and
   draws the seven squares of the current week, so repeating them here
   would be the same information twice in one row. What was missing was
   the count itself: you could see which days you had worked and not how
   much you had done.

   Both numbers are shown against their target, because a number on its
   own is not feedback. "7" tells you nothing. "7 of 20" is an
   instruction.
*/

interface GoalSide { goal: number; goalType: 'daily' | 'weekly'; done: number }
interface GoalState { application: GoalSide; outreach: GoalSide }

/** A daily goal is stated per day; the week's target is five of them. */
function weeklyTarget(side: GoalSide): number {
  return side.goalType === 'weekly' ? side.goal : side.goal * 5;
}

export function WeekGlance() {
  const navigate = useNavigate();
  const reduced = prefersReducedMotion();

  const { data: goals } = useQuery({
    queryKey: ['tracker-goals'],
    queryFn: async () => (await api.get('/tracker/goals')).data as GoalState,
    staleTime: 5 * 60_000,
  });

  if (!goals) return null;

  return (
    <motion.button
      onClick={() => navigate('/tracker')}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      transition={SPRING.tap}
      style={{
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        textAlign: 'left', cursor: 'pointer',
        padding: '12px 16px',
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: warm.radius.card,
        boxShadow: warm.shadow.soft,
      }}
    >
      <Metric label="Applications" side={goals.application} reduced={reduced} />
      <Metric label="Outreach" side={goals.outreach} reduced={reduced} />

    </motion.button>
  );
}

function Metric({ label, side, reduced }: { label: string; side: GoalSide; reduced: boolean }) {
  const target = weeklyTarget(side);
  const done = side.done;
  const hit = done >= target;
  const pct = target > 0 ? Math.min(1, done / target) : 0;

  return (
    <span style={{ minWidth: 128 }}>
      <span style={{
        display: 'block', fontFamily: warm.type.fontBody,
        ...warm.text.micro, color: warm.colors.textMuted, marginBottom: 5,
      }}>
        {label} this week
      </span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 6 }}>
        <span style={{
          fontFamily: warm.type.fontBody, fontSize: 22, lineHeight: 1,
          fontWeight: warm.weight.bold, letterSpacing: '-0.02em',
          color: hit ? warm.colors.success : warm.colors.textPrimary,
        }}>
          {done}
        </span>
        <span style={{
          fontFamily: warm.type.fontBody, fontSize: 13,
          color: warm.colors.textMuted,
        }}>
          of {target}
        </span>
      </span>
      <span style={{
        display: 'block', height: 4, borderRadius: 999,
        background: warm.colors.bgAlt, overflow: 'hidden',
      }}>
        <motion.span
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: pct }}
          transition={reduced ? { duration: 0 } : { duration: DUR.slow, ease: EASE.out }}
          style={{
            display: 'block', height: '100%', width: '100%',
            transformOrigin: 'left center', borderRadius: 999,
            background: hit ? warm.colors.success : warm.colors.accentPetrol,
          }}
        />
      </span>
    </span>
  );
}
