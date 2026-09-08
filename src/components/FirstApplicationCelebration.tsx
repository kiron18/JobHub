import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { useIsMobile } from '../hooks/useIsMobile';

const PREV_COUNT_KEY    = 'jobhub_sent_count_prev';
const CELEBRATED_KEY    = 'jobhub_first_application_celebrated';

interface SentCountResponse {
  count: number;
}

/**
 * Fires once, when the user transitions from zero sent applications to one or
 * more. No fabricated stats — the one claim it makes is about time, and it is
 * about the draft's structure rather than an invented outcome.
 *
 * ONE beat, not three. It used to be the moment, then a list of what the draft
 * did differently, then a paragraph on why consistency compounds — about twenty
 * lines, which on a 390px phone did not fit the screen at all: the modal had no
 * max-height and no scroller, so it was clipped at both ends and the button was
 * unreachable.
 *
 * Cutting it was the fix rather than adding a scrollbar. The two beats that
 * went are a sales argument delivered after the sale, at the one moment in the
 * product where the person is not reading. What is left is the congratulation
 * and the two things to do next, which is all this screen was ever for. The
 * scroller went in anyway, as the floor under a long name or a short screen.
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
  const isMobile = useIsMobile();
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
            /* 24 a side is 48px of a 390px screen spent before the card starts,
               and the card then spends 72 more. See warm.measure. */
            padding: isMobile ? 14 : 24,
            /* A card taller than the screen used to be clipped top and bottom
               with its own button off the edge. 100dvh, not vh: on a phone vh
               is measured with the browser chrome retracted. */
            overflowY: 'auto',
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
              borderRadius: isMobile ? 18 : 22,
              padding: isMobile ? '26px 18px 20px' : '40px 36px 32px',
              boxShadow: warm.shadow.lifted,
              maxHeight: 'calc(100dvh - 28px)',
              overflowY: 'auto',
              margin: 'auto',
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
            {/* Inset from the sides so the centred heading clears the close
                button in the corner. Without it the last word of a two-line
                heading sits under the X. */}
            <div style={{
              textAlign: 'center',
              padding: '0 26px',
              marginBottom: isMobile ? 20 : 28,
            }}>
              <h2 style={{
                margin: '0 0 14px',
                fontSize: isMobile ? 'clamp(23px, 6.6vw, 29px)' : 'clamp(27px, 5.4vw, 36px)',
                fontWeight: warm.weight.bold,
                color: warm.colors.textPrimary,
                lineHeight: 1.14,
                letterSpacing: '-0.022em',
              }}>
                Your first application is out
              </h2>
              <p style={{
                margin: 0,
                fontSize: 15,
                color: warm.colors.textSecondary,
                lineHeight: 1.6,
                maxWidth: 420,
                marginInline: 'auto',
                fontWeight: 450,
              }}>
                Most candidates spend two hours on an application like the one you just
                sent. You did it in minutes.
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
              {/*
                Was "Take a breath first", which is a nice thought and a dead
                end. Applications are half the job; the other half is that
                somebody inside the company knows your name. This sends them
                straight into the outreach tab with the generator on screen.
              */}
              <button
                onClick={() => { close(); navigate('/linkedin?tab=outreach'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: warm.colors.accentPetrol,
                  fontSize: 13.5,
                  fontWeight: warm.weight.semibold,
                  cursor: 'pointer',
                  padding: '8px 6px',
                  letterSpacing: '-0.01em',
                  textDecoration: 'underline',
                  textUnderlineOffset: 4,
                }}
              >
                Use the Networking Wizard
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
