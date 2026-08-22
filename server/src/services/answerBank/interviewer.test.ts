import { describe, it, expect } from 'vitest';
import {
  auditAnswer, nextProbeReason, decideTurn, probeIsSafe, chooseProbe,
  buildProbePrompt, FALLBACK_PROBE, MAX_FOLLOW_UPS, MIN_WORDS,
} from './interviewer';
import type { Question } from './intake';

/** A complete answer: scene, first-person action, obstacle, ending. */
const GOOD = `Last year during a quarterly stocktake at the store I was working at, I noticed the
count for one product line was out by about forty units. The problem was nobody had picked it up
because the variance report ran to several pages. So I went back through three months of delivery
dockets and I found the supplier was shipping cartons of ten while our system expected twelve. I
photographed the dockets and I showed my manager. In the end we recovered around two thousand
dollars in credit and the setting was fixed.`;

const NO_OBSTACLE = `Last year during a quarterly stocktake at the store I was working at, I checked
the counts for every product line. I went through three months of delivery dockets and I recorded
what I found. I showed my manager the numbers afterwards. In the end everything was signed off and
the stocktake was completed on time without any issues at all that day.`;

const NO_OUTCOME = `Last year during the stocktake at the store I noticed one product line was out by
forty units. The problem was nobody had picked it up because the report was long. So I went back
through three months of delivery dockets and I found the supplier had changed their carton size
without telling anyone about the change at all.`;

const ALL_WE = `We were doing the stocktake last year and we noticed one line was out. The problem was
nobody had picked it up. We went through the delivery dockets and we found the supplier had changed
carton sizes. The team showed the manager and in the end we recovered the credit and everyone was
happy with how our group handled it.`;

describe('auditAnswer', () => {
  it('finds all four elements in a complete answer', () => {
    const audit = auditAnswer(GOOD);
    expect(audit.missing).toEqual([]);
    expect(audit.score).toBe(4);
    expect(audit.complete).toBe(true);
  });

  it('notices a story with no obstacle in it', () => {
    expect(auditAnswer(NO_OBSTACLE).missing).toContain('obstacle');
  });

  it('notices a story that stops before the ending', () => {
    expect(auditAnswer(NO_OUTCOME).missing).toContain('outcome');
  });

  it('catches an answer that credits the team and never the candidate', () => {
    const audit = auditAnswer(ALL_WE);
    expect(audit.hidesBehindWe).toBe(true);
    expect(audit.complete).toBe(false);
  });

  it('does not accuse a complete first-person answer of hiding behind we', () => {
    expect(auditAnswer(GOOD).hidesBehindWe).toBe(false);
  });

  it('judges nothing at all when there is barely any text', () => {
    const audit = auditAnswer('I helped out with the stocktake and it went fine.');
    expect(audit.tooShort).toBe(true);
    expect(audit.verdicts.every((v) => !v.present)).toBe(true);
  });

  it('treats an empty answer as too short rather than throwing', () => {
    expect(auditAnswer('').tooShort).toBe(true);
    expect(auditAnswer('').score).toBe(0);
  });

  it('counts words the way a person would', () => {
    expect(auditAnswer('one two three').wordCount).toBe(3);
  });
});

describe('nextProbeReason', () => {
  it('asks for the scene before anything else', () => {
    const audit = auditAnswer(`I checked the dockets and I found the error. The problem was nobody
      had noticed it before. In the end my manager fixed the setting and we recovered the credit
      that we were owed by the supplier for all of those deliveries.`);
    expect(audit.missing).toContain('situation');
    expect(nextProbeReason(audit)).toBe('situation');
  });

  it('chases the missing obstacle when the scene is already there', () => {
    expect(nextProbeReason(auditAnswer(NO_OBSTACLE))).toBe('obstacle');
  });

  it('returns nothing to ask when the answer is complete', () => {
    expect(nextProbeReason(auditAnswer(GOOD))).toBe(null);
  });

  it('asks for their own part last, once the story itself is whole', () => {
    expect(nextProbeReason(auditAnswer(ALL_WE))).toBe('we');
  });

  it('asks for the whole thing again when there is nothing to work with', () => {
    expect(nextProbeReason(auditAnswer('It went well.'))).toBe('short');
  });
});

describe('decideTurn', () => {
  it('banks a complete answer without asking anything', () => {
    const turn = decideTurn(GOOD, 0);
    expect(turn.action).toBe('accept');
    expect(turn.probe).toBe(null);
  });

  it('asks once for an incomplete answer, with usable words', () => {
    const turn = decideTurn(NO_OBSTACLE, 0);
    expect(turn.action).toBe('probe');
    expect(turn.probe).toBe(FALLBACK_PROBE.obstacle);
  });

  it('lets go after the cap rather than interrogating', () => {
    const turn = decideTurn(NO_OBSTACLE, MAX_FOLLOW_UPS);
    expect(turn.action).toBe('give_up');
    expect(turn.probe).toBe(null);
  });

  it('still banks a complete answer even at the cap', () => {
    expect(decideTurn(GOOD, MAX_FOLLOW_UPS).action).toBe('accept');
  });

  it('has a written probe for every reason it can give', () => {
    for (const text of [GOOD, NO_OBSTACLE, NO_OUTCOME, ALL_WE, 'too short']) {
      const turn = decideTurn(text, 0);
      if (turn.reason) expect(FALLBACK_PROBE[turn.reason]).toBeTruthy();
    }
  });
});

describe('probeIsSafe', () => {
  it('accepts a plain specific question', () => {
    expect(probeIsSafe('You mentioned the dockets. What made you go back through three months of them?').ok).toBe(true);
  });

  it('rejects a probe that supplies the answer', () => {
    expect(probeIsSafe('Was it because the supplier changed carton sizes, for example?').ok).toBe(false);
  });

  it('rejects a probe that guesses a fact about them', () => {
    const check = probeIsSafe('It sounds like you probably escalated it to your manager. Did you?');
    expect(check.ok).toBe(false);
    expect(check.problem).toBe('leading');
  });

  it('rejects praise, which biases the next answer', () => {
    const check = probeIsSafe('Great answer! What happened next?');
    expect(check.ok).toBe(false);
    expect(check.problem).toBe('praise');
  });

  it('rejects three questions bundled into one turn', () => {
    const check = probeIsSafe('Where were you? What did you do? How did it end?');
    expect(check.ok).toBe(false);
    expect(check.problem).toBe('multiple_questions');
  });

  it('rejects a statement that never asks anything', () => {
    expect(probeIsSafe('Tell me more about that.').problem).toBe('not_a_question');
  });

  it('rejects an empty probe', () => {
    expect(probeIsSafe('').problem).toBe('empty');
  });
});

describe('chooseProbe', () => {
  it('uses the model probe when it passes', () => {
    const chosen = chooseProbe('What did you do when you saw the count was out?', 'action');
    expect(chosen.source).toBe('model');
  });

  it('falls back to the written probe when the model leads the witness', () => {
    const chosen = chooseProbe('You could say you escalated it. Did you?', 'action');
    expect(chosen.source).toBe('fallback');
    expect(chosen.probe).toBe(FALLBACK_PROBE.action);
  });

  it('falls back when the model returned nothing at all', () => {
    expect(chooseProbe(null, 'outcome').probe).toBe(FALLBACK_PROBE.outcome);
    expect(chooseProbe(undefined, 'outcome').source).toBe('fallback');
  });

  it('never returns an empty probe, whatever the model did', () => {
    for (const bad of ['', '   ', 'Great!', 'You might say you led it.']) {
      expect(chooseProbe(bad, 'obstacle').probe.length).toBeGreaterThan(10);
    }
  });
});

describe('buildProbePrompt', () => {
  const question: Question = {
    id: 'q-gap-obstacle', kind: 'gap', themes: ['pressure'],
    ask: 'What was the busiest day you had at the store?',
    probes: [], hints: { reach: '', shape: '', avoid: '' }, cues: [],
  };

  it('forbids supplying an answer, in the prompt as well as the check', () => {
    const prompt = buildProbePrompt(question, GOOD, 'obstacle');
    expect(prompt).toMatch(/Never suggest, supply, or hint at an answer/);
    expect(prompt).toMatch(/Never state a fact about them/);
  });

  it('carries the question and the answer so the probe can be specific', () => {
    const prompt = buildProbePrompt(question, GOOD, 'obstacle');
    expect(prompt).toContain(question.ask);
    expect(prompt).toContain('stocktake');
  });

  it('describes the we problem in words, not as the token', () => {
    expect(buildProbePrompt(question, ALL_WE, 'we')).toMatch(/not their own part/);
  });
});

describe('the thresholds are the ones documented', () => {
  it('needs a real answer before it judges', () => {
    expect(MIN_WORDS).toBe(35);
  });
  it('lets go after three', () => {
    expect(MAX_FOLLOW_UPS).toBe(3);
  });
});

/**
 * The detectors were widened after 35 of 45 hand-written model answers failed
 * this audit, which meant real candidates telling perfectly good stories were
 * being asked up to three follow-ups for elements they had already given.
 *
 * Widening a detector trades a false follow-up for a false pass, and a false
 * pass is the worse of the two: it banks a story that cannot be used on a form.
 * These are the answers that must still be caught.
 */
describe('the widened detectors still catch a bad answer', () => {
  const DUTY_STATEMENT = `In my role I managed the social media accounts and I handled customer
  enquiries and I processed refunds when they were needed. I always made sure everything was
  completed on time and I checked my work carefully before it went out to anyone.`;

  const HABITUAL = `Customers came in most weeks and asked me about their orders. I looked them up
  and I told them where things were up to. I explained the delivery times and I answered their
  questions about the products we stocked and what else we had available in the store.`;

  const DISGUISED_STRENGTH = `I would say my biggest weakness is that I care too much about my work.
  I stayed late a lot and I checked things more than I needed to. I worked harder than most people
  around me and I always wanted everything to be perfect before I let it go out.`;

  it('still refuses a duty statement with no occasion in it', () => {
    expect(auditAnswer(DUTY_STATEMENT).missing).toContain('situation');
    expect(auditAnswer(DUTY_STATEMENT).complete).toBe(false);
  });

  it('still refuses a habitual account of the general job', () => {
    const audit = auditAnswer(HABITUAL);
    expect(audit.missing).toContain('situation');
    expect(audit.missing).toContain('obstacle');
  });

  it('still notices there is no obstacle in a disguised strength', () => {
    expect(auditAnswer(DISGUISED_STRENGTH).missing).toContain('obstacle');
  });

  it('does not read a first-person past tense verb as a whole story', () => {
    // `I <verb>ed` counts as an action now. It must not carry the other three.
    expect(auditAnswer(`I checked the report and I emailed it over. ${'filler '.repeat(40)}`).score)
      .toBeLessThan(4);
  });

  it('still hears an answer told entirely in the plural', () => {
    expect(auditAnswer(ALL_WE).hidesBehindWe).toBe(true);
  });
});

describe('the widened detectors now accept real speech', () => {
  it('accepts a day named by its weekday', () => {
    const audit = auditAnswer(`One Saturday a man came in already angry because his phone had been
      sent away twice. I let him say the whole thing before I said anything, then I read the repair
      notes back to him. The trouble was I could not give him what he wanted, which was a new
      handset on the spot. In the end I offered him a loan phone and he took it.`);
    expect(audit.missing).toEqual([]);
  });

  it('accepts an ending where somebody else does something', () => {
    const audit = auditAnswer(`One morning I found the guard rail on the mezzanine unbolted. I
      stopped what I was doing and I reported it to the supervisor straight away. The problem was
      it was in the way of the pallet run and putting it back would have slowed everybody down.
      They taped the area off and a fitter refitted it that afternoon.`);
    expect(audit.missing).toEqual([]);
  });

  it('accepts an obstacle phrased as the easy option being tempting', () => {
    const audit = auditAnswer(`One evening a regular came in with his teenage son and asked me to
      serve him. I asked the son for ID, the same as I would for anyone. The easy thing would have
      been to serve him and nobody would have known. In the end I said no, and he was fine about
      it the following week.`);
    expect(audit.missing).toEqual([]);
  });
});
