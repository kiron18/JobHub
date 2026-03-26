import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.ALLOWED_ORIGIN ?? 'https://job-hub-snowy-ten.vercel.app';

export async function sendWelcomeEmail(to: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping welcome email');
    return;
  }
  await resend.emails.send({
    from: 'JobHub <onboarding@resend.dev>',
    to,
    subject: 'Your JobHub diagnosis is ready',
    text: [
      "G'day,",
      '',
      "Your diagnostic report is ready — head back to the app to see exactly what's been holding back your job search and your three-step fix.",
      '',
      APP_URL,
      '',
      "We'll also be sending you job opportunities we've hand-picked for your role and location soon. Stay tuned.",
      '',
      'The JobHub team',
    ].join('\n'),
  });
}
