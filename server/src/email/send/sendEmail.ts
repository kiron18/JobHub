import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'Aussie Grad Careers <kiron@aussiegradcareers.com.au>';

export interface SendEmailParams {
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  trackingId?: string; // emailSendId — appended as tracking pixel if HTML
}

export async function sendEmail(params: SendEmailParams): Promise<{ resendEmailId: string | null; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[sendEmail] RESEND_API_KEY not set — skipping send');
    return { resendEmailId: null, error: 'RESEND_API_KEY not set' };
  }

  let html = params.bodyHtml;
  if (html && params.trackingId) {
    const baseUrl = process.env.API_URL ?? 'http://localhost:3002/api';
    const pixelUrl = `${baseUrl}/email/track/open/${params.trackingId}`;
    html += `\n<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`;
    html = html.replace(/href="(https?:\/\/[^"]+)"/g, (_match: string, url: string) => {
      const encoded = encodeURIComponent(url);
      return `href="${baseUrl}/email/track/click/${params.trackingId}?url=${encoded}"`;
    });
  }

  try {
    const payload: Record<string, any> = {
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.subject,
      ...(params.bodyText ? { text: params.bodyText } : {}),
      ...(html ? { html } : {}),
    };
    const result = await resend.emails.send(payload as any);
    return { resendEmailId: result.data?.id ?? null };
  } catch (err: any) {
    console.error('[sendEmail] Resend error:', err.message);
    return { resendEmailId: null, error: err.message };
  }
}
