import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { EASE, SPRING, prefersReducedMotion } from '../../lib/theme/motion';
import { haptic } from '../../lib/feedback';
import { closeoutLineFor } from '../../lib/closeoutLines';
import { useAuth } from '../../contexts/AuthContext';

/* ── DailyCloseOut ─────────────────────────────────────────────────────
   The Duolingo/Wordle moment: once the day's applications are actually
   done, say so plainly and let the session end, instead of the day just
   fizzling out after the last quiet applause.ts toast.

   Fires once per AEST day — gated server-side via closeoutSeenDate
   (server/src/services/tracker/closeout.ts) — so it survives a refresh
   and never repeats across tabs or devices. Mounted once, globally, same
   reasoning as CelebrationHost: whichever screen the goal-crossing
   application happened on, this is what plays.

   Unlike Celebration's toast (deliberately small — it fires up to a dozen
   times a day), this fires exactly once, so a brief centred card earns its
   moment without becoming a toll gate.
*/

interface CloseoutState {
  eligible: boolean;
  appliedToday: number;
  goal: number;
  dailyStreak: number;
}

export function DailyCloseOut() {
  const { user } = useAuth();
  const isAuthenticated = !!user && !(user as any).is_anonymous;
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const reduced = prefersReducedMotion();

  const { data } = useQuery({
    queryKey: ['tracker-closeout'],
    queryFn: async () => (await api.get('/tracker/closeout')).data as CloseoutState,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.eligible) {
      haptic('success');
      setVisible(true);
    }
  }, [data?.eligible]);

  const ackMutation = useMutation({
    mutationFn: async () => (await api.post('/tracker/closeout/ack')).data as CloseoutState,
    onSuccess: updated => queryClient.setQueryData(['tracker-closeout'], updated),
  });

  const dismiss = () => {
    setVisible(false);
    ackMutation.mutate();
  };

  if (!data) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="closeout-backdrop"
          onClick={dismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 5000,
            background: 'rgba(20,16,12,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <motion.div
            key="closeout-card"
            onClick={e => e.stopPropagation()}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: EASE.in } }}
            transition={reduced ? { duration: 0.12 } : SPRING.arrive}
            style={{
              width: '100%', maxWidth: 340,
              background: warm.colors.bgSurface,
              border: `1px solid ${warm.colors.borderWhisper}`,
              borderRadius: warm.radius.card,
              boxShadow: warm.shadow.lifted,
              padding: '28px 26px 22px',
              textAlign: 'center',
            }}
          >
            <div style={{
              fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: warm.colors.success, marginBottom: 10,
            }}>
              Day done
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: warm.colors.textPrimary, marginBottom: 6 }}>
              {data.appliedToday} of {data.goal}
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: warm.colors.textSecondary, lineHeight: 1.5 }}>
              {closeoutLineFor(data.dailyStreak)}
            </p>
            {data.dailyStreak > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 999,
                fontSize: 12, fontWeight: 800, background: 'rgba(196,113,58,0.12)', color: '#C4713A',
                marginBottom: 18,
              }}>
                <Flame size={12} /> {data.dailyStreak}-day streak
              </div>
            )}
            <div>
              <button
                onClick={dismiss}
                style={{
                  padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none',
                  cursor: 'pointer', background: warm.colors.accentPetrol, color: 'white',
                }}
              >
                See you tomorrow
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
