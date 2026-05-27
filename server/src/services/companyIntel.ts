import { callPerplexity } from './llm';

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
  const { companyName, jobTitle, jobExcerpts, candidateSkills } = params;

  const prompt = [
    `Company: ${companyName}`,
    `Job Title: ${jobTitle}`,
    `Key requirements from the job: ${jobExcerpts.join('; ')}`,
    `Candidate's relevant strengths: ${candidateSkills.join(', ')}`,
    '',
    'Research the intersection of this candidate, this job, and this company.',
    'Find specific, concrete connections the candidate can reference in a cover letter.',
    '',
    'Return JSON with this exact structure:',
    '{',
    '  "summary": "3-4 sentence paragraph — specific tools, projects, initiatives, or culture signals that connect the candidate to this company",',
    '  "suggestedContact": {',
    '    "title": "e.g. Head of Marketing, CTO, HR Manager, Founder/CEO",',
    '    "reason": "One sentence explaining why this person is the right contact"',
    '  }',
    '}',
  ].join('\n');

  const result = await callPerplexity(prompt, true);

  // Parse the JSON response from Perplexity
  let parsed: { summary: string; suggestedContact: { title: string; reason: string } };
  try {
    parsed = JSON.parse(result.content);
  } catch {
    // If Perplexity returns fuzzy JSON, try to extract from markdown code block
    const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // Last resort: clean and parse
      const cleaned = result.content
        .replace(/^```(?:json)?\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    }
  }

  if (!parsed.summary || !parsed.suggestedContact?.title) {
    throw new Error('Company Intel response missing required fields');
  }

  return {
    summary: parsed.summary,
    suggestedContact: {
      title: parsed.suggestedContact.title,
      reason: parsed.suggestedContact.reason ?? '',
    },
    citations: result.citations,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Builds the candidate skills preview from profile data for the intel prompt.
 * Extracts the top N skills, preferring those that are strings over object shapes.
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
