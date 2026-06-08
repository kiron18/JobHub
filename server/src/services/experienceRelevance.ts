import { callLLM } from './llm';
import { parseLLMJson } from '../utils/parseLLMResponse';
import type { ExperienceFlag } from '../lib/experienceSelection';

interface ClassifierInput {
  role: string;
  company: string;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

const CLASSIFIER_PROMPT = (jobDescription: string, rows: string): string => `You are screening a candidate's past roles for ONE specific job application.

For EACH role, decide two booleans:
- "relevant": true if the role's field, skills, or responsibilities are meaningfully relevant to the TARGET JOB below. Professional/technical roles in the same or an adjacent field are relevant. Unrelated casual/hospitality/retail/event/manual jobs are NOT relevant to a professional role.
- "australianLocal": true if the role was performed in Australia. Use the location (Australian states/cities/suburbs such as NSW, VIC, Sydney, Melbourne, Glen Waverley, Box Hill count as Australian; Colombo, Sri Lanka, India, UK, USA do NOT). If location is empty/unknown, set false.

TARGET JOB:
${jobDescription}

ROLES (0-indexed):
${rows}

Output ONLY a JSON array, one object per role, no prose, no markdown fences:
[{"index":0,"relevant":true,"australianLocal":false}, ...]
Return exactly one object for every role index listed above.`;

/**
 * Classify each experience as relevant / australianLocal for this job. Returns null
 * on any failure (bad JSON, wrong length) so the caller falls back to keeping all
 * experience — never worse than today.
 */
export async function classifyExperiences(
  jobDescription: string,
  experiences: ClassifierInput[],
): Promise<ExperienceFlag[] | null> {
  if (!experiences.length) return null;
  const rows = experiences
    .map((e, i) => `${i}. ${e.role || 'Role'} at ${e.company || 'Unknown'} — location: ${e.location || 'unknown'} — dates: ${e.startDate || '?'} to ${e.endDate || 'present'}`)
    .join('\n');

  try {
    const raw = await callLLM(CLASSIFIER_PROMPT(jobDescription, rows));
    const parsed = parseLLMJson(raw);
    if (!Array.isArray(parsed) || parsed.length !== experiences.length) return null;
    const flags: ExperienceFlag[] = parsed.map((p: any, i: number) => ({
      index: typeof p?.index === 'number' ? p.index : i,
      relevant: p?.relevant === true,
      australianLocal: p?.australianLocal === true,
    }));
    return flags;
  } catch (err) {
    console.warn('[experienceRelevance] classification failed, keeping all experience:', (err as Error)?.message);
    return null;
  }
}
