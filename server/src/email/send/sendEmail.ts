import { Resend } from 'resend';

// Built lazily, not at import time: a standalone script that sets
// RESEND_API_KEY after this module is first imported (its own env file isn't
// loaded yet when the import graph resolves) would otherwise freeze in an
// unconfigured client forever.
let resend: Resend | null = null;
function resendClient(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}
const FROM_ADDRESS = () => process.env.EMAIL_FROM ?? 'Aussie Grad Careers <kiron@aussiegradcareers.com.au>';

/** Whether a body has a link to our own site, which is the only kind of click
 * that can be counted. The dashboard shows "no links" rather than 0% when it
 * does not, since there was never anything to click. */
export function emailHasLinks(html: string | null | undefined): boolean {
  if (!html) return false;
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    if (isTrackableLink(m[1].replace(/&amp;/g, '&'))) return true;
  }
  return false;
}

/** Our own sites. Only links to these are tagged; a link anywhere else
 * (Hunter, Skool, a Meet room) is left exactly as written. */
export const TRACKABLE_LINK_HOSTS = new Set([
  'aussiegradcareers.com.au',
  'www.aussiegradcareers.com.au',
  'aussiegradcareers.com',
  'www.aussiegradcareers.com',
  'job-hub.vercel.app',
]);

export function isTrackableLink(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && TRACKABLE_LINK_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/** The query parameter an emailed link carries. The site reads it on landing
 * (src/lib/emailClick.ts), records the click and removes it from the address. */
export const EMAIL_CLICK_PARAM = 'e';

/**
 * Tags every link to our own site with the EmailSend row's id, so a click is
 * recorded when the page loads.
 *
 * Until 2026-10-15 this added our own open pixel and sent every link through a
 * redirect on the API's host. That host was never configured on production, so
 * every button in every client email from 6 October pointed at localhost and
 * nothing was ever recorded. Links now stay on our own domain and go straight
 * to the page: nothing in between to break, and no mismatched link domain for
 * spam filters to hold against us. Opens, deliveries and bounces come from
 * Resend's webhook instead (email/tracking/resendWebhook.ts).
 *
 * `trackLinks: false` leaves every link alone, for emails whose links carry a
 * login token.
 */
export function tagEmailLinks(html: string, trackingId: string, opts: { trackLinks?: boolean } = {}): string {
  if (opts.trackLinks === false) return html;
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (match: string, raw: string) => {
    const url = raw.replace(/&amp;/g, '&');
    if (!isTrackableLink(url)) return match;
    const u = new URL(url);
    u.searchParams.set(EMAIL_CLICK_PARAM, trackingId);
    return `href="${u.toString().replace(/&/g, '&amp;')}"`;
  });
}

/** The same for a plain-text body, where links are bare addresses. Trailing
 * punctuation stays outside the link, so "see https://x.com/tracker." still
 * opens /tracker. */
export function tagTextLinks(text: string, trackingId: string, opts: { trackLinks?: boolean } = {}): string {
  if (opts.trackLinks === false) return text;
  return text.replace(/https:\/\/[^\s<>"']+/g, (found: string) => {
    const tail = found.match(/[.,;:!?)\]]+$/)?.[0] ?? '';
    const url = tail ? found.slice(0, -tail.length) : found;
    if (!isTrackableLink(url)) return found;
    const u = new URL(url);
    u.searchParams.set(EMAIL_CLICK_PARAM, trackingId);
    return u.toString() + tail;
  });
}

export interface SendEmailParams {
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  trackingId?: string; // EmailSend id, tagged onto links to our own site
  /** ISO timestamp — passed straight to Resend's scheduled_at. */
  scheduledAt?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ resendEmailId: string | null; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[sendEmail] RESEND_API_KEY not set — skipping send');
    return { resendEmailId: null, error: 'RESEND_API_KEY not set' };
  }

  const html = params.bodyHtml && params.trackingId
    ? tagEmailLinks(params.bodyHtml, params.trackingId)
    : params.bodyHtml;
  const text = params.bodyText && params.trackingId
    ? tagTextLinks(params.bodyText, params.trackingId)
    : params.bodyText;

  try {
    const payload: Record<string, any> = {
      from: FROM_ADDRESS(),
      to: params.to,
      subject: params.subject,
      ...(text ? { text } : {}),
      ...(html ? { html } : {}),
      ...(params.scheduledAt ? { scheduled_at: params.scheduledAt } : {}),
    };
    const result = await resendClient().emails.send(payload as any);
    return { resendEmailId: result.data?.id ?? null };
  } catch (err: any) {
    console.error('[sendEmail] Resend error:', err.message);
    return { resendEmailId: null, error: err.message };
  }
}
