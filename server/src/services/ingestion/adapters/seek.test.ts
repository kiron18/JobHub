import { describe, it, expect, vi } from 'vitest';

vi.mock('../firecrawl', () => ({
  firecrawlScrape: vi.fn(async () => ({ markdown: '# jobs\n[x](https://au.seek.com/job/1)', blocked: false })),
}));
vi.mock('../parseSeekMarkdown', () => ({
  parseSeekMarkdown: vi.fn(async () => ([{
    title: 'Marketing Coordinator', company: 'Acme', location: 'Sydney NSW', salary: null,
    description: '', sourceUrl: 'https://au.seek.com/job/1', sourcePlatform: 'seek', postedAt: null,
  }])),
}));

import { seekAdapter } from './seek';

describe('seekAdapter', () => {
  it('returns parsed jobs and a report', async () => {
    const r = await seekAdapter.search({ role: 'Marketing Coordinator', location: 'Sydney NSW', maxPages: 1 });
    expect(r.jobs).toHaveLength(1);
    expect(r.report.source).toBe('seek');
    expect(r.report.blocked).toBe(false);
    expect(r.report.creditsUsed).toBe(1);
  });
});
