import twilio from 'twilio';

/**
 * WhatsApp sending for the trial-challenge reminder, via Twilio's WhatsApp
 * Business API.
 *
 * Business-initiated WhatsApp messages (anything outside a live 24h customer
 * conversation the recipient started) MUST use a Meta-approved template — this
 * is a Meta platform rule, not a Twilio limitation, and it cannot be worked
 * around by formatting nice text here. Before this can send a single real
 * message: a WhatsApp Business Account has to be connected to Twilio (Business
 * Manager verification — historically takes days), and the exact reminder
 * wording has to be submitted as a template and approved (also days, not
 * guaranteed). Until TWILIO_TEMPLATE_SID_TRIAL_REMINDER is set, this
 * degrades to a log line and the reminder cron still sends the email half.
 */
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'
const templateSid = process.env.TWILIO_TEMPLATE_SID_TRIAL_REMINDER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export function whatsappConfigured(): boolean {
  return Boolean(client && fromWhatsApp && templateSid);
}

export async function sendTrialChallengeReminderWhatsApp(
  to: string,
  variables: Record<string, string>,
): Promise<void> {
  if (!whatsappConfigured()) {
    console.warn('[whatsapp] Twilio not fully configured (account/from/template) — skipping trial reminder');
    return;
  }
  await client!.messages.create({
    from: fromWhatsApp!,
    to: `whatsapp:${to}`,
    contentSid: templateSid!,
    contentVariables: JSON.stringify(variables),
  });
}
