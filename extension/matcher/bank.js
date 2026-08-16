// The bank itself: what a valid one looks like, what it covers, and what it is
// still missing.
//
// The validator is strict about the things that silently produce a wrong answer
// later (an entry with no text in it, two entries sharing an id, a learned
// mapping pointing at a story that has been deleted) and only warns about the
// things that merely make the bank weaker (an unknown theme, a story with no
// `raw`). Nothing here throws: a bank with problems still loads, and the panel
// says what is wrong.

import { THEMES, ADDON_THEMES, SHAPES, LENGTH_BANDS } from './taxonomy.js';
import { PROFILE_FIELDS } from './profile.js';

export const THEME_IDS = [...THEMES, ...ADDON_THEMES].map((t) => t.id);
export const SHAPE_IDS = SHAPES.map((s) => s.id);
export const VARIANTS = LENGTH_BANDS.map((b) => b.variant);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

export function emptyBank() {
  return { profile: {}, stories: [], statements: [], learned: {} };
}

/** @returns {{ok, errors: string[], warnings: string[], stats: object}} */
export function validateBank(input) {
  const errors = [];
  const warnings = [];

  if (!isObj(input)) {
    return { ok: false, errors: ['This is not a bank object. Expected JSON starting with {'], warnings, stats: null };
  }

  const bank = { ...emptyBank(), ...input };

  for (const key of ['stories', 'statements']) {
    if (!Array.isArray(bank[key])) {
      errors.push(`"${key}" must be a list (found ${typeof bank[key]}).`);
      bank[key] = [];
    }
  }
  if (!isObj(bank.profile)) {
    errors.push('"profile" must be an object.');
    bank.profile = {};
  }
  if (!isObj(bank.learned)) {
    warnings.push('"learned" was not an object, so it has been reset to empty.');
    bank.learned = {};
  }

  const seen = new Map();
  const entries = [
    ...bank.stories.map((e) => ['story', e]),
    ...bank.statements.map((e) => ['statement', e]),
  ];

  for (const [kind, entry] of entries) {
    if (!isObj(entry)) {
      errors.push(`A ${kind} is not an object.`);
      continue;
    }
    const id = entry.id;
    const where = `${kind} "${id || entry.title || '(untitled)'}"`;

    if (!id) errors.push(`${where} has no id.`);
    else if (seen.has(id)) errors.push(`Two entries share the id "${id}" (${seen.get(id)} and ${kind}).`);
    else seen.set(id, kind);

    if (!entry.title) warnings.push(`${where} has no title, so the panel cannot say where an answer came from.`);

    const variants = isObj(entry.variants) ? entry.variants : {};
    const filled = VARIANTS.filter((v) => String(variants[v] || '').trim());
    if (!filled.length) errors.push(`${where} has no answer text in any length.`);
    else if (!variants.medium) warnings.push(`${where} has no "medium" variant, the length most forms ask for.`);

    for (const [name, text] of Object.entries(variants)) {
      if (!VARIANTS.includes(name)) warnings.push(`${where} has an unknown length "${name}". Use: ${VARIANTS.join(', ')}.`);
      const stray = String(text || '').match(/\{\{\s*(\w+)\s*\}\}/g) || [];
      for (const token of stray) {
        if (!/\{\{\s*(company|role)\s*\}\}/i.test(token)) {
          warnings.push(`${where} carries a placeholder ${token} that nothing fills in.`);
        }
      }
    }

    for (const theme of entry.themes || []) {
      if (!THEME_IDS.includes(theme)) warnings.push(`${where} uses an unknown theme "${theme}".`);
    }

    if (kind === 'statement') {
      for (const shape of entry.answers || []) {
        if (!SHAPE_IDS.includes(shape)) warnings.push(`${where} answers an unknown shape "${shape}".`);
      }
      if (!(entry.answers || []).length) warnings.push(`${where} does not say which question shapes it answers.`);
    } else if (!String(entry.raw || '').trim()) {
      warnings.push(`${where} has no "raw" version, so a recut has nothing to work from.`);
    }
  }

  // Learned mappings that point nowhere are dropped rather than left to
  // short-circuit matching onto a story that no longer exists.
  const dropped = [];
  for (const [key, id] of Object.entries(bank.learned)) {
    if (!seen.has(id)) {
      dropped.push(key);
      delete bank.learned[key];
    }
  }
  if (dropped.length) warnings.push(`${dropped.length} remembered answer(s) pointed at deleted entries and were dropped.`);

  const missingProfile = PROFILE_FIELDS
    .filter((f) => ['name', 'email', 'phone', 'workRights'].includes(f.key))
    .filter((f) => !bank.profile[f.key])
    .map((f) => f.label);
  if (missingProfile.length) warnings.push(`Profile is missing: ${missingProfile.join(', ')}.`);

  const stats = {
    stories: bank.stories.length,
    statements: bank.statements.length,
    learned: Object.keys(bank.learned).length,
    profileFields: PROFILE_FIELDS.filter((f) => bank.profile[f.key] !== undefined && bank.profile[f.key] !== '').length,
    industry: bank.profile.industry || null,
    longestAnswer: Math.max(0, ...entries.map(([, e]) => words(isObj(e?.variants) ? e.variants.full || e.variants.medium : ''))),
  };

  return { ok: errors.length === 0, errors, warnings, stats, bank };
}

/**
 * Which themes the bank can actually answer on, and which are still bare.
 * This is the number that predicts whether a form goes well, so the options
 * page leads with it.
 */
export function bankCoverage(bank = {}, { industry = null } = {}) {
  const pool = [...THEMES];
  if (industry || bank.profile?.industry) {
    // Add-on themes only count when the candidate's field calls for them.
    for (const t of ADDON_THEMES) if (!pool.some((p) => p.id === t.id)) pool.push(t);
  }

  const counts = new Map();
  for (const entry of [...(bank.stories || []), ...(bank.statements || [])]) {
    for (const theme of entry.themes || []) counts.set(theme, (counts.get(theme) || 0) + 1);
  }

  const rows = pool.map((t) => ({
    theme: t.id,
    label: t.label,
    count: counts.get(t.id) || 0,
    covered: (counts.get(t.id) || 0) > 0,
  }));

  return {
    rows,
    covered: rows.filter((r) => r.covered).length,
    total: rows.length,
    gaps: rows.filter((r) => !r.covered).map((r) => r.label),
  };
}

/** A copy of the bank with the extension's remembered answers folded in. */
export function withLearned(bank = {}, learned = {}) {
  return { ...bank, learned: { ...(bank.learned || {}), ...learned } };
}
