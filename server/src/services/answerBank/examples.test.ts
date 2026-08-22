/**
 * The examples are shown to somebody as "what a good answer sounds like", so
 * the one thing that must be true is that our own interviewer agrees.
 *
 * If an example fails auditAnswer, we are teaching a shape the follow-up will
 * immediately push back on, which is worse than showing nothing: it tells them
 * the thing they were asked to copy is not good enough.
 */
import { describe, it, expect } from 'vitest';
import { EXAMPLES, SEED_EXAMPLES, examplesFor, asParagraph, BEATS, type WorkedExample } from './examples';
import { auditAnswer } from './interviewer';
import { THEME_HINTS, CUES, planIntake } from './intake';

const everyExample: [string, WorkedExample][] = [
  ...Object.entries(EXAMPLES).flatMap(([theme, list]) =>
    list.map((e) => [theme, e] as [string, WorkedExample]),
  ),
  ...SEED_EXAMPLES.map((e) => ['seed', e] as [string, WorkedExample]),
];

describe('every worked example', () => {
  it.each(everyExample)('%s: "%s" passes our own audit', (_theme, example) => {
    const audit = auditAnswer(asParagraph(example));
    expect(audit.missing).toEqual([]);
    expect(audit.score).toBe(4);
    expect(audit.tooShort).toBe(false);
    expect(audit.complete).toBe(true);
  });

  it.each(everyExample)('%s: "%s" keeps the candidate in it', (_theme, example) => {
    // The most common failure in a real answer is describing the group and
    // leaving yourself out. An example that did it would teach exactly that.
    expect(auditAnswer(asParagraph(example)).hidesBehindWe).toBe(false);
  });

  it.each(everyExample)('%s: "%s" says where it happened', (_theme, example) => {
    expect(example.where.trim().length).toBeGreaterThan(0);
  });
});

describe('coverage of the examples', () => {
  it('has a set for every theme the hints cover', () => {
    for (const theme of Object.keys(THEME_HINTS)) {
      expect(EXAMPLES[theme], `no examples for ${theme}`).toBeDefined();
    }
  });

  it('offers three of them, as promised on the page', () => {
    for (const [theme, list] of Object.entries(EXAMPLES)) {
      expect(list.length, `${theme} has ${list.length}`).toBe(3);
    }
    expect(SEED_EXAMPLES).toHaveLength(3);
  });

  it('draws the three from three different kinds of work', () => {
    // Three warehouse stories teach one setting, not one shape. The spread is
    // what tells a reader this is about structure and not about their industry.
    for (const [theme, list] of Object.entries(EXAMPLES)) {
      const places = new Set(list.map((e) => e.where.toLowerCase()));
      expect(places.size, `${theme} reuses a setting`).toBe(3);
    }
  });

  it('gives every planned question something to show', () => {
    const script = planIntake([
      'Experience',
      '',
      'Retail Assistant | Coles Supermarkets, Glen Waverley | March 2022 - July 2023',
      '- Handled customer complaints at the service desk during peak trading',
      '- Trained three new starters on register procedures',
    ].join('\n'), { industry: 'health' }).script;

    for (const q of script.questions) {
      expect(examplesFor(q).length, `nothing to show for ${q.id}`).toBe(3);
    }
  });
});

describe('the four beats', () => {
  it('are the four things the audit scores', () => {
    // If these ever drift apart, the page is teaching a different shape from
    // the one the follow-up questions chase.
    expect(BEATS.map((b) => b.key)).toEqual(['situation', 'action', 'obstacle', 'outcome']);
  });

  it('reads as one spoken paragraph when joined', () => {
    const text = asParagraph(SEED_EXAMPLES[0]);
    expect(text).not.toMatch(/\s{2,}/);
    expect(text.split(/\s+/).length).toBeGreaterThan(40);
  });
});

describe('an example is not a cue', () => {
  it('never reuses a cue as an example, or the pair says the same thing twice', () => {
    const cues = new Set(Object.values(CUES).flat().map((c) => c.toLowerCase()));
    for (const [, example] of everyExample) {
      expect(cues.has(example.situation.toLowerCase())).toBe(false);
    }
  });
});
