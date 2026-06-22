import { motion, useReducedMotion } from 'framer-motion';
import { colors } from './tokens';

// A small resume "page" with a scan line sweeping over it. On pass, output rows
// are solid (clean parse). On fail, output rows are broken/dashed (scrambled).
export default function AtsScannerVisual({ pass }: { pass: boolean }) {
  const reduce = useReducedMotion();
  const good = colors.success;
  const bad = '#C2603F';
  const rowColor = pass ? good : bad;

  const rows = [0, 1, 2, 3];

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '8px 0' }}>
      {/* Source document */}
      <div style={{ position: 'relative', width: 96, height: 128, borderRadius: 8, background: colors.bgSurface, border: `1px solid ${colors.borderDefined}`, overflow: 'hidden' }}>
        {rows.map(i => (
          <div key={i} style={{ height: 6, margin: '12px 10px', borderRadius: 3, background: colors.borderDefined, opacity: 0.8 }} />
        ))}
        {/* scan line */}
        {!reduce && (
          <motion.div
            initial={{ y: -8 }}
            animate={{ y: 128 }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
            style={{ position: 'absolute', left: 0, right: 0, height: 14, background: `linear-gradient(${colors.accentPetrol}33, transparent)`, borderTop: `2px solid ${colors.accentPetrol}` }}
          />
        )}
      </div>

      {/* Arrow */}
      <span style={{ color: colors.textMuted, fontSize: 20 }}>{'→'}</span>

      {/* Parsed output */}
      <div style={{ width: 96, height: 128, borderRadius: 8, background: colors.bgSurface, border: `1px solid ${colors.borderDefined}`, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(i => (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, width: '20%' }}
            animate={{ opacity: 1, width: pass ? '100%' : ['60%', '30%', '70%'][i % 3] }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.3 + i * 0.25 }}
            style={{
              height: 6, borderRadius: 3,
              background: pass ? rowColor : 'transparent',
              border: pass ? 'none' : `2px dashed ${rowColor}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
