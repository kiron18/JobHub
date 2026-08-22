/**
 * These two functions stand between a model's output and something said out
 * loud, by name, to the person it is about. The cases below are the ones where
 * a wrong answer is silent: a question attached to the wrong person, a fact
 * sheet quoting a resume line that does not exist, a gap number that renders as
 * "Gap undefined" on the only tab open during the call.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./llm', () => ({
  callClaude: vi.fn(),
  PREMIUM_MODEL: 'test-model',
}));

import { callClaude as rawCallClaude } from './llm';
import { matchThreadToRoster, generateCoachBrief } from './coachBrief';

const callClaude = vi.mocked(rawCallClaude);

const ROSTER = [
  { id: 'reg_a', name: 'Priyadarshini Ramesh', email: 'priya@example.com' },
  { id: 'reg_b', name: 'Sachin Borkar', email: 'sachin@example.com' },
];

const reply = (body: unknown) =>
  callClaude.mockResolvedValue({
    content: typeof body === 'string' ? body : JSON.stringify(body),
    usage: { promptTokens: 0, completionTokens: 0 },
  });

beforeEach(() => callClaude.mockReset());

describe('matchThreadToRoster', () => {
  it('keeps a match to a real roster id', async () => {
    reply({ matches: [{ poster: 'Priya R', question: 'Why no interviews?', registrationId: 'reg_a', note: 'only Priya' }] });

    const out = await matchThreadToRoster('a thread long enough to be real', ROSTER);

    expect(out).toEqual([
      { poster: 'Priya R', question: 'Why no interviews?', registrationId: 'reg_a', note: 'only Priya' },
    ]);
  });

  it('drops an id that is not on the roster, rather than attaching it to nobody real', async () => {
    // The failure this guards against is the worst one available: reading a
    // question out under a name that was invented.
    reply({ matches: [{ poster: 'Ghost', question: 'How do I start?', registrationId: 'reg_zzz', note: '' }] });

    const out = await matchThreadToRoster('a thread long enough to be real', ROSTER);

    expect(out[0].registrationId).toBeNull();
    expect(out[0].question).toBe('How do I start?');
  });

  it('survives a fenced response, because the model still sends them', async () => {
    reply('```json\n{"matches":[{"poster":"Sachin","question":"Hidden job market?","registrationId":"reg_b","note":"exact"}]}\n```');

    const out = await matchThreadToRoster('a thread long enough to be real', ROSTER);

    expect(out).toHaveLength(1);
    expect(out[0].registrationId).toBe('reg_b');
  });

  it('drops entries with no question text at all', async () => {
    reply({ matches: [{ poster: 'Sachin', question: '   ', registrationId: 'reg_b', note: '' }] });

    expect(await matchThreadToRoster('a thread long enough to be real', ROSTER)).toEqual([]);
  });

  it('throws when there is no JSON to read, so the caller can say so', async () => {
    reply('I could not find any questions in that thread.');

    await expect(matchThreadToRoster('a thread long enough to be real', ROSTER)).rejects.toThrow(/no JSON/i);
  });
});

describe('generateCoachBrief', () => {
  const FULL = {
    who: 'Clinical researcher, 3 years, 485 visa',
    stuck: 'Every line is a duty, nothing separates her from other MSc graduates',
    question: 'CV is optimised and still no interviews',
    gap: 2,
    nameCallout: 'Her trial coordination is the strongest thing on the page and it is buried on page two',
    resumeLine: 'Responsible for coordinating patient recruitment',
    temperature: 'Hot',
    temperatureReason: 'asked directly for help',
  };

  it('passes a well formed brief through unchanged', async () => {
    reply(FULL);
    expect(await generateCoachBrief({ name: 'Priyadarshini' })).toEqual(FULL);
  });

  it('nulls a gap outside 1 to 4 instead of rendering "Gap 7"', async () => {
    reply({ ...FULL, gap: 7 });
    expect((await generateCoachBrief({ name: 'X' })).gap).toBeNull();
  });

  it('nulls a missing gap, which is the honest answer when nobody asked anything', async () => {
    reply({ ...FULL, gap: null });
    expect((await generateCoachBrief({ name: 'X' })).gap).toBeNull();
  });

  it('falls back to Warm on an unrecognised temperature rather than showing a blank chip', async () => {
    reply({ ...FULL, temperature: 'lukewarm' });
    expect((await generateCoachBrief({ name: 'X' })).temperature).toBe('Warm');
  });

  it('accepts a temperature in the wrong case', async () => {
    reply({ ...FULL, temperature: 'cold' });
    expect((await generateCoachBrief({ name: 'X' })).temperature).toBe('Cold');
  });

  it('turns the string "null" and an empty quote into no resume line', async () => {
    // Both render as an empty quote block on the read, which is a blank example
    // to point at mid-call.
    reply({ ...FULL, resumeLine: 'null' });
    expect((await generateCoachBrief({ name: 'X' })).resumeLine).toBeNull();

    reply({ ...FULL, resumeLine: '  ' });
    expect((await generateCoachBrief({ name: 'X' })).resumeLine).toBeNull();
  });

  it('says so plainly when no question was asked', async () => {
    reply({ ...FULL, question: '' });
    expect((await generateCoachBrief({ name: 'X' })).question).toBe('No question asked.');
  });
});
