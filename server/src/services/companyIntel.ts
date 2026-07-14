import { callPerplexity } from './llm';
import { parseLLMJson } from '../utils/parseLLMResponse';

export interface CompanyIntelParams {
  companyName: string;
  jobTitle: string;
  jobExcerpts: string[];
  candidateSkills: string[];
}

export interface CompanyIntelResult {
  summary: string;
  suggestedContact: {
    title: string;
    reason: string;
  };
  citations: string[];
  fetchedAt: string;
}

/**
 * Fetches company intelligence by researching the intersection of
 * the candidate's profile, the job description, and the target company.
 * Calls Perplexity sonar-pro via OpenRouter.
 */
export async function fetchCompanyIntel(
  params: CompanyIntelParams
): Promise<CompanyIntelResult> {
  if (process.env.COMPANY_RESEARCH_ENABLED === 'false') {
    throw new Error('COMPANY_RESEARCH_DISABLED');
  }

  const { companyName, jobTitle, jobExcerpts, candidateSkills } = params;

  const prompt = [
    `Company: ${companyName}`,
    `Job Title: ${jobTitle}`,
    `Key requirements from the job: ${jobExcerpts.join('; ')}`,
    `Candidate's relevant strengths: ${candidateSkills.join(', ')}`,
    '',
    'Research this company and this role, then connect them to the candidate using ONLY the strengths listed above.',
    'Hard rule: never state or imply the candidate has experience, qualifications, or seniority that is not in the strengths list. Do not say their background "mirrors", "aligns with", or "matches" the role unless the listed strengths genuinely support it. If the overlap is thin, say so plainly and point to the closest real strength instead of inventing fit.',
    'Find specific, concrete, factual details about the company (tools, projects, initiatives, culture signals) the candidate can reference honestly in a cover letter.',
    '',
    'Return JSON with this exact structure.',
    'Plain text only inside string values — NO markdown (no ** or #), NO citation markers like [1].',
    '{',
    '  "summary": "Max 3 sentences. Specific, factual company signals (tools, projects, initiatives, culture). Reference the candidate only where a listed strength genuinely connects, and never assert experience the candidate does not have.",',
    '  "suggestedContact": {',
    '    "title": "e.g. Head of Marketing, CTO, HR Manager, Founder/CEO",',
    '    "reason": "One sentence explaining why this person is the right contact"',
    '  }',
    '}',
  ].join('\n');

  const result = await callPerplexity(prompt, true);

  // Parse the JSON response using the shared utility (handles fences, prose, comments)
  let parsed: { summary: string; suggestedContact: { title: string; reason: string } };
  try {
    parsed = parseLLMJson(result.content) as any;
  } catch (e: any) {
    throw new Error(`Company Intel JSON parse failed: ${e.message}`);
  }

  if (!parsed.summary || !parsed.suggestedContact?.title) {
    throw new Error('Company Intel response missing required fields');
  }

  // sonar-pro often leaks citation markers ([1]) and markdown despite the prompt —
  // strip them so the read-only insight card renders clean prose.
  const clean = (s: string): string =>
    (s || '')
      .replace(/\[\d+\](?:\[\d+\])*/g, '')   // citation markers, incl. runs like [3][5]
      .replace(/\*\*/g, '')                   // bold markers
      .replace(/\s{2,}/g, ' ')                // collapse whitespace left behind
      .trim();

  return {
    summary: clean(parsed.summary),
    suggestedContact: {
      title: clean(parsed.suggestedContact.title),
      reason: clean(parsed.suggestedContact.reason ?? ''),
    },
    citations: result.citations ?? [],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Cleans a suggestedContact.title for use as a salutation: drops a trailing
 * parenthetical and collapses an "X or Y" title to the first option, so the
 * greeting reads "Dear Head of Marketing," not the full descriptor.
 * Returns null for empty input so callers can fall back to "Hiring Manager".
 */
export function salutationTitle(title: string | null | undefined): string | null {
  let t = (title || '').trim();
  if (!t) return null;
  t = t.replace(/\s*\([^)]*\)\s*$/g, '').trim();   // trailing parenthetical
  t = t.split(/\s+or\s+/i)[0].trim();              // "X or Y" -> "X"
  return t || null;
}

/**
 * Builds the candidate skills preview from profile data for the intel prompt.
 * Extracts the top N skills, preferring those that are string over object shapes.
 */
export function buildSkillsPreview(
  rawSkills: any,
  maxCount: number = 7
): string[] {
  if (!rawSkills) return [];

  let skills: string[] = [];

  if (Array.isArray(rawSkills)) {
    skills = rawSkills
      .filter((s: any) => typeof s === 'string')
      .slice(0, maxCount);
  } else if (typeof rawSkills === 'object') {
    // Profile skills are often stored as { technical: string[], softSkills: string[], ... }
    const sections = ['technical', 'industryKnowledge', 'softSkills', 'tools', 'other'];
    for (const section of sections) {
      if (Array.isArray((rawSkills as any)[section])) {
        for (const item of (rawSkills as any)[section]) {
          if (typeof item === 'string' && skills.length < maxCount) {
            skills.push(item);
          }
        }
      }
    }
  }

  return skills;
}
