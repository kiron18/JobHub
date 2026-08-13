/**
 * Keeps the sales board in step with what people actually do.
 *
 * The old board had ten stages that were dragged by hand, which meant the board
 * was only ever as current as the last time someone remembered to move a card.
 * Here the stage is DERIVED: registered, attended, sent a report and paid are
 * all facts the system already records, so the board cannot drift from reality.
 *
 * Only Dead is manual, because "this person is not going to buy" is a judgement
 * and there is no signal for it.
 */
import { prisma } from '../index';

/** Ordered worst to best. Position in this array is the ranking. */
export const STAGES = ['Lead', 'Registered', 'Attended', 'Pitched', 'Client', 'Dead'] as const;
export type Stage = (typeof STAGES)[number];

export interface LeadSignals {
  registeredAt?: Date | null;
  attendedAt?: Date | null;
  reportSentAt?: Date | null;
  paidAt?: Date | null;
}

/**
 * The stage a set of signals implies.
 *
 * Highest reached wins, never the most recent: someone who paid and then
 * registers for another workshop is still a client, and a board that demoted
 * them would be actively wrong. This is the same bug that used to knock paying
 * clients out of the pipeline when they booked a call.
 */
export function deriveStage(signals: LeadSignals): Stage {
  if (signals.paidAt) return 'Client';
  if (signals.reportSentAt) return 'Pitched';
  if (signals.attendedAt) return 'Attended';
  if (signals.registeredAt) return 'Registered';
  return 'Lead';
}

/**
 * Record a funnel event against a person, creating them if this is the first we
 * have seen of them.
 *
 * Matched on email, which is the join key across the CRM, JobHub and Stripe.
 * Signals are only ever set, never cleared, so a later event with fewer facts
 * in it cannot erase what an earlier one established.
 *
 * `Dead` is preserved: it is a decision someone made, and a subsequent
 * automatic signal should not silently overrule it. Everything else is derived.
 */
export async function recordLeadSignal(params: {
  email: string;
  name?: string | null;
  phone?: string | null;
  source?: string;
  sourceAsset?: string | null;
  hasResume?: boolean;
  signals: LeadSignals;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  if (!email) return;

  const existing = await prisma.salesLead.findUnique({ where: { email } });

  const merged: LeadSignals = {
    registeredAt: params.signals.registeredAt ?? existing?.registeredAt ?? null,
    attendedAt: params.signals.attendedAt ?? existing?.attendedAt ?? null,
    reportSentAt: params.signals.reportSentAt ?? existing?.reportSentAt ?? null,
    paidAt: params.signals.paidAt ?? existing?.paidAt ?? null,
  };

  const stage = existing?.stage === 'Dead' ? 'Dead' : deriveStage(merged);

  const data = {
    ...merged,
    stage,
    // A name typed by the person beats one parsed or imported, but an empty one
    // must never overwrite a name we already have.
    ...(params.name?.trim() ? { name: params.name.trim() } : {}),
    ...(params.phone?.trim() ? { phone: params.phone.trim() } : {}),
    ...(params.sourceAsset ? { sourceAsset: params.sourceAsset } : {}),
    ...(params.hasResume ? { hasResume: true } : {}),
    // Someone who reappears through the funnel is not noise any more, whatever
    // an import decided about them months ago.
    ...(params.hasResume || merged.registeredAt ? { archived: false } : {}),
  };

  await prisma.salesLead.upsert({
    where: { email },
    create: {
      email,
      name: params.name?.trim() || email.split('@')[0],
      source: params.source ?? 'session',
      ...data,
    },
    update: data,
  });
}

/** Set by hand, and the only stage that is. */
export async function markLeadStage(id: string, stage: Stage): Promise<void> {
  await prisma.salesLead.update({ where: { id }, data: { stage } });
}
