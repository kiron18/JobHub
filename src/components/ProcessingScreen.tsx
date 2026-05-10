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
  name?: string;
  targetRole?: string;
  onComplete: () => void;
  onRetry: () => void;
}

const MESSAGES = [
  "Reading how you've positioned your experience...",
  "Parsing your resume structure and layout...",
  "Cross-referencing against Australian hiring expectations...",
  "Checking for signals that get filtered before a human reads it...",
  "Identifying how a recruiter reads your first page in 6 seconds...",
  "Scanning for the gaps that typically go unspoken in rejections...",
  "Connecting your documents to your actual results...",
  "Pinpointing exactly where your funnel breaks down...",
  "Building your three-step fix, ranked by impact...",
  "Writing the section most candidates find confronting...",
  "The hard part: being specific without softening it...",
  "Almost there — pulling everything together now...",
  "This is the diagnosis most people never get to see...",
  "Get ready. This one hits hard.",
];

const HUMAN_ASIDES = [
  "Oh, that's an interesting way to frame it...",
  "Most people undersell this section. Let's see.",
  "OK — the structure here is going to tell us a lot.",
  "This bit matters more than most realise.",
  "Reading between the lines now.",
  "There's something worth flagging here — noting it.",
  "Not many candidates get this part right. Checking yours.",
  "This is the section recruiters spend the least time on. That's telling.",
  "Actually, this is doing more heavy lifting than it looks.",
  "Hm. There's a pattern forming here.",
  "This is where it usually gets interesting.",
  "Checking how this reads to someone who's seen hundreds of these.",
];

const ROLE_DEMONYMS: Record<string, string> = {
  marketing: 'marketers',
  sales: 'salespeople',
  engineering: 'engineers',
  software: 'software engineers',
  finance: 'finance professionals',
  design: 'designers',
  product: 'product managers',
  hr: 'HR professionals',
  'human resources': 'HR professionals',
  operations: 'operations professionals',
  accounting: 'accountants',
  legal: 'lawyers',
  healthcare: 'healthcare professionals',
  nursing: 'nurses',
  education: 'educators',
  teaching: 'teachers',
  data: 'data professionals',
  management: 'managers',
  administration: 'administrators',
  logistics: 'logistics professionals',
  retail: 'retail professionals',
  hospitality: 'hospitality professionals',
};

function getRoleDemonym(targetRole: string): string {
  const key = targetRole.toLowerCase().trim();
  if (ROLE_DEMONYMS[key]) return ROLE_DEMONYMS[key];
  for (const [k, v] of Object.entries(ROLE_DEMONYMS)) {
    if (key.includes(k)) return v;
  }
  return `${targetRole} professionals`;
}

function getRoleAsides(role: string): string[] {
  const demonym = getRoleDemonym(role);
  return [
    `${role} roles in Australia shortlist fast — checking how clearly yours signals fit...`,
    `Comparing against what actually gets ${demonym} to interview stage...`,
    `There's a gap between what ${demonym} write and what hiring managers look for. Measuring yours.`,
  ];
}

const FALLBACK_MESSAGE = "Still running — this one's thorough...";
const FAILED_MESSAGE   = "Something went sideways, but we've got your data.";

const BAR_DURATION_MS = 150_000;
const POLL_INTERVAL_MS = 3_000;
const MESSAGE_INTERVAL_MS = 10_000;
const ASIDE_INTERVAL_MS   = 13_000;

export function ProcessingScreen({ isDark: _isDark, theme: T, email, name, targetRole, onComplete, onRetry }: ProcessingScreenProps) {
  const queryClient = useQueryClient();
  const [barWidth, setBarWidth]     = useState(100);
  const [msgIndex, setMsgIndex]     = useState(0);
  const [asideIndex, setAsideIndex] = useState(0);
  const [status, setStatus]         = useState<'processing' | 'failed' | 'done'>('processing');
  const [msgVisible, setMsgVisible]     = useState(true);
  const [asideVisible, setAsideVisible] = useState(false);

  const allAsides = targetRole
    ? [...getRoleAsides(targetRole), ...HUMAN_ASIDES]
    : HUMAN_ASIDES;

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const asideRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMs  = useRef(Date.now());

  // Bar depletion
  useEffect(() => {
    barRef.current = setInterval(() => {
      const elapsed = Date.now() - startMs.current;
      const pct = Math.max(3, 100 - (elapsed / BAR_DURATION_MS) * 97);
      setBarWidth(pct);
    }, 200);
    return () => { if (barRef.current) clearInterval(barRef.current); };
  }, []);

  // Main message rotation
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

  // Aside rotation — starts after 5 s delay, then every 13 s, offset from main messages
  useEffect(() => {
    const delay = setTimeout(() => {
      setAsideVisible(true);
      asideRef.current = setInterval(() => {
        setAsideVisible(false);
        setTimeout(() => {
          setAsideIndex(i => i + 1);
          setAsideVisible(true);
        }, 400);
      }, ASIDE_INTERVAL_MS);
    }, 5_000);
    return () => {
      clearTimeout(delay);
      if (asideRef.current) clearInterval(asideRef.current);
    };
  }, []);

  // Polling
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get<{ status: string }>('/onboarding/report');
        console.log('[ProcessingScreen] poll response — status:', data.status);
        if (data.status === 'COMPLETE') {
          clearInterval(pollRef.current!);
          clearInterval(msgRef.current!);
          clearInterval(asideRef.current!);
          clearInterval(barRef.current!);
          setBarWidth(0);
          // BUG FIX: Clear reportSeen BEFORE invalidating queries. If we clear it after,
          // the profile refetch can complete and mount ReportOrDashboard while the flag
          // still says 'true', causing it to show the Dashboard instead of the Report.
          console.log('[ProcessingScreen] COMPLETE — clearing reportSeen BEFORE invalidating queries');
          localStorage.removeItem('jobhub_report_seen');
          await queryClient.invalidateQueries({ queryKey: ['profile'] });
          await queryClient.invalidateQueries({ queryKey: ['report'] });
          console.log('[ProcessingScreen] queries invalidated — calling onComplete in 500ms');
          setTimeout(() => {
            setStatus('done');
            onComplete();
          }, 500);
        } else if (data.status === 'FAILED') {
          clearInterval(pollRef.current!);
          clearInterval(msgRef.current!);
          clearInterval(asideRef.current!);
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

  const currentAside = allAsides[asideIndex % allAsides.length];

  return (
    <div style={{
      minHeight: '100dvh',
      background: T.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes lava1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          25% { transform: translate(70px, -90px) scale(1.18); }
          50% { transform: translate(-30px, 60px) scale(0.88); }
          75% { transform: translate(50px, 20px) scale(1.05); }
        }
        @keyframes lava2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(-80px, 50px) scale(0.85); }
          66% { transform: translate(60px, -70px) scale(1.2); }
        }
        @keyframes lava3 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          40% { transform: translate(40px, 80px) scale(1.1); }
          80% { transform: translate(-50px, -30px) scale(0.9); }
        }
      `}</style>

      {/* Lava lamp blobs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {([
          { size: 480, color: 'rgba(88,80,236,0.13)', anim: 'lava1 14s ease-in-out infinite', top: '-10%', left: '-8%', bottom: undefined, right: undefined },
          { size: 380, color: 'rgba(139,92,246,0.09)', anim: 'lava2 17s ease-in-out infinite', top: undefined, left: undefined, bottom: '-8%', right: '-6%' },
          { size: 300, color: 'rgba(99,102,241,0.07)', anim: 'lava3 11s ease-in-out infinite', top: '35%', left: '45%', bottom: undefined, right: undefined },
        ] as const).map((b, i) => (
          <div key={i} style={{
            position: 'absolute', width: b.size, height: b.size, borderRadius: '50%',
            background: `radial-gradient(circle at 40% 35%, ${b.color} 0%, transparent 68%)`,
            animation: b.anim,
            top: b.top, left: b.left, bottom: b.bottom, right: b.right,
          }} />
        ))}
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
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

        {/* Name / role header */}
        {(name || targetRole) && (
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            {name && (
              <p style={{ fontSize: 13, fontWeight: 700, color: T.textMuted, margin: '0 0 4px', letterSpacing: '0.01em' }}>
                {name}
              </p>
            )}
            {targetRole && (
              <p style={{ fontSize: 11, fontWeight: 600, color: T.textFaint, margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {targetRole}
              </p>
            )}
          </div>
        )}

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
              marginBottom: 8,
            }}>
              {currentMessage}
            </p>
            <p style={{
              fontSize: 13,
              fontStyle: 'italic',
              color: T.textFaint,
              textAlign: 'center',
              minHeight: 22,
              opacity: asideVisible ? 1 : 0,
              transition: 'opacity 0.4s ease',
              marginBottom: 20,
            }}>
              {currentAside}
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
                Your report and personalised recommendations will be sent to <strong style={{ color: T.text }}>{email}</strong> once ready.
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
