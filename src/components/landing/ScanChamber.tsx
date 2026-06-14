import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { colors, type as typeTokens } from './tokens';
import { HealingCv } from './HealingCv';
import { ALL_SCAN_IMAGES } from './scanImages';
import { scanCinematicCopy } from './scanCinematicCopy';

const EASE = [0.25, 1, 0.5, 1] as const;

/** Full-screen "being evaluated" moment shown while the scan runs. */
export function ScanChamber() {
  const reduce = useReducedMotion();
  const progress = useMotionValue(0); // CV stays mostly fractured during the scan
  const [shown, setShown] = useState(0);

  // Preload the reveal images so the next screen is instant.
  useEffect(() => {
    ALL_SCAN_IMAGES.forEach(src => { const img = new Image(); img.src = src; });
  }, []);

  // Stream the analysis lines one at a time.
  useEffect(() => {
    const total = scanCinematicCopy.chamber.lines.length;
    const t = setInterval(() => setShown(s => (s < total ? s + 1 : s)), 1100);
    return () => clearInterval(t);
  }, []);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: colors.bgCanvas,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28,
        backgroundImage: `radial-gradient(120% 80% at 50% 0%, ${colors.bgSurface} 0%, ${colors.bgCanvas} 60%)` }}
    >
      <div style={{ position: 'relative' }}>
        <HealingCv progress={progress} />
        {!reduce && (
          <motion.div
            initial={{ y: -10, opacity: 0.0 }}
            animate={{ y: 240, opacity: [0, 0.9, 0] }}
            transition={{ duration: 1.6, ease: EASE, repeat: Infinity }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3,
              background: `linear-gradient(90deg, transparent, ${colors.accentPetrol}, transparent)` }}
          />
        )}
      </div>
      <div style={{ height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {scanCinematicCopy.chamber.lines.slice(0, shown).map((l, i) => (
          <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
            style={{ fontFamily: typeTokens.body, fontSize: 14, color: colors.textSecondary, margin: 0 }}>
            {l}
          </motion.p>
        ))}
      </div>
    </motion.div>,
    document.body,
  );
}
