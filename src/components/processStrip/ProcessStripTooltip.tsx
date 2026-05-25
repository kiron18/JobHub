import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ProcessStripTooltipProps {
  /** CSS selector to anchor the tooltip beside. If missing, falls back to a centered bottom banner. */
  anchorSelector: string;
  /** Delay before the tooltip mounts, in ms. */
  delayMs?: number;
  /** Body copy shown inside the tooltip. */
  children: React.ReactNode;
  /** Dismiss button label. 'Got it' for action-required tooltips, undefined for an X-only soft tooltip. */
  dismissLabel?: string;
  /** Fires when the user dismisses (Got it click OR X click). */
  onDismiss: () => void;
  /** If true, force-fallback banner regardless of anchor presence. Used for known-narrow viewports. */
  forceBanner?: boolean;
}

const MOBILE_MQ = '(max-width: 900px)';

export const ProcessStripTooltip: React.FC<ProcessStripTooltipProps> = ({
  anchorSelector,
  delayMs = 0,
  children,
  dismissLabel,
  onDismiss,
  forceBanner,
}) => {
  const [mounted, setMounted] = useState(delayMs === 0);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches);
  const cardRef = useRef<HTMLDivElement>(null);

  // Delay-mount.
  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  // Track viewport narrowness.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Resolve and track the anchor element on every relevant change.
  useEffect(() => {
    if (!mounted) return;
    if (forceBanner || isNarrow) {
      setAnchorRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(anchorSelector);
      if (!el) {
        setAnchorRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setAnchorRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [mounted, anchorSelector, forceBanner, isNarrow]);

  if (!mounted) return null;

  const useBanner = forceBanner || isNarrow || !anchorRect;

  const cardStyle: React.CSSProperties = useBanner
    ? {
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 360,
        width: 'calc(100% - 32px)',
        zIndex: 70,
      }
    : {
        position: 'fixed',
        // Place tooltip to the right of anchor (sidebar use-case). 12px gap.
        top: Math.max(16, anchorRect.top + anchorRect.height / 2 - 36),
        left: anchorRect.left + anchorRect.width + 12,
        maxWidth: 280,
        zIndex: 70,
      };

  return (
    <AnimatePresence>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: useBanner ? 8 : 0, x: useBanner ? 0 : -4 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        style={{
          ...cardStyle,
          background: warm.colors.bgSurface,
          border: `1px solid ${warm.colors.borderWhisper}`,
          borderRadius: warm.radius.card,
          boxShadow: '0 12px 32px rgba(26, 24, 20, 0.12)',
          padding: '14px 16px',
          fontFamily: warm.type.fontBody,
        }}
      >
        {/* Pointer arrow toward the sidebar anchor — only when anchored, not banner */}
        {!useBanner && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: -6,
              top: 24,
              width: 12,
              height: 12,
              background: warm.colors.bgSurface,
              borderLeft: `1px solid ${warm.colors.borderWhisper}`,
              borderBottom: `1px solid ${warm.colors.borderWhisper}`,
              transform: 'rotate(45deg)',
            }}
          />
        )}

        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
        }}>
          <div style={{
            flex: 1,
            fontSize: 13,
            lineHeight: 1.5,
            color: warm.colors.textPrimary,
            fontWeight: 500,
          }}>
            {children}
          </div>
          {!dismissLabel && (
            <button
              onClick={onDismiss}
              aria-label="Dismiss"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: warm.colors.textMuted,
                padding: 4,
                flexShrink: 0,
                borderRadius: 6,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {dismissLabel && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={onDismiss}
              style={{
                background: warm.colors.accentPetrol,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 10,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}
            >
              {dismissLabel}
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
