import { describe, it, expect, vi, beforeEach } from 'vitest';

const sample = {
  data: [{
    job_title: 'Marketing Coordinator', employer_name: 'Acme',
    job_city: 'Sydney', job_state: 'NSW',
    job_description: 'Full JD text.', job_apply_link: 'https://example.com/apply/1',
    job_posted_at_datetime_utc: '2026-06-10T00:00:00Z',
    job_min_salary: 70000, job_max_salary: 90000,
  }],
};

beforeEach(() => {
  process.env.JSEARCH_API_KEY = 'key';
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => sample })) as any);
});

import { jsearchAdapter } from './jsearch';

describe('jsearchAdapter', () => {
  it('maps JSearch data to RawJob with full description', async () => {
    const r = await jsearchAdapter.search({ role: 'Marketing Coordinator', location: 'Sydney NSW', maxPages: 1 });
    expect(r.jobs[0].sourcePlatform).toBe('jsearch');
    expect(r.jobs[0].description).toBe('Full JD text.');
    expect(r.jobs[0].location).toContain('Sydney');
  });
});
