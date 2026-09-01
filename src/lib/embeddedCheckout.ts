/**
 * The flag on in-page payment.
 *
 * Stripe's embedded checkout mounts the real card form inside our own page, so
 * somebody who has just watched their application being written never leaves
 * the screen it was written on. That is worth a conversion test, and it is also
 * the payment path on a live key, so it ships dark and gets turned on
 * deliberately rather than by being merged.
 *
 * Two things have to be true, and the second is not optional:
 *
 *   VITE_EMBEDDED_CHECKOUT=true      — somebody chose this.
 *   VITE_STRIPE_PUBLISHABLE_KEY=pk_… — the browser cannot mount checkout without
 *                                      it, and a flag on with no key would take
 *                                      the redirect away and put nothing back.
 *
 * With either missing, every caller falls back to the hosted redirect, which is
 * the path that has always worked. Neither is a secret: the publishable key is
 * designed to be public. The SECRET key stays on the server and must never
 * reach a VITE_ variable, because every VITE_ value is compiled into the bundle
 * and served to anyone who asks.
 */

/** Stripe's public key for this account. Safe in the bundle; `pk_`, never `sk_`. */
export const STRIPE_PUBLISHABLE_KEY: string =
    (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ?? '';

/** True only when in-page payment was switched on AND can actually run. */
export function embeddedCheckoutEnabled(): boolean {
    return (
        import.meta.env.VITE_EMBEDDED_CHECKOUT === 'true'
        && STRIPE_PUBLISHABLE_KEY.startsWith('pk_')
    );
}
