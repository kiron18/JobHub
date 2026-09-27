import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { MessageCircle, Check } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

const C = warm.colors;
const DISMISS_KEY = 'jobhub_whatsapp_coach_dismissed';

interface WhatsappState {
  verified: boolean;
  whatsappOptInLink: string;
}

/**
 * Opt-in card for the paid-member WhatsApp coach check-in (morning nudge +
 * evening review — see server/src/cron/coachCheckinCron.ts). One tap opens
 * WhatsApp pre-filled with "START <code>"; nothing is sent until that number
 * texts in first (see services/whatsappBaileys.ts for why).
 */
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

  if (!data || dismissed) return null;

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
      <p style={{ margin: '0 0 14px', fontSize: 13, color: C.textSecondary, lineHeight: 1.5 }}>
        A morning question to set up your day, and an evening check-in on how it went. It uses your real numbers, and typing your answers back is what turns a plan into a commitment. Your replies are saved for your weekly check-in.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        {qrDataUrl && <img src={qrDataUrl} alt="WhatsApp opt-in QR" width={80} height={80} style={{ borderRadius: 8, flexShrink: 0 }} />}
        <p style={{ margin: 0, fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>
          On this phone? Tap below.<br />On a computer? Scan this with your phone's camera.
        </p>
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
