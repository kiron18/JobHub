import { describe, it, expect, vi } from 'vitest';
import { buildTitlePrompt } from './jobTitleSuggest';
import type { CvGapResult } from './cvGapScan';

// Mock the LLM module at the top level so all imports in this file use it.
vi.mock('../utils/callLLMWithRetry', () => ({
  callLLMWithRetry: vi.fn(),
}));

// Dynamic import to get the mocked versions — wrapped to avoid top-level await.
async function getModule() {
  const { suggestJobTitles } = await import('./jobTitleSuggest');
  const { callLLMWithRetry } = await import('../utils/callLLMWithRetry');
  return { suggestJobTitles, callLLMWithRetry };
}

describe('buildTitlePrompt', () => {
  it('contains the resume text', () => {
    const prompt = buildTitlePrompt('I worked as a data analyst in Sydney.', 'Data Analyst');
    expect(prompt).toContain('I worked as a data analyst in Sydney.');
  });

  it('contains the inferred role', () => {
    const prompt = buildTitlePrompt('Resume text here.', 'Data Analyst');
    expect(prompt).toContain('Data Analyst');
  });

  it('contains the local-experience down-rank instruction', () => {
    const prompt = buildTitlePrompt('Resume text.', 'Senior Manager');
    expect(prompt).toContain('auto-rejected');
    expect(prompt).toContain('down-rank');
  });

  it('contains the no-em-dash line', () => {
    const prompt = buildTitlePrompt('Resume text.', 'Engineer');
    expect(prompt).toContain('Never use an em dash or en dash');
  });
});

describe('suggestJobTitles', () => {
  const baseResult: CvGapResult = {
    score: 50,
    inferredRole: 'Data Analyst',
    firstName: 'Rohan',
    fullName: 'Rohan Kapoor',
    items: [],
    quickWins: [],
  };

  it('fallback: returns inferredRole when LLM throws', async () => {
    const { suggestJobTitles, callLLMWithRetry } = await getModule();
    vi.mocked(callLLMWithRetry).mockRejectedValueOnce(new Error('LLM failed'));
    const result = await suggestJobTitles('Some resume text here.', baseResult);
    expect(result.titles).toEqual(['Data Analyst']);
    expect(result.location).toBeNull();
  });

  it('caps titles to 3 and drops empties from a valid JSON response', async () => {
    const { suggestJobTitles, callLLMWithRetry } = await getModule();
    vi.mocked(callLLMWithRetry).mockResolvedValueOnce(
      JSON.stringify({ titles: ['A', 'B', 'C', 'D'], location: 'Sydney, NSW' })
    );
    const result = await suggestJobTitles('Resume', baseResult);
    expect(result.titles.length).toBe(3);
    expect(result.titles).toEqual(['A', 'B', 'C']);
    expect(result.location).toBe('Sydney, NSW');
  });

  it('handles parse error with malformed JSON', async () => {
    const { suggestJobTitles, callLLMWithRetry } = await getModule();
    vi.mocked(callLLMWithRetry).mockResolvedValueOnce('not json at all');
    const result = await suggestJobTitles('Resume', baseResult);
    expect(result.titles).toEqual(['Data Analyst']);
    expect(result.location).toBeNull();
  });

  it('uses empty inferredRole fallback when no inferredRole', async () => {
    const { suggestJobTitles, callLLMWithRetry } = await getModule();
    vi.mocked(callLLMWithRetry).mockRejectedValueOnce(new Error('fail'));
    const noRole = { ...baseResult, inferredRole: '' };
    const result = await suggestJobTitles('Resume', noRole);
    expect(result.titles).toEqual(['Entry-level roles']);
    expect(result.location).toBeNull();
  });
});
