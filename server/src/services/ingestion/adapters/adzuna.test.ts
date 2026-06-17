import { describe, it, expect, vi, beforeEach } from 'vitest';

const sample = {
  results: [{
    title: 'Marketing Coordinator',
    company: { display_name: 'Acme' },
    location: { display_name: 'Sydney, NSW' },
    salary_min: 70000, salary_max: 90000,
    description: 'Full description text here.',
    redirect_url: 'https://www.adzuna.com.au/jobs/details/123',
    created: '2026-06-10T00:00:00Z',
  }],
};

beforeEach(() => {
  process.env.ADZUNA_APP_ID = 'id';
  process.env.ADZUNA_APP_KEY = 'key';
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })) as any);
});

import { adzunaAdapter } from './adzuna';

describe('adzunaAdapter', () => {
  it('maps Adzuna results to RawJob with full description', async () => {
    const r = await adzunaAdapter.search({ role: 'Marketing Coordinator', location: 'Sydney NSW', maxPages: 1 });
    expect(r.jobs[0].sourcePlatform).toBe('adzuna');
    expect(r.jobs[0].description).toBe('Full description text here.');
    expect(r.report.source).toBe('adzuna');
  });
});
