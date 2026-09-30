/**
 * Every fixed line of text in the paid-member WhatsApp check-in, kept apart
 * from the send/cron/reply plumbing so the wording can be read and edited in
 * one place. Nothing in here calls the network.
 *
 * Tone: high energy, decisive, commitment-first (in the spirit of Tony
 * Robbins, never quoting him or claiming to be him). Short. No em dashes.
 *
 * What is NOT here: the one tailored reply to a member's answer. That is
 * written per person by replies.ts under the rules in replyRules.ts.
 */

import { MORNING_QUOTES } from './quotes';

/** Ends every reply to a morning check-in (Kiron, 2026-09-30). Added in code,
 *  never left to the model, so it is always exactly this. */
export const MORNING_REPLY_CLOSE =
  "These check-ins are automated, but declaring your intention matters. I want you to promise yourself you'll see this through.";

export interface CheckinContext {
  name: string;
  /** Today's committed target, or their program goal if they have not set one. */
  target: number;
  /** Applications sent so far today (AEST). */
  filedToday: number;
  /** Consecutive days at or above the program goal. */
  streak: number;
  /** 1-based challenge day, or null if the challenge has not been assigned. */
  day: number | null;
  challengeLength: number;
}

function pick<T>(variants: T[], seed: number): T {
  return variants[((seed % variants.length) + variants.length) % variants.length];
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86400000);
}

/** "Day 18 of 90, 4-day streak." pieces, only the ones that are real. */
function progressLine(c: CheckinContext): string {
  const bits: string[] = [];
  if (c.day) bits.push(`Day ${c.day} of ${c.challengeLength}`);
  if (c.streak >= 2) bits.push(`${c.streak}-day streak`);
  return bits.length ? `${bits.join(', ')}.` : '';
}

/* ── Morning: asks the question the member answers ─────────────────────── */

/* Kiron's format (2026-09-30):
     Good morning, <name>
     <short positive quote from quotes.ts>
     Let's set some goals for today...
   Each on its own line. The quote rotates by day of the year, so nobody sees
   a repeat until the whole bank has gone round. */
export function morningCheckinText(c: CheckinContext, at: Date = new Date()): string {
  const quote = pick(MORNING_QUOTES, dayOfYear(at));
  const progress = progressLine(c);
  return [
    `Good morning, ${c.name}`,
    quote,
    ...(progress ? [progress] : []),
    "Let's set some goals for today. How many applications and/or outreach do you want to do today?",
  ].join('\n\n');
}

/* ── Evening: reacts to the real number, ends on a reflection ──────────── */

export function eveningCheckinText(c: CheckinContext, at: Date = new Date()): string {
  const seed = dayOfYear(at);
  const progress = progressLine(c);
  const { filedToday: done, target, name } = c;

  let body: string;
  if (done <= 0) {
    body = pick([
      `Nothing logged today, ${name}. That's okay, because the next 30 minutes are still yours. What got in the way, and what's one application you can send right now?`,
      `${name}, quiet day on applications. One day doesn't define you, what you do next does. What happened today, and what's the plan for tomorrow morning?`,
    ], seed);
  } else if (done >= target) {
    body = pick([
      `${done} applications today, ${name}. You said you'd do it and you did it, and that's what separates people who get hired from people who wait. What was the one thing that made today work?`,
      `Target hit, ${name}, ${done} sent. That's a commitment kept. What do you want to remember about how you did it today?`,
    ], seed);
  } else {
    body = pick([
      `${done} of ${target} today, ${name}. Not done yet, and you've still got time. What's stopping the last ${target - done}, and can you fix it in the next 20 minutes?`,
      `${name}, ${done} in, ${target - done} to go. This is the moment most people stop, and you get to decide what you do. What will it take to finish?`,
    ], seed);
  }
  return `${progress ? progress + ' ' : ''}${body}`;
}

/* ── First ever reply: how this works, sent once ───────────────────────── */

export function welcomeText(name: string): string {
  return `Thanks ${name}, that's the first step. Quick note on how this works: these check-ins are automated, so I can't chat back and forth like a person. But typing out your answer matters. Putting a plan into words is what turns "I should" into "I'm going to", so keep answering, even in one line. For something to dig into, the Resources section in JobHub has the course material.`;
}

/* ── Distress: warm acknowledgement, no hype, no task ──────────────────── */

/* Kiron's wording (2026-09-30). `severe` is set when the message mentions
   self-harm or suicide (looksSevere): only then is the Lifeline line added,
   because that is the one case where a crisis number has to be there. */
export function distressReplyText(name: string, severe = false): string {
  const parts = [
    `Hey ${name}, I genuinely get it, it's rough out there. I know this from first-hand experience, and from working directly with people who have walked similar paths.`,
    "If you need to throw in the towel today so that you can keep going tomorrow, that's okay.",
    "The seed of an oak tree is tiny and fits in the palm of your hand, but the tree that grows out of it can give shade to a small group of people.",
    'Even the smallest action you take today can yield great results tomorrow.',
  ];
  if (severe) parts.push("If it ever feels like too much, please talk to someone now: Lifeline is there any time on 13 11 14.");
  return parts.join('\n\n');
}

/** When the reply model is unavailable. Deliberately plain and safe for any answer. */
export function fallbackReplyText(name: string, target: number): string {
  return `Thanks ${name}, I've saved that. Now make it happen: block out 30 minutes, aim for ${target} applications, and if you have a few minutes spare, connect with a few people on LinkedIn.`;
}

/** Sent when they ask whether this is a bot or a person. Honest, short. */
export function botQuestionText(name: string): string {
  return `Good question ${name}. This is an automated check-in system from Aussie Grad Careers, built to keep you accountable every day. It uses your real numbers from JobHub, and Kiron sees anything members flag.`;
}
