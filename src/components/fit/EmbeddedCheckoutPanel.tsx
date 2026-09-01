/**
 * Stripe checkout, mounted in our page instead of on Stripe's.
 *
 * Only rendered when `embeddedCheckoutEnabled()` says so. Everything about what
 * is charged — the price, the plan, whether there is a trial — is decided on
 * the server by the same code the hosted redirect uses, so this cannot charge a
 * different amount from the button that opens it. All it does is mount the form.
 *
 * The Stripe SDK is imported lazily and only after the flag has been checked, so
 * an account that never turns this on never downloads it.
 */
import { useEffect, useRef, useState } from 'react';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { STRIPE_PUBLISHABLE_KEY } from '../../lib/embeddedCheckout';

const C = warm.colors;

/**
 * One Stripe instance for the tab.
 *
 * loadStripe injects a script and is expensive; calling it per mount would add
 * a script tag every time somebody opened and closed the offer. Kept as a
 * promise rather than an awaited value so concurrent mounts share one load.
 */
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
    if (!stripePromise) {
        stripePromise = import('@stripe/stripe-js').then((m) => m.loadStripe(STRIPE_PUBLISHABLE_KEY));
    }
    return stripePromise;
}

interface Props {
    /** The plan key to charge. The server owns what that costs. */
    plan: string;
    /** Told when the session could not be created, so the caller can fall back. */
    onError: (message: string) => void;
}

export function EmbeddedCheckoutPanel({ plan, onError }: Props) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [stripe, setStripe] = useState<Promise<Stripe | null> | null>(null);
    // The panel can unmount while either request is in flight — somebody closing
    // the offer — and setting state after that is a warning at best.
    const alive = useRef(true);
    // React 18 mounts effects twice in dev. Two mounts would create two Stripe
    // sessions, and the second would silently replace the first.
    const requested = useRef(false);

    useEffect(() => {
        alive.current = true;
        if (requested.current) return;
        requested.current = true;

        setStripe(getStripe());

        (async () => {
            try {
                const { data } = await api.post<{ clientSecret?: string }>('/stripe/checkout', {
                    plan,
                    uiMode: 'embedded',
                });
                if (!alive.current) return;
                if (!data?.clientSecret) throw new Error('no client secret');
                setClientSecret(data.clientSecret);
            } catch (err: unknown) {
                if (!alive.current) return;
                const status = (err as { response?: { status?: number } })?.response?.status;
                onError(
                    status === 410
                        ? 'Checkout is temporarily unavailable. Email kiron@aussiegradcareers.com.au and I will sort you out.'
                        : 'Could not open the payment form. Please try again.',
                );
            }
        })();

        return () => { alive.current = false; };
    }, [plan, onError]);

    if (!clientSecret || !stripe) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '48px 0', color: C.textMuted, fontSize: 14,
            }}>
                <Loader2 size={18} className="animate-spin" />
                Opening secure payment…
            </div>
        );
    }

    return (
        <div style={{ minHeight: 320 }}>
            <EmbeddedCheckoutProvider stripe={stripe} options={{ clientSecret }}>
                <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
        </div>
    );
}
