import { describe, it, expect, vi } from 'vitest';

// Mock the LLM so no network is hit — we test the mapping/filtering, not the model.
vi.mock('../llm', () => ({ callClaude: vi.fn() }));

async function getModule() {
  const { parseIndeedMarkdown } = await import('./parseIndeedMarkdown');
  const { callClaude } = await import('../llm');
  return { parseIndeedMarkdown, callClaude };
}

describe('parseIndeedMarkdown', () => {
  it('maps the LLM JSON to RawJob[], strips the URL fragment, drops cards missing required fields', async () => {
    const { parseIndeedMarkdown, callClaude } = await getModule();
    vi.mocked(callClaude).mockResolvedValue({
      content: JSON.stringify([
        { title: 'Registered Nurse', company: 'Health Co', location: 'Dubbo, NSW', salary: '$80k', sourceUrl: 'https://au.indeed.com/viewjob?jk=abc123#top', teaser: 'Great role' },
        { title: 'No URL Job', company: 'X', location: null, salary: null, sourceUrl: '', teaser: null }, // dropped: no url
        { title: '', company: 'Y', location: null, salary: null, sourceUrl: 'https://au.indeed.com/viewjob?jk=z', teaser: null }, // dropped: no title
      ]),
    } as any);

    const jobs = await parseIndeedMarkdown('irrelevant markdown');
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: 'Registered Nurse',
      company: 'Health Co',
      location: 'Dubbo, NSW',
      sourcePlatform: 'indeed',
      sourceUrl: 'https://au.indeed.com/viewjob?jk=abc123', // fragment stripped, query kept
    });
  });

  it('returns [] when the model output is not JSON', async () => {
    const { parseIndeedMarkdown, callClaude } = await getModule();
    vi.mocked(callClaude).mockResolvedValue({ content: 'sorry, no jobs here' } as any);
    expect(await parseIndeedMarkdown('md')).toEqual([]);
  });
});
