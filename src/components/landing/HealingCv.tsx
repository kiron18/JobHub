import { motion, useTransform, type MotionValue } from 'framer-motion';
import { colors } from './tokens';

/**
 * A stylised CV that heals as `progress` goes 0 (fractured) to 1 (whole).
 * Three stacked "shards" splay out and fade their cracks as progress rises.
 * Purely decorative; drives the scroll metaphor and doubles as the scroll signpost.
 */
export function HealingCv({ progress }: { progress: MotionValue<number> }) {
  // Shard offsets collapse to 0 as the CV heals.
  const topX = useTransform(progress, [0, 1], [-46, 0]);
  const topRot = useTransform(progress, [0, 1], [-9, 0]);
  const botX = useTransform(progress, [0, 1], [40, 0]);
  const botRot = useTransform(progress, [0, 1], [7, 0]);
  const crackOpacity = useTransform(progress, [0, 1], [1, 0]);
  const glow = useTransform(progress, [0, 1], ['0 0 0 rgba(45,90,110,0)', '0 18px 60px rgba(45,90,110,0.30)']);

  const sheet: React.CSSProperties = {
    position: 'absolute',
    width: 150,
    height: 70,
    left: 35,
    background: colors.bgSurface,
    border: `1px solid ${colors.borderDefined}`,
    borderRadius: 8,
  };
  const line: React.CSSProperties = {
    position: 'absolute', left: 14, height: 6, borderRadius: 3, background: colors.borderDefined,
  };

  return (
    <div style={{ position: 'relative', width: 220, height: 230 }} aria-hidden>
      <motion.div style={{ ...sheet, top: 0, x: topX, rotate: topRot, boxShadow: glow }}>
        <div style={{ ...line, top: 14, width: 70 }} />
        <div style={{ ...line, top: 30, width: 110 }} />
      </motion.div>
      <div style={{ ...sheet, top: 80 }}>
        <div style={{ ...line, top: 14, width: 90 }} />
        <div style={{ ...line, top: 30, width: 120 }} />
      </div>
      <motion.div style={{ ...sheet, top: 160, x: botX, rotate: botRot, boxShadow: glow }}>
        <div style={{ ...line, top: 14, width: 100 }} />
        <div style={{ ...line, top: 30, width: 60 }} />
      </motion.div>
      {/* red crack marks that fade as it heals */}
      <motion.div style={{ position: 'absolute', inset: 0, opacity: crackOpacity }}>
        <div style={{ position: 'absolute', top: 74, left: 20, width: 180, height: 2, background: '#C2603F', transform: 'rotate(-2deg)' }} />
        <div style={{ position: 'absolute', top: 154, left: 30, width: 170, height: 2, background: '#C2603F', transform: 'rotate(3deg)' }} />
      </motion.div>
    </div>
  );
}
