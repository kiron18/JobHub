import { motion } from 'framer-motion';
import { Database, ShieldCheck, Pencil } from 'lucide-react';
import { colors, type as typeTokens } from './tokens';
import { Eyebrow } from './shared/Eyebrow';

const REASONS = [
  {
    icon: Database,
    title: 'Trained on data ChatGPT and other LLMs don\'t have.',
    body: 'Gathered from real people, having real conversations, making real hiring decisions across Australia. Direct interviews with recruiters and hiring managers,the kind of context a general-purpose AI never sees.',
  },
  {
    icon: ShieldCheck,
    title: 'Tight guardrails. No drift.',
    body: 'Left alone, LLMs drift, hallucinate, and quietly reformat your documents in ways that hurt you. JobHub is powered by LLMs,but they\'re harnessed inside strict guardrails tuned for resume writing, cover letters, and Australian hiring patterns. You get an accurate, on-brief result every time, not a creative interpretation.',
  },
  {
    icon: Pencil,
    title: 'Send it as is. Or make it yours.',
    body: 'Every document arrives ready to send,tailored to the role, calibrated for the Australian market, audited inside our guardrails. If you want to add a personal story, sharpen a line, or reorder bullets, every word is fully editable. The strong draft is the default; the personal touches are optional.',
  },
];

export function ObjectionHandler() {
  return (
    <section id="objection" style={{ background: colors.bgAlt }}>
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '120px 24px',
        }}
      >
        <Eyebrow>THE OBVIOUS QUESTION</Eyebrow>

        <h2
          style={{
            fontFamily: typeTokens.display,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: '-0.015em',
            color: colors.textPrimary,
            margin: 0,
            fontVariationSettings: "'SOFT' 50, 'WONK' 1",
          }}
        >
          Why not just use ChatGPT,
          <br />
          Claude, Gemini, or your
          <br />
          favourite LLM?
        </h2>

        <p
          style={{
            fontFamily: typeTokens.body,
            fontSize: '1.125rem',
            lineHeight: 1.6,
            color: colors.textSecondary,
            marginTop: 28,
          }}
        >
          Fair question. You can absolutely use a general-purpose AI to write cover
          letters and edit resumes. Most of our users tried it first. Here's what we
          learned from sitting next to them while they did:
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 36,
            marginTop: 52,
          }}
        >
          {REASONS.map((reason, i) => {
            const Icon = reason.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.5,
                  ease: [0.25, 1, 0.5, 1],
                }}
                style={{ display: 'flex', gap: 16 }}
              >
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <Icon size={20} color={colors.accentPetrol} strokeWidth={1.5} />
                </div>
                <div>
                  <p
                    style={{
                      fontFamily: typeTokens.body,
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: colors.textPrimary,
                      margin: 0,
                    }}
                  >
                    {reason.title}
                  </p>
                  <p
                    style={{
                      fontFamily: typeTokens.body,
                      fontSize: '1rem',
                      lineHeight: 1.65,
                      color: colors.textSecondary,
                      margin: '8px 0 0',
                    }}
                  >
                    {reason.body}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          style={{
            fontFamily: typeTokens.display,
            fontSize: '1.25rem',
            fontWeight: 500,
            fontStyle: 'italic',
            lineHeight: 1.45,
            color: colors.textPrimary,
            textAlign: 'center',
            maxWidth: 580,
            margin: '48px auto 0',
            fontVariationSettings: "'SOFT' 50, 'WONK' 1",
          }}
        >
          <em>
            Think of it as your personal career advisor,one who knows the details
            of your career, has the language skills to frame it effectively, and
            knows exactly how Australian employers think.
          </em>
        </motion.p>
      </div>

      <style>{`
        @media (max-width: 640px) {
          section#objection > div { padding: 72px 20px; }
        }
      `}</style>
    </section>
  );
}
