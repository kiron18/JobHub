import axios from 'axios';
import { prisma } from '../index';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { parseLLMJson } from '../utils/parseLLMResponse';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RawJob {
  title: string;
  company: string;
  location: string;
  salary: string | null;
  description: string;
  sourceUrl: string;
  sourcePlatform: string;
  postedAt: Date | null;
}

export interface AddresseeSuggestion {
  name: string;
  title: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'job-listing' | 'web-search';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('seek.com.au')) return 'seek';
    if (host.includes('indeed.com')) return 'indeed';
    if (host.includes('jora.com')) return 'jora';
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('adzuna.com')) return 'other';
    return 'other';
  } catch {
    return 'other';
  }
}

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  if (min && max) return `$${Math.round(min / 1000)}k–$${Math.round(max / 1000)}k`;
  if (min) return `From $${Math.round(min / 1000)}k`;
  if (max) return `Up to $${Math.round(max / 1000)}k`;
  return null;
}

/** Returns today's date in AEST/AEDT (Australia/Sydney) as a JS Date at midnight UTC */
export function todayAEST(): Date {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  // en-AU locale returns "DD/MM/YYYY"
  const [day, month, year] = s.split('/');
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

// ─── Adzuna fetch ─────────────────────────────────────────────────────────────

export async function fetchAdzunaJobs(role: string, city: string): Promise<RawJob[]> {
  const APP_ID = process.env.ADZUNA_APP_ID;
  const APP_KEY = process.env.ADZUNA_APP_KEY;
  if (!APP_ID || !APP_KEY) throw new Error('Adzuna credentials not configured');

  const base = 'https://api.adzuna.com/v1/api/jobs/au/search';
  const params = {
    app_id: APP_ID,
    app_key: APP_KEY,
    what: role,
    where: city,
    results_per_page: 50,
    'content-type': 'application/json',
  };

  const [page1, page2] = await Promise.all([
    axios.get(`${base}/1`, { params }).catch(() => null),
    axios.get(`${base}/2`, { params }).catch(() => null),
  ]);

  const raw: any[] = [
    ...(page1?.data?.results ?? []),
    ...(page2?.data?.results ?? []),
  ];

  const seen = new Set<string>();
  const jobs: RawJob[] = [];

  for (const r of raw) {
    const url: string = r.redirect_url ?? '';
    if (!url || seen.has(url)) continue;
    seen.add(url);

    jobs.push({
      title: r.title ?? 'Untitled',
      company: r.company?.display_name ?? 'Unknown Company',
      location: r.location?.display_name ?? city,
      salary: formatSalary(r.salary_min, r.salary_max),
      description: r.description ?? '',
      sourceUrl: url,
      sourcePlatform: extractPlatform(url),
      postedAt: r.created ? new Date(r.created) : null,
    });
  }

  return jobs;
}

// ─── Bullet generation ────────────────────────────────────────────────────────

export async function generateBullets(jobs: RawJob[]): Promise<(string[] | null)[]> {
  if (jobs.length === 0) return [];

  const batch = jobs.slice(0, 10);

  const input = batch.map(j => ({
    title: j.title,
    company: j.company,
    description: j.description.slice(0, 800),
  }));

  const prompt = `For each job below, write exactly 3-5 bullet points that help a job seeker quickly assess fit.
Cover: role type, team/company context, key requirements, work arrangement/location, and anything
notable (salary, government role, selection criteria likely required, etc.).
Each bullet is one short plain-text sentence. No markdown, no dashes, no asterisks.

Return a JSON array of arrays: [[bullet, bullet, ...], ...]  — same order as input.

Jobs:
${JSON.stringify(input)}`;

  try {
    const raw = await callLLMWithRetry(prompt, true);
    const parsed = parseLLMJson(raw);
    if (!Array.isArray(parsed)) return batch.map(() => null);
    return parsed.map((b: any) => (Array.isArray(b) ? b : null));
  } catch (err) {
    console.error('[generateBullets] LLM call failed:', err);
    return batch.map(() => null);
  }
}

// ─── Build daily feed ─────────────────────────────────────────────────────────

export async function buildDailyFeed(userId: string): Promise<void> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { targetRole: true, targetCity: true },
  });

  if (!profile?.targetRole || !profile?.targetCity) {
    throw new Error('Profile incomplete — set a target role and city first');
  }

  const jobs = await fetchAdzunaJobs(profile.targetRole, profile.targetCity);
  const today = todayAEST();

  // Only rebuild if we have new jobs — avoids wiping existing feed on Adzuna transient errors
  if (jobs.length === 0) return;

  // Clear today's existing rows then insert fresh batch
  await prisma.jobFeedItem.deleteMany({ where: { userId, feedDate: today } });

  await prisma.jobFeedItem.createMany({
    data: jobs.map(j => ({
      userId,
      feedDate: today,
      title: j.title,
      company: j.company,
      location: j.location,
      salary: j.salary,
      description: j.description,
      sourceUrl: j.sourceUrl,
      sourcePlatform: j.sourcePlatform,
      postedAt: j.postedAt,
    })),
  });
}

// ─── SerpAPI addressee search ─────────────────────────────────────────────────

export async function findAddressee(
  company: string,
  role: string,
  description: string
): Promise<AddresseeSuggestion | null> {

  // Step 1: Scan description for explicit contact
  const patterns = [
    /contact\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
    /address\s+(?:your\s+)?(?:application|enquiries)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /enquiries\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /queries\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /speak\s+(?:to|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) {
      const titleMatch = description.match(
        new RegExp(`${match[1].replace(/\s/g, '\\s+')}[,\\s]+([A-Za-z ]+?(?:Manager|Director|Head|Officer|Lead|Coordinator))`, 'i')
      );
      return {
        name: match[1],
        title: titleMatch?.[1]?.trim() ?? '',
        confidence: 'high',
        source: 'job-listing',
      };
    }
  }

  // Step 2: SerpAPI search
  const SERPAPI_KEY = process.env.SERPAPI_KEY;
  if (!SERPAPI_KEY) return null;

  try {
    const safeCompany = company.replace(/"/g, '');
    const query = `"${safeCompany}" hiring manager OR "head of" OR founder site:linkedin.com`;
    const resp = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google', q: query, api_key: SERPAPI_KEY, num: 5 },
      timeout: 8000,
    });

    const results: any[] = resp.data?.organic_results ?? [];

    const smallSignals = /startup|small team|our team of [1-9]\b|family business|directly with the founder/i.test(description);

    const titlePatterns = [
      /\b(CEO|Founder|Co-Founder|Managing Director)\b/i,
      /\b(Head of [A-Za-z ]+|[A-Za-z]+ Manager|HR Manager|Talent Acquisition|Recruiter)\b/i,
    ];

    for (const result of results) {
      const text = `${result.title ?? ''} ${result.snippet ?? ''}`;

      const nameMatch = text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
      if (!nameMatch?.[1]) continue;

      let foundTitle = '';
      let confidence: 'medium' | 'low' = 'low';

      for (let i = 0; i < titlePatterns.length; i++) {
        const tm = text.match(titlePatterns[i]);
        if (tm?.[1]) {
          foundTitle = tm[1];
          confidence = 'medium';
          break;
        }
      }

      if (!foundTitle) continue;

      return {
        name: nameMatch[1],
        title: foundTitle,
        confidence,
        source: 'web-search',
      };
    }
  } catch {
    // SerpAPI failure is always silent
  }

  return null;
}
