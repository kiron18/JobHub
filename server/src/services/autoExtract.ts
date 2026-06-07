// Auto-extracts profile structure and achievements from resume text.
// Split into a pure LLM parse (no DB / no userId, safe to run anonymously during
// the scan) and a persist step (DB writes, needs userId). autoExtractAchievements
// remains the convenience wrapper used by the onboarding path.

import { callLLM } from './llm';
import { STAGE_1_PROMPT, STAGE_2_PROMPT } from './prompts';
import { prisma } from '../index';
import { parseLLMJson } from '../utils/parseLLMResponse';
import { deriveIdentityCards } from './identityDerivation';

export interface ParsedResume {
  stage1Data: any;
  achievements: any[];
}

// ── Pure LLM parse — no DB, no userId. Safe to run on an anonymous resume (e.g.
// kicked off during the scan, keyed by scanId, then persisted later at claim). ──
export async function parseResumeToStructure(resumeText: string): Promise<ParsedResume> {
  // Stage 1 — profile structure
  const stage1Raw = await callLLM(STAGE_1_PROMPT(resumeText));
  const stage1Data = parseLLMJson(stage1Raw); // throws on bad JSON; caller handles

  console.log(`[AutoExtract] Stage 1 parsed — education: ${stage1Data.education?.length ?? 0}, experience: ${stage1Data.experience?.length ?? 0}, projects: ${stage1Data.projects?.length ?? 0}, certs: ${stage1Data.certifications?.length ?? 0}`);

  // Stage 2 — achievements from each experience + project entry
  let achievements: any[] = [];
  const allEntries: Array<{ role: string; company: string; bullets: string[]; type: 'work' | 'project'; originalIndex: number }> = [];

  if (stage1Data.experience && Array.isArray(stage1Data.experience)) {
    stage1Data.experience.forEach((exp: any, i: number) => {
      if (exp.bullets && exp.bullets.length > 0) {
        allEntries.push({ role: exp.role || 'Unknown Role', company: exp.company || 'Unknown', bullets: exp.bullets, type: 'work', originalIndex: i });
      }
    });
  }

  if (stage1Data.projects && Array.isArray(stage1Data.projects)) {
    stage1Data.projects.forEach((proj: any, i: number) => {
      if (proj.bullets && proj.bullets.length > 0) {
        allEntries.push({ role: proj.title || 'Project', company: proj.org || 'University Project', bullets: proj.bullets, type: 'project', originalIndex: i });
      }
    });
  }

  for (const entry of allEntries) {
    try {
      const stage2Raw = await callLLM(STAGE_2_PROMPT(entry.role, entry.company, entry.bullets));
      let stage2Data: any;
      try {
        stage2Data = parseLLMJson(stage2Raw);
      } catch (e: any) {
        console.error(`[AutoExtract] Failed to parse Stage 2 JSON for ${entry.role}:`, e.message);
        continue;
      }
      const entryAchievements = (stage2Data.achievements || []).map((ach: any) => ({
        ...ach,
        entryType: entry.type,
        entryRole: entry.role,
        entryCompany: entry.company,
        originalIndex: entry.originalIndex,
      }));
      achievements = [...achievements, ...entryAchievements];
    } catch (e: any) {
      console.error(`[AutoExtract] Stage 2 LLM call failed for ${entry.role}:`, e.message);
      continue;
    }
  }

  return { stage1Data, achievements };
}

// ── Persist a parsed resume to a user's structured bank. Idempotent: skips if the
// user already has achievements. Needs the profile row to already exist. ──
export async function persistExtracted(userId: string, parsed: ParsedResume): Promise<void> {
  try {
    const existingCount = await prisma.achievement.count({ where: { userId } });
    if (existingCount > 0) {
      console.log(`[AutoExtract] Skipping persist — user ${userId} already has ${existingCount} achievements`);
      return;
    }

    const { stage1Data, achievements } = parsed;

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

    await prisma.$transaction(async (tx) => {
      // Save extracted scalar profile fields — only non-null, never overwrite onboarding fields
      const scalarUpdate: Record<string, any> = {};
      if (profile.name)                scalarUpdate.name                = profile.name;
      // email intentionally excluded — already captured; writing it risks a P2002
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

      // Work experience
      const experienceToCreate = (stage1Data.experience || []).map((exp: any) => ({
        candidateProfileId: profileId,
        company: exp.company || 'Unknown Company',
        role: exp.role || 'Unknown Role',
        startDate: exp.startDate || 'Unknown',
        endDate: exp.endDate ?? null,
        type: 'work',
        description: exp.bullets?.join('\n') || exp.description || '',
        coachingTips: Array.isArray(exp.coachingTips)
          ? exp.coachingTips.join(' | ')
          : (exp.coachingTips || null),
      }));

      if (experienceToCreate.length > 0) {
        await tx.experience.createMany({ data: experienceToCreate });
      }

      // Projects (stored as Experience type='project')
      const projectsToCreate = (stage1Data.projects || []).map((proj: any) => ({
        candidateProfileId: profileId,
        company: proj.org || 'University Project',
        role: proj.title || 'Project',
        startDate: proj.startDate || 'Unknown',
        endDate: proj.endDate ?? null,
        type: 'project',
        description: proj.bullets?.join('\n') || '',
        coachingTips: Array.isArray(proj.coachingTips)
          ? proj.coachingTips.join(' | ')
          : (proj.coachingTips || null),
      }));

      if (projectsToCreate.length > 0) {
        await tx.experience.createMany({ data: projectsToCreate });
        console.log(`[AutoExtract] Saved ${projectsToCreate.length} project entries for userId: ${userId}`);
      }

      // Education
      const educationToCreate = (stage1Data.education || [])
        .filter((edu: any) => edu.institution || edu.degree)
        .map((edu: any) => ({
          candidateProfileId: profileId,
          institution: edu.institution || 'Unknown Institution',
          degree: edu.degree || 'Unknown Degree',
          field: edu.field ?? null,
          year: edu.year ?? null,
          coachingTips: Array.isArray(edu.coachingTips)
            ? edu.coachingTips.join(' | ')
            : (edu.coachingTips || null),
        }));

      if (educationToCreate.length > 0) {
        const existingEdu = await tx.education.findMany({
          where: { candidateProfileId: profileId },
          select: { institution: true, degree: true },
        });
        const existingEduKeys = new Set(
          existingEdu.map((e: any) => `${e.institution.toLowerCase().trim()}||${e.degree.toLowerCase().trim()}`)
        );
        const newEdu = educationToCreate.filter((e: any) =>
          !existingEduKeys.has(`${e.institution.toLowerCase().trim()}||${e.degree.toLowerCase().trim()}`)
        );
        if (newEdu.length > 0) {
          await tx.education.createMany({ data: newEdu });
          console.log(`[AutoExtract] Saved ${newEdu.length} education entries for userId: ${userId}`);
        }
      }

      // Volunteering
      const volunteeringToCreate = (stage1Data.volunteering || [])
        .filter((vol: any) => vol.org || vol.organization)
        .map((vol: any) => ({
          candidateProfileId: profileId,
          organization: vol.org || vol.organization || 'Unknown Organisation',
          role: vol.role || 'Volunteer',
          description: vol.desc || vol.description || null,
        }));

      if (volunteeringToCreate.length > 0) {
        const existingVols = await tx.volunteering.findMany({
          where: { candidateProfileId: profileId },
          select: { organization: true, role: true },
        });
        const existingVolKeys = new Set(
          existingVols.map((v: any) => `${v.organization.toLowerCase().trim()}||${v.role.toLowerCase().trim()}`)
        );
        const newVols = volunteeringToCreate.filter((v: any) =>
          !existingVolKeys.has(`${v.organization.toLowerCase().trim()}||${v.role.toLowerCase().trim()}`)
        );
        if (newVols.length > 0) {
          await tx.volunteering.createMany({ data: newVols });
          console.log(`[AutoExtract] Saved ${newVols.length} volunteering entries for userId: ${userId}`);
        }
      }

      // Certifications
      const certsToCreate = (stage1Data.certifications || [])
        .filter((cert: any) => cert.name)
        .map((cert: any) => ({
          candidateProfileId: profileId,
          name: cert.name,
          issuingBody: cert.issuer || cert.issuingBody || 'Unknown',
          year: cert.year ?? null,
        }));

      if (certsToCreate.length > 0) {
        const existingCerts = await tx.certification.findMany({
          where: { candidateProfileId: profileId },
          select: { name: true },
        });
        const existingCertNames = new Set(
          existingCerts.map((c: any) => c.name.toLowerCase().trim())
        );
        const newCerts = certsToCreate.filter((c: any) =>
          !existingCertNames.has(c.name.toLowerCase().trim())
        );
        if (newCerts.length > 0) {
          await tx.certification.createMany({ data: newCerts });
          console.log(`[AutoExtract] Saved ${newCerts.length} certification entries for userId: ${userId}`);
        }
      }

      // Languages
      const langsToCreate = (stage1Data.languages || [])
        .filter((lang: any) => lang.name)
        .map((lang: any) => ({
          candidateProfileId: profileId,
          name: lang.name,
          proficiency: lang.proficiency || 'Conversational',
        }));

      if (langsToCreate.length > 0) {
        const existingLangs = await tx.language.findMany({
          where: { candidateProfileId: profileId },
          select: { name: true },
        });
        const existingLangNames = new Set(
          existingLangs.map((l: any) => l.name.toLowerCase().trim())
        );
        const newLangs = langsToCreate.filter((l: any) =>
          !existingLangNames.has(l.name.toLowerCase().trim())
        );
        if (newLangs.length > 0) {
          await tx.language.createMany({ data: newLangs });
          console.log(`[AutoExtract] Saved ${newLangs.length} language entries for userId: ${userId}`);
        }
      }

      // Re-fetch to link achievements to experience ids
      const refreshedProfile = await tx.candidateProfile.findUnique({
        where: { userId },
        include: { experience: true, achievements: true },
      });

      if (!refreshedProfile) return;

      if (achievements.length > 0) {
        const existingAchievements = await tx.achievement.findMany({
          where: { candidateProfileId: profileId },
          select: { title: true },
        });
        const existingTitles = new Set(
          existingAchievements.map((a: { title: string }) => a.title.toLowerCase().trim())
        );

        const expLookup = new Map<string, string>();
        for (const exp of refreshedProfile.experience) {
          const key = `${(exp.role || '').toLowerCase().trim()}||${(exp.company || '').toLowerCase().trim()}`;
          expLookup.set(key, exp.id);
        }

        const achievementsToCreate = achievements
          .filter((ach: any) => {
            const title = (ach.title || 'Untitled Achievement').toLowerCase().trim();
            return !existingTitles.has(title);
          })
          .map((ach: any) => {
            const lookupKey = `${(ach.entryRole || '').toLowerCase().trim()}||${(ach.entryCompany || '').toLowerCase().trim()}`;
            const experienceId = expLookup.get(lookupKey) ?? null;

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

    // Stage 3 — Identity Derivation (fire-and-forget)
    deriveIdentityCards(userId).catch(err => {
      console.error('[AutoExtract] Stage 3 (identity derivation) failed:', err);
    });

    console.log(`[AutoExtract] Persist completed for userId: ${userId}`);
  } catch (err) {
    console.error('[AutoExtract] Error during persist:', err);
  }
}

// Convenience wrapper used by the onboarding path: parse + persist in one call.
export async function autoExtractAchievements(userId: string, resumeText: string): Promise<void> {
  try {
    const existingCount = await prisma.achievement.count({ where: { userId } });
    if (existingCount > 0) {
      console.log(`[AutoExtract] Skipping — user ${userId} already has ${existingCount} achievements`);
      return;
    }
    console.log(`[AutoExtract] Running parse for userId: ${userId}`);
    const parsed = await parseResumeToStructure(resumeText);
    await persistExtracted(userId, parsed);
  } catch (err) {
    console.error('[AutoExtract] Error during auto-extraction:', err);
  }
}

// Forces a full re-extraction of achievements and experience from a new resume.
// Called from the source-documents route when the user re-uploads their resume.
export async function forceAutoExtract(userId: string, resumeText: string): Promise<void> {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return;

    await prisma.$transaction([
      prisma.achievement.deleteMany({ where: { candidateProfileId: profile.id } }),
      prisma.experience.deleteMany({ where: { candidateProfileId: profile.id } }),
    ]);

    console.log(`[ForceExtract] Cleared experience + achievements for userId: ${userId}`);
  } catch (err) {
    console.error('[ForceExtract] Failed to clear existing data:', err);
    return;
  }

  // Now run standard extraction — achievement count is 0 so the guard won't skip
  await autoExtractAchievements(userId, resumeText);
}
