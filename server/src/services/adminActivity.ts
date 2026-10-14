/**
 * When each account last did something in the app.
 *
 * "Something" is the three things a client does that leave a row behind:
 * tracking an application, logging outreach, generating a document. Signing in
 * and looking around leaves nothing, so this is "last worked", not "last seen",
 * which is the question the admin console is actually asking: a client who
 * opens the app daily and produces nothing is as stuck as one who never opens
 * it.
 */
import { prisma } from '../index';

export async function lastActiveByUser(userIds?: string[]): Promise<Map<string, Date>> {
  const where = userIds ? { userId: { in: userIds } } : {};
  const [apps, outreach, docs] = await Promise.all([
    prisma.jobApplication.groupBy({ by: ['userId'], where, _max: { createdAt: true } }),
    prisma.outreachLog.groupBy({ by: ['userId'], where, _max: { createdAt: true } }),
    prisma.document.groupBy({ by: ['userId'], where, _max: { createdAt: true } }),
  ]);
  const out = new Map<string, Date>();
  for (const row of [...apps, ...outreach, ...docs]) {
    const at = row._max.createdAt;
    if (!at) continue;
    const seen = out.get(row.userId);
    if (!seen || at > seen) out.set(row.userId, at);
  }
  return out;
}

/** Whole days between then and now, never negative. */
export function daysSince(then: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}
