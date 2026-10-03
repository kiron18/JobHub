/**
 * POST /api/track — the funnel's first-party relay into PostHog.
 *
 * Ad blockers drop requests to posthog.com, and before 2026-10-03 that hid
 * whole people: signups who never appeared in PostHog at all. The front door's
 * funnel events (every welcome step, the email outcome, the trial offer) are
 * posted here instead, to our own API, and captured server-side. A blocker
 * that never sees a posthog.com request has nothing to block.
 *
 * Who the event belongs to, in order:
 *   1. the signed-in account,
 *   2. the browser's PostHog id (ph_id), so it joins that visitor's own events,
 *   3. our own first-party visitor id (vid), when PostHog never loaded.
 * /welcome/finish aliases the vid onto the account at signup, so a blocked
 * visitor still comes out as one person from first visit to trial.
 *
 * Public and unauthenticated by necessity, so it only takes a fixed list of
 * event names and property keys, and is rate limited per IP.
 */
import { Router, Request, Response } from 'express';
import { optionalAuthenticate, AuthRequest } from '../middleware/auth';
import { captureServerEvent } from '../lib/posthogServer';

const router = Router();

/** The only events this endpoint will record. */
export const RELAYED_EVENTS = new Set([
  'welcome_step_viewed',
  'welcome_step_failed',
  'welcome_completed',
  'email_submitted',
  'email_outcome',
  'trial_offer_viewed',
  'closed_route_redirected',
]);

/** Property keys that pass through. Everything else is dropped. */
const ALLOWED_PROPS = new Set([
  'step', 'step_index', 'reason', 'new_user', 'outcome', 'email_domain', 'day', 'from',
  'acquisition_source', 'landing_page',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  '$current_url', '$pathname', '$referrer', '$referring_domain', '$session_id',
  'is_mobile',
]);

// Per-IP: generous for a real visitor clicking through every step, tight for a script.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 150;
const hits = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (now >= h.resetAt) hits.delete(ip);
}, WINDOW_MS).unref();

function overLimit(req: Request): boolean {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now >= h.resetAt) { hits.set(ip, { count: 1, resetAt: now + WINDOW_MS }); return false; }
  h.count += 1;
  return h.count > MAX_PER_WINDOW;
}

const shortString = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined;

/** Who a front-door event belongs to when there is no account yet. Shared
 * with routes/welcome.ts so both sides key a visitor the same way. */
export function anonymousId(body: any, token?: string | null): string | undefined {
  const ph = shortString(body?.ph_id);
  if (ph) return ph;
  const vid = shortString(body?.vid, 64);
  if (vid && /^[A-Za-z0-9-]+$/.test(vid)) return `visitor:${vid}`;
  return token ? `welcome:${token}` : undefined;
}

/** The site the request came from, as PostHog's $host, so staging and local
 * runs filter out of the live numbers the same way browser events do. */
export function originHost(req: Request): string | undefined {
  const origin = req.get('origin') || req.get('referer');
  try { return origin ? new URL(origin).host : undefined; } catch { return undefined; }
}

router.post('/', optionalAuthenticate, (req: AuthRequest, res: Response) => {
  // Always 204: a tracking call must never surface an error to the visitor.
  if (overLimit(req)) { res.status(204).end(); return; }

  const event = req.body?.event;
  if (typeof event !== 'string' || !RELAYED_EVENTS.has(event)) { res.status(204).end(); return; }

  const distinctId = req.user?.id || anonymousId(req.body, shortString(req.body?.token, 64));
  if (!distinctId) { res.status(204).end(); return; }

  const raw = req.body?.props && typeof req.body.props === 'object' ? req.body.props : {};
  const properties: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!ALLOWED_PROPS.has(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean') properties[k] = v;
    else if (typeof v === 'string' && v.length <= 500) properties[k] = v;
  }

  captureServerEvent({
    distinctId,
    event,
    properties: { ...properties, $host: originHost(req), source: 'relay', ...(req.body?.ph_id ? {} : { posthog_blocked: true }) },
  });
  res.status(204).end();
});

export { router as trackRouter };
