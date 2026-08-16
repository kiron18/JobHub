// Question -> bank entry matching. No AI, no network, no dependencies.
//
// The ladder, cheapest first. Only step 5 costs anything:
//   1. Seen this exact question before?      -> learned cache
//   2. What shape of answer does it want?    -> stem patterns
//   3. Which themes is it about?             -> weighted signal scoring
//   4. Rank the bank, show the top 3, human picks
//   5. LLM, only if 1-4 came up empty
//
// Steps 1-4 are what this file does.

import { SHAPES, THEMES, ADDON_THEMES, INDUSTRY_THEMES, LENGTH_BANDS } from './taxonomy.js';
import { normalise } from './normalise.js';

// Re-exported so callers can keep treating the matcher as the one entry point.
export { normalise };

// --------------------------------------------------------------- word limits

/**
 * How long the answer is allowed to be. The question text usually says, and the
 * reader also hands us the field's maxlength. Take the tighter of the two.
 */
export function extractWordLimit(question, maxLength = null) {
  const text = question || '';
  let words = null;

  const wordMatch = text.match(
    /(?:max(?:imum)?(?:\s+of)?|no more than|up to|within|limit(?:ed)? to|under|approx(?:imately)?)\s*(\d{2,5})\s*words?/i
  ) || text.match(/(\d{2,5})\s*words?\s*(?:max(?:imum)?|or less|or fewer|limit)/i)
    || text.match(/\(\s*(\d{2,5})\s*words?/i);
  if (wordMatch) words = parseInt(wordMatch[1], 10);

  if (words === null) {
    const charMatch = text.match(
      /(?:max(?:imum)?(?:\s+of)?|no more than|up to|within|limit(?:ed)? to)\s*(\d{2,6})\s*characters?/i
    ) || text.match(/(\d{2,6})\s*characters?\s*(?:max(?:imum)?|or less|limit)/i);
    // ~6 characters per word including the space.
    if (charMatch) words = Math.floor(parseInt(charMatch[1], 10) / 6);
  }

  if (maxLength && Number.isFinite(maxLength)) {
    const fromField = Math.floor(maxLength / 6);
    // Ignore implausibly small maxlengths on long-answer boxes.
    if (fromField >= 20 && (words === null || fromField < words)) words = fromField;
  }

  return words;
}

/** Map a word budget onto the stored variant that fits it. */
export function pickVariant(wordLimit) {
  if (wordLimit === null || wordLimit === undefined) return 'medium';
  return (LENGTH_BANDS.find((b) => wordLimit <= b.maxWords) || LENGTH_BANDS.at(-1)).variant;
}

// -------------------------------------------------------------------- shapes

/**
 * Longest stem wins, so "why do you want to work" beats the shorter "why you"
 * regardless of the order the shapes are declared in.
 */
export function classifyShape(normalised) {
  let best = null;
  for (const shape of SHAPES) {
    for (const stem of shape.stems) {
      if (normalised.includes(stem) && (!best || stem.length > best.stem.length)) {
        best = { id: shape.id, answeredBy: shape.answeredBy, stem };
      }
    }
  }
  if (best) return { shape: best.id, answeredBy: best.answeredBy, matchedStem: best.stem };

  // No stem hit. A question mark plus reasonable length still reads as a
  // question we should try to answer from a story rather than skip.
  return { shape: 'unknown', answeredBy: 'story', matchedStem: null };
}

// -------------------------------------------------------------------- themes

const signalCache = new Map();

/** Prefix match on a word boundary: `learn` hits learning/learned, `lead` misses misleading. */
function signalRegex(signal) {
  if (!signalCache.has(signal)) {
    const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    signalCache.set(signal, new RegExp(`\\b${escaped}`, 'i'));
  }
  return signalCache.get(signal);
}

const asPair = (s) => (Array.isArray(s) ? { text: s[0], weight: s[1] } : { text: s, weight: 1 });

export function scoreThemes(normalised, { industry = null } = {}) {
  const pool = [...THEMES];
  const addOns = industry ? INDUSTRY_THEMES[industry] || [] : [];
  for (const theme of ADDON_THEMES) {
    if (addOns.includes(theme.id) && !pool.some((t) => t.id === theme.id)) pool.push(theme);
  }

  const scored = [];
  for (const theme of pool) {
    let score = 0;
    const hits = [];
    for (const raw of theme.signals) {
      const { text, weight } = asPair(raw);
      if (signalRegex(text).test(normalised)) {
        score += weight;
        hits.push(text);
      }
    }
    for (const raw of theme.against || []) {
      const { text, weight } = asPair(raw);
      if (signalRegex(text).test(normalised)) score -= weight;
    }
    if (score > 0) scored.push({ theme: theme.id, label: theme.label, score, hits });
  }

  return scored.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------- bank match

/**
 * @param {string} question   raw question text as the reader found it
 * @param {object} bank       { stories: [], statements: [], profile: {}, learned: {} }
 * @param {object} opts       { company, role, industry, maxLength, limit }
 */
export function matchQuestion(question, bank = {}, opts = {}) {
  const { company = '', role = '', industry = null, maxLength = null, limit = 3 } = opts;

  const normalised = normalise(question, { company, role });
  const wordLimit = extractWordLimit(question, maxLength);
  const variant = pickVariant(wordLimit);
  const { shape, answeredBy, matchedStem } = classifyShape(normalised);
  const themes = scoreThemes(normalised, { industry });

  const result = {
    question, normalised, shape, answeredBy, matchedStem,
    wordLimit, variant, themes,
    source: null, candidates: [],
  };

  // 1. Learned cache. A question anyone has already answered is free forever.
  const learnedId = (bank.learned || {})[normalised];
  if (learnedId) {
    const entry = findEntry(bank, learnedId);
    if (entry) {
      result.source = 'learned';
      result.candidates = [{ entry, score: 100, why: ['answered before'] }];
      return result;
    }
  }

  // 2. Plain facts come straight off the profile, no scoring involved.
  if (answeredBy === 'profile') {
    result.source = 'profile';
    result.candidates = [];
    return result;
  }

  // 3. Rank the right half of the bank by theme overlap.
  const pool = answeredBy === 'statement' ? bank.statements || [] : bank.stories || [];
  const themeScore = new Map(themes.map((t) => [t.theme, t.score]));

  const ranked = pool
    .map((entry) => {
      let score = 0;
      const why = [];
      for (const theme of entry.themes || []) {
        const s = themeScore.get(theme);
        if (s) {
          score += s * 2;
          why.push(theme);
        }
      }
      for (const kw of entry.keywords || []) {
        if (signalRegex(kw).test(normalised)) {
          score += 1;
          why.push(kw);
        }
      }
      // A statement declaring the shape it answers is a strong direct hit.
      if ((entry.answers || []).includes(shape)) {
        score += 5;
        why.push(shape);
      }
      return { entry, score, why };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  result.candidates = ranked.slice(0, limit);
  result.source = ranked.length ? 'matched' : 'none';
  return result;
}

function findEntry(bank, id) {
  return (bank.stories || []).find((s) => s.id === id)
    || (bank.statements || []).find((s) => s.id === id)
    || null;
}

const countWords = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

/**
 * Pick the variant to use and hand back both it and its text.
 *
 * The length band is a starting guess, not the answer: the bands are ranges, so
 * a "medium" written at 190 words does not fit a form asking for 150. When a
 * hard limit is known, the real rule is the longest variant that fits under it,
 * and only if nothing fits do we return the shortest and admit it is over.
 *
 * Falls back through the bands rather than returning nothing, because a
 * slightly-too-short answer beats an empty box.
 */
export function fitVariant(entry, variant, { limit = null } = {}) {
  if (!entry) return { variant: null, text: null, overLimit: false };
  const order = LENGTH_BANDS.map((b) => b.variant);
  const variants = entry.variants || {};
  const has = (name) => !!String(variants[name] || '').trim();

  const start = Math.max(0, order.indexOf(variant));
  let chosen = null;
  for (let i = start; i >= 0 && !chosen; i--) if (has(order[i])) chosen = order[i];
  for (let i = start + 1; i < order.length && !chosen; i++) if (has(order[i])) chosen = order[i];
  if (!chosen) return { variant: null, text: null, overLimit: false };

  if (limit) {
    // Step down until it fits. If even the shortest is over, say so.
    let i = order.indexOf(chosen);
    while (i > 0 && countWords(variants[chosen]) > limit) {
      i -= 1;
      if (has(order[i])) chosen = order[i];
    }
  }

  return {
    variant: chosen,
    text: variants[chosen],
    overLimit: !!limit && countWords(variants[chosen]) > limit,
  };
}

/** The text to drop in the box, with the placeholders filled. */
export function renderAnswer(entry, variant, { company = '', role = '', limit = null } = {}) {
  const { text } = fitVariant(entry, variant, { limit });
  if (!text) return null;

  return text
    .replace(/\{\{\s*company\s*\}\}/gi, company || 'the company')
    .replace(/\{\{\s*role\s*\}\}/gi, role || 'this role');
}
