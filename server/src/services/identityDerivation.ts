import { callLLMWithRetry } from '../utils/callLLMWithRetry';
import { IDENTITY_DERIVATION_PROMPT, IdentityCard } from './prompts/identity';
import { prisma } from '../index';
import { parseLLMJson } from '../utils/parseLLMResponse';

export async function deriveIdentityCards(userId: string): Promise<void> {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        experience: { orderBy: { createdAt: 'asc' } },
        achievements: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });

    if (!profile) {
      console.log(`[IdentityDerivation] No profile for userId: ${userId}`);
      return;
    }

    const achievementCount = await prisma.achievement.count({ where: { userId } });

    const coverLetterSamples: string[] = [];
    if (profile.coverLetterRawText) coverLetterSamples.push(profile.coverLetterRawText);
    if (profile.coverLetterRawText2) coverLetterSamples.push(profile.coverLetterRawText2);

    const prompt = IDENTITY_DERIVATION_PROMPT(
      {
        name: profile.name,
        professionalSummary: profile.professionalSummary,
        targetRole: profile.targetRole,
        seniority: profile.seniority,
        industry: profile.industry,
        perceivedBlocker: profile.perceivedBlocker,
      },
      profile.experience.map(e => ({
        company: e.company,
        role: e.role,
        startDate: e.startDate,
        endDate: e.endDate,
        type: (e as any).type ?? 'work',
      })),
      profile.achievements.map(a => ({
        title: a.title,
        description: a.description,
        metric: a.metric,
        skills: a.skills,
      })),
      coverLetterSamples
    );

    console.log(`[IdentityDerivation] Running Stage 3 for userId: ${userId}`);
    const raw = await callLLMWithRetry(prompt, true);

    let parsed: { identityCards: IdentityCard[] };
    try {
      parsed = parseLLMJson(raw);
    } catch (e: any) {
      console.error('[IdentityDerivation] Failed to parse JSON:', e.message);
      return;
    }

    if (!Array.isArray(parsed.identityCards) || parsed.identityCards.length === 0) {
      console.error('[IdentityDerivation] No identity cards returned');
      return;
    }

    await prisma.candidateProfile.update({
      where: { userId },
      data: {
        identityCards: parsed.identityCards as any,
        identityCardsUpdatedAt: new Date(),
        achievementCountAtDerivation: achievementCount,
      },
    });

    console.log(`[IdentityDerivation] Saved ${parsed.identityCards.length} cards for userId: ${userId}`);
  } catch (err) {
    // Fire-and-forget — log but never throw
    console.error('[IdentityDerivation] Error:', err);
  }
}
