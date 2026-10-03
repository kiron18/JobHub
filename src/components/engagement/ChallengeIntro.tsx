import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';
import { prefersReducedMotion } from '../../lib/theme/motion';
import { CHALLENGE_INTRO as COPY } from '../../config/challengeIntro';
import { trackChallengeIntroVideoPlayed } from '../../lib/analytics';

/* ── ChallengeIntro ────────────────────────────────────────────────────
   The first screen a member ever sees on the dashboard: what the 90 days
   are, and the walkthrough video. One time only. Pressing the button starts
   the challenge (today becomes Day 1) and hands over to the morning commit.

   Blocking, like the morning commit, because it is the orientation for
   everything behind it. The words live in config/challengeIntro.ts.
*/

export function ChallengeIntro({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  const reduced = prefersReducedMotion();
  // Thumbnail until pressed, so the dialog does not load a YouTube player
  // (and its tracking) for everyone who never plays it.
  const [playing, setPlaying] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={COPY.title}
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
        <h1 style={{
          margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500,
          fontSize: 'clamp(28px, 6vw, 36px)', lineHeight: 1.12, color: warm.colors.textPrimary,
        }}>
          {COPY.title}
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.5, color: warm.colors.textSecondary }}>
          {COPY.subtitle}
        </p>

        <h2 style={{ ...warm.text.h2, margin: '28px 0 8px', color: warm.colors.textPrimary }}>
          {COPY.challengeHeading}
        </h2>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: warm.colors.textSecondary }}>
          {COPY.challenge.before}
          <strong style={{ color: warm.colors.textPrimary, fontWeight: 700 }}>{COPY.challenge.bold}</strong>
          {COPY.challenge.after}
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.6, color: warm.colors.textSecondary }}>
          {COPY.challengeFollow}
        </p>

        <h2 style={{ ...warm.text.h3, margin: '26px 0 10px', color: warm.colors.textPrimary }}>
          {COPY.videoHeading}
        </h2>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 14, overflow: 'hidden', background: warm.colors.bgDeep }}>
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${COPY.videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={COPY.videoHeading}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          ) : (
            <button
              type="button"
              onClick={() => { trackChallengeIntroVideoPlayed(); setPlaying(true); }}
              aria-label={`Play: ${COPY.videoHeading}`}
              style={{ position: 'absolute', inset: 0, padding: 0, border: 0, cursor: 'pointer', background: 'none' }}
            >
              <img
                src={`https://i.ytimg.com/vi/${COPY.videoId}/hqdefault.jpg`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <span style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 68, height: 68, borderRadius: 99, background: warm.colors.accentPetrol, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 6px 24px rgba(15,32,56,0.35)',
              }}>
                <Play size={28} fill="#fff" style={{ marginLeft: 4 }} />
              </span>
            </button>
          )}
        </div>

        <button
          onClick={onStart}
          disabled={busy}
          style={{
            marginTop: 24, width: '100%', padding: '16px 20px', borderRadius: 14, border: 'none',
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
