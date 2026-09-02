import React from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { warm } from '../../lib/theme/warmTokens';
import { SPRING, EASE, DUR, prefersReducedMotion } from '../../lib/theme/motion';

/* ── StepRail ──────────────────────────────────────────────────────────
   Numbered circles, kept. What changed is that colour now carries state
   instead of decorating it:

     gold   where you are right now. One per rail, never two.
     blue   banked. This step is done and its work is saved.
     grey   not yet. A hairline circle and a muted number.

   The gold disc is a single shared element with a layoutId, so when you
   advance it physically travels from the step you finished to the step
   you are on rather than blinking out of one circle and into another.
   That one detail is what makes the rail feel like an object instead of
   a set of independent lights.

   The connector between two circles fills left to right as you cross it,
   so progress reads as distance covered.
*/

export interface RailStep {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export function StepRail({
  steps, currentIndex, onSelect, canSelect, compact,
}: {
  steps: RailStep[];
  currentIndex: number;
  onSelect?: (i: number) => void;
  /** Which steps the user is allowed to jump to. Defaults to anything behind them. */
  canSelect?: (i: number) => boolean;
  compact?: boolean;
}) {
  const reduced = prefersReducedMotion();
  const size = compact ? 28 : 34;
  const allowed = (i: number) => (canSelect ? canSelect(i) : i <= currentIndex);

  return (
    <LayoutGroup id="steprail">
      <div
        role="list"
        style={{
          display: 'flex', alignItems: 'flex-start',
          padding: compact ? '12px 14px' : '18px 20px 14px',
          background: warm.colors.bgSurface,
          border: `1px solid ${warm.colors.borderWhisper}`,
          borderRadius: warm.radius.card,
          boxShadow: warm.shadow.soft,
          overflowX: 'auto',
        }}
      >
        {steps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const selectable = allowed(i) && !!onSelect && !active;

          return (
            <React.Fragment key={step.id}>
              <motion.button
                role="listitem"
                aria-current={active ? 'step' : undefined}
                disabled={!selectable}
                onClick={selectable ? () => onSelect!(i) : undefined}
                whileTap={selectable ? { scale: 0.94 } : undefined}
                transition={SPRING.tap}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                  background: 'none', border: 'none', padding: 0,
                  cursor: selectable ? 'pointer' : 'default',
                  flexShrink: 0, minWidth: compact ? 50 : 60,
                }}
              >
                {/* Circle */}
                <span style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
                  {/* Base disc: blue once banked, hairline until then. */}
                  <motion.span
                    animate={{
                      background: done ? warm.colors.accentPetrol : warm.colors.bgSurface,
                      borderColor: done ? warm.colors.accentPetrol : warm.colors.borderDefined,
                    }}
                    transition={{ duration: DUR.base, ease: EASE.out }}
                    style={{
                      position: 'absolute', inset: 0,
                      borderRadius: '50%', borderWidth: 1.5, borderStyle: 'solid',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  />

                  {/* The gold "you are here" disc. One in the tree, so it travels. */}
                  {active && (
                    <motion.span
                      layoutId="steprail-here"
                      transition={reduced ? { duration: 0 } : SPRING.arrive}
                      style={{
                        position: 'absolute', inset: 0,
                        borderRadius: '50%',
                        background: warm.colors.accentGoldBright,
                        boxShadow: `0 2px 10px ${warm.colors.accentGoldBright}55`,
                      }}
                    />
                  )}

                  {/* Arrival pulse. Twice, then still. A rail that pulses forever is a nag. */}
                  {active && !reduced && (
                    <motion.span
                      key={`pulse-${i}`}
                      initial={{ scale: 1, opacity: 0.45 }}
                      animate={{ scale: 1.6, opacity: 0 }}
                      transition={{ duration: 1.1, ease: EASE.out, repeat: 1 }}
                      style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        border: `2px solid ${warm.colors.accentGoldBright}`,
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Number, or the tick once the step is banked. */}
                  <span style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: warm.type.fontBody,
                    fontSize: compact ? 12 : 13,
                    fontWeight: warm.weight.bold,
                    color: done || active ? '#FFFFFF' : warm.colors.textMuted,
                    zIndex: 1,
                  }}>
                    <AnimatePresence mode="wait" initial={false}>
                      {done ? (
                        <motion.svg
                          key="tick"
                          width={compact ? 13 : 15} height={compact ? 13 : 15} viewBox="0 0 24 24"
                          fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                          initial={{ pathLength: 0, opacity: 0, scale: 0.7 }}
                          animate={{ pathLength: 1, opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.7 }}
                          transition={{ duration: reduced ? 0 : 0.34, ease: EASE.out }}
                        >
                          <motion.path d="M20 6 9 17l-5-5" />
                        </motion.svg>
                      ) : (
                        <motion.span
                          key="num"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: reduced ? 0 : DUR.fast, ease: EASE.out }}
                        >
                          {i + 1}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </span>

                {/* Label */}
                <motion.span
                  animate={{
                    color: active ? warm.colors.textPrimary
                      : done ? warm.colors.accentPetrol
                      : warm.colors.textMuted,
                  }}
                  transition={{ duration: DUR.base, ease: EASE.out }}
                  style={{
                    fontFamily: warm.type.fontBody,
                    fontSize: compact ? 11 : 12,
                    fontWeight: active ? warm.weight.bold : warm.weight.medium,
                    letterSpacing: '-0.005em',
                    textAlign: 'center',
                    lineHeight: 1.3,
                    maxWidth: compact ? 68 : 84,
                  }}
                >
                  {step.label}
                </motion.span>
              </motion.button>

              {/* Connector. Fills left to right as it is crossed. */}
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  style={{
                    flex: 1, minWidth: 12, height: 2,
                    marginTop: size / 2 - 1,
                    background: warm.colors.borderWhisper,
                    borderRadius: 2, overflow: 'hidden', position: 'relative',
                  }}
                >
                  <motion.span
                    initial={false}
                    animate={{ scaleX: i < currentIndex ? 1 : 0 }}
                    transition={{ duration: reduced ? 0 : DUR.slow, ease: EASE.out }}
                    style={{
                      position: 'absolute', inset: 0,
                      transformOrigin: 'left center',
                      background: warm.colors.accentPetrol,
                    }}
                  />
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
