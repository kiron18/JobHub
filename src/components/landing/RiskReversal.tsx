import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { colors, type as typeTokens } from './tokens';
import { Eyebrow } from './shared/Eyebrow';

const ITEMS = [
  {
    label: 'Free to try.',
    sub: 'No payment required to run the diagnostic.',
  },
  {
    label: 'No credit card.',
    sub: 'Sign up with email. Nothing charged, ever, unless you choose a paid plan.',
  },
  {
    label: '3 minutes.',
    sub: "That's it. Less time than a coffee order.",
  },
];

export function RiskReversal() {
  return (
    <section id="risk" style={{ background: colors.bgAlt }}>
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '96px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Eyebrow>BEFORE YOU DECIDE</Eyebrow>
        </div>

        <h2
          style={{
            fontFamily: typeTokens.display,
            fontSize: '1.75rem',
            fontWeight: 500,
            lineHeight: 1.2,
            letterSpacing: '-0.015em',
            color: colors.textPrimary,
            margin: 0,
            fontVariationSettings: "'SOFT' 50, 'WONK' 1",
          }}
        >
          Costs you nothing to find out.
        </h2>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 48,
            marginTop: 44,
          }}
        >
          {ITEMS.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.5,
                delay: i * 0.1,
                ease: [0.25, 1, 0.5, 1],
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                flex: 1,
                maxWidth: 200,
              }}
            >
              <Check size={18} color={colors.success} strokeWidth={2} />
              <span
                style={{
                  fontFamily: typeTokens.body,
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: colors.textPrimary,
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontFamily: typeTokens.body,
                  fontSize: '0.875rem',
                  color: colors.textSecondary,
                  lineHeight: 1.5,
                }}
              >
                {item.sub}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          style={{
            fontFamily: typeTokens.display,
            fontSize: '1rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: colors.textSecondary,
            marginTop: 32,
            fontVariationSettings: "'SOFT' 50, 'WONK' 1",
          }}
        >
          <em>Built for Aussie grads by someone who was one.</em>
        </motion.p>
      </div>

      <style>{`
        @media (max-width: 768px) {
          section#risk > div > div { flex-direction: column; align-items: center; gap: 32px; }
        }
        @media (max-width: 640px) {
          section#risk > div { padding: 64px 20px; }
        }
      `}</style>
    </section>
  );
}
