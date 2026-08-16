// Story intake: turn a resume into an interview, not into answers.
//
// A resume is an INDEX of stories, never the stories themselves. It records the
// outcome with everything interesting removed: no situation, no obstacle, no
// "what did YOU do as opposed to the team", and above all no failures, because
// nobody lists their mistakes. Generating answers straight off a resume is
// precisely what makes every commercial autofill tool sound templated, since a
// resume is all they have.
//
// So this module does three things and stops:
//   1. mine the resume for candidate MOMENTS (seeds)
//   2. work out which themes those seeds could evidence, and which they cannot
//   3. write an anchored interview script that fills the gaps
//
// It deliberately never writes an answer. A human still has to talk.
//
// No LLM, no network. A model would parse messier resumes better and can be
// layered on later, but the whole thing needs to run offline and be testable,
// and the gap analysis below is the part that actually matters.

import { THEMES, ADDON_THEMES, INDUSTRY_THEMES } from '../matcher/taxonomy.js';
import { PROFILE_FIELDS } from '../matcher/profile.js';

// -------------------------------------------------------------- resume shape

const HEADINGS = /^(education|experience|employment|work experience|professional experience|career history|projects?|volunteer(ing)?|community|skills|technical skills|certifications?|licences?|licenses?|achievements?|awards?|summary|profile|objective|referees?|references?|interests|extracurricular)\b/i;

const YEAR = /\b(19|20)\d{2}\b/;
const BULLET = /^\s*[-•*▪●·o]\s+/;

/** Split a resume into sections, entries (role + org + dates) and their bullets. */
export function parseResume(text) {
  const lines = (text || '').split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  const sections = [];
  let section = { heading: 'unlabelled', entries: [] };
  let entry = null;

  const pushEntry = () => { if (entry) section.entries.push(entry); entry = null; };
  const pushSection = () => {
    pushEntry();
    if (section.entries.length) sections.push(section);
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const isHeading = HEADINGS.test(line) && line.length < 45 && !BULLET.test(line);
    if (isHeading) {
      pushSection();
      section = { heading: line.replace(/[:.]$/, '').toLowerCase(), entries: [] };
      continue;
    }

    if (BULLET.test(line)) {
      const bullet = line.replace(BULLET, '').trim();
      if (!entry) entry = { role: '', org: '', dates: '', bullets: [] };
      if (bullet) entry.bullets.push(bullet);
      continue;
    }

    // A non-bullet line carrying a year starts a new entry.
    if (YEAR.test(line)) {
      pushEntry();
      entry = { ...splitEntryLine(line), bullets: [] };
      continue;
    }

    // Anything else. Open an implicit entry rather than dropping the line:
    // plenty of resumes list achievements with no bullet marker and no date,
    // and silently discarding them is exactly the kind of quiet data loss that
    // makes a parser look like it works when it does not.
    if (!entry) entry = { role: section.heading, org: '', dates: '', bullets: [] };
    entry.bullets.push(line);
  }
  pushSection();

  return sections;
}

function splitEntryLine(line) {
  const parts = line.split(/\s*\|\s*|\s+[—–]\s+|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  const dateIdx = parts.findIndex((p) => YEAR.test(p));
  const dates = dateIdx >= 0 ? parts[dateIdx] : '';
  const rest = parts.filter((_, i) => i !== dateIdx);
  return {
    role: rest[0] || line,
    org: (rest[1] || '').split(',')[0].trim(),
    dates,
  };
}

// --------------------------------------------------------------- seed scoring

const ACTION_VERBS = /^(led|managed|supervis|coordinat|built|created|designed|redesign|rebuilt|develop|implement|launch|introduc|improv|streamlin|automat|reduc|increas|resolv|handled|negotiat|train|mentor|taught|identif|investigat|reconcil|audit|analys|analyz|deliver|organis|organiz|present|pitched|recover|fixed|solved|initiat|propos|establish|migrat|transition)/i;

const SCOPE_WORDS = /\b(team|customer|client|patient|stakeholder|store|project|deadline|supplier|budget|process|system|report|volunteer|student|staff|shift|campaign)/i;

const GENERIC = /\b(responsible for|duties includ|assisted with|as required|day.to.day|various tasks|general (?:admin|customer|office)|ad.hoc|other duties|participated in|involved in|helped with|worked on)\b/i;

const HAS_NUMBER = /(\d[\d,.]*\s*(?:%|percent|k\b|m\b)|\$\s?\d|\b\d{2,}\b|\bby \d)/i;

const SKILLS_LIST = /^(proficient|familiar|experienced|skilled|competent|working knowledge)\b|^[^.]{0,120}(,\s*[A-Za-z+#. ]{2,20}){3,}$/i;

/** Phone, email, profile links: never a story, and they carry digits that would otherwise score. */
const CONTACT = /@|\bhttps?:|\b(?:linkedin|github)\.com|\b\d{4}\s?\d{3}\s?\d{3}\b|^\+?\d[\d ]{7,}/i;

/**
 * How much real story is likely to sit behind a bullet.
 * Negative or zero means it is a duty statement, not a moment.
 */
export function scoreSeed(text) {
  const reasons = [];
  let score = 0;

  if (ACTION_VERBS.test(text)) { score += 3; reasons.push('action verb'); }
  if (HAS_NUMBER.test(text)) { score += 2; reasons.push('concrete number'); }

  const scopeHits = (text.match(new RegExp(SCOPE_WORDS.source, 'gi')) || []).length;
  if (scopeHits) { score += Math.min(scopeHits, 2); reasons.push('scope'); }

  if (GENERIC.test(text)) { score -= 4; reasons.push('duty statement'); }
  if (SKILLS_LIST.test(text)) { score -= 4; reasons.push('skills list'); }
  if (CONTACT.test(text)) { score -= 6; reasons.push('contact details'); }
  if (text.length < 25) { score -= 2; reasons.push('too short'); }

  return { score, reasons };
}

// --------------------------------------------------- resume language -> themes

/**
 * Resume verbs are not question verbs, so the matcher's signals do not fire on
 * them. These are the resume-side equivalents.
 *
 * There is deliberately no entry for failure, conflict or ethics. Those three
 * themes cannot be evidenced by a resume at all, which is the entire reason an
 * interview step has to exist. NEVER_ON_RESUME below asserts it.
 */
// Leading \b only, never trailing: these are PREFIXES, so `reconcil` has to
// catch "Reconciled" and `simultaneous` has to catch "simultaneously". Where a
// prefix would be dangerous the word is pinned explicitly instead, which is why
// `led\b` is anchored (otherwise "supplier ledgers" reads as leadership).
const RESUME_HINTS = {
  leadership: /\b(led\b|leading|managed|supervis|oversaw|coordinat|delegat|trained|training|mentor|captain|president|head of|team of)/i,
  teamwork: /\b(collaborat|cross.functional|team of|worked with|partnered|group (project|assignment)|committee|jointly)/i,
  customer: /\b(customer|client|patient|guest|retail|hospitality|front of house|service|sales|reception|help ?desk|public)/i,
  detail: /\b(reconcil|audit|accura|quality|verif|checked|proofread|data entry|documentation|compliance check|discrepanc)/i,
  initiative: /\b(introduc|creat|launch|initiat|propos|redesign|rebuilt|streamlin|improv|automat|reduc|built)/i,
  learning: /\b(learn|self.taught|taught myself|certif|upskill|trained in|new (system|software|tool|platform))/i,
  pressure: /\b(deadline|peak|high.volume|fast.paced|busy period|time.critical|under pressure|turnaround)/i,
  priorities: /\b(simultaneous|multiple|concurrent|juggl|competing|prioritis|prioritiz|workload)/i,
  change: /\b(transition|migrat|restructur|adapt|new process|rollout|change management)/i,
  safety: /\b(safety|hazard|whs|ohs|incident|risk assessment|first aid|infection control)/i,
  procedure: /\b(procedure|protocol|policy|complian|regulat|guideline|sop|standard operating|governance)/i,
};

/** The three themes a resume structurally cannot evidence. */
export const NEVER_ON_RESUME = ['failure', 'conflict', 'ethics'];

/**
 * How often entry-level forms ask about each theme. This is a considered guess,
 * not data. It only affects the ORDER gaps are asked about, so being wrong is
 * cheap, and the prototype's own captures will correct it.
 */
const ASK_FREQUENCY = {
  failure: 10, teamwork: 10, pressure: 9, customer: 9, conflict: 8,
  initiative: 7, learning: 7, leadership: 6, priorities: 6, detail: 5,
  change: 4, safety: 6, procedure: 5, ethics: 4,
};

function themesForText(text, pool) {
  return pool.filter((t) => RESUME_HINTS[t.id] && RESUME_HINTS[t.id].test(text)).map((t) => t.id);
}

function themePool(industry) {
  const pool = [...THEMES];
  for (const t of ADDON_THEMES) {
    if ((INDUSTRY_THEMES[industry] || []).includes(t.id) && !pool.some((p) => p.id === t.id)) pool.push(t);
  }
  return pool;
}

// -------------------------------------------------------------------- seeds

/** Mine the resume for candidate moments, strongest first. */
export function extractSeeds(resumeText, { industry = null, minScore = 2 } = {}) {
  const pool = themePool(industry);
  const sections = parseResume(resumeText);
  const seeds = [];
  let n = 0;

  for (const section of sections) {
    // `unlabelled` is the contact block above the first heading.
    if (/^(unlabelled|skills|technical skills|interests|referees?|references?|summary|profile|objective)/.test(section.heading)) continue;

    for (const entry of section.entries) {
      for (const bullet of entry.bullets) {
        const { score, reasons } = scoreSeed(bullet);
        seeds.push({
          id: `seed${++n}`,
          text: bullet,
          section: section.heading,
          role: entry.role,
          org: entry.org,
          dates: entry.dates,
          score,
          reasons,
          themes: themesForText(bullet, pool),
          strong: score >= minScore,
        });
      }
    }
  }

  return seeds.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------- gaps

/** Which themes the resume evidences, which it does not, and what to ask about. */
export function analyseGaps(seeds, { industry = null } = {}) {
  const pool = themePool(industry);
  const covered = new Map();

  for (const seed of seeds) {
    if (!seed.strong) continue;
    for (const theme of seed.themes) {
      if (!covered.has(theme)) covered.set(theme, []);
      covered.get(theme).push(seed.id);
    }
  }

  const rows = pool.map((t) => ({
    theme: t.id,
    label: t.label,
    covered: covered.has(t.id),
    evidence: covered.get(t.id) || [],
    frequency: ASK_FREQUENCY[t.id] ?? 5,
    unreachable: NEVER_ON_RESUME.includes(t.id),
  }));

  return {
    rows,
    coveredCount: rows.filter((r) => r.covered).length,
    total: rows.length,
    gaps: rows.filter((r) => !r.covered).sort((a, b) => b.frequency - a.frequency),
  };
}

// ------------------------------------------------------------------- script

const GAP_PROMPTS = {
  failure: (a) => `At ${a}, think of a shift or a week that went badly. What happened?`,
  conflict: (a) => `At ${a}, was there someone you found difficult to work with, or a time you disagreed with how something was being done?`,
  ethics: (a) => `At ${a}, was there ever a time where the easy thing and the right thing were not the same?`,
  pressure: (a) => `What was the busiest or most stressful day you had at ${a}? Talk me through it.`,
  teamwork: (a) => `Tell me about a time at ${a} where you had to rely on other people to get something done.`,
  customer: (a) => `Tell me about the most difficult customer or client you dealt with at ${a}.`,
  leadership: (a) => `Was there ever a point at ${a} where you ended up making the call, or showing someone else how to do something?`,
  initiative: (a) => `Was there anything at ${a} you changed or improved that nobody asked you to?`,
  learning: (a) => `What was the hardest thing you had to pick up quickly at ${a}?`,
  priorities: (a) => `Tell me about a time at ${a} when you had more to do than time to do it. How did you decide what to drop?`,
  detail: (a) => `Was there a time at ${a} where you caught something that other people had missed?`,
  change: (a) => `Tell me about a time at ${a} when something changed unexpectedly and you had to adjust.`,
  safety: (a) => `Was there ever a safety issue at ${a} that you noticed or had to raise?`,
  procedure: (a) => `Tell me about a time at ${a} where following the correct process mattered, or where someone was tempted to cut a corner.`,
};

/** The two follow-ups every story needs, because people skip straight to the result. */
export const PROBES = [
  'What did you specifically do? Not the team, you.',
  'What did you decide NOT to do?',
  'How did it end up?',
];

/**
 * Pick the role the candidate spent most time in, since that is where the
 * unrecorded stories are. Falls back to whichever entry has the most bullets.
 */
export function anchorRole(seeds) {
  const byOrg = new Map();
  for (const seed of seeds) {
    if (!seed.org) continue;
    byOrg.set(seed.org, (byOrg.get(seed.org) || 0) + 1);
  }
  if (!byOrg.size) return 'your last job';
  return [...byOrg.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * The deliverable: a set of anchored questions. Never abstract. "Tell me about
 * a time you failed" gets a blank stare; "think of a shift at Harborline that
 * went badly" gets a story, because it names a time and place to retrieve from.
 */
export function buildScript(seeds, gapReport, { maxSeedQuestions = 6 } = {}) {
  const anchor = anchorRole(seeds);
  const questions = [];

  // 1. One question per strong seed, best first, one per organisation-ish spread.
  const strong = seeds.filter((s) => s.strong).slice(0, maxSeedQuestions);
  for (const seed of strong) {
    const where = seed.org || seed.role || seed.section;
    questions.push({
      id: `q-${seed.id}`,
      kind: 'seed',
      from: seed.id,
      themes: seed.themes,
      ask: `Your resume says "${trim(seed.text)}" at ${where}. Walk me through one specific time that happened. What was actually going on?`,
      probes: PROBES,
    });
  }

  // 2. One question per gap, most-asked first. These are the ones the resume
  //    could never have told us about.
  for (const gap of gapReport.gaps) {
    const prompt = GAP_PROMPTS[gap.theme];
    if (!prompt) continue;
    questions.push({
      id: `q-gap-${gap.theme}`,
      kind: 'gap',
      themes: [gap.theme],
      unreachable: gap.unreachable,
      ask: prompt(anchor),
      probes: PROBES,
    });
  }

  return { anchor, questions, estimatedMinutes: questions.length * 5 };
}

const trim = (s, n = 70) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/** Everything in one call. */
export function planIntake(resumeText, { industry = null } = {}) {
  const seeds = extractSeeds(resumeText, { industry });
  const gaps = analyseGaps(seeds, { industry });
  const script = buildScript(seeds, gaps);
  return { seeds, gaps, script };
}

// ------------------------------------------------------------------ scaffold

/** The five statements every entry-level form asks for in some wording. */
const STATEMENT_STUBS = [
  { id: 'st1', title: 'About me', themes: [], answers: ['self_description'],
    keywords: ['about yourself', 'introduce', 'tell us about you', 'describe yourself'] },
  { id: 'st2', title: 'Strengths', themes: [], answers: ['self_description'],
    keywords: ['strength', 'best qualit', 'good at', 'bring to', 'top skill'] },
  { id: 'st3', title: 'Weakness', themes: ['failure', 'learning'], answers: ['self_description'],
    keywords: ['weakness', 'improve', 'development area', 'work on'] },
  { id: 'st4', title: 'Why this field', themes: [], answers: ['motivation'],
    keywords: ['why did you choose', 'career goal', 'this field', 'this industry', 'where do you see yourself'] },
  { id: 'st5', title: 'Why this company and why me', themes: [], answers: ['motivation'],
    keywords: ['why do you want to work', 'why us', 'this company', 'why should we hire',
               'best person', 'best fit', 'what makes you', 'why this role'] },
];

const titleFor = (question) => {
  if (question.kind === 'gap') return `${question.themes[0]}: (name the story once you have told it)`;
  const quoted = question.ask.match(/"([^"]+)"/);
  return quoted ? trim(quoted[1], 60) : trim(question.ask, 60);
};

/**
 * A bank with the right shape and no content: one slot per question the intake
 * asks, waiting for the answers.
 *
 * It will not import into the extension until the slots have text in them, and
 * that is on purpose. An empty bank that loads is a bank that answers forms with
 * nothing and looks like it worked.
 */
export function buildScaffold(plan, { profile = {} } = {}) {
  const filledProfile = {};
  for (const field of PROFILE_FIELDS) {
    filledProfile[field.key] = profile[field.key] !== undefined
      ? profile[field.key]
      : (field.boolean ? null : '');
  }

  const stories = plan.script.questions.map((q, i) => ({
    id: `s${i + 1}`,
    title: titleFor(q),
    context: '',
    themes: q.themes || [],
    keywords: [],
    prompt: q.ask,
    raw: '',
    variants: { headline: '', short: '', medium: '', full: '' },
  }));

  return {
    _howToFill: 'Answer each "prompt" out loud and transcribe it into "raw" in your own words. '
      + 'Then cut raw down into the four variants: headline (~25 words), short (~80), medium (~180), full (as long as it needs). '
      + 'Delete any story you have nothing for. The bank will not load until every entry left in it has text.',
    profile: filledProfile,
    stories,
    statements: STATEMENT_STUBS.map((s) => ({
      ...s,
      raw: '',
      variants: { headline: '', short: '', medium: '', full: '' },
    })),
    learned: {},
  };
}

/** Printable version, for a coaching call or a voice-note prompt list. */
export function formatScript(plan) {
  const lines = [];
  lines.push(`STORY INTAKE  (${plan.script.questions.length} questions, about ${plan.script.estimatedMinutes} min)`);
  lines.push(`Coverage: ${plan.gaps.coveredCount}/${plan.gaps.total} themes evidenced by the resume\n`);

  lines.push('FROM THE RESUME');
  for (const q of plan.script.questions.filter((x) => x.kind === 'seed')) {
    lines.push(`\n  ${q.ask}`);
    for (const p of q.probes) lines.push(`      - ${p}`);
  }

  lines.push('\n\nNOT ON THE RESUME  (this is where the real material is)');
  for (const q of plan.script.questions.filter((x) => x.kind === 'gap')) {
    lines.push(`\n  [${q.themes[0]}]${q.unreachable ? ' *' : ''} ${q.ask}`);
    for (const p of q.probes) lines.push(`      - ${p}`);
  }
  lines.push('\n  * a resume can never evidence this theme, so it is always asked');

  return lines.join('\n');
}
