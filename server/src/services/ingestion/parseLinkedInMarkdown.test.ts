import { describe, it, expect, vi } from 'vitest';

// Mock the LLM so no network is hit — we test the mapping/filtering, not the model.
vi.mock('../llm', () => ({ callClaude: vi.fn() }));

async function getModule() {
  const { parseLinkedInMarkdown } = await import('./parseLinkedInMarkdown');
  const { callClaude } = await import('../llm');
  return { parseLinkedInMarkdown, callClaude };
}

describe('parseLinkedInMarkdown', () => {
  it('maps the LLM JSON to RawJob[], canonicalises the /jobs/view/<id> URL, drops invalid cards', async () => {
    const { parseLinkedInMarkdown, callClaude } = await getModule();
    vi.mocked(callClaude).mockResolvedValue({
      content: JSON.stringify([
        { title: 'Disability Support Worker', company: 'Care Group', location: 'Wagga Wagga, NSW', salary: null, sourceUrl: 'https://www.linkedin.com/jobs/view/3899999999/?trk=abc', teaser: 'Join us' },
        { title: 'Missing Company', company: '', location: null, salary: null, sourceUrl: 'https://www.linkedin.com/jobs/view/1', teaser: null }, // dropped: no company
      ]),
    } as any);

    const jobs = await parseLinkedInMarkdown('irrelevant markdown');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: 'Disability Support Worker',
      company: 'Care Group',
      sourcePlatform: 'linkedin',
      sourceUrl: 'https://www.linkedin.com/jobs/view/3899999999', // canonicalised, tracking stripped
    });
  });

  it('returns [] when the model output is not JSON', async () => {
    const { parseLinkedInMarkdown, callClaude } = await getModule();
    vi.mocked(callClaude).mockResolvedValue({ content: 'no jobs' } as any);
    expect(await parseLinkedInMarkdown('md')).toEqual([]);
  });
});
