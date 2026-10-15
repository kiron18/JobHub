/**
 * Counts a click from one of our emails.
 *
 * Every link to our own site in an email carries ?e=<send id> (see tagEmailLinks
 * in server/src/email/send/sendEmail.ts). On landing this reports it to the API
 * and takes it back out of the address, so it is not bookmarked, shared or
 * passed along to the next page.
 *
 * Runs once in main.tsx, before the app renders, so the router never sees the
 * parameter and no page has to know about it. A beacon, so it still goes out
 * when the page being landed on redirects straight away (/community does).
 * Never throws: a lost click must never cost anyone the page.
 */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const PARAM = 'e';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function recordEmailClick(): void {
  try {
    const url = new URL(window.location.href);
    const id = url.searchParams.get(PARAM);
    if (!id) return;

    url.searchParams.delete(PARAM);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);

    if (!UUID.test(id)) return;
    const endpoint = `${API_BASE}/email/landed?e=${encodeURIComponent(id)}&p=${encodeURIComponent(url.pathname)}`;
    if (!navigator.sendBeacon?.(endpoint)) {
      void fetch(endpoint, { method: 'POST', keepalive: true }).catch(() => {});
    }
  } catch {
    /* never in the way of the page */
  }
}
