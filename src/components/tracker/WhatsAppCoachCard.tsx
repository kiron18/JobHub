import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { MessageCircle, Check } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

const C = warm.colors;
const DISMISS_KEY = 'jobhub_whatsapp_coach_dismissed';

interface WhatsappState {
  /** Check-ins are switched on in this environment. Undefined: older server. */
  enabled?: boolean;
  verified: boolean;
  whatsappOptInLink: string;
}

/**
 * Opt-in card for the paid-member WhatsApp coach check-in (morning nudge +
 * evening review — see server/src/cron/coachCheckinCron.ts). One tap opens
 * WhatsApp pre-filled with "START <code>"; nothing is sent until that number
 * texts in first (see services/whatsappBaileys.ts for why).
 */
const SCAN_CSS = `@keyframes jh-scanline { 0% { top: 8%; } 50% { top: 86%; } 100% { top: 8%; } }`;

/** The QR inside camera-viewfinder corners with a sweeping scan line, so it
 *  reads at a glance as "scan this", not just a picture of a code. */
function ScanFrame({ src }: { src: string }) {
  const corner = (pos: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute', width: 22, height: 22, borderColor: C.accentPetrol, borderStyle: 'solid', borderWidth: 0, ...pos,
  });
  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0, padding: 10 }}>
      <style>{SCAN_CSS}</style>
      <span style={corner({ top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 })} />
      <span style={corner({ top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 })} />
      <span style={corner({ bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 })} />
      <span style={corner({ bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 })} />
      <img src={src} alt="QR code: scan with your phone's camera to start WhatsApp check-ins" width={120} height={120} style={{ display: 'block', borderRadius: 6 }} />
      <span style={{
        position: 'absolute', left: 12, right: 12, height: 2, borderRadius: 2,
        background: `linear-gradient(90deg, transparent, ${C.accentPetrol}, transparent)`,
        boxShadow: `0 0 8px ${C.accentPetrol}`, animation: 'jh-scanline 2.4s ease-in-out infinite',
      }} />
    </div>
  );
}

/** A phone with its camera pointed at the code. */
function PhoneScanIcon() {
  return (
    <svg width="46" height="64" viewBox="0 0 46 64" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="4" y="2" width="30" height="58" rx="6" stroke={C.accentPetrol} strokeWidth="2.5" fill="#fff" />
      <rect x="15" y="6" width="8" height="2.5" rx="1.25" fill={C.accentPetrol} />
      <path d="M11 20v-4h4M27 16h4v4M31 36v4h-4M15 40h-4v-4" stroke={C.accentPetrol} strokeWidth="2" strokeLinecap="round" />
      <rect x="15" y="22" width="4" height="4" fill={C.accentPetrol} /><rect x="21" y="22" width="4" height="4" fill={C.accentPetrol} />
      <rect x="15" y="28" width="4" height="4" fill={C.accentPetrol} /><rect x="21" y="30" width="4" height="4" fill={C.accentPetrol} />
      <path d="M36 28h8m0 0-3.5-3.5M44 28l-3.5 3.5" stroke={C.accentGoldBright} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WhatsAppCoachCard() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['tracker-whatsapp'],
    queryFn: async () => (await api.get('/tracker/whatsapp')).data as WhatsappState,
    staleTime: 30_000,
    // Verification happens outside the app (a WhatsApp text), so poll while
    // this card is showing the unverified state — it flips on its own once
    // the candidate sends START, no page reload needed.
    refetchInterval: (query) => (query.state.data?.verified ? false : 10_000),
  });

  useEffect(() => {
    if (!data?.whatsappOptInLink) return;
    QRCode.toDataURL(data.whatsappOptInLink, { width: 160, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [data?.whatsappOptInLink]);

  if (!data || dismissed || data.enabled === false) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  if (data.verified) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        borderRadius: 12, background: 'rgba(74,157,111,0.08)', border: '1px solid rgba(74,157,111,0.25)',
        marginBottom: 12, fontSize: 13, color: C.textSecondary,
      }}>
        <Check size={14} style={{ color: C.success, flexShrink: 0 }} />
        WhatsApp check-ins are on. Answer each one, it's what makes the plan stick.
      </div>
    );
  }

  return (
    <div style={{ background: C.bgSurface, border: `1px solid ${C.borderWhisper}`, borderRadius: 16, padding: '16px 20px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <MessageCircle size={14} style={{ color: C.accentPetrol }} />
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textSecondary }}>
          Daily check-ins on WhatsApp
        </span>
      </div>
      {/* Kiron's copy, 2026-09-30. */}
      <p style={{ margin: '0 0 16px', fontSize: 15, color: C.textSecondary, lineHeight: 1.6 }}>
        Consistency over time yields results, always, inevitably. The problem is life gets in the way.
        Scan the code to set up reminders and communication over WhatsApp, so you can move a little
        closer to your goal every day.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        {qrDataUrl && <ScanFrame src={qrDataUrl} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PhoneScanIcon />
          <p style={{ margin: 0, fontSize: 14, color: C.textSecondary, lineHeight: 1.5 }}>
            <strong style={{ color: C.textPrimary }}>On a computer?</strong> Point your phone's camera at the code.<br />
            <strong style={{ color: C.textPrimary }}>On your phone?</strong> Tap the button below.
          </p>
        </div>
      </div>

      <a
        href={data.whatsappOptInLink} target="_blank" rel="noopener noreferrer"
        style={{
          display: 'block', textAlign: 'center', width: '100%', padding: 11, borderRadius: 10,
          background: C.accentPetrol, color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
          marginBottom: 8,
        }}
      >
        Start check-ins on WhatsApp
      </a>
      <button
        onClick={dismiss}
        style={{ display: 'block', width: '100%', padding: '6px 0', background: 'none', border: 'none', fontSize: 12, color: C.textMuted, cursor: 'pointer' }}
      >
        Not now
      </button>
      <p style={{ margin: '6px 0 0', fontSize: 11.5, color: C.textMuted, textAlign: 'center' }}>Automated check-ins. Reply STOP any time.</p>
    </div>
  );
}
