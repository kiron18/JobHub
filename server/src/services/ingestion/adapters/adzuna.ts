import type { RawJob } from '../../jobFeed';
import type { SourceAdapter, SearchQuery, AdapterResult } from '../types';

interface AdzunaResult {
  title: string; company?: { display_name?: string }; location?: { display_name?: string };
  salary_min?: number; salary_max?: number; description: string; redirect_url: string; created?: string;
}

function salary(r: AdzunaResult): string | null {
  if (r.salary_min && r.salary_max) return `$${Math.round(r.salary_min)} - $${Math.round(r.salary_max)}`;
  return null;
}

export const adzunaAdapter: SourceAdapter = {
  source: 'adzuna',
  async search({ role, location }: SearchQuery): Promise<AdapterResult> {
    const started = Date.now();
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) {
      return { jobs: [], report: { source: 'adzuna', rawCount: 0, blocked: false,
        errorMessage: 'ADZUNA_APP_ID/ADZUNA_APP_KEY not set', latencyMs: Date.now() - started, creditsUsed: 0 } };
    }
    const url = `https://api.adzuna.com/v1/api/jobs/au/search/1?app_id=${appId}&app_key=${appKey}`
      + `&what=${encodeURIComponent(role)}&where=${encodeURIComponent(location)}&results_per_page=20&content-type=application/json`;
    let errorMessage: string | null = null;
    let jobs: RawJob[] = [];
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`adzuna ${res.status}`);
      const data = await res.json() as { results: AdzunaResult[] };
      jobs = (data.results || []).map(r => ({
        title: r.title,
        company: r.company?.display_name ?? 'Unknown',
        location: r.location?.display_name ?? '',
        salary: salary(r),
        description: r.description ?? '',
        sourceUrl: r.redirect_url,
        sourcePlatform: 'adzuna',
        postedAt: r.created ? new Date(r.created) : null,
      }));
    } catch (e: any) {
      errorMessage = e?.message ?? 'adzuna error';
    }
    return { jobs, report: { source: 'adzuna', rawCount: jobs.length, blocked: false,
      errorMessage, latencyMs: Date.now() - started, creditsUsed: 0 } };
  },
};
