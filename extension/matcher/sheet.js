// One form in, one answer sheet out.
//
// This is the whole product in a single pure function. The extension's service
// worker does nothing but storage and messaging around it, which is what makes
// the end-to-end path testable in node with no browser at all.
//
// Precedence, and each step is there for a reason:
//   1. remembered  - the candidate has already chosen an answer for this exact
//                    question, possibly at a different employer. Never override
//                    a human decision with a fresh guess.
//   2. profile     - a plain fact. One right answer, no scoring.
//   3. matched     - rank the bank, offer the top three, let them pick.
//   4. nothing     - say so. A blank marked "no story covers this" is a to-do
//                    for the next coaching call; a silently missing question is
//                    a form submitted half empty.

import { matchQuestion, renderAnswer, fitVariant } from './matcher.js';
import { answerFromProfile } from './profile.js';
import { withLearned } from './bank.js';

const countWords = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

/**
 * Fields nothing in a bank can ever fill. `file` is in here for a second
 * reason: a "do you hold a licence, attach it" upload reads as a fact question,
 * and writing a string into a file input throws in the page.
 */
const UNANSWERABLE = new Set(['file', 'password', 'submit', 'button', 'range', 'color', 'image', 'reset']);

/** Answerable in principle, but only ever as a tick, never as text. */
const TICK_ONLY = new Set(['checkbox']);

/** A consent tickbox is not a question about the candidate. */
const isConsent = (field) =>
  field.type === 'checkbox' && /\b(agree|consent|privacy|terms|policy|acknowledge|confirm|declare|subscribe)\b/i.test(field.label || '');

export function answerField(field, bank = {}, ctx = {}) {
  const { company = '', role = '', industry = null } = ctx;
  const out = {
    ...field,
    kind: 'other',
    answer: null,
    alternatives: [],
    note: null,
    confidence: 'none',
  };

  if (!field.label) {
    out.note = 'No label could be read for this field, so there is nothing to match on.';
    return out;
  }

  if (UNANSWERABLE.has(field.type)) {
    out.kind = 'skip';
    return out;
  }

  const opts = { company, role, industry, maxLength: field.maxLength || null };

  // 2 (checked first because it is cheap and decisive): is this a plain fact?
  const fact = answerFromProfile(field.label, bank.profile || {}, { options: field.options || [] });

  const match = matchQuestion(field.label, bank, opts);
  out.shape = match.shape;
  out.themes = match.themes.slice(0, 3).map((t) => t.theme);
  out.wordLimit = match.wordLimit;
  out.variant = match.variant;

  // 1. Remembered.
  if (match.source === 'learned' && match.candidates.length) {
    const entry = match.candidates[0].entry;
    const rendered = render(entry, match, { company, role });
    if (rendered) {
      out.kind = 'open';
      out.confidence = 'remembered';
      out.answer = buildAnswer(rendered, entry, match, 'remembered', ['you chose this answer before']);
      out.alternatives = alternativesFor(entry, bank, match, { company, role });
      return out;
    }
  }

  // 2. Facts. A tickbox can carry one, but only when the answer is an option to
  //    tick rather than a sentence to type.
  if (fact && !(TICK_ONLY.has(field.type) && !fact.option)) {
    out.kind = 'fact';
    out.fact = fact;
    if (fact.missing) {
      out.confidence = 'none';
      out.note = `Your bank has no "${fact.label}" recorded. Add it once and every form after this one fills itself.`;
      return out;
    }
    out.confidence = 'strong';
    out.answer = {
      text: fact.text,
      option: fact.option,
      words: countWords(fact.text),
      limit: match.wordLimit,
      overLimit: false,
      variant: null,
      source: 'profile',
      from: { id: `profile.${fact.field}`, title: fact.label, kind: 'profile' },
      why: ['from your profile'],
    };
    return out;
  }

  if (TICK_ONLY.has(field.type) || isConsent(field)) {
    out.kind = 'skip';
    return out;
  }

  // 3. Matched.
  if (match.candidates.length) {
    const [best, ...rest] = match.candidates;
    const rendered = render(best.entry, match, { company, role });
    if (rendered) {
      out.kind = 'open';
      out.confidence = best.score >= 6 ? 'strong' : 'weak';
      out.answer = buildAnswer(rendered, best.entry, match, 'matched', best.why);
      out.alternatives = rest
        .map((c) => renderCandidate(c, match, { company, role }))
        .filter(Boolean);
      if (out.confidence === 'weak') {
        out.note = 'A loose match. Read it before you use it, and pick another if it fits better.';
      }
      return out;
    }
  }

  // 4. Nothing.
  if (field.likelySubjective) {
    out.kind = 'open';
    out.note = 'No story in your bank covers this one. Worth adding after the form.';
  }
  return out;
}

/** Text sized to the box, and which of the stored lengths that turned out to be. */
function render(entry, match, ctx) {
  const limit = match.wordLimit;
  const fitted = fitVariant(entry, match.variant, { limit });
  const text = renderAnswer(entry, match.variant, { ...ctx, limit });
  return text ? { ...fitted, text, words: countWords(text) } : null;
}

function buildAnswer(rendered, entry, match, source, why) {
  return {
    text: rendered.text,
    option: null,
    words: rendered.words,
    limit: match.wordLimit,
    overLimit: rendered.overLimit,
    variant: rendered.variant,
    source,
    from: { id: entry.id, title: entry.title || entry.id, kind: entry.id.startsWith('st') ? 'statement' : 'story' },
    why: why || [],
  };
}

function renderCandidate(candidate, match, ctx) {
  const rendered = render(candidate.entry, match, ctx);
  if (!rendered) return null;
  return {
    id: candidate.entry.id,
    title: candidate.entry.title || candidate.entry.id,
    text: rendered.text,
    words: rendered.words,
    why: candidate.why,
    score: candidate.score,
  };
}

/** Other entries worth offering next to a remembered answer. */
function alternativesFor(chosen, bank, match, ctx) {
  const fresh = matchQuestion(match.question, { ...bank, learned: {} }, {
    company: ctx.company, role: ctx.role, industry: bank.profile?.industry || null,
  });
  return fresh.candidates
    .filter((c) => c.entry.id !== chosen.id)
    .map((c) => renderCandidate(c, match, ctx))
    .filter(Boolean);
}

/**
 * @param {object} input { frames, context, bank, learned }
 *   frames  as the reader collected them: [{ url, title, isTop, frameId, fields }]
 *   context { company, role } from context.js
 *   bank    the candidate's answer bank
 *   learned the extension's remembered choices, merged over the bank's own
 */
export function buildSheet({ frames = [], context = {}, bank = null, learned = {} } = {}) {
  const merged = bank ? withLearned(bank, learned) : null;
  const ctx = {
    company: context.company || '',
    role: context.role || '',
    industry: bank?.profile?.industry || null,
  };

  const outFrames = frames.map((frame) => ({
    ...frame,
    fields: (frame.fields || []).map((f) => (merged ? answerField(f, merged, ctx) : { ...f, kind: 'other', answer: null, alternatives: [] })),
  }));

  const all = outFrames.flatMap((f) => f.fields);
  const questions = all.filter((f) => f.kind !== 'skip');

  return {
    generatedAt: new Date().toISOString(),
    context: { ...context },
    hasBank: !!merged,
    candidate: merged?.profile?.name || null,
    frames: outFrames,
    stats: {
      fields: all.length,
      questions: questions.length,
      openEnded: all.filter((f) => f.kind === 'open').length,
      facts: all.filter((f) => f.kind === 'fact').length,
      answered: all.filter((f) => f.answer).length,
      unanswered: questions.filter((f) => !f.answer && f.label).length,
      unlabelled: all.filter((f) => !f.label).length,
      remembered: all.filter((f) => f.answer && f.answer.source === 'remembered').length,
      needsReview: all.filter((f) => f.confidence === 'weak' || (f.answer && f.answer.overLimit)).length,
    },
  };
}

/** Plain text of the whole sheet, for the Copy-all button and for a coaching call. */
export function formatSheet(sheet) {
  const lines = [];
  const { company, role } = sheet.context || {};
  lines.push(`APPLICATION ANSWERS${company ? ` - ${company}` : ''}${role ? ` - ${role}` : ''}`);
  lines.push(`${sheet.stats.answered} of ${sheet.stats.questions} questions answered`);

  for (const frame of sheet.frames) {
    for (const field of frame.fields) {
      if (field.kind === 'skip') continue;
      lines.push('', '-'.repeat(70), field.label || '(no label)');
      if (field.wordLimit) lines.push(`(limit ${field.wordLimit} words)`);
      lines.push('');
      if (field.answer) {
        if (field.answer.option) lines.push(`[select: ${field.answer.option}]`);
        lines.push(field.answer.text || '');
      } else {
        lines.push(field.note || '(nothing in the bank covers this yet)');
      }
    }
  }
  return lines.join('\n');
}
