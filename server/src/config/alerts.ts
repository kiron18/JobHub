/**
 * How loudly the "PAID BUT UNMATCHED" admin alert speaks.
 *
 * The sweep records every payer it cannot tie to a JobHub account. Emailing
 * about each one was meant as a safety net, but a payer who is legitimately
 * never going to have an account (a workshop ticket bought through a payment
 * link, say) stays unmatched forever, so the weekly re-nag turned into a
 * standing pile of mail with no action behind it.
 *
 * Off by default. The record still lands in UnmatchedPayment and the sweep
 * still logs every one, so nothing is lost, it just stops mailing.
 *
 *   off     no email, ever (default)
 *   once    one email the first time a payer is seen, then silence
 *   weekly  one email on first sight, then a reminder every RENAG_DAYS
 */
export type UnmatchedAlertMode = 'off' | 'once' | 'weekly';

export function unmatchedAlertMode(): UnmatchedAlertMode {
  const raw = (process.env.UNMATCHED_PAYMENT_ALERTS ?? '').toLowerCase().trim();
  return raw === 'once' || raw === 'weekly' ? raw : 'off';
}
