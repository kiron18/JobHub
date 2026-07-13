/**
 * Post-payment onboarding for cold buyers.
 *
 * When someone pays through a hand-made Stripe payment link *before* they have
 * a JobHub account, the webhook has no userId to attach the payment to. Before
 * this, that money just triggered an admin "unmatched" alert and the buyer got
 * nothing until it was reconciled by hand (see scripts/grant_access.ts).
 *
 * `onboardPaidCustomer` closes that gap: it creates the buyer's Supabase login
 * (their email is the login, which — per the product rule — must be the same
 * email that's on their resume), ensures a CandidateProfile exists, and emails
 * them a "set your password + how to use the program" link.
 *
 * It deliberately does NOT set plan / access / expiry. The caller (the Stripe
 * webhook) does that with its existing, tested grant logic, so cold buyers and
 * known users take the exact same path once a userId exists.
 */
import { supabase } from '../lib/supabase';
import { prisma } from '../index';
import { sendClientOnboardingEmail } from './email';

const APP_URL = (process.env.ALLOWED_ORIGIN ?? 'https://aussiegradcareers.com.au')
  .split(',')[0]
  .trim();

/**
 * CandidateProfile.email is unique. When `userId`'s login is about to take
 * ownership of `email` but a different row (a previous scan or an old login's
 * zombie profile) already holds it, reattach or release that row first so the
 * caller's upsert cannot trip the unique constraint.
 */
export async function reconcileProfileEmail(userId: string, email: string | null): Promise<void> {
  if (!email) return;
  const byEmail = await prisma.candidateProfile.findUnique({ where: { email } });
  if (!byEmail || byEmail.userId === userId) return;
  const byUser = await prisma.candidateProfile.findUnique({ where: { userId } });
  if (byUser) {
    // Two rows for the same person: keep this login's row, free the email
    // from the old one so it can move over.
    await prisma.candidateProfile.update({ where: { id: byEmail.id }, data: { email: null } });
    console.log(`[onboarding] Released email ${email} from old profile row ${byEmail.id} (kept row for userId=${userId})`);
  } else {
    // No row for this login yet: claim the old row outright, history and all.
    await prisma.candidateProfile.update({ where: { id: byEmail.id }, data: { userId } });
    console.log(`[onboarding] Claimed old profile row ${byEmail.id} (email ${email}) for userId=${userId}`);
  }
}

export interface OnboardResult {
  userId: string;
  /** true when we created a brand-new Supabase auth user this call */
  createdAuthUser: boolean;
  /** true when the set-password/instructions email was sent */
  emailSent: boolean;
}

/**
 * Find an existing Supabase auth user by email. The admin API has no direct
 * get-by-email, so we page through listUsers the same way admin.ts already does.
 */
async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.warn('[onboarding] listUsers failed:', error.message);
    return null;
  }
  const match = data.users.find(
    (u) => (u.email ?? '').toLowerCase().trim() === email,
  );
  return match ? { id: match.id } : null;
}

/**
 * Ensure the buyer has a login + profile, and email them a set-password link.
 * Idempotent: safe to call again on Stripe webhook retries.
 */
export async function onboardPaidCustomer(params: {
  email: string;
  stripeCustomerId?: string | null;
}): Promise<OnboardResult> {
  const email = params.email.toLowerCase().trim();
  if (!email) throw new Error('onboardPaidCustomer called without an email');

  // 1. Ensure a Supabase auth user exists (the login).
  let authUserId: string;
  let createdAuthUser = false;

  const existing = await findAuthUserByEmail(email);
  if (existing) {
    authUserId = existing.id;
  } else {
    // email_confirm: true — they paid, so we trust the address and skip the
    // confirmation round-trip. They set their password via the recovery link.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error || !data?.user) {
      throw new Error(`Failed to create auth user for ${email}: ${error?.message ?? 'no user returned'}`);
    }
    authUserId = data.user.id;
    createdAuthUser = true;
    console.log(`[onboarding] Created Supabase login for ${email} → userId=${authUserId}`);
  }

  // 2. Ensure a CandidateProfile exists AND grant 3 months of full access.
  //    Paying is the entitlement — the moment they pay we open the whole site
  //    for 90 days, regardless of whether they've finished onboarding yet.
  await reconcileProfileEmail(authUserId, email);
  const accessExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const grant = {
    plan: 'three_month',
    planStatus: 'active',
    dashboardAccess: true,
    accessExpiresAt,
  } as const;
  await prisma.candidateProfile.upsert({
    where: { userId: authUserId },
    update: { ...grant, stripeCustomerId: params.stripeCustomerId ?? undefined },
    create: {
      userId: authUserId,
      email,
      stripeCustomerId: params.stripeCustomerId ?? undefined,
      ...grant,
    },
  });

  // 3. Mint a set-password link (recovery flow) and email it with instructions.
  //    generateLink returns the link WITHOUT sending, so we deliver it via
  //    Resend (our sender) instead of Supabase's built-in SMTP.
  let emailSent = false;
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${APP_URL}/set-password` },
    });
    if (error || !data?.properties?.action_link) {
      throw new Error(error?.message ?? 'no action_link returned');
    }
    await sendClientOnboardingEmail({ to: email, actionLink: data.properties.action_link });
    emailSent = true;
    console.log(`[onboarding] Sent set-password + instructions email to ${email}`);
  } catch (err: any) {
    // Never throw here — the account and access still stand. Surface it so it
    // can be re-sent by hand if the mail step alone failed.
    console.error(`[onboarding] Failed to send onboarding email to ${email}:`, err.message ?? err);
  }

  return { userId: authUserId, createdAuthUser, emailSent };
}
