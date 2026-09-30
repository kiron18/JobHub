import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { prefersReducedMotion } from '../../lib/theme/motion';
import { CHALLENGE_INTRO as COPY } from '../../config/challengeIntro';

/* ── ChallengeIntro ────────────────────────────────────────────────────
   The first screen a member ever sees on the dashboard: what the 90 days
   are and how a day runs. One time only. Pressing the button starts the
   challenge (today becomes Day 1) and hands over to the morning commit.

   Blocking, like the morning commit, because it is the orientation for
   everything behind it. The words live in config/challengeIntro.ts.
*/

export function ChallengeIntro({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const reduced = prefersReducedMotion();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={COPY.eyebrow}
      style={{
        position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(15,32,56,0.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto',
      }}
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '100%', maxWidth: 580, margin: 'auto', background: '#fff', borderRadius: 22,
          padding: '34px 30px 28px', boxShadow: warm.shadow.lifted, fontFamily: warm.type.fontBody,
        }}
      >
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: warm.colors.accentGold }}>
          {COPY.eyebrow}
        </p>
        <h1 style={{
          margin: '10px 0 12px', fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500,
          fontSize: 32, lineHeight: 1.15, color: warm.colors.textPrimary,
        }}>
          {COPY.title}
        </h1>
        <p style={{ margin: '0 0 22px', fontSize: 17, lineHeight: 1.6, color: warm.colors.textSecondary }}>
          {COPY.lead}
        </p>

        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {COPY.steps.map((s, i) => (
            <li key={s.title} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: warm.colors.bgAlt, borderRadius: 14 }}>
              <span style={{
                width: 30, height: 30, flexShrink: 0, borderRadius: 99, background: warm.colors.accentPetrol, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700,
              }}>
                {i + 1}
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: warm.colors.textPrimary }}>{s.title}</span>
                <span style={{ display: 'block', marginTop: 4, fontSize: 15.5, lineHeight: 1.55, color: warm.colors.textSecondary }}>{s.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <p style={{ margin: '22px 0 0', fontSize: 17, fontWeight: 600, lineHeight: 1.5, color: warm.colors.textPrimary, textAlign: 'center' }}>
          {COPY.close}
        </p>

        <button
          onClick={onStart}
          disabled={busy}
          style={{
            marginTop: 18, width: '100%', padding: '16px 20px', borderRadius: 14, border: 'none',
            background: warm.colors.accentPetrol, color: '#fff', cursor: busy ? 'default' : 'pointer',
            fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
          {COPY.button}
        </button>
      </motion.div>
    </div>
  );
}
