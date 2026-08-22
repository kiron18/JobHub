/**
 * The digging.
 *
 * A first spoken answer is almost never usable. People narrate the outcome,
 * say "we" throughout, and leave out the obstacle that made the story worth
 * telling. On a call a coach fixes that by asking one more question. This
 * module is that coach, and it is the difference between self-service intake
 * and a worse version of a form.
 *
 * The rule it works under: THE MODEL NEVER WRITES THE ANSWER. It reads what was
 * said, decides what is missing, and asks for the missing part. Every word that
 * ends up in the bank was spoken by the candidate. That is not a style
 * preference. A resume-fed model writing interview answers is exactly what
 * makes every commercial tool sound templated, and JobHub has already lost a
 * client's publication to a system that thought it could improve on their text.
 *
 * Scoring is deterministic and runs with no model at all. That matters for two
 * reasons: it is testable without a network, and it means a model outage
 * degrades the intake to "no follow-up asked" rather than to "follow-up
 * invented". The model is only consulted to phrase the follow-up naturally, and
 * there is a written fallback for every gap if it is unavailable.
 */

import type { Question } from './intake';

/** The four things a usable story has. Missing any one makes it unusable. */
export type Element = 'situation' | 'action' | 'obstacle' | 'outcome';

export const ELEMENTS: Element[] = ['situation', 'action', 'obstacle', 'outcome'];

export interface ElementVerdict {
  element: Element;
  present: boolean;
  /** What in the text decided it. Shown in the admin view, never to the candidate. */
  evidence: string[];
}

export interface AnswerAudit {
  wordCount: number;
  verdicts: ElementVerdict[];
  missing: Element[];
  /** True when the answer credits a group and never the candidate. */
  hidesBehindWe: boolean;
  /** True when there is not enough text to judge anything. */
  tooShort: boolean;
  /** 0-4. Four means every element landed. */
  score: number;
  complete: boolean;
}

// --------------------------------------------------------------- the signals

/**
 * Past tense and a scene. A story that never says when or where it happened is
 * a policy statement: "I always make sure to communicate clearly."
 */
const WEEKDAY = String.raw`(?:mon|tues|wednes|thurs|fri|satur|sun)day`;
const MONTH_NAME = String.raw`(?:january|february|march|april|may|june|july|august|september|october|november|december)`;

const SITUATION = [
  /\b(?:one|a|last|this|that|the)\s+(?:day|night|morning|afternoon|evening|shift|week|weekend|month|semester|year|time|service|round)\b/i,
  // "One Saturday", "on a Tuesday", "that Thursday". Naming the day is one of
  // the commonest ways somebody places a story, and its absence here meant a
  // third of otherwise complete answers were asked to set a scene they had
  // just set. Same for naming a month.
  new RegExp(String.raw`\b(?:one|a|last|this|that|the|on)\s+${WEEKDAY}\b`, 'i'),
  new RegExp(String.raw`\b(?:in|around|during|one|last|that)\s+${MONTH_NAME}\b`, 'i'),
  /\b(?:we|i)\s+(?:were|was)\s+(?:working|running|doing|short|understaffed|on|put|moved|given|told|handed|checking|counting|entering|booking)\b/i,
  // Narrow on purpose: "when they were needed" is a duty statement, not a
  // scene. Only the candidate placing themselves somewhere counts.
  /\b(?:when|while)\s+(?:i|we)\b/i,
  /\bduring\s+(?:a|an|the|my|one)\b/i,
  /\bthere\s+was\s+(?:one|a|an)\b/i,
  /\b(?:the|my)\s+(?:worst|first|best|hardest|busiest)\s+(?:one|day|night|shift|week|time)\b/i,
  /\b(?:back|there)\s+(?:in|at)\s+\w+/i,
  /\b(?:it|this)\s+(?:happened|was)\s+(?:in|on|at|during|around)\b/i,
  /\b(?:in|around)\s+(?:19|20)\d{2}\b/,
  /\b(?:my|his|her|their|our)\s+(?:first|second|third|last|final)\s+\w+/i,
  /\bat\s+the\s+(?:end|start|beginning)\s+of\s+(?:a|the|my)\b/i,
];

/** First person and a verb. "I checked", "I called", "I stayed back". */
const ACTION = [
  /\bi\s+(?:went|took|called|checked|asked|told|showed|made|did|started|stayed|pulled|wrote|sent|spoke|talked|decided|found|fixed|changed|raised|reported|flagged|organised|organized|arranged|rang|emailed|explained|offered|suggested|swapped|covered|escalated|logged|recorded|counted|tested|ran|set|put|got|brought|handled|sorted|cleaned|redid|rechecked|double.checked|stopped|let|held|split|signed|loaded|taught|watched|practised|practiced|introduced|apologised|apologized|owned|closed|taped|moved|waited|quarantined|photographed|relabelled|relabeled|rewrote)\b/i,
  // The irregular past tenses, which no `-ed` rule can reach and which are the
  // commonest verbs in spoken English.
  /\bi\s+(?:stood|sat|came|kept|left|saw|said|caught|dealt|drove|drew|paid|read|met|knew how|gave|took)\b/i,
  /\bi\s+(?:had to|ended up|volunteered to|offered to|decided to|chose to|made sure|went back|sat down|would rather)\b/i,
  // Any first-person past-tense verb is an action, with the purely mental ones
  // excluded: "I wanted" and "I thought" describe a state, not something done.
  // Without this the detector missed most real answers, because people use far
  // more verbs than any hand-written list can hold.
  /\bi\s+(?!wanted|needed|felt|thought|hoped|liked|loved|believed|assumed|realised|realized|remembered|noticed)\w+ed\b/i,
  /\bso i\b/i,
  /\bwhat i did\b/i,
  /\bthe first thing i (?:did|said)\b/i,
];

/** The thing that made it a story instead of a task. */
const OBSTACLE = [
  /\b(?:but|however|unfortunately|except)\b/i,
  // "the problem was" through to "which was a real problem": people name the
  // difficulty in whatever grammar the sentence gives them.
  /\b(?:a|the|one|another)\s+(?:real |big |main |only |other )?(?:problem|issue|trouble|catch|difficulty)\b/i,
  /\bthe (?:problem|issue|trouble|catch|hard part|hardest part|hardest thing|hard thing) (?:was|is)\b/i,
  /\b(?:went wrong|fell through|broke down|dropped out|froze|did not work|didn.t work|failed|missed|short.staffed|understaffed|behind schedule|running late|ran out|no one|nobody|refused|pushed back|complained|angry|upset|stressed|panic)\b/i,
  /\b(?:i|we|he|she|they)\s+(?:could not|couldn.t|did not know|didn.t know|had no idea|was not sure|wasn.t sure|had never|was not happy|were not happy|did not want|didn.t want|did not turn up)\b/i,
  // A bare difficulty word is not an obstacle. "I worked harder than most
  // people around me" is a disguised strength, and this list used to pass it.
  /\b(?:was|were|got|getting|felt|seemed|became|becoming|it got)\s+(?:a bit\s+)?(?:hard|harder|difficult|tricky|awkward|tense|messy|chaotic|frustrating|frustrated|stressful|worried|annoyed|impatient)\b/i,
  /\bthe (?:hard|hardest|difficult|tricky|awkward) (?:part|bit|thing|one|ones)\b/i,
  // The shape of a real obstacle that names no problem word: the easy option
  // was available and attractive. Common in ethics and procedure answers,
  // which were failing this check almost every time.
  /\bthe easy (?:thing|option)\b/i,
  /\b(?:it|that) would have been\b/i,
  /\bfelt (?:like|rude|unkind|wrong|hard|awkward)\b/i,
  /\b(?:was|were) certain\b/i,
  /\bnever been shown\b/i,
  /\bno (?:way to|time)\b/i,
  /\bonly one\b/i,
  /\bdid not (?:match|add up|have|arrive|know where|solve)\b/i,
  // Friction between people, which the list above named only as open conflict.
  // Most real obstacles are quieter than "refused".
  /\b(?:going|went) quiet\b/i,
  /\bstopped (?:replying|talking|answering|coming)\b/i,
  /\btook it as\b/i,
  /\bfurther behind\b/i,
  /\bredo(?:ing|ne)?\b/i,
  /\bin the way\b/i,
  /\bat the same time\b/i,
];

/** How it landed. Without this the story stops mid-air. */
const OUTCOME = [
  /\b(?:in the end|eventually|so in the end|the result was|it ended up|ended up being|afterwards|after that|since then|from then on|the next|by the end)\b/i,
  /\bit turned out\b/i,
  /\bwent ahead\b/i,
  /\b(?:the following|within a|within the)\s+(?:day|week|fortnight|month|year)\b/i,
  /\b(?:we|i|they|it)\s+(?:got|finished|submitted|delivered|completed|recovered|saved|fixed|resolved|passed|closed|sorted|cleared|agreed|kept|changed|started|stopped|added|sent|split|settled)\b/i,
  /\bwe were\s+\w+ed\b/i,
  // How an ending actually lands in speech: somebody else does something, or
  // stops doing it. "He used the trolley after that", "She waited", "They taped
  // the area off" are all endings, and none of them matched before.
  /\b(?:he|she|they)\s+(?:\w+ed|rang|came|took|kept|went|got|said|made|left|stayed|gave|held|sent|put|paid)\b/i,
  /\b(?:my (?:manager|supervisor|boss|tutor|lecturer))\s+\w+/i,
  /\b(?:what i (?:took|learned|learnt)|the lesson|it taught me|since then i|i would (?:do|make) the same)\b/i,
  /\b(?:on time|no complaints|never happened again|stopped happening|nothing came of it|was fine|were fine)\b/i,
  /\bstill\s+(?:done|do|check|use|works)\b/i,
];

const SIGNALS: Record<Element, RegExp[]> = {
  situation: SITUATION,
  action: ACTION,
  obstacle: OBSTACLE,
  outcome: OUTCOME,
};

/** First-person singular, the thing an answer has to contain to be about them. */
const I_FORMS = /\b(?:i|i'm|i'd|i've|i'll|my|me|myself)\b/gi;
const WE_FORMS = /\b(?:we|we're|we'd|we've|our|us|the team|the group|everyone)\b/gi;

/** Under this many words there is nothing to judge, only silence to fill. */
export const MIN_WORDS = 35;

const words = (text: string) => (text.trim().match(/\S+/g) || []).length;

// ---------------------------------------------------------------- the audit

/**
 * Read a spoken answer and say what is missing from it.
 *
 * No model, no network, no judgement about quality. It is deliberately blunt:
 * the cost of asking one unnecessary follow-up is ten seconds, and the cost of
 * missing one is a story that cannot be used on any form.
 */
export function auditAnswer(text: string): AnswerAudit {
  const clean = (text || '').trim();
  const wordCount = words(clean);
  const tooShort = wordCount < MIN_WORDS;

  const verdicts: ElementVerdict[] = ELEMENTS.map((element) => {
    const evidence: string[] = [];
    for (const rx of SIGNALS[element]) {
      const hit = clean.match(rx);
      if (hit) evidence.push(hit[0].toLowerCase());
    }
    // A very short answer can trip a signal by accident, so nothing counts as
    // present until there is enough text for the signal to mean anything.
    return { element, present: !tooShort && evidence.length > 0, evidence };
  });

  const iCount = (clean.match(I_FORMS) || []).length;
  const weCount = (clean.match(WE_FORMS) || []).length;
  // "We" outnumbering "I" is the single most common failure in a spoken answer,
  // and the one candidates are least able to hear in their own voice.
  const hidesBehindWe = !tooShort && weCount >= 2 && iCount < weCount;

  const missing = verdicts.filter((v) => !v.present).map((v) => v.element);
  const score = verdicts.filter((v) => v.present).length;

  return {
    wordCount,
    verdicts,
    missing,
    hidesBehindWe,
    tooShort,
    score,
    complete: missing.length === 0 && !hidesBehindWe && !tooShort,
  };
}

// ------------------------------------------------------------- the follow-up

/**
 * The written fallback for each gap. These are the questions a coach asks, and
 * they are used verbatim whenever the model is unavailable, over budget, or
 * returns something that fails validation. The intake never stalls on the LLM.
 */
export const FALLBACK_PROBE: Record<Element | 'we' | 'short', string> = {
  short: 'That is a start, but there is not enough there yet to use. Take it from the top: where were you, what were you doing, and what happened?',
  situation: 'Before the rest of it, set the scene for me. Where were you working, roughly when was this, and what was going on that day?',
  action: 'What did you actually do? Walk me through it step by step, starting from the moment you realised something needed doing.',
  obstacle: 'What made this hard? If it had all gone smoothly there would be no story in it, so what was the part that nearly went wrong?',
  outcome: 'How did it end? What happened in the end, and did anyone say anything about it afterwards?',
  we: 'You have said "we" most of the way through. Tell me your part specifically. What did you do that somebody else on that team did not?',
};

/**
 * Which gap to chase first. Asking for all four at once gets you none of them.
 *
 * `we` sits ahead of `action` on purpose. An answer told entirely in the first
 * person plural is also, always, an answer with no first-person action in it,
 * so both fire together. "What did you do that somebody else did not" is the
 * sharper of the two questions, and the vaguer one would only have to be asked
 * again afterwards.
 */
const PRIORITY: (Element | 'we')[] = ['situation', 'we', 'action', 'obstacle', 'outcome'];

export type ProbeReason = Element | 'we' | 'short' | null;

/**
 * The single next thing to ask about, or null when the answer is done.
 *
 * One at a time is not politeness. A person answering three questions at once
 * answers the last one and forgets the other two, which is how an intake ends
 * up with four rounds of follow-up and still no obstacle in the story.
 */
export function nextProbeReason(audit: AnswerAudit): ProbeReason {
  if (audit.tooShort) return 'short';
  for (const key of PRIORITY) {
    if (key === 'we') {
      if (audit.hidesBehindWe) return 'we';
      continue;
    }
    if (audit.missing.includes(key)) return key;
  }
  return null;
}

/** How many follow-ups before moving on, however incomplete the answer is. */
export const MAX_FOLLOW_UPS = 3;

export interface TurnDecision {
  /** 'probe' asks again, 'accept' banks it, 'give_up' banks what there is. */
  action: 'probe' | 'accept' | 'give_up';
  reason: ProbeReason;
  /** The words to say, already usable. A model may rephrase it, never replace it. */
  probe: string | null;
  audit: AnswerAudit;
}

/**
 * What to do after a spoken answer.
 *
 * `give_up` exists because an intake that will not let go is worse than one
 * that banks a thin story. Some people genuinely have no obstacle in the
 * story they picked, and the third re-ask reads as an accusation.
 */
export function decideTurn(text: string, followUpsSoFar: number): TurnDecision {
  const audit = auditAnswer(text);
  const reason = nextProbeReason(audit);

  if (!reason) return { action: 'accept', reason: null, probe: null, audit };
  if (followUpsSoFar >= MAX_FOLLOW_UPS) {
    return { action: 'give_up', reason, probe: null, audit };
  }
  return { action: 'probe', reason, probe: FALLBACK_PROBE[reason], audit };
}

// -------------------------------------------------- phrasing the follow-up

/**
 * The prompt that turns a generic probe into one about what they just said.
 *
 * Everything hostile to the doctrine is forbidden in the instructions AND
 * checked afterwards by `probeIsSafe`, because an instruction is a request and
 * a check is a guarantee.
 */
export function buildProbePrompt(
  question: Question,
  answer: string,
  reason: Exclude<ProbeReason, null>,
): string {
  return [
    'You are helping someone tell a story from their own working life so they can use it on job applications.',
    '',
    `The question they were asked: ${question.ask}`,
    '',
    'What they said, transcribed from speech:',
    '"""',
    answer,
    '"""',
    '',
    `What is missing from their answer: ${reason === 'we' ? 'they described the team, not their own part' : reason}`,
    '',
    'Write ONE short follow-up question that gets them to fill in exactly that gap.',
    '',
    'Rules, all of them absolute:',
    '- Refer to something specific they actually said, so it is clear you listened.',
    '- Never suggest, supply, or hint at an answer. Do not offer examples of what they might say.',
    '- Never state a fact about them that they did not say themselves.',
    '- Ask about one thing only.',
    '- Plain spoken English, two sentences at most, no jargon, no "STAR method", no praise.',
    '- Do not congratulate them or comment on how good the answer was.',
    '',
    'Return only the question itself, nothing else.',
  ].join('\n');
}

/** Phrases that mean the model started writing the answer instead of asking for it. */
const LEADING = [
  /\bfor example\b/i,
  /\b(?:you could say|you might say|perhaps you|maybe you could|i imagine|i assume|it sounds like you probably|presumably)\b/i,
  /\bsomething like\b/i,
  /\bwould it be fair to say\b/i,
  // Proposing the cause and inviting a yes. People agree with whatever is put
  // in front of them, and the story quietly becomes the model's rather than
  // theirs. This form is harder to spot than "you could say" and does more damage.
  /\b(?:was|is|were)\s+(?:it|that|they|this)\s+because\b/i,
  /\bi (?:take|took) it (?:that|you)\b/i,
  /\byou must have\b/i,
];

/** Praise. It biases the next answer towards whatever got praised. */
const PRAISE = /\b(?:great|excellent|wonderful|fantastic|amazing|well done|good (?:answer|job|example)|that.s (?:great|good|excellent|a great))\b/i;

export interface ProbeCheck {
  ok: boolean;
  problem?: 'empty' | 'too_long' | 'multiple_questions' | 'leading' | 'praise' | 'not_a_question';
}

/**
 * Whether a model-written probe can be shown.
 *
 * A failure here is not an error state. The caller falls back to the written
 * probe for the same gap, so the worst case is a slightly less personal
 * question, never a leading one.
 */
export function probeIsSafe(probe: string): ProbeCheck {
  const text = (probe || '').trim();
  if (!text) return { ok: false, problem: 'empty' };
  if (words(text) > 60) return { ok: false, problem: 'too_long' };
  if (!text.includes('?')) return { ok: false, problem: 'not_a_question' };
  if ((text.match(/\?/g) || []).length > 2) return { ok: false, problem: 'multiple_questions' };
  if (LEADING.some((rx) => rx.test(text))) return { ok: false, problem: 'leading' };
  if (PRAISE.test(text)) return { ok: false, problem: 'praise' };
  return { ok: true };
}

/** The probe to actually show: the model's if it passes, the written one if not. */
export function chooseProbe(
  modelProbe: string | null | undefined,
  reason: Exclude<ProbeReason, null>,
): { probe: string; source: 'model' | 'fallback'; problem?: ProbeCheck['problem'] } {
  if (!modelProbe) return { probe: FALLBACK_PROBE[reason], source: 'fallback' };
  const check = probeIsSafe(modelProbe);
  if (!check.ok) return { probe: FALLBACK_PROBE[reason], source: 'fallback', problem: check.problem };
  return { probe: modelProbe.trim(), source: 'model' };
}
