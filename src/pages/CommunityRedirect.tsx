/* ────────────────────────────────────────────────────────────────────────────
   CommunityRedirect — /community

   A branded, measurable front door to the free Skool group. Every place the
   group is mentioned points here rather than at skool.com directly, for three
   reasons:

     1. The destination can change without touching a confirmation screen, an
        email template or a printed link.
     2. The click is attributable. `?src=` says which moment produced the
        member: the confirmation screen, the Meet chat, a follow-up email, a DM.
        `?lead=` says WHO, when the link was built somewhere that knew, and that
        one lands on the sales board rather than in analytics.
        Nothing else in this funnel has ever been attributable.
     3. It reads as ours in a chat window, which matters when it is pasted into
        a room of people deciding whether to trust us.

   It is a page rather than a static 308 precisely because of (2): a redirect at
   the edge is invisible to analytics.
   ──────────────────────────────────────────────────────────────────────────── */
import { useEffect } from 'react';
import { trackCommunityClick } from '../lib/analytics';

/** The free group. Overridable at build time so it moves without a code change. */
const SKOOL_URL =
  import.meta.env.VITE_SKOOL_GROUP_URL || 'https://www.skool.com/touch-grass-5787/about';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

/** Where the click came from. Unknown is a real answer worth counting. */
const KNOWN_SOURCES = ['confirm', 'chat', 'email', 'dm', 'post', 'profile', 'app', 'receipts'];

export default function CommunityRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('src') || '').toLowerCase().trim();
    const src = KNOWN_SOURCES.includes(raw) ? raw : raw ? 'other' : 'none';

    trackCommunityClick(src, raw || null);

    // ── The same click, stamped against the person ──────────────────────────
    // PostHog answers "how many clicked". This answers "which fourteen people",
    // which is the only version of the question the sales board can act on.
    //
    // `lead` is present only when the link was built somewhere that knew who
    // they were: the confirmation screen, mostly. A bare /community visit is
    // still counted above, just anonymously, and that is fine.
    //
    // sendBeacon rather than fetch: this page is about to unload, and a beacon
    // is the one request the browser guarantees to finish anyway. Falls back to
    // a keepalive fetch where it is missing, and gives up silently if both fail
    // — a lost stamp must never cost them the redirect.
    const leadId = (params.get('lead') || '').trim();
    if (leadId) {
      const url = `${API_BASE}/session-signup/skool-click?lead=${encodeURIComponent(leadId)}`;
      try {
        if (!navigator.sendBeacon?.(url)) {
          void fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
        }
      } catch {
        void fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
      }
    }

    // A beat, so the capture has a chance to leave the page before it unloads.
    // PostHog batches, and a synchronous redirect drops the event often enough
    // to make the numbers untrustworthy, which would defeat the whole point.
    //
    // `replace` rather than `assign`: back should return them to wherever they
    // came from, not bounce them straight back out to Skool.
    const t = window.setTimeout(() => {
      window.location.replace(SKOOL_URL);
    }, 220);

    return () => window.clearTimeout(t);
  }, []);

  // Shown for a fifth of a second normally, and indefinitely if the redirect is
  // blocked, which is the only reason the manual link is here.
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        textAlign: 'center',
        background: '#FBF9F5',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        color: '#1A1814',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600 }}>
        Taking you to the group…
      </p>
      <a
        href={SKOOL_URL}
        style={{ fontSize: '0.9375rem', color: '#2D5A6E', textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        Tap here if nothing happens
      </a>
    </div>
  );
}
