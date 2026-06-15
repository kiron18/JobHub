import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { parseLLMJson } from '../utils/parseLLMResponse';
import type { CvGapResult } from './cvGapScan';

export interface TitleSuggestion { titles: string[]; location: string | null; }

// PURE, unit-testable, no network.
export function buildTitlePrompt(resumeText: string, inferredRole: string): string {
  return [
    'You are an Australian recruitment strategist.',
    'Given a candidate resume, return the 3 job titles this person can REALISTICALLY land in Australia RIGHT NOW.',
    'Critical rule: candidates whose experience is entirely overseas get auto-rejected for senior or manager roles here, because employers assume the skills are not transferable and there is no local vouch.',
    'So if their experience is foreign-only or thin locally, down-rank seniority: suggest the realistic entry or bridge rung (for example "Marketing Coordinator", not "Head of Marketing"), reasoned from the resume, never a fixed rule.',
    'Also infer their most likely job-search location (city) from the resume, or null if genuinely unclear.',
    'Never use an em dash or en dash in any output.',
    `Their inferred current role is: ${inferredRole || 'unknown'}.`,
    'Return STRICT JSON only: {"titles": ["..","..",".."], "location": "City, State" | null}. Exactly 3 titles, most-attainable first.',
    '--- RESUME ---',
    resumeText.slice(0, 12000),
  ].join('\n');
}

export async function suggestJobTitles(resumeText: string, result: CvGapResult): Promise<TitleSuggestion> {
  const inferredRole = result.inferredRole || '';
  try {
    const raw = await callLLMWithRetry(buildTitlePrompt(resumeText, inferredRole), true, 3, 0);
    const parsed = parseLLMJson(raw) as { titles?: unknown; location?: unknown };
    const titles = Array.isArray(parsed.titles)
      ? parsed.titles.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 3)
      : [];
    const location = typeof parsed.location === 'string' && parsed.location.trim() ? parsed.location.trim() : null;
    if (titles.length === 0) throw new Error('no titles');
    return { titles, location };
  } catch {
    return { titles: [inferredRole || 'Entry-level roles'], location: null };
  }
}
