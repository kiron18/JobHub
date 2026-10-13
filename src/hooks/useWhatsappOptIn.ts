import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import api from '../lib/api';

export interface WhatsappState {
  /** Check-ins are switched on in this environment. Undefined: older server. */
  enabled?: boolean;
  /** On a paid plan, so check-ins will actually reach them. Undefined: older server. */
  paid?: boolean;
  verified: boolean;
  whatsappOptInLink: string;
}

/**
 * The WhatsApp coach check-in opt-in state plus its QR, shared by the tracker
 * card (tracker/WhatsAppCoachCard.tsx) and the dashboard pill
 * (engagement/WhatsAppReminderPill.tsx).
 *
 * Verification happens outside the app (a WhatsApp text), so while `poll` is
 * on and the member is unverified this refetches every 10s and flips on its
 * own once they send START, no page reload needed.
 */
export function useWhatsappOptIn(poll: boolean) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['tracker-whatsapp'],
    queryFn: async () => (await api.get('/tracker/whatsapp')).data as WhatsappState,
    staleTime: 30_000,
    refetchInterval: (query) => (poll && !query.state.data?.verified ? 10_000 : false),
  });

  useEffect(() => {
    if (!data?.whatsappOptInLink) return;
    QRCode.toDataURL(data.whatsappOptInLink, { width: 160, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [data?.whatsappOptInLink]);

  return { data, qrDataUrl };
}
