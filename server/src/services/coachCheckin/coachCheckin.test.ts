import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  candidateProfile: { findUnique: vi.fn(), update: vi.fn() },
  coachMessage: { findMany: vi.fn(), create: vi.fn() },
}));
vi.mock('../../index', () => ({ prisma: db }));

const llm = vi.hoisted(() => ({ callClaude: vi.fn() }));
vi.mock('../llm', () => llm);

vi.mock('./context', () => ({
  getCheckinContext: vi.fn(async () => ({
    name: 'Sam', target: 5, filedToday: 2, streak: 4, day: 18, challengeLength: 90,
  })),
  challengeDay: vi.fn(),
}));

import { looksSevere, sanitiseReply, handleCoachReply } from './replies';
import { morningCheckinText, eveningCheckinText, welcomeText, distressReplyText, botQuestionText, fallbackReplyText } from './messages';
import { resourceLine, RESOURCE_TOPICS } from './resources';

const ctx = { name: 'Sam', target: 5, filedToday: 0, streak: 4, day: 18, challengeLength: 90 };
const NO_DASH = /[—–]/;

describe('crisis detection is checked before any model is used', () => {
  it.each([
    'I feel hopeless', "I can't do this anymore", "what's the point", 'i feel worthless',
    'I want to die', "I'm thinking about suicide", 'I might hurt myself', 'I am so depressed',
    "I don't see anything getting better and I'm exhausted by all of it", 'this is pointless',
    "it's never going to get better", "I'm ready to give up",
  ])('flags: %s', (t) => expect(looksSevere(t)).toBe(true));

  it.each([
    "I'm going to tailor 5 applications for finance roles",
    'Busy day, only got 2 done', 'a bit tired but I will do it', 'applying to the point of exhaustion is not it',
    "I'm not going to stop until I get a yes", 'my resume is getting better each week', "don't give up on the follow ups",
  ])('does not flag: %s', (t) => expect(looksSevere(t)).toBe(false));
});

describe('model output is made safe before it is sent', () => {
  it('strips links and dashes, and bounds length', () => {
    const out = sanitiseReply('Great plan — go here https://evil.example/x and www.evil.com now');
    expect(out).not.toMatch(/https?:|www\./);
    expect(out).not.toMatch(NO_DASH);
    expect(sanitiseReply('a'.repeat(5000)).length).toBeLessThanOrEqual(600);
  });
});

describe('fixed wording', () => {
  it('never contains an em or en dash', () => {
    const all = [
      morningCheckinText(ctx), eveningCheckinText(ctx), eveningCheckinText({ ...ctx, filedToday: 3 }),
      eveningCheckinText({ ...ctx, filedToday: 5 }), welcomeText('Sam'), distressReplyText('Sam'),
      botQuestionText('Sam'), fallbackReplyText('Sam', 5),
    ];
    for (const t of all) expect(t).not.toMatch(NO_DASH);
  });

  it('morning asks the question and uses real progress', () => {
    const t = morningCheckinText(ctx);
    expect(t).toMatch(/getting hired today\?/);
    expect(t).toContain('Day 18 of 90');
    expect(t).toContain('4-day streak');
  });

  it('omits day and streak when they are not real', () => {
    const t = morningCheckinText({ ...ctx, day: null, streak: 0 });
    expect(t).not.toMatch(/Day \d|streak/);
  });

  it('evening reacts to the actual count', () => {
    expect(eveningCheckinText({ ...ctx, filedToday: 0 })).toMatch(/nothing logged|quiet day/i);
    expect(eveningCheckinText({ ...ctx, filedToday: 3 })).toMatch(/3/);
    expect(eveningCheckinText({ ...ctx, filedToday: 5 })).toMatch(/5/);
  });

  it('distress reply carries no task and points to Lifeline', () => {
    const t = distressReplyText('Sam');
    expect(t).toContain('13 11 14');
    expect(t).not.toMatch(/30 minutes|applications today|go for it/i);
  });

  it('every resource topic yields a link that only claims "closest match"', () => {
    for (const slug of Object.keys(RESOURCE_TOPICS)) {
      expect(resourceLine(slug)).toMatch(/Closest match.*worth a look: https?:\/\/\S+\/classroom\/[a-z-]+/);
    }
  });
});

describe('reply flow', () => {
  const now = Date.now();
  const promptRow = { direction: 'out', kind: 'morning', createdAt: new Date(now - 3600_000) };

  beforeEach(() => {
    vi.clearAllMocks();
    db.candidateProfile.findUnique.mockResolvedValue({ name: 'Sam Lee', coachWelcomedAt: null });
    db.coachMessage.create.mockResolvedValue({});
    db.candidateProfile.update.mockResolvedValue({});
    llm.callClaude.mockResolvedValue({
      content: JSON.stringify({ category: 'normal', topic: 'networking', reply: 'Love it. Block 30 minutes and hit 5.' }),
    });
  });

  it('first reply gets the welcome, then one tailored answer with a resource line', async () => {
    db.coachMessage.findMany.mockResolvedValue([promptRow]);
    const out = await handleCoachReply('u1', 'I want to go and meet people');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/automated/);
    expect(out[1]).toMatch(/Love it/);
    expect(out[1]).toMatch(/Closest match.*Networking/);
    expect(db.candidateProfile.update).toHaveBeenCalledTimes(1);
  });

  it('welcome is not repeated once sent', async () => {
    db.candidateProfile.findUnique.mockResolvedValue({ name: 'Sam', coachWelcomedAt: new Date() });
    db.coachMessage.findMany.mockResolvedValue([promptRow]);
    const out = await handleCoachReply('u1', 'plan is to apply after lunch');
    expect(out).toHaveLength(1);
  });

  it('a second message to the same prompt is saved but not answered', async () => {
    db.coachMessage.findMany.mockResolvedValue([
      { direction: 'out', kind: 'reply', createdAt: new Date(now - 1800_000) },
      promptRow,
    ]);
    const out = await handleCoachReply('u1', 'also one more thing');
    expect(out).toEqual([]);
    expect(llm.callClaude).not.toHaveBeenCalled();
    expect(db.coachMessage.create).toHaveBeenCalledTimes(1); // the inbound log only
  });

  it('a message with no prompt to answer is saved and left alone', async () => {
    db.coachMessage.findMany.mockResolvedValue([]);
    expect(await handleCoachReply('u1', 'hello?')).toEqual([]);
    expect(llm.callClaude).not.toHaveBeenCalled();
  });

  it('severe wording gets the fixed message, flagged, and never reaches the model', async () => {
    db.coachMessage.findMany.mockResolvedValue([promptRow]);
    const out = await handleCoachReply('u1', 'honestly I feel hopeless');
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('13 11 14');
    expect(llm.callClaude).not.toHaveBeenCalled();
    const flagged = db.coachMessage.create.mock.calls.filter(c => c[0].data.flagged);
    expect(flagged.length).toBeGreaterThan(0);
  });

  it('distress is still answered even after the prompt already had its reply', async () => {
    db.coachMessage.findMany.mockResolvedValue([
      { direction: 'out', kind: 'reply', createdAt: new Date(now - 1800_000) },
      promptRow,
    ]);
    const out = await handleCoachReply('u1', "I can't do this anymore");
    expect(out[0]).toContain('13 11 14');
  });

  it('distress reply is not repeated within its cooldown', async () => {
    db.coachMessage.findMany.mockResolvedValue([
      { direction: 'out', kind: 'distress_reply', createdAt: new Date(now - 600_000) },
      promptRow,
    ]);
    expect(await handleCoachReply('u1', 'still hopeless')).toEqual([]);
  });

  it('a model-detected distress the keywords missed gets the fixed message too', async () => {
    llm.callClaude.mockResolvedValue({ content: JSON.stringify({ category: 'distress', topic: 'none', reply: 'Go get em!' }) });
    db.candidateProfile.findUnique.mockResolvedValue({ name: 'Sam', coachWelcomedAt: new Date() });
    db.coachMessage.findMany.mockResolvedValue([promptRow]);
    const out = await handleCoachReply('u1', 'everything feels pointless lately');
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('13 11 14');
    expect(out[0]).not.toContain('Go get em');
  });

  it('honest answer when asked if it is a bot', async () => {
    db.coachMessage.findMany.mockResolvedValue([]);
    const out = await handleCoachReply('u1', 'wait is this a bot?');
    expect(out[0]).toMatch(/automated/);
  });

  it('falls back to a plain safe reply, flagged, if the model is down', async () => {
    llm.callClaude.mockRejectedValue(new Error('down'));
    db.candidateProfile.findUnique.mockResolvedValue({ name: 'Sam', coachWelcomedAt: new Date() });
    db.coachMessage.findMany.mockResolvedValue([promptRow]);
    const out = await handleCoachReply('u1', 'going to apply after lunch');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/30 minutes/);
    expect(db.coachMessage.create.mock.calls.some(c => c[0].data.flagged)).toBe(true);
  });

  it('ignores a model answer that is not valid JSON', async () => {
    llm.callClaude.mockResolvedValue({ content: 'sure! here you go' });
    db.candidateProfile.findUnique.mockResolvedValue({ name: 'Sam', coachWelcomedAt: new Date() });
    db.coachMessage.findMany.mockResolvedValue([promptRow]);
    const out = await handleCoachReply('u1', 'plan is to apply');
    expect(out[0]).toMatch(/30 minutes/);
  });
});
