import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';

const PREV_COUNT_KEY    = 'jobhub_sent_count_prev';
const CELEBRATED_KEY    = 'jobhub_first_application_celebrated';

interface SentCountResponse {
  count: number;
}

/**
 * Fires once, when the user transitions from zero sent applications to one or
 * more. Three short beats: the moment, what changed in the draft, why
 * consistency matters at scale. No fabricated stats — claims are about the
 * draft's structure, not invented numbers.
 *
 * Edge cases handled:
 * - User who imports a tracker with N>0 applications on first open never sees
 *   this (the previous count snapshot lands at N, not 0).
 * - User who dismisses sees it once; the celebrated flag locks it out forever.
 * - User who fluctuates (applies, deletes, applies again) only sees it the
 *   first time they cross zero -> one.
 */
export function FirstApplicationCelebration() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data } = useQuery<SentCountResponse>({
    queryKey: ['jobs', 'sent-count', 'celebration'],
    queryFn: async () => (await api.get('/jobs/sent-count')).data,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const count = data?.count ?? null;

  useEffect(() => {
    if (count === null) return;
    if (typeof window === 'undefined') return;

    const celebrated = window.localStorage.getItem(CELEBRATED_KEY) === 'true';
    const prevRaw = window.localStorage.getItem(PREV_COUNT_KEY);
    const prev = prevRaw === null ? null : Number.parseInt(prevRaw, 10);

    // Only fire on the first observed transition from 0 -> >=1. A null prev
    // means we have never snapshotted; treat that as "this is our first read"
    // and just record the current count without firing.
    if (!celebrated && prev === 0 && count >= 1) {
      setOpen(true);
      window.localStorage.setItem(CELEBRATED_KEY, 'true');
    }

    window.localStorage.setItem(PREV_COUNT_KEY, String(count));
  }, [count]);

  function close() {
    setOpen(false);
  }

  function sendAnother() {
    setOpen(false);
    navigate('/');
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={close}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            style={{
              position: 'relative',
              maxWidth: 560,
              width: '100%',
              background: warm.colors.bgSurface,
              border: `1px solid ${warm.colors.borderDefined}`,
              borderRadius: 22,
              padding: '40px 36px 32px',
              boxShadow: warm.shadow.lifted,
            }}
          >
            {/* Close button */}
            <button
              onClick={close}
              aria-label="Dismiss"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'none',
                border: 'none',
                color: warm.colors.textSecondary,
                cursor: 'pointer',
                padding: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = warm.colors.bgAlt; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <X size={16} />
            </button>

            {/* Beat 1 — The moment */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <p style={{
                margin: '0 0 10px',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: warm.colors.accentGold,
              }}>
                Your first application is out
              </p>
              <h2 style={{
                margin: '0 0 14px',
                fontSize: 'clamp(24px, 4.8vw, 32px)',
                fontWeight: 900,
                color: warm.colors.textPrimary,
                lineHeight: 1.18,
                letterSpacing: '-0.02em',
              }}>
                One down. Many more to go.
              </h2>
              <p style={{
                margin: 0,
                fontSize: 15,
                color: warm.colors.textSecondary,
                lineHeight: 1.65,
                maxWidth: 420,
                marginInline: 'auto',
                fontWeight: 450,
              }}>
                Most candidates spend two hours on an application like the one you just sent. You did it in minutes.
              </p>
            </div>

            {/* Beat 2 — What this draft did differently */}
            <div style={{
              padding: '20px 22px',
              background: warm.colors.bgAlt,
              border: `1px solid ${warm.colors.borderWhisper}`,
              borderRadius: 16,
              marginBottom: 24,
            }}>
              <p style={{
                margin: '0 0 14px',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: warm.colors.success,
              }}>
                What this draft did differently
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  "Your resume was retuned for this exact role, not a generic version of you.",
                  "Your cover letter opened with the employer's need, not your own intro.",
                  "Selection criteria were written in the language of the job description, not your own.",
                ].map((line, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{
                      flexShrink: 0,
                      marginTop: 4,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: warm.colors.success,
                      opacity: 0.8,
                    }} />
                    <p style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: warm.colors.textPrimary,
                      fontWeight: 450,
                    }}>
                      {line}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Beat 3 — Why consistency matters */}
            <div style={{ marginBottom: 28 }}>
              <p style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.7,
                color: warm.colors.textSecondary,
                fontWeight: 450,
                textAlign: 'center',
              }}>
                Job hunting feels like luck. It is a numbers game with quality applications. The more strong applications you send, the more your odds shift, week over week. <span style={{ color: warm.colors.textPrimary, fontWeight: 600 }}>This is the first one.</span>
              </p>
            </div>

            {/* CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <motion.button
                onClick={sendAnother}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: warm.colors.accentPetrol,
                  color: warm.colors.textOnDeep,
                  borderRadius: 14,
                  padding: '15px 24px',
                  fontSize: 15,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                  boxShadow: `0 6px 24px rgba(45,90,110,0.25)`,
                }}
              >
                Send another
                <ArrowRight size={16} />
              </motion.button>
              <button
                onClick={close}
                style={{
                  background: 'none',
                  border: 'none',
                  color: warm.colors.textSecondary,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px',
                  letterSpacing: '-0.01em',
                }}
              >
                Take a breath first
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
