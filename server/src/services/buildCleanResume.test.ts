import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// callLLMWithRetry is the only external dependency; stub it so these tests are
// about the gate, not the model.
const callLLMWithRetry = vi.fn();
vi.mock('../utils/callLLMWithRetry', () => ({
  callLLMWithRetry: (...args: unknown[]) => callLLMWithRetry(...args),
}));

import { buildCleanResume, findBlanks, unwrapSourcedBrackets, BlankLeakError, ContentLossError, MAX_REBUILD_ATTEMPTS, IntakeAnswer } from './buildCleanResume';

const RESUME = `Jane Smith
jane@example.com

## Work Experience
Coles, Retail Assistant, 2019 - 2023
- Responsible for serving customers on the checkout
- Duties included restocking shelves and closing the register
`.repeat(3); // pad past the 200-char minimum

function answer(partial: Partial<IntakeAnswer> = {}): IntakeAnswer {
  return {
    questionId: 'q1',
    question: 'At Coles, roughly how many customers did you serve in a normal shift?',
    anchor: '- Responsible for serving customers on the checkout',
    status: 'answered',
    value: 'about 80',
    ...partial,
  };
}

describe('findBlanks', () => {
  it('catches the placeholder shapes diagnosticReport deliberately emits', () => {
    expect(findBlanks('Served [how many] customers')).toEqual(['[how many]']);
    expect(findBlanks('Lifted resolution to [what figure] over [over what period]'))
      .toEqual(['[what figure]', '[over what period]']);
    expect(findBlanks('Worked at [Company Name]')).toEqual(['[Company Name]']);
    expect(findBlanks('Add [X] here')).toEqual(['[X]']);
  });

  it('deduplicates repeats so the retry instruction stays short', () => {
    expect(findBlanks('[how many] and [how many] again')).toEqual(['[how many]']);
  });

  it('does not fire on clean resume text', () => {
    expect(findBlanks('Served around 80 customers a shift, lifting resolution to 92%')).toEqual([]);
    expect(findBlanks('Mar 2019 - May 2023\n## Skills\nPython, SQL')).toEqual([]);
  });

  it('ignores empty or numeric-only brackets, which are not placeholders', () => {
    expect(findBlanks('array[0] lookup')).toEqual([]);
    expect(findBlanks('nothing []')).toEqual([]);
  });

  // The 27 Aug 2026 deadlock: LlamaParse keeps a hyperlink's label and drops its
  // URL, so the model has a link it cannot complete and cannot delete.
  it('does not call a link label from their own resume a placeholder', () => {
    const source = 'LinkedIn | Tableau Portfolio | SQL Portfolio';
    expect(findBlanks('[Tableau Portfolio] | [SQL Portfolio]', [source])).toEqual([]);
    expect(findBlanks('[Tableau Portfolio](https://invented.example)', [source])).toEqual([]);
  });

  it('still catches a placeholder when the source is in front of it', () => {
    const source = 'Served customers at Officeworks';
    expect(findBlanks('Served [how many] customers', [source])).toEqual(['[how many]']);
  });
});

describe('unwrapSourcedBrackets', () => {
  const source = 'LinkedIn | Tableau Portfolio | SQL Portfolio | github.com/emmanuel';

  it('unwraps a sourced label to plain text and drops an invented target', () => {
    expect(unwrapSourcedBrackets('[Tableau Portfolio]', [source])).toBe('Tableau Portfolio');
    expect(unwrapSourcedBrackets('[SQL Portfolio](https://invented.example)', [source]))
      .toBe('SQL Portfolio');
  });

  it('leaves a link alone when its target is in the source', () => {
    expect(unwrapSourcedBrackets('[Tableau Portfolio](github.com/emmanuel)', [source]))
      .toBe('[Tableau Portfolio](github.com/emmanuel)');
  });

  it('leaves a real placeholder untouched for findBlanks to catch', () => {
    expect(unwrapSourcedBrackets('Served [how many] customers', [source]))
      .toBe('Served [how many] customers');
  });
});

describe('buildCleanResume', () => {
  beforeEach(() => callLLMWithRetry.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it('returns the resume when the model produces no blanks', async () => {
    callLLMWithRetry.mockResolvedValueOnce('## Professional Summary\nRetail assistant who served around 80 customers a shift.');
    const out = await buildCleanResume({ resumeText: RESUME, answers: [answer()] });
    expect(out.resume).toContain('around 80 customers');
    expect(out.repaired).toBe(false);
    expect(callLLMWithRetry).toHaveBeenCalledTimes(1);
  });

  it('retries once with the offending strings when a blank leaks', async () => {
    callLLMWithRetry
      .mockResolvedValueOnce('Served [how many] customers a shift')
      .mockResolvedValueOnce('Served around 80 customers a shift');

    const out = await buildCleanResume({ resumeText: RESUME, answers: [answer()] });

    expect(out.resume).toBe('Served around 80 customers a shift');
    // A retry was needed, which the sign-off line tells the candidate about.
    expect(out.repaired).toBe(true);
    expect(callLLMWithRetry).toHaveBeenCalledTimes(2);
    // The corrective prompt must name what was wrong, or the retry is a coin flip.
    expect(callLLMWithRetry.mock.calls[1]?.[0]).toContain('[how many]');
    expect(callLLMWithRetry.mock.calls[1]?.[0]).toContain('REJECTED');
  });

  it('throws rather than returning a resume that still has blanks', async () => {
    callLLMWithRetry.mockResolvedValue('Served [how many] customers a shift');
    // A persisted blank would be copied into every future generation, so failing
    // the build is the correct outcome.
    await expect(buildCleanResume({ resumeText: RESUME, answers: [] })).rejects.toThrow(BlankLeakError);
    // The whole budget is spent: a blank leak, an ungrounded figure and a
    // content drop are independent faults, and each gets a corrective retry
    // that names what was wrong.
    expect(callLLMWithRetry).toHaveBeenCalledTimes(MAX_REBUILD_ATTEMPTS);
  });

  it('tells the model to leave withheld figures out entirely', async () => {
    callLLMWithRetry.mockResolvedValueOnce('## Work Experience\nServed customers on the checkout');
    await buildCleanResume({
      resumeText: RESUME,
      answers: [answer({ status: 'unknown', value: '' }), answer({ questionId: 'q2', status: 'later', value: '' })],
    });
    const prompt = callLLMWithRetry.mock.calls[0]?.[0] as string;
    expect(prompt).toContain('NOT AVAILABLE');
    expect(prompt).toContain('no invented number, no placeholder');
    expect(prompt).not.toContain('FACTS THE CANDIDATE HAS CONFIRMED');
  });

  it('forbids deleting content when a question goes unanswered', async () => {
    // Regression: a "later" answer to a question that asked the candidate to
    // CLARIFY an existing figure made the model strip "97% delivery compliance"
    // and then drop the bullet entirely, leaving a resume worse than the upload.
    callLLMWithRetry.mockResolvedValueOnce('clean resume text');
    await buildCleanResume({ resumeText: RESUME, answers: [answer({ status: 'later', value: '' })] });
    const prompt = callLLMWithRetry.mock.calls[0]?.[0] as string;
    expect(prompt).toContain('INCLUDING any figure already written there');
    expect(prompt).toContain('never a reason to delete anything');
  });

  it('always carries the no-content-loss rule, answers or not', async () => {
    callLLMWithRetry.mockResolvedValueOnce('clean resume text');
    await buildCleanResume({ resumeText: RESUME, answers: [] });
    const prompt = callLLMWithRetry.mock.calls[0]?.[0] as string;
    expect(prompt).toContain('NOTHING IS LOST');
    expect(prompt).toContain('must survive into the clean version');
  });

  it('passes confirmed answers through as facts and forbids sharpening them', async () => {
    callLLMWithRetry.mockResolvedValueOnce('clean resume text');
    await buildCleanResume({ resumeText: RESUME, answers: [answer({ value: '20 to 50' })] });
    const prompt = callLLMWithRetry.mock.calls[0]?.[0] as string;
    expect(prompt).toContain('FACTS THE CANDIDATE HAS CONFIRMED');
    expect(prompt).toContain('20 to 50');
    // A range must stay a range — sharpening "20 to 50" into "35" is fabrication.
    expect(prompt).toContain('keep it hedged');
  });

  it('carries the shared evidence rule, since a prompt missing it caused a real incident', async () => {
    callLLMWithRetry.mockResolvedValueOnce('clean resume text');
    await buildCleanResume({ resumeText: RESUME, answers: [] });
    expect(callLLMWithRetry.mock.calls[0]?.[0]).toContain('EVIDENCE RULE');
  });

  it('retries when the rebuild drops a real employer, naming what went missing', async () => {
    // The Pawan case: a current role dropped while less relevant ones survived.
    callLLMWithRetry
      .mockResolvedValueOnce('## Work Experience\nElgar Homes Supported Residential Services')
      .mockResolvedValueOnce('## Work Experience\nMont Albert Manor\nElgar Homes Supported Residential Services');

    const out = await buildCleanResume({
      resumeText: RESUME,
      answers: [],
      mustKeep: { employers: ['Mont Albert Manor', 'Elgar Homes Supported Residential Services'], qualifications: [], contacts: [] },
    });

    expect(out.resume).toContain('Mont Albert Manor');
    expect(out.repaired).toBe(true);
    expect(out.retention.passed).toBe(true);
    expect(callLLMWithRetry.mock.calls[1]?.[0]).toContain('Mont Albert Manor');
    expect(callLLMWithRetry.mock.calls[1]?.[0]).toMatch(/DROPPED CONTENT/i);
  });

  it('throws rather than persisting a resume that keeps losing content', async () => {
    // Better to fail than to make a lost role the source of truth for every
    // future application.
    callLLMWithRetry.mockResolvedValue('## Work Experience\nElgar Homes only');
    await expect(buildCleanResume({
      resumeText: RESUME,
      answers: [],
      mustKeep: { employers: ['Mont Albert Manor'], qualifications: [], contacts: [] },
    })).rejects.toThrow(ContentLossError);
    expect(callLLMWithRetry).toHaveBeenCalledTimes(MAX_REBUILD_ATTEMPTS);
  });

  it('reports how many items were verified, for the sign-off line', async () => {
    callLLMWithRetry.mockResolvedValueOnce('Mont Albert Manor and a BSc from Deakin University, jane@example.com');
    const out = await buildCleanResume({
      resumeText: RESUME,
      answers: [],
      mustKeep: { employers: ['Mont Albert Manor'], qualifications: ['BSc, Deakin University'], contacts: ['jane@example.com'] },
    });
    expect(out.retention.checked).toBe(3);
    expect(out.retention.passed).toBe(true);
  });

  it('refuses a resume too short to be real rather than calling the model', async () => {
    await expect(buildCleanResume({ resumeText: 'too short', answers: [] })).rejects.toThrow(/too short/);
    expect(callLLMWithRetry).not.toHaveBeenCalled();
  });
});
