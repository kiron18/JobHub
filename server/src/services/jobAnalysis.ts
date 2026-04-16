import { prisma } from '../index';
import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { JOB_ANALYSIS_PROMPT } from './prompts';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { searchAchievements } from './vector';
import { addGrades, computeComposite } from './compositeScoring';

export interface FeedScoreResult {
  matchScore: number;
  matchDetails: {
    overallGrade?: string;
    dimensions?: Record<string, any>;
    keywords?: string[];
    gaps?: string[];
    summary?: string;
  };
}

export async function scoreJobForFeed(
  userId: string,
  jobDescription: string
): Promise<FeedScoreResult> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId } as any,
    include: { achievements: true },
  }) as any;

  if (!profile) throw new Error('Profile not found');

  let parsedSkills = { technical: [], industryKnowledge: [], softSkills: [] };
  try {
    parsedSkills =
      typeof profile.skills === 'string'
        ? JSON.parse(profile.skills)
        : profile.skills || parsedSkills;
  } catch {
    /* use defaults */
  }

  let matches: any[] = [];
  try {
    matches = await searchAchievements(userId, jobDescription, 12);
  } catch {
    /* Pinecone optional */
  }

  const achievementsText =
    matches.length > 0
      ? matches
          .map((m: any) => {
            const meta = m.metadata || {};
            return `ID: ${m.id} | Title: ${meta.title || ''} | Text: ${meta.text || ''} | Metric: ${meta.metric || 'N/A'}`;
          })
          .join('\n---\n')
      : 'No achievements found in the bank.';

  const identityCards: Array<{ label: string; summary: string }> = Array.isArray(
    profile.identityCards
  )
    ? profile.identityCards
    : [];

  const prompt = JOB_ANALYSIS_PROMPT(
    jobDescription,
    { ...profile, skills: parsedSkills },
    achievementsText,
    identityCards
  );

  const raw = await callLLMWithRetry(prompt, true);
  const analysis = parseLLMJson(raw);

  let matchScore: number = analysis.matchScore ?? 50;
  let overallGrade: string | undefined;
  let dimensions: Record<string, any> | undefined;

  if (analysis.dimensions && typeof analysis.dimensions === 'object') {
    try {
      dimensions = addGrades(analysis.dimensions);
      const composite = computeComposite(dimensions as any);
      overallGrade = composite.overallGrade;
      matchScore = composite.matchScore;
    } catch {
      /* use raw score */
    }
  }

  return {
    matchScore,
    matchDetails: {
      overallGrade,
      dimensions,
      keywords: analysis.keywords ?? [],
      gaps: analysis.gaps ?? [],
      summary: analysis.summary ?? '',
    },
  };
}
