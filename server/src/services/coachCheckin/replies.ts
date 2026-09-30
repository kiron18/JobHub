import { prisma } from '../../index';
import { getCheckinContext, firstName } from './context';
import { welcomeText, distressReplyText, botQuestionText } from './messages';
import { composeReply, looksSevere, BOT_QUESTION, type ReplyCategory } from './compose';

export { looksSevere, sanitiseReply, type ReplyCategory } from './compose';

/**
 * Handles what a member texts back to a check-in.
 *
 * The contract that keeps this cheap and safe at one-coach scale:
 *   - ONE reply per prompt. They answer the morning or evening question, the
 *     system answers once, and further messages are only logged. No open-ended
 *     chat, so no thread ever needs a human.
 *   - Distress is the exception to that cap and never gets the motivational
 *     script: a fixed, warm message goes out and the row is flagged for a person.
 *   - Everything they say is saved, for the weekly digest.
 *   - Their message is untrusted text. It is passed to the model as data with
 *     rules that forbid following instructions inside it, and the model's
 *     output is sanitised (no links of its own, no em dashes, length capped).
 */

/** How long after a prompt a reply still counts as an answer to it. */
const ANSWER_WINDOW_MS = 24 * 3600 * 1000;
const DISTRESS_COOLDOWN_MS = 6 * 3600 * 1000;
const BOT_COOLDOWN_MS = 12 * 3600 * 1000;
const MAX_INBOUND_CHARS = 600;

const inFlight = new Set<string>();

async function logOut(userId: string, kind: string, body: string, extra: { flagged?: boolean; topic?: string | null } = {}) {
  await prisma.coachMessage.create({
    data: { userId, direction: 'out', kind, body, flagged: extra.flagged ?? false, topic: extra.topic ?? null },
  });
}

/** Record something we sent as a prompt, so replies can be matched to it. */
export async function logPrompt(userId: string, kind: 'morning' | 'evening', body: string): Promise<void> {
  await logOut(userId, kind, body);
}

/**
 * Returns the texts to send back, in order (usually 0 or 1, 2 on a member's
 * very first reply). Never throws for a model problem, only for the database.
 */
export async function handleCoachReply(userId: string, inbound: string): Promise<string[]> {
  if (inFlight.has(userId)) return []; // two texts at once: answer the first only
  inFlight.add(userId);
  try {
    return await respond(userId, inbound.trim().slice(0, MAX_INBOUND_CHARS));
  } finally {
    inFlight.delete(userId);
  }
}

async function respond(userId: string, text: string): Promise<string[]> {
  if (!text) return [];
  const now = Date.now();

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { name: true, coachWelcomedAt: true },
  });
  const name = firstName(profile?.name);

  const recent = await prisma.coachMessage.findMany({
    where: { userId, createdAt: { gte: new Date(now - ANSWER_WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  const lastPrompt = recent.find(m => m.direction === 'out' && (m.kind === 'morning' || m.kind === 'evening'));
  const answeredPrompt = lastPrompt
    ? recent.some(m => m.direction === 'out' && ['reply', 'distress_reply', 'bot_reply'].includes(m.kind) && m.createdAt > lastPrompt.createdAt)
    : false;
  const sentSince = (kind: string, ms: number) =>
    recent.some(m => m.direction === 'out' && m.kind === kind && now - m.createdAt.getTime() < ms);

  const logIn = (category: ReplyCategory | null, flagged: boolean, topic: string | null = null) =>
    prisma.coachMessage.create({
      data: { userId, direction: 'in', kind: 'reply', body: text, category, flagged, topic },
    });

  // 1. Severe wording: a person's problem, whatever the model would say.
  if (looksSevere(text)) {
    await logIn('distress', true);
    if (sentSince('distress_reply', DISTRESS_COOLDOWN_MS)) return [];
    const reply = distressReplyText(name);
    await logOut(userId, 'distress_reply', reply, { flagged: true });
    return [reply];
  }

  // 2. "Is this a bot?" gets an honest answer at any time, once in a while.
  if (BOT_QUESTION.test(text)) {
    await logIn('bot_question', false);
    if (sentSince('bot_reply', BOT_COOLDOWN_MS)) return [];
    const reply = botQuestionText(name);
    await logOut(userId, 'bot_reply', reply);
    return [reply];
  }

  // 3. Not an answer to a prompt, or that prompt already had its one reply:
  //    save it for the weekly digest and stay quiet.
  if (!lastPrompt || answeredPrompt) {
    await logIn(null, false);
    return [];
  }

  // 4. The one tailored reply.
  const ctx = await getCheckinContext(userId);
  const { category, body, kind, topic, flagged } = await composeReply(ctx, lastPrompt.kind as 'morning' | 'evening', text);
  const out: string[] = [];

  if (!profile?.coachWelcomedAt && kind === 'reply') {
    out.push(welcomeText(name));
    await prisma.candidateProfile.update({ where: { userId }, data: { coachWelcomedAt: new Date() } });
    await logOut(userId, 'welcome', out[0]);
  }
  out.push(body);

  await logIn(category, flagged, topic);
  await logOut(userId, kind, body, { flagged, topic });
  return out;
}
