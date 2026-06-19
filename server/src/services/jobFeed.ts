import axios from 'axios';
import { prisma } from '../index';
import { buildSeekClusterKey, buildEntryLevelSearchTerm, fetchSeekJobsForCluster } from './seekScraper';
import { deduplicateJobs } from '../utils/deduplicateJobs';

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
    return 'other';
  } catch {
    return 'other';
  }
}

/** Filters out jobs that are clearly location-mismatched and non-remote. */
function preMatchFilter(jobs: RawJob[], targetCity: string): RawJob[] {
  const normalCity = targetCity.toLowerCase().split(',')[0].trim();
  return jobs.filter(job => {
    const loc = (job.location ?? '').toLowerCase();
    if (loc.includes(normalCity)) return true;
    const text = (job.title + ' ' + job.description).toLowerCase();
    return text.includes('remote') || text.includes('work from home') || text.includes('wfh');
  });
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

// ─── Quick keyword pre-scorer ─────────────────────────────────────────────────

// Title/description signals that mark a listing as too senior for an entry-level
// candidate. Listings matching any of these are pushed down the feed, not removed.
const SENIOR_SIGNALS = [
  'senior', 'principal', 'lead ', 'team lead', 'head of', 'director',
  'manager', '5+ years', 'minimum 5 years', 'extensive experience',
];

// Title/description signals that mark a listing as junior/entry-level. Matching
// listings are promoted up the feed. Seek's search query is a hard AND-filter, so
// junior bias must happen here in ranking, not in the search URL.
const JUNIOR_SIGNALS = [
  'junior', 'graduate', 'entry level', 'entry-level', 'trainee', 'apprentice',
  'cadet', 'no experience', 'early career', '0-2 years', '1-2 years', 'assistant',
];

function quickScore(skillsJson: any, job: RawJob): number {
  if (!skillsJson) return 50;
  try {
    const parsed = typeof skillsJson === 'string' ? JSON.parse(skillsJson) : skillsJson;
    const allSkills: string[] = [
      ...(parsed.technical || []),
      ...(parsed.industryKnowledge || []),
      ...(parsed.tools || []),
      ...(parsed.soft || []),
    ].map((s: string) => String(s).toLowerCase()).filter(s => s.length > 2);

    if (allSkills.length === 0) return 50;

    const haystack = `${job.title} ${job.description}`.toLowerCase();
    const matches = allSkills.filter(s => haystack.includes(s));
    let score = Math.min(99, Math.round((matches.length / allSkills.length) * 100));
    if (SENIOR_SIGNALS.some(sig => haystack.includes(sig))) {
      score -= 1000; // pushes senior roles to the bottom without dropping them
    }
    if (JUNIOR_SIGNALS.some(sig => haystack.includes(sig))) {
      score += 25;
    }
    return score;
  } catch {
    return 50;
  }
}

// ─── Build daily feed ─────────────────────────────────────────────────────────

export async function buildDailyFeed(userId: string): Promise<void> {
  // Job feed removed — the app runs on pasted jobs only. Disabled so nothing
  // scrapes Seek (which was 403-blocked at source). Set FEED_ENABLED = true to
  // restore the daily feed build.
  const FEED_ENABLED: boolean = false;
  if (!FEED_ENABLED) return;

  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { targetRole: true, targetRoles: true, targetCity: true, location: true, industry: true, skills: true },
  });

  const effectiveCity = profile?.targetCity || profile?.location;
  if (!profile?.targetRole || !effectiveCity) {
    throw new Error('Profile incomplete — set a target role and city first');
  }

  const rolesArray: string[] = Array.isArray(profile.targetRoles) && profile.targetRoles.length > 0
    ? (profile.targetRoles as string[])
    : [profile.targetRole];
  const seekSearchTerm = buildEntryLevelSearchTerm(rolesArray);

  const seekCluster = buildSeekClusterKey(seekSearchTerm, effectiveCity, profile.industry);

  const seekJobs = await fetchSeekJobsForCluster(seekCluster).catch((err: Error) => {
    console.error(`[buildDailyFeed] Seek failed for ${userId}:`, err.message);
    return [] as RawJob[];
  });

  const jobs = deduplicateJobs(seekJobs, []);
  const today = todayAEST();

  if (jobs.length === 0) return;

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
      matchScore: quickScore(profile.skills, j),
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
