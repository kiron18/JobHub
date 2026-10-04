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

/** Whether a body has a real link to click — the open/click dashboard shows
 * CTR as N/A rather than 0% when this is false, since there was never
 * anything to click in the first place. */
export function emailHasLinks(html: string | null | undefined): boolean {
  return !!html && /href="https?:\/\//.test(html);
}

/** Appends the open pixel and rewrites every http(s) link through the click
 * redirect, both keyed on the EmailSend row's id. Shared by sendEmail() and
 * any caller (e.g. the welcome resume email) that builds its own HTML and
 * sends through Resend directly instead of through sendEmail(). */
export function injectEmailTracking(html: string, trackingId: string): string {
  const baseUrl = process.env.API_URL ?? 'http://localhost:3002/api';
  const pixelUrl = `${baseUrl}/email/track/open/${trackingId}`;
  let out = `${html}\n<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;
  out = out.replace(/href="(https?:\/\/[^"]+)"/g, (_match: string, url: string) => {
    const encoded = encodeURIComponent(url);
    return `href="${baseUrl}/email/track/click/${trackingId}?url=${encoded}"`;
  });
  return out;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  trackingId?: string; // emailSendId — appended as tracking pixel if HTML
  /** ISO timestamp — passed straight to Resend's scheduled_at. */
  scheduledAt?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ resendEmailId: string | null; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[sendEmail] RESEND_API_KEY not set — skipping send');
    return { resendEmailId: null, error: 'RESEND_API_KEY not set' };
  }

  const html = params.bodyHtml && params.trackingId
    ? injectEmailTracking(params.bodyHtml, params.trackingId)
    : params.bodyHtml;

  try {
    const payload: Record<string, any> = {
      from: FROM_ADDRESS(),
      to: params.to,
      subject: params.subject,
      ...(params.bodyText ? { text: params.bodyText } : {}),
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
