/**
 * Coverage re-scoring: the thing that decides somebody is finished.
 *
 * The tests that matter here are the ones asserting it does NOT retire a
 * question. Retiring one wrongly leaves a hole in the bank the candidate never
 * finds out about until a form asks for exactly that.
 */
import { describe, it, expect } from 'vitest';
import {
  scoreThemes, themesEvidencedBy, buildCoverage, isRedundant,
  remainingWork, minutesFor, MIN_SIGNAL_SCORE, coreStatus, isOptional, CORE_THEMES,
} from './coverage';
import { ASK_FREQUENCY } from './intake';

/** A real shape of answer: one bad week, carrying four themes at once. */
const BAD_WEEK = `
It was the week before the end of financial year and two people were off sick.
I was meant to be doing reporting but the whole thing went wrong when the client
changed the brief on the Wednesday. I had to drop the reporting and tell my
manager it would be late. The problem was nobody had told the design team, so I
rang them myself and we rebuilt it over two days. In the end we got it out on
time but I learned to check the brief was locked before I started building.
`;

const ONE_LINER = 'Yeah I remember doing that. It was pretty good.';

describe('scoreThemes', () => {
  it('finds the themes a told story actually carries', () => {
    const themes = scoreThemes(BAD_WEEK).map((t) => t.theme);
    expect(themes).toContain('failure');
    expect(themes).toContain('teamwork');
    expect(themes).toContain('priorities');
  });

  it('scores nothing on an empty answer', () => {
    expect(scoreThemes('')).toEqual([]);
  });

  it('only offers industry themes to the industry that asked for them', () => {
    const text = 'There was a safety issue with the hazard signage so I escalated it.';
    expect(scoreThemes(text).map((t) => t.theme)).not.toContain('safety');
    expect(scoreThemes(text, 'health').map((t) => t.theme)).toContain('safety');
  });
});

describe('themesEvidencedBy', () => {
  it('credits the theme it was asked about outright', () => {
    const { asked } = themesEvidencedBy({ questionId: 'q1', themes: ['pressure'], text: BAD_WEEK });
    expect(asked).toEqual(['pressure']);
  });

  it('credits themes the story carried without being asked', () => {
    const { volunteered } = themesEvidencedBy({ questionId: 'q1', themes: ['pressure'], text: BAD_WEEK });
    expect(volunteered).toContain('failure');
    expect(volunteered).not.toContain('pressure'); // already counted as asked
  });

  it('credits nothing extra to an answer too short to mean anything', () => {
    const { asked, volunteered } = themesEvidencedBy({
      questionId: 'q1', themes: ['pressure'], text: ONE_LINER,
    });
    expect(volunteered).toEqual([]);
    expect(asked).toEqual(['pressure']); // still asked and answered, however thinly
  });

  it('does not claim a theme off a single passing mention', () => {
    const passing = `${'word '.repeat(60)} it was a bit of a mistake I suppose`;
    const { volunteered } = themesEvidencedBy({ questionId: 'q1', themes: [], text: passing });
    // "mistake" alone is weight 1, under the bar.
    expect(volunteered).not.toContain('failure');
    expect(MIN_SIGNAL_SCORE).toBeGreaterThan(1);
  });
});

describe('isRedundant', () => {
  const coverage = buildCoverage([
    { questionId: 'q1', themes: ['pressure'], text: BAD_WEEK },
  ]);

  it('retires a question whose theme another story already covered', () => {
    expect(isRedundant({ id: 'q-gap-failure', themes: ['failure'] }, coverage).redundant).toBe(true);
  });

  it('names which answer covered it, so the page can say so', () => {
    const verdict = isRedundant({ id: 'q-gap-failure', themes: ['failure'] }, coverage);
    expect(verdict.by).toEqual([{ theme: 'failure', questionId: 'q1' }]);
  });

  it('keeps a question with a theme nothing has touched', () => {
    expect(isRedundant({ id: 'q-gap-conflict', themes: ['conflict'] }, coverage).redundant).toBe(false);
  });

  it('keeps a multi-theme question when only some of it is covered', () => {
    expect(isRedundant({ id: 'q2', themes: ['failure', 'conflict'] }, coverage).redundant).toBe(false);
  });

  it('never retires a question on the strength of its own answer', () => {
    expect(isRedundant({ id: 'q1', themes: ['pressure'] }, coverage).redundant).toBe(false);
  });

  it('never retires a question it cannot reason about', () => {
    expect(isRedundant({ id: 'q3', themes: [] }, coverage).redundant).toBe(false);
  });
});

describe('remainingWork', () => {
  const questions = [
    { id: 'q1', themes: ['pressure'] },
    { id: 'q-gap-failure', themes: ['failure'] },
    { id: 'q-gap-conflict', themes: ['conflict'] },
  ];
  const coverage = buildCoverage([{ questionId: 'q1', themes: ['pressure'], text: BAD_WEEK }]);

  it('splits what is answered, retired and genuinely left', () => {
    const { live, covered, answered } = remainingWork(questions, coverage, (q) => q.id === 'q1');
    expect(answered.map((q) => q.id)).toEqual(['q1']);
    expect(covered.map((q) => q.id)).toEqual(['q-gap-failure']);
    expect(live.map((q) => q.id)).toEqual(['q-gap-conflict']);
  });
});

describe('minutesFor', () => {
  it('never tells somebody they have zero minutes of work left', () => {
    expect(minutesFor(1)).toBeGreaterThan(0);
  });

  it('puts a five question intake inside the quarter hour it promises', () => {
    expect(minutesFor(5)).toBeLessThanOrEqual(15);
  });
});

describe('when it is enough', () => {
  it('is not enough on an empty bank', () => {
    expect(coreStatus(buildCoverage([])).enough).toBe(false);
  });

  it('names the core themes still missing, so the next question is obvious', () => {
    const coverage = buildCoverage([{ questionId: 'q1', themes: ['pressure'], text: BAD_WEEK }]);
    const { missing, covered } = coreStatus(coverage);
    // One story carrying three of the five core themes is the whole point:
    // it was asked about pressure, and failure and customer came along with it.
    expect(covered).toEqual(expect.arrayContaining(['pressure', 'failure', 'customer']));
    expect(missing).toEqual(['teamwork', 'conflict']);
  });

  it('is enough once every core theme has a story', () => {
    const coverage = buildCoverage(
      CORE_THEMES.map((theme, i) => ({ questionId: `q${i}`, themes: [theme], text: BAD_WEEK })),
    );
    expect(coreStatus(coverage).enough).toBe(true);
  });

  it('holds a health candidate to safety as well', () => {
    const coverage = buildCoverage(
      CORE_THEMES.map((theme, i) => ({ questionId: `q${i}`, themes: [theme], text: BAD_WEEK })),
      'health',
    );
    expect(coreStatus(coverage, 'health').enough).toBe(false);
    expect(coreStatus(coverage, 'health').missing).toContain('safety');
  });
});

describe('isOptional', () => {
  it('treats a low-frequency theme as an extra', () => {
    expect(isOptional({ kind: 'gap', themes: ['change'] })).toBe(true);
  });

  it('never treats a core theme as an extra', () => {
    expect(isOptional({ kind: 'gap', themes: ['failure'] })).toBe(false);
  });

  it('never treats the warm-up as an extra', () => {
    expect(isOptional({ kind: 'seed', themes: ['change'] })).toBe(false);
  });

  it('counts an industry theme as core for that industry only', () => {
    expect(isOptional({ kind: 'gap', themes: ['safety'] })).toBe(true);
    expect(isOptional({ kind: 'gap', themes: ['safety'] }, 'health')).toBe(false);
  });
});

describe('CORE_THEMES against ASK_FREQUENCY', () => {
  // coverage.ts cannot import the table (intake.ts imports coverage.ts, and a
  // cycle here would break module init), so the two are kept in step here.
  it('is exactly the themes asked about most often', () => {
    const byFrequency = Object.entries(ASK_FREQUENCY)
      .filter(([, n]) => n >= 8)
      .map(([theme]) => theme);
    expect([...CORE_THEMES].sort()).toEqual([...byFrequency].sort());
  });
});
