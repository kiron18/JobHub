import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { colors, type as typeTokens } from '../tokens';

/* ── What an hour buys ───────────────────────────────────────────────────────
   The old block was a static bar chart: three hours on a Sunday, 12 by hand
   against 150 through the belt. Static means the reader has to accept our
   framing of their week. This asks for their number instead, which is the one
   number they actually know, and does the arithmetic in front of them.

   The rates are the offer, so they live here as named constants rather than
   inside the formula:

     with the system   5 minutes an application, 3 minutes an outreach
     by hand          45 minutes an application, 15 minutes an outreach

   Split any block of time three quarters to applications and one quarter to
   outreach and an hour comes out at 9 applications and 5 outreach through the
   system, 1 and 1 by hand. Those are the two numbers the page promises, so they
   are a consequence of the rates rather than a pair of literals typed next to
   a formula that disagrees with them.

   If a rate ever changes, it changes here and the headline numbers move with
   it. That is deliberate. The alternative is a calculator that contradicts the
   sentence printed above it.                                                  */

const RATES = {
  systemApplyMins: 5,
  systemOutreachMins: 3,
  manualApplyMins: 45,
  manualOutreachMins: 15,
} as const;

/** Share of the session that goes on applications. The rest goes on outreach. */
const APPLY_SHARE = 0.75;

const MIN_MINUTES = 15;
const MAX_MINUTES = 240;
const STEP_MINUTES = 15;

function yieldFor(minutes: number, applyMins: number, outreachMins: number) {
  return {
    applications: Math.floor((minutes * APPLY_SHARE) / applyMins),
    outreach: Math.floor((minutes * (1 - APPLY_SHARE)) / outreachMins),
  };
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem} minutes`;
  const hourPart = h === 1 ? '1 hour' : `${h} hours`;
  return rem === 0 ? hourPart : `${hourPart} ${rem} min`;
}

function Column({
  heading,
  applications,
  outreach,
  accent,
  emphasis,
}: {
  heading: string;
  applications: number;
  outreach: number;
  accent: string;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        /* Narrow enough that the two columns stay side by side inside the card
           on a 390px phone. They are a comparison: stacked, they are two facts. */
        flex: '1 1 132px',
        minWidth: 0,
        padding: '16px 16px 14px',
        borderRadius: 12,
        background: emphasis ? 'rgba(45,90,110,0.06)' : colors.bgAlt,
        border: `1px solid ${emphasis ? 'rgba(45,90,110,0.22)' : colors.borderWhisper}`,
      }}
    >
      <div
        style={{
          fontFamily: typeTokens.body,
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.13em',
          textTransform: 'uppercase',
          color: emphasis ? accent : colors.textMuted,
          marginBottom: 14,
        }}
      >
        {heading}
      </div>

      {[
        { n: applications, unit: applications === 1 ? 'application' : 'applications' },
        { n: outreach, unit: outreach === 1 ? 'outreach message' : 'outreach messages' },
      ].map(row => (
        <div key={row.unit} style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <motion.span
            key={`${row.unit}-${row.n}`}
            initial={{ opacity: 0.35, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            style={{
              fontFamily: typeTokens.display,
              fontSize: emphasis ? 'clamp(1.75rem, 5vw, 2.375rem)' : 'clamp(1.375rem, 4vw, 1.75rem)',
              fontWeight: 600,
              lineHeight: 1,
              color: emphasis ? accent : colors.textSecondary,
              fontVariationSettings: "'SOFT' 50, 'WONK' 1",
              minWidth: '1.2em',
            }}
          >
            {row.n}
          </motion.span>
          <span style={{ fontFamily: typeTokens.body, fontSize: '0.8125rem', color: colors.textSecondary }}>
            {row.unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function HourCalculator() {
  const [minutes, setMinutes] = useState(60);
  const sliderId = useId();

  const manual = yieldFor(minutes, RATES.manualApplyMins, RATES.manualOutreachMins);
  const system = yieldFor(minutes, RATES.systemApplyMins, RATES.systemOutreachMins);

  const monthGap = (system.applications - manual.applications) * 30;

  return (
    <div
      style={{
        background: colors.bgSurface,
        border: `1px solid ${colors.borderDefined}`,
        borderRadius: 14,
        padding: 'clamp(20px, 4vw, 30px)',
        boxShadow: '0 1px 2px rgba(26,24,20,0.04), 0 12px 32px rgba(26,24,20,0.06)',
      }}
    >
      <div
        style={{
          fontFamily: typeTokens.display,
          fontSize: 'clamp(1.125rem, 2.6vw, 1.375rem)',
          fontWeight: 500,
          letterSpacing: '-0.015em',
          color: colors.textPrimary,
          margin: '0 0 20px',
          fontVariationSettings: "'SOFT' 50, 'WONK' 1",
        }}
      >
        What a single hour a day gets you
      </div>

      {/* The one input. Their number, not ours. */}
      <label
        htmlFor={sliderId}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          fontFamily: typeTokens.body,
          fontSize: '0.875rem',
          color: colors.textSecondary,
          marginBottom: 10,
        }}
      >
        <span>How much free time do you have per day?</span>
        <span style={{ fontWeight: 700, color: colors.textPrimary, whiteSpace: 'nowrap' }}>
          {formatMinutes(minutes)}
        </span>
      </label>

      <input
        id={sliderId}
        type="range"
        min={MIN_MINUTES}
        max={MAX_MINUTES}
        step={STEP_MINUTES}
        value={minutes}
        onChange={e => setMinutes(Number(e.target.value))}
        aria-valuetext={formatMinutes(minutes)}
        className="hour-calculator-slider"
        style={{ width: '100%', marginBottom: 22, display: 'block' }}
      />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Column heading="By yourself" applications={manual.applications} outreach={manual.outreach} accent={colors.textSecondary} />
        <Column
          heading="Through the JobHub system"
          applications={system.applications}
          outreach={system.outreach}
          accent={colors.accentPetrol}
          emphasis
        />
      </div>

      {monthGap > 0 && (
        <p
          style={{
            fontFamily: typeTokens.body,
            fontSize: '0.875rem',
            color: colors.textPrimary,
            margin: '0 0 14px',
            lineHeight: 1.6,
          }}
        >
          Same {minutes === 60 ? 'hour' : formatMinutes(minutes)} every day. Over 30 days that is{' '}
          <span style={{ background: colors.highlight, padding: '0 5px', fontWeight: 700 }}>
            {monthGap.toLocaleString()} more applications.
          </span>
        </p>
      )}

      <p
        style={{
          fontFamily: typeTokens.body,
          fontSize: '0.875rem',
          color: colors.textSecondary,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        Apply for the right jobs with high quality personalised applications that get you interviews. Five clicks, five
        minutes, that is all it takes.
      </p>

      {/* A range input is unstyleable through the style prop, so the track and
          thumb get real CSS. Scoped by class so nothing else on the page moves. */}
      <style>{`
        .hour-calculator-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 99px;
          background: ${colors.bgAlt};
          border: 1px solid ${colors.borderWhisper};
          outline: none;
          cursor: pointer;
        }
        .hour-calculator-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 99px;
          background: ${colors.accentPetrol};
          border: 3px solid ${colors.bgSurface};
          box-shadow: 0 1px 2px rgba(26,24,20,0.10), 0 3px 10px rgba(45,90,110,0.30);
          cursor: grab;
        }
        .hour-calculator-slider::-moz-range-thumb {
          width: 22px;
          height: 22px;
          border-radius: 99px;
          background: ${colors.accentPetrol};
          border: 3px solid ${colors.bgSurface};
          box-shadow: 0 1px 2px rgba(26,24,20,0.10), 0 3px 10px rgba(45,90,110,0.30);
          cursor: grab;
        }
        .hour-calculator-slider:focus-visible {
          box-shadow: 0 0 0 3px ${colors.ringFocus};
        }
      `}</style>
    </div>
  );
}
