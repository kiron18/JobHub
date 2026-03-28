import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

interface Theme {
  bg: string; card: string; cardBorder: string; cardShadow: string;
  text: string; textMuted: string; textFaint: string;
  btnBg: string; btnText: string; btnShadow: string;
  progressBg: string; progressFill: string;
  blobGrad: string; blobShadow: string;
}

interface ProcessingScreenProps {
  isDark: boolean;
  theme: Theme;
  email?: string;
  onComplete: () => void;
  onRetry: () => void;
}

const MESSAGES = [
  "Righto, let's see what we're working with...",
  "Digging through your resume. There's good stuff in here, trust.",
  "Mapping out where you've been dropping off. We got you.",
  "This is the bit that actually changes things, hang tight...",
  "Nearly there. Your diagnosis is coming together nicely.",
  "Last bit of thinking... you're about to see exactly what's been holding you back.",
];
const FALLBACK_MESSAGE = "Still cooking, won't be long...";
const FAILED_MESSAGE   = "Something went sideways, but we've got your data.";

const BAR_DURATION_MS = 30_000;
const POLL_INTERVAL_MS = 3_000;
const MESSAGE_INTERVAL_MS = 8_000;

export function ProcessingScreen({ isDark: _isDark, theme: T, email, onComplete, onRetry }: ProcessingScreenProps) {
  const queryClient = useQueryClient();
  const [barWidth, setBarWidth] = useState(100);
  const [msgIndex, setMsgIndex] = useState(0);
  const [status, setStatus] = useState<'processing' | 'failed' | 'done'>('processing');
  const [msgVisible, setMsgVisible] = useState(true);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const barRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMs = useRef(Date.now());

  // Bar depletion
  useEffect(() => {
    barRef.current = setInterval(() => {
      const elapsed = Date.now() - startMs.current;
      const pct = Math.max(3, 100 - (elapsed / BAR_DURATION_MS) * 97);
      setBarWidth(pct);
    }, 200);
    return () => { if (barRef.current) clearInterval(barRef.current); };
  }, []);

  // Message rotation
  useEffect(() => {
    msgRef.current = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIndex(i => i + 1);
        setMsgVisible(true);
      }, 300);
    }, MESSAGE_INTERVAL_MS);
    return () => { if (msgRef.current) clearInterval(msgRef.current); };
  }, []);

  // Polling
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get<{ status: string }>('/onboarding/report');
        if (data.status === 'COMPLETE') {
          clearInterval(pollRef.current!);
          clearInterval(msgRef.current!);
          clearInterval(barRef.current!);
          setBarWidth(0);
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          setTimeout(() => {
            setStatus('done');
            onComplete();
          }, 500);
        } else if (data.status === 'FAILED') {
          clearInterval(pollRef.current!);
          clearInterval(msgRef.current!);
          clearInterval(barRef.current!);
          setStatus('failed');
        }
      } catch {
        // Network hiccup — keep polling
      }
    }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [onComplete, queryClient]);

  const currentMessage = msgIndex < MESSAGES.length
    ? MESSAGES[msgIndex]
    : FALLBACK_MESSAGE;

  return (
    <div style={{
      minHeight: '100dvh',
      background: T.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: T.card,
        border: `1px solid ${T.cardBorder}`,
        boxShadow: T.cardShadow,
        borderRadius: 28,
        padding: 40,
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
      }}>
        {/* Countdown bar */}
        <div style={{
          height: 4,
          borderRadius: 2,
          background: T.progressBg,
          marginBottom: 36,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${barWidth}%`,
            background: T.progressFill,
            borderRadius: 2,
            transition: status === 'done'
              ? 'width 0.4s ease'
              : 'width 0.2s linear',
          }} />
        </div>

        {/* Message */}
        {status === 'processing' && (
          <>
            <p style={{
              fontSize: 16,
              fontWeight: 500,
              color: T.text,
              lineHeight: 1.6,
              textAlign: 'center',
              opacity: msgVisible ? 1 : 0,
              transition: 'opacity 0.3s ease',
              minHeight: 52,
            }}>
              {currentMessage}
            </p>
            {email && (
              <p style={{
                fontSize: 12,
                color: T.textMuted,
                textAlign: 'center',
                marginTop: 20,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(99,102,241,0.07)',
                border: '1px solid rgba(99,102,241,0.15)',
                lineHeight: 1.6,
              }}>
                📧 Check <strong style={{ color: T.text }}>{email}</strong> for a confirmation link — click it to secure your account and access it from any device.
              </p>
            )}
          </>
        )}

        {status === 'failed' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: T.text, marginBottom: 20 }}>
              {FAILED_MESSAGE}
            </p>
            <button
              onClick={onRetry}
              style={{
                background: T.btnBg,
                color: T.btnText,
                border: 'none',
                borderRadius: 12,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: T.btnShadow,
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
