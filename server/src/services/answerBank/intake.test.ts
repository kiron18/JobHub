/**
 * The intake planner, on the server that owns it.
 *
 * The exhaustive parser and hint tests live with the extension's history; what
 * matters here is the contract the rest of the system leans on, and the two
 * real resume shapes that broke it.
 */
import { describe, it, expect } from 'vitest';
import { planIntake, buildScaffold, parseResume, extractSeeds, anchorRole, THEME_HINTS, CUES, cuesAreSafe, clamp } from './intake';
import { CORE_THEMES, coreStatus, buildCoverage } from './coverage';

/** Written in Word: tabs, and the employer on the line under the role. */
const WORD_RESUME = [
  'Employment',
  '',
  '\t11/2021-02/2023\tTrainee',
  '\tLanka Hospitals PLC',
  '\tNo 578 Elvitigala Mawatha, Narahenpita, Colombo 5',
  '\t- investigating abnormal biochemical conditions',
  '\t- analysing chemicals in the body using gel electrophoresis',
  '\t- writing reports of findings',
  '',
  '\t07/2023 – 10/2025\tBachelor of Science',
  '\tDeakin University, Burwood',
  '\t- Group placement project on critical energy elements',
].join('\n');

/** Written with pipes, the shape the parser was originally built for. */
const PIPE_RESUME = [
  'Experience',
  '',
  'Finance Intern | Meridian Advisory, Melbourne | Nov 2025 - Feb 2026',
  '- Reconciled a supplier ledger and identified a $2,000 discrepancy',
  '- Coordinated the quarterly stocktake across two sites',
].join('\n');

describe('parseResume', () => {
  it('reads a tab-separated entry line', () => {
    const entry = parseResume(WORD_RESUME)[0].entries[0];
    expect(entry.role).toBe('Trainee');
    expect(entry.dates).toBe('11/2021-02/2023');
  });

  it('keeps a date range whole instead of making its back half the role', () => {
    const degree = parseResume(WORD_RESUME)[0].entries.find((e) => e.role === 'Bachelor of Science');
    expect(degree?.dates).toBe('07/2023 – 10/2025');
  });

  it('adopts the employer from the line below the role', () => {
    expect(parseResume(WORD_RESUME)[0].entries[0].org).toBe('Lanka Hospitals PLC');
  });

  it('still reads the pipe-separated shape', () => {
    const entry = parseResume(PIPE_RESUME)[0].entries[0];
    expect(entry.role).toBe('Finance Intern');
    expect(entry.org).toBe('Meridian Advisory');
  });
});

describe('extractSeeds', () => {
  it('never offers a street address as something to tell a story about', () => {
    const address = extractSeeds(WORD_RESUME).filter((s) => /Elvitigala/.test(s.text));
    expect(address.every((s) => !s.strong)).toBe(true);
  });

  it('anchors on a real employer rather than the generic fallback', () => {
    expect(anchorRole(extractSeeds(WORD_RESUME))).toBe('Lanka Hospitals PLC');
  });
});

describe('planIntake', () => {
  const plan = planIntake(WORD_RESUME, { industry: 'lab' });

  it('always asks about failure and conflict, which no resume can evidence', () => {
    const themes = plan.script.questions.filter((q) => q.kind === 'gap').map((q) => q.themes[0]);
    expect(themes).toContain('failure');
    expect(themes).toContain('conflict');
  });

  // Ethics is the third theme a resume structurally cannot evidence, but unlike
  // the other two it is an industry addon, so a lab or trades candidate is never
  // asked about it at all. Pinned rather than fixed: moving it into the core set
  // changes the matcher's theme pool for every existing bank, which is a product
  // decision, not a test fix.
  it('asks about ethics only where the industry turns it on', () => {
    const themeOf = (industry: string) => planIntake(WORD_RESUME, { industry })
      .script.questions.map((q) => q.themes[0]);
    expect(themeOf('lab')).not.toContain('ethics');
    expect(themeOf('finance')).toContain('ethics');
  });

  it('turns on the industry themes it was given', () => {
    const themes = plan.script.questions.map((q) => q.themes[0]);
    expect(themes).toContain('safety');
  });

  it('gives every question reach, shape and avoid guidance', () => {
    expect(plan.script.questions.every((q) => q.hints?.reach && q.hints?.shape && q.hints?.avoid)).toBe(true);
  });

  it('does not give two themes the same guidance', () => {
    const gaps = plan.script.questions.filter((q) => q.kind === 'gap');
    expect(new Set(gaps.map((q) => q.hints.reach)).size).toBe(gaps.length);
  });

  it('names the disguised-strength trap on the failure question', () => {
    expect(THEME_HINTS.failure.avoid).toMatch(/disguised strength/i);
  });

  it('gives every question a stable id, so an answer cannot drift onto another', () => {
    const ids = plan.script.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produces the same plan twice for the same resume', () => {
    const again = planIntake(WORD_RESUME, { industry: 'lab' });
    expect(again.script.questions.map((q) => q.id)).toEqual(plan.script.questions.map((q) => q.id));
  });
});

describe('buildScaffold', () => {
  const plan = planIntake(WORD_RESUME, { industry: 'lab' });

  it('leaves every answer slot empty', () => {
    const bank = buildScaffold(plan);
    expect(bank.stories.length).toBeGreaterThan(0);
    expect(bank.stories.every((s) => s.raw === '')).toBe(true);
    expect(bank.stories.every((s) => Object.values(s.variants).every((v) => v === ''))).toBe(true);
  });

  it('carries the question and its hints into every slot', () => {
    const bank = buildScaffold(plan);
    expect(bank.stories.every((s) => !!s.prompt && !!s.hints?.avoid)).toBe(true);
  });

  it('fills only the profile fields it was actually given', () => {
    const bank = buildScaffold(plan, { profile: { name: 'Pawan Hewage', email: 'p@example.com' } });
    expect(bank.profile.name).toBe('Pawan Hewage');
    // Work rights is the one field the extension refuses to guess. A scaffold
    // that quietly filled it would smuggle the guess in through the side door.
    expect(bank.profile.workRights).toBe('');
    expect(bank.profile.hasWorkRights).toBe(null);
  });

  it('gives every statement slot the same empty shape as a story', () => {
    const bank = buildScaffold(plan);
    expect(bank.statements.every((s) => s.raw === '' && s.variants.full === '')).toBe(true);
  });
});

describe('the warm-up seeds', () => {
  /** The shape that produced six near-duplicate questions before the dedup. */
  const REPEATED = [
    'Experience',
    '',
    'Digital Marketing Specialist | Forico Media, Melbourne | February 2024 - Present',
    '- Reduced cost-per-result on Meta Ads by 90% through manual bid adjustments and weekly audience testing',
    '- Managed a monthly ad budget of $18,000 across four client accounts',
    '- Built automated reporting dashboards in Looker Studio for client review meetings',
    '- Coordinated a student ambassador photoshoot across two campuses',
    '- Handled customer complaints at the service desk during peak trading',
  ].join('\n');

  const script = planIntake(REPEATED).script;
  const seedQuestions = script.questions.filter((q) => q.kind === 'seed');

  it('warms up on two, not six', () => {
    expect(seedQuestions).toHaveLength(2);
  });

  it('never asks two warm-ups about the same theme', () => {
    const seen = new Set<string>();
    for (const q of seedQuestions) {
      for (const theme of q.themes) {
        expect(seen.has(theme)).toBe(false);
        seen.add(theme);
      }
    }
  });

  it('never chops a resume line mid-word', () => {
    // The bug this replaces produced `"...on Meta Ads by 90% through manual"`,
    // a quote ending mid-sentence on a word the writer never wrote.
    const long = 'Reduced cost-per-result on Meta Ads by 90% through manual bid adjustments';
    for (let max = 10; max < long.length; max += 1) {
      const cut = clamp(long, max).replace(/…$/, '');
      expect(long.startsWith(cut)).toBe(true);
      // It stopped at a space or at the end, so the last word survives whole.
      expect([' ', undefined]).toContain(long[cut.length]);
    }
  });

  it('leaves a line that already fits completely alone', () => {
    expect(clamp('Trained three new starters', 90)).toBe('Trained three new starters');
  });

  it('quotes a short line whole rather than eliding it', () => {
    const short = planIntake([
      'Experience',
      '',
      'Retail Assistant | Coles, Glen Waverley | 2022 - 2023',
      '- Trained three new starters on register procedures',
    ].join('\n')).script.questions[0];
    expect(short.ask).toContain('"Trained three new starters on register procedures"');
  });

  // The planned figure is the CEILING, before a single answer has retired
  // anything. coverage.ts is what takes it to the quarter hour, and it can only
  // do that once there is an answer to read.
  it('plans a session somebody might finish, not an hour of it', () => {
    expect(script.questions.length).toBeLessThanOrEqual(10);
    expect(script.estimatedMinutes).toBeLessThanOrEqual(25);
  });
});

describe('cues', () => {
  const script = planIntake(WORD_RESUME, { industry: 'lab' }).script;

  it('offers a way in on every question', () => {
    for (const q of script.questions) expect(q.cues.length).toBeGreaterThan(0);
  });

  it('gives a gap question cues written for its own theme', () => {
    const failure = script.questions.find((q) => q.themes[0] === 'failure');
    expect(failure?.cues).toEqual(CUES.failure);
  });

  it('never supplies an answer inside a cue', () => {
    for (const q of script.questions) {
      const verdict = cuesAreSafe(q.cues);
      expect(verdict.problem ?? null).toBeNull();
      expect(verdict.ok).toBe(true);
    }
  });

  it('catches a cue that carries an outcome', () => {
    expect(cuesAreSafe(['The time you resolved a customer complaint']).ok).toBe(false);
  });
});

describe('the finishing line', () => {
  /** A resume that mentions pressure and customers, so gap analysis suppresses both. */
  const COVERED = [
    'Experience',
    '',
    'Retail Assistant | Coles Supermarkets, Glen Waverley | March 2022 - July 2023',
    '- Handled customer complaints at the service desk during peak trading',
    '- Trained three new starters on register procedures',
  ].join('\n');

  const script = planIntake(COVERED).script;
  const asked = new Set(script.questions.flatMap((q) => q.themes));

  it('asks about every core theme even when the resume mentions it', () => {
    // A resume line is an index entry, not a story. Suppressing the question
    // leaves the bank with nothing to say when a form asks for one.
    for (const theme of CORE_THEMES) expect([...asked]).toContain(theme);
  });

  it('never asks the same core theme twice', () => {
    const ids = script.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves a reachable finish', () => {
    // Every core theme has a question, so answering them all makes it enough.
    const answers = script.questions
      .filter((q) => q.themes.some((t) => CORE_THEMES.includes(t)))
      .map((q) => ({ questionId: q.id, themes: q.themes, text: 'x '.repeat(60) }));
    expect(coreStatus(buildCoverage(answers)).enough).toBe(true);
  });
});
