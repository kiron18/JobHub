import cron from 'node-cron';
import { reconcileStripePayments } from '../services/paymentReconcile';
import { sendAdminPaymentAlert } from '../services/email';

let cronStarted = false;

/**
 * Daily sweep so a paying client is never left marked as free.
 *
 * Writes, but only ever grants — see paymentReconcile.ts. autoOnboard is off:
 * creating logins and emailing set-password links is the webhook's job at the
 * moment of payment, not something a background sweep should spring on someone.
 * A payer with no account is reported instead.
 */
export function startPaymentReconcileCron(): void {
  if (cronStarted) return;
  cronStarted = true;

  // 11:00 UTC daily = 21:00 AEST, an hour after the trial reminder.
  cron.schedule('0 11 * * *', async () => {
    try {
      const result = await reconcileStripePayments({ write: true, autoOnboard: false });

      if (result.granted.length === 0 && result.unmatched.length === 0 && result.errors.length === 0) {
        console.log(`[paymentReconcile] ${result.scanned} payers scanned, all correctly marked`);
        return;
      }

      console.log(`[paymentReconcile] scanned=${result.scanned} granted=${result.granted.length} unmatched=${result.unmatched.length} alerting=${result.toAlert.length} resolved=${result.resolved.length} errors=${result.errors.length}`);
      for (const g of result.granted) {
        console.log(`[paymentReconcile] GRANTED ${g.email} -> ${g.plan} (${g.reason})`);
      }
      for (const u of result.unmatched) {
        console.warn(`[paymentReconcile] UNMATCHED ${u} — paid but has no JobHub account`);
      }
      for (const r of result.resolved) {
        console.log(`[paymentReconcile] RESOLVED ${r} — now has an account, alerts closed`);
      }
      for (const e of result.errors) console.error(`[paymentReconcile] ERROR ${e}`);

      // A payer with no account needs a human — but only the ones that are
      // newly seen or due a weekly reminder. Alerting on every unmatched payer
      // every night buried the real signal under repeats.
      for (const u of result.toAlert) {
        sendAdminPaymentAlert({
          event: 'payment_unmatched',
          userEmail: u.email,
          plan: u.amount != null ? `${u.plan} — $${u.amount.toFixed(2)}` : u.plan,
          subscriptionId: u.reason,
          firstSeenAt: u.firstSeenAt,
          alertCount: u.alertCount,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[paymentReconcile] Cron error:', err);
    }
  });
}
