// Auto-extracts profile structure and achievements from resume text after onboarding
// Called fire-and-forget from onboarding.ts — failures are logged but not surfaced to user

import { callLLM } from './llm';
import { STAGE_1_PROMPT, STAGE_2_PROMPT } from './prompts';
import { prisma } from '../index';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { deriveIdentityCards } from './identityDerivation';

export async function autoExtractAchievements(userId: string, resumeText: string): Promise<void> {
  try {
    // 1. Skip if user already has achievements — prevents re-import on re-onboarding
    const existingCount = await prisma.achievement.count({
      where: { userId },
    });
    if (existingCount > 0) {
      console.log(`[AutoExtract] Skipping — user ${userId} already has ${existingCount} achievements`);
      return;
    }

    // 2. Run STAGE_1_PROMPT to get profile structure
    console.log(`[AutoExtract] Running Stage 1 for userId: ${userId}`);
    const stage1Raw = await callLLM(STAGE_1_PROMPT(resumeText));

    let stage1Data: any;
    try {
      stage1Data = parseLLMJson(stage1Raw);
    } catch (e: any) {
      console.error('[AutoExtract] Failed to parse Stage 1 JSON:', e.message);
      return;
    }

    // 3. Run STAGE_2_PROMPT per experience role to get achievements
    console.log(`[AutoExtract] Running Stage 2 for userId: ${userId}`);
    let achievements: any[] = [];

    if (stage1Data.experience && Array.isArray(stage1Data.experience)) {
      for (let i = 0; i < stage1Data.experience.length; i++) {
        const exp = stage1Data.experience[i];
        if (exp.bullets && exp.bullets.length > 0) {
          try {
            const stage2Raw = await callLLM(STAGE_2_PROMPT(exp.role, exp.company, exp.bullets));
            let stage2Data: any;
            try {
              stage2Data = parseLLMJson(stage2Raw);
            } catch (e: any) {
              console.error(`[AutoExtract] Failed to parse Stage 2 JSON for role ${exp.role}:`, e.message);
              continue;
            }
            const roleAchievements = (stage2Data.achievements || []).map((ach: any) => ({
              ...ach,
              experienceIndex: i,
            }));
            achievements = [...achievements, ...roleAchievements];
          } catch (e: any) {
            console.error(`[AutoExtract] Stage 2 LLM call failed for role ${exp.role}:`, e.message);
            continue;
          }
        }
      }
    }

    // 4. Get the candidateProfile for this userId to get the id
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { userId },
    });

    if (!candidateProfile) {
      console.error(`[AutoExtract] No candidateProfile found for userId: ${userId}`);
      return;
    }

    const profileId = candidateProfile.id;
    const profile = stage1Data.profile || {};
    const skills = stage1Data.skills;

    // 5 + 6 + 7 + 8 + 9. DB writes in a single transaction with 30s timeout
    await prisma.$transaction(async (tx) => {
      // 5. Save extracted profile fields — only non-null values, do NOT overwrite onboarding fields
      const scalarUpdate: Record<string, any> = {};
      if (profile.name)                scalarUpdate.name                = profile.name;
      // email intentionally excluded — already captured during onboarding;
      // writing it here risks a P2002 unique constraint violation
      if (profile.location)            scalarUpdate.location            = profile.location;
      if (profile.phone)               scalarUpdate.phone               = profile.phone;
      if (profile.linkedin)            scalarUpdate.linkedin            = profile.linkedin;
      if (profile.professionalSummary) scalarUpdate.professionalSummary = profile.professionalSummary;
      if (skills)                      scalarUpdate.skills              = typeof skills === 'string' ? skills : JSON.stringify(skills);

      if (Object.keys(scalarUpdate).length > 0) {
        await tx.candidateProfile.update({
          where: { userId },
          data: scalarUpdate,
        });
      }

      // 6. Save experience entries using createMany
      const experienceToCreate = (stage1Data.experience || []).map((exp: any) => ({
        candidateProfileId: profileId,
        company: exp.company || 'Unknown Company',
        role: exp.role || 'Unknown Role',
        startDate: exp.startDate || 'Unknown',
        endDate: exp.endDate ?? null,
        description: exp.bullets?.join('\n') || exp.description || '',
        coachingTips: Array.isArray(exp.coachingTips)
          ? exp.coachingTips.join(' | ')
          : (exp.coachingTips || null),
      }));

      if (experienceToCreate.length > 0) {
        await tx.experience.createMany({ data: experienceToCreate });
      }

      // 7. Re-fetch profile with experience to get experience IDs
      const refreshedProfile = await tx.candidateProfile.findUnique({
        where: { userId },
        include: { experience: true, achievements: true },
      });

      if (!refreshedProfile) return;

      // 8. Save achievements with proper experienceId linking, deduplicate by title
      if (achievements.length > 0) {
        const existingAchievements = await tx.achievement.findMany({
          where: { candidateProfileId: profileId },
          select: { title: true },
        });
        const existingTitles = new Set(
          existingAchievements.map((a: { title: string }) => a.title.toLowerCase().trim())
        );

        const achievementsToCreate = achievements
          .filter((ach: any) => {
            const title = (ach.title || 'Untitled Achievement').toLowerCase().trim();
            return !existingTitles.has(title);
          })
          .map((ach: any) => {
            const experienceId =
              ach.experienceIndex !== undefined &&
              refreshedProfile.experience &&
              refreshedProfile.experience[ach.experienceIndex]
                ? refreshedProfile.experience[ach.experienceIndex].id
                : null;

            return {
              candidateProfileId: profileId,
              userId,
              experienceId,
              title: ach.title || 'Untitled Achievement',
              description: ach.description || ach.content || 'No description provided.',
              metric: ach.metric || null,
              metricType: ach.metricType || null,
              industry: ach.industry || null,
              skills: typeof ach.skills === 'string'
                ? ach.skills
                : Array.isArray(ach.skills)
                  ? ach.skills.join(', ')
                  : null,
              tags: typeof ach.tags === 'string'
                ? ach.tags
                : Array.isArray(ach.tags)
                  ? ach.tags.join(', ')
                  : null,
            };
          });

        if (achievementsToCreate.length > 0) {
          await tx.achievement.createMany({ data: achievementsToCreate });
          console.log(`[AutoExtract] Saved ${achievementsToCreate.length} achievements for userId: ${userId}`);
        }
      }
    }, { timeout: 30000 });

    // Stage 3 — Identity Derivation (fire-and-forget, does not block onboarding)
    deriveIdentityCards(userId).catch(err => {
      console.error('[AutoExtract] Stage 3 (identity derivation) failed:', err);
    });

    console.log(`[AutoExtract] Completed for userId: ${userId}`);
  } catch (err) {
    // Wrap entire function — log errors but don't throw
    console.error('[AutoExtract] Error during auto-extraction:', err);
  }
}
