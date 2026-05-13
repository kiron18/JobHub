import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface SkoolGateProps {
  onJoined: () => void;
}

type GateState = 'prompt' | 'success';

export function SkoolGate({ onJoined }: SkoolGateProps) {
  const queryClient = useQueryClient();
  const [gateState, setGateState] = useState<GateState>('prompt');
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(true);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Already joined — render nothing (gate is transparent)
  if (profile?.skoolJoined) return null;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.post('/skool/join', {});
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setGateState('success');
      setTimeout(() => {
        setVisible(false);
        setTimeout(onJoined, 500);
      }, 1200);
    } catch {
      setSubmitting(false);
    }
  }

  const name = profile?.name?.split(' ')[0] ?? 'there';
  const role = profile?.targetRole ?? 'your target role';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'linear-gradient(160deg, #060b14 0%, #0a1628 50%, #060b14 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            style={{
              maxWidth: 520, width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 24, padding: '40px 36px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
            }}
          >
            {gateState === 'prompt' && (
              <>
                <p style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
                  textTransform: 'uppercase', color: '#0F766E', marginBottom: 16,
                }}>
                  Aussie Grad Careers — Free Community
                </p>
                <h2 style={{
                  fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 900,
                  color: '#f3f4f6', lineHeight: 1.2, marginBottom: 20, letterSpacing: '-0.02em',
                }}>
                  Your diagnosis is ready, {name}.
                </h2>
                <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.75, marginBottom: 16 }}>
                  We've analysed your profile and put together a strategic breakdown of the
                  specific moves that will sharpen your <strong style={{ color: '#e5e7eb' }}>{role}</strong> applications.
                </p>
                <p style={{ fontSize: 18, color: '#e5e7eb', fontWeight: 800, lineHeight: 1.35, marginBottom: 28, letterSpacing: '-0.01em' }}>
                  Before you read it.<br />One quick step.
                </p>
                <p style={{ fontSize: 15, color: '#9ca3af', lineHeight: 1.75, marginBottom: 28 }}>
                  Join the free{' '}
                  <a href="https://www.skool.com/aussiegradcareers" target="_blank" rel="noopener noreferrer" style={{ color: '#2dd4bf', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    Aussie Grad Careers community
                  </a>
                  {' '}on Skool. It takes 30 seconds and costs nothing. Inside you'll find videos
                  and resources built around exactly the kinds of problems in your report.
                </p>
                <a
                  href="https://www.skool.com/aussiegradcareers"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleSubmit}
                  style={{
                    display: 'block', textAlign: 'center', textDecoration: 'none',
                    background: 'linear-gradient(135deg, #0F766E, #134E4A)',
                    color: 'white', borderRadius: 14, padding: '15px',
                    fontSize: 16, fontWeight: 800,
                    boxShadow: '0 6px 24px rgba(15,118,110,0.30)',
                    marginBottom: 12,
                    opacity: submitting ? 0.6 : 1,
                    pointerEvents: submitting ? 'none' : 'auto',
                  }}
                >
                  Join free on Skool →
                </a>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%', background: 'none',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: '#4b5563', borderRadius: 12, padding: '11px',
                    fontSize: 13, cursor: submitting ? 'default' : 'pointer',
                  }}
                >
                  Already a member? Continue →
                </button>
              </>
            )}

            {gateState === 'success' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: 22, fontWeight: 900, color: '#f3f4f6', marginBottom: 8 }}>
                  You're in.
                </p>
                <p style={{ fontSize: 15, color: '#9ca3af' }}>
                  Opening your report now.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
