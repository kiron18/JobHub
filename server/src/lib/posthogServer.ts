/**
 * Server-side PostHog capture.
 *
 * Exists for exactly one reason: the moment a payment truly succeeds is a
 * server-side fact (the Stripe webhook), and nothing the client does can be
 * trusted to report it — a tab closed one second after payment is a real
 * $250 that a client-only `payment_completed` would silently miss. Revenue
 * attribution ("which acquisition source produces the most revenue") is only
 * as good as this event's completeness.
 *
 * Capture is keyed by the same `userId` the client passes to
 * `identify()` (see src/lib/analytics.ts), so a server-fired event lands on
 * the same PostHog person as the browser session that started the funnel.
 *
 * Uses the project key (the same `phc_...` value as VITE_POSTHOG_KEY), not
 * the personal API key — that one is for the HogQL query surface in
 * routes/admin.ts and must never be used for capture.
 */
import { PostHog } from 'posthog-node';
import { createHash } from 'crypto';

const key = process.env.POSTHOG_PROJECT_KEY;
const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

export const posthogServer = key
  ? new PostHog(key, { host, flushAt: 1, flushInterval: 0 })
  : null;

/**
 * A deterministic RFC-4122 v5-shaped UUID derived from `seed`. Used as the
 * PostHog event `uuid` so a Stripe webhook redelivery of the same event
 * cannot double-count revenue — PostHog dedupes captures on event uuid, so
 * the same seed (e.g. a Stripe event id) always produces the same uuid and a
 * resend is dropped rather than re-counted.
 */
export function idempotencyUuid(seed: string): string {
  const hash = createHash('sha1').update(seed).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '5' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-');
}

export function captureServerEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  uuid?: string;
}) {
  if (!posthogServer) return;
  try {
    posthogServer.capture(params);
  } catch (err) {
    // Analytics must never take down a payment or email flow.
    console.warn('[posthogServer] capture failed (non-fatal):', (err as any)?.message ?? err);
  }
}
