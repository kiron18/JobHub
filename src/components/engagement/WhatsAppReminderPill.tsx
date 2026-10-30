import { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { warm, ACTION } from '../../lib/theme/warmTokens';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useWhatsappOptIn } from '../../hooks/useWhatsappOptIn';
import { WhatsAppOptInBody } from '../tracker/WhatsAppCoachCard';

/* ── WhatsAppReminderPill ──────────────────────────────────────────────
   The way into the WhatsApp coach check-in from the dashboard, sitting
   over the Day chip. The tracker has had the full card since September,
   but that is a page a member has to go looking for; this is the page
   they open every day.

   It is a pill and not the card because this strip sits above the paste
   box, and anything tall here pushes the one thing people came to use
   down the page. The pitch, the QR and the button open in a dialog.

   Tinted, not solid: "Check eligibility" is this page's one filled
   button and a second one would compete with it. WhatsApp's own green is
   also too light to carry white text (under 2:1), so the label is the
   product's dark success green on its soft tint.

   Shown only where a check-in will really arrive: check-ins switched on
   in this environment and the member on a paid plan. Once they are in,
   it settles to a quiet "on" line instead of disappearing, so there is
   somewhere to see that it worked.
*/

/** WhatsApp's mark (Simple Icons). lucide has no brand icons. */
function WhatsAppGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function WhatsAppReminderPill() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  // Poll only while the dialog is up: that is the only time the answer can
  // change, and this page is open all day.
  const { data, qrDataUrl } = useWhatsappOptIn(open);

  if (!data || data.enabled !== true || data.paid !== true) return null;

  if (data.verified && !open) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 12, fontWeight: 600, color: warm.colors.success, whiteSpace: 'nowrap',
      }}>
        <Check size={13} strokeWidth={2.6} aria-hidden="true" />
        WhatsApp reminders on
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          // 44px is the smallest target a thumb hits reliably.
          minHeight: isMobile ? 44 : 32, padding: '0 13px', borderRadius: 999,
          background: warm.colors.successSoft, border: `1px solid ${warm.colors.success}47`,
          color: warm.colors.success, fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
          whiteSpace: 'nowrap', cursor: 'pointer',
        }}
      >
        <WhatsAppGlyph />
        Get WhatsApp reminders
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Daily check-ins on WhatsApp">
        {data.verified ? (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: '50%', marginBottom: 12,
              background: warm.colors.successSoft, color: warm.colors.success,
            }}>
              <Check size={22} strokeWidth={2.6} aria-hidden="true" />
            </span>
            <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: warm.colors.textPrimary }}>
              You're set.
            </p>
            <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.6, color: warm.colors.textSecondary }}>
              Your first check-in arrives at the next 8am or 6pm, Sydney time. Answer each one, it's what makes the plan stick.
            </p>
            <button className="agc-action"
              type="button"
              onClick={() => setOpen(false)}
              style={{
                padding: '11px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
                ...ACTION, fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <WhatsAppOptInBody link={data.whatsappOptInLink} qrDataUrl={qrDataUrl} />
            <p style={{ margin: '6px 0 0', fontSize: 12, color: warm.colors.textMuted, textAlign: 'center' }}>
              Morning and evening, automated. Reply STOP any time.
            </p>
          </>
        )}
      </Modal>
    </>
  );
}
