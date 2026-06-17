import type { RawJob } from '../../jobFeed';
import type { SourceAdapter, SearchQuery, AdapterResult } from '../types';

interface JSearchResult {
  job_title: string; employer_name?: string; job_city?: string; job_state?: string;
  job_description: string; job_apply_link: string; job_posted_at_datetime_utc?: string;
  job_min_salary?: number; job_max_salary?: number;
}

function salary(r: JSearchResult): string | null {
  if (r.job_min_salary && r.job_max_salary) return `$${Math.round(r.job_min_salary)} - $${Math.round(r.job_max_salary)}`;
  return null;
}

export const jsearchAdapter: SourceAdapter = {
  source: 'jsearch',
  async search({ role, location }: SearchQuery): Promise<AdapterResult> {
    const started = Date.now();
    const key = process.env.JSEARCH_API_KEY;
    if (!key) {
      return { jobs: [], report: { source: 'jsearch', rawCount: 0, blocked: false,
        errorMessage: 'JSEARCH_API_KEY not set', latencyMs: Date.now() - started, creditsUsed: 0 } };
    }
    const q = encodeURIComponent(`${role} in ${location}`);
    // OpenWeb Ninja DIRECT route (x-api-key). Identical params/response to the RapidAPI route, no transfer caps.
    const url = `https://api.openwebninja.com/jsearch/search?query=${q}&page=1&num_pages=1&country=au`;
    let errorMessage: string | null = null;
    let jobs: RawJob[] = [];
    try {
      const res = await fetch(url, { headers: { 'x-api-key': key } });
      if (!res.ok) throw new Error(`jsearch ${res.status}`);
      const data = await res.json();
      jobs = (data.data as JSearchResult[]).map(r => ({
        title: r.job_title,
        company: r.employer_name ?? 'Unknown',
        location: [r.job_city, r.job_state].filter(Boolean).join(', ') || null,
        salary: salary(r),
        description: r.job_description ?? '',
        sourceUrl: r.job_apply_link,
        sourcePlatform: 'jsearch',
        postedAt: r.job_posted_at_datetime_utc ? new Date(r.job_posted_at_datetime_utc) : null,
      }));
    } catch (e: any) {
      errorMessage = e?.message ?? 'jsearch error';
    }
    return { jobs, report: { source: 'jsearch', rawCount: jobs.length, blocked: false,
      errorMessage, latencyMs: Date.now() - started, creditsUsed: 0 } };
  },
};
