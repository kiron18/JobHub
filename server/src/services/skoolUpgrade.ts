/**
 * The handoff from "paid" to "has Premium in Skool".
 *
 * Skool has no API, so the grant itself cannot be automated: it is a toggle in
 * the Skool members admin that a human has to click. Everything either side of
 * it is automated here, which leaves exactly one manual step per sale.
 *
 * Two emails go out together and neither is optional. Kiron gets the task, and
 * the buyer gets told that the upgrade is being done by hand so the delay is
 * expected rather than alarming. Sending only the first would leave someone who
 * has just paid $750 staring at an unchanged screen.
 */
import { prisma } from '../index';
import { sendSkoolUpgradeTask, sendPremiumWelcomeEmail } from './email';

/** Where the buyer joins if they are not in the free group yet. */
const SKOOL_JOIN_URL = process.env.SKOOL_GROUP_URL || 'https://aussiegradcareers.com.au/community';

/**
 * Raise the Premium handoff for a paying customer, exactly once.
 *
 * ⚠️ The guard is the point. Stripe retries webhook deliveries on any non-2xx,
 * on timeouts, and sometimes simply because it delivers at least once rather
 * than exactly once. Without the flag, one purchase can produce several
 * identical "add this person to Premium" emails, and an admin task that arrives
 * repeatedly is one that gets ignored, which is worse than not sending it.
 *
 * Claim-then-send, not send-then-mark: the update is conditional on the flag
 * still being null, so two concurrent webhook deliveries cannot both win.
 */
export async function raiseSkoolUpgrade(params: {
  userId: string;
  plan: string;
}): Promise<void> {
  const { userId, plan } = params;

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { email: true, name: true, skoolUpgradeNotifiedAt: true },
  });

  if (!profile?.email) {
    // Nothing to hand over: without an address there is neither a Skool account
    // to find nor anyone to write to. The unmatched-payment alert in the webhook
    // already covers this case.
    console.warn(`[skoolUpgrade] no email on profile ${userId} — skipping`);
    return;
  }
  if (profile.skoolUpgradeNotifiedAt) {
    console.log(`[skoolUpgrade] already raised for ${profile.email} — skipping`);
    return;
  }

  const claimed = await prisma.candidateProfile.updateMany({
    where: { userId, skoolUpgradeNotifiedAt: null },
    data: { skoolUpgradeNotifiedAt: new Date() },
  });
  if (claimed.count === 0) {
    console.log(`[skoolUpgrade] lost the race for ${profile.email} — another delivery has it`);
    return;
  }

  try {
    await sendSkoolUpgradeTask({
      customerEmail: profile.email,
      customerName: profile.name,
      plan,
    });
    await sendPremiumWelcomeEmail({
      to: profile.email,
      name: profile.name,
      skoolUrl: SKOOL_JOIN_URL,
    });
    console.log(`[skoolUpgrade] handoff raised for ${profile.email} (${plan})`);
  } catch (err) {
    // Hand the flag back so the next delivery, or a manual retry, can try again.
    // A customer who never gets upgraded is a refund; a duplicate email is not.
    await prisma.candidateProfile.updateMany({
      where: { userId },
      data: { skoolUpgradeNotifiedAt: null },
    });
    console.error(`[skoolUpgrade] failed for ${profile.email}, flag released:`, err);
  }
}
