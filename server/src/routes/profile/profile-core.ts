import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';
import { indexAchievement } from '../../services/vector';
import { EXEMPT_EMAILS } from '../stripe';
import { generateBaselineResume } from '../../services/baselineResume';

const router = Router();

// GET /api/profile
router.get('/profile', authenticate, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            include: {
                experience: true,
                education: true,
                volunteering: true,
                certifications: true,
                languages: true,
                achievements: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!profile) return res.json(null);

        // Auto-grant dashboardAccess for exempt accounts (owner + test accounts)
        const authEmail = ((req as any).user?.email ?? '').toLowerCase();
        if (EXEMPT_EMAILS.includes(authEmail) && !profile.dashboardAccess) {
          await prisma.candidateProfile.update({
            where: { userId },
            data: { dashboardAccess: true },
          });
          profile.dashboardAccess = true;
        }

        const isAdmin = EXEMPT_EMAILS.includes(authEmail);

        // Compute profile completion score
        let score = 0;
        const missingFields: string[] = [];
        if (profile.name) score += 15; else missingFields.push('name');
        if (profile.email) score += 10; else missingFields.push('email');
        if (profile.location) score += 10; else missingFields.push('location');
        if (profile.professionalSummary) score += 15; else missingFields.push('summary');
        if (profile.experience?.length > 0) score += 20; else missingFields.push('experience');
        if (profile.education?.length > 0) score += 10; else missingFields.push('education');
        if (profile.achievements?.length >= 3) score += 15; else missingFields.push('3+ achievements');
        if (profile.skills) score += 5; else missingFields.push('skills');

        res.json({
            ...profile,
            isAdmin,
            completion: {
                score,
                isReady: score >= 70,
                missingFields
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// GET /api/profile/resumes
router.get('/profile/resumes', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const profile = await prisma.candidateProfile.findUnique({ where: { userId }, select: { id: true } });
        if (!profile) return res.json([]);

        const versions = await prisma.resumeVersion.findMany({
            where: { candidateProfileId: profile.id },
            select: { id: true, label: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(versions);
    } catch (error) {
        console.error('Fetch Resume Versions Error:', error);
        res.status(500).json({ error: 'Failed to fetch resume versions' });
    }
});

// DELETE /api/profile/resumes/:id
router.delete('/profile/resumes/:id', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params as any;
    try {
        // Verify ownership before deleting
        const version = await prisma.resumeVersion.findFirst({
            where: { id, userId }
        });
        if (!version) return res.status(404).json({ error: 'Resume version not found' });

        await prisma.resumeVersion.delete({ where: { id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete Resume Version Error:', error);
        res.status(500).json({ error: 'Failed to delete resume version' });
    }
});

// POST /api/profile
router.post('/profile', authenticate, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        const authEmail = (req as any).user.email as string | undefined;
        const { profile, discoveredAchievements, experience, education, volunteering, certifications, languages, skills, coachingAlerts, resumeLabel, rawText } = req.body;

        if (!profile) {
            return res.status(400).json({ error: 'Profile data is required' });
        }

        const result = await prisma.$transaction(async (tx) => {
            // ── Ensure the CandidateProfile row exists ──────────────────────────
            // The create path seeds all relations from scratch; the update path
            // uses explicit merge logic below so we don't wipe data on re-import.
            const existingProfile = await tx.candidateProfile.findUnique({ where: { userId } });

            let updatedProfile: any;

            if (!existingProfile) {
                // ── NEW PROFILE — insert everything wholesale ──────────────────
                updatedProfile = await tx.candidateProfile.create({
                    data: {
                        userId,
                        email: profile.email || authEmail || null,
                        name: profile.name,
                        professionalSummary: profile.professionalSummary,
                        skills: skills ? (typeof skills === 'string' ? skills : JSON.stringify(skills)) : '{}',
                        location: profile.location,
                        phone: profile.phone,
                        linkedin: profile.linkedin,
                        coachingAlerts: coachingAlerts || undefined,
                        experience: {
                            create: experience?.map((exp: any) => ({
                                company: exp.company || 'Unknown Company',
                                role: exp.role || 'Unknown Role',
                                startDate: exp.startDate || 'Unknown',
                                endDate: exp.endDate,
                                description: exp.bullets?.join('\n') || exp.description || '',
                                coachingTips: Array.isArray(exp.coachingTips) ? exp.coachingTips.join(' | ') : (exp.coachingTips || null)
                            })) || []
                        },
                        education: {
                            create: education?.map((edu: any) => ({
                                institution: edu.institution || 'Unknown Institution',
                                degree: edu.degree || 'Unknown Degree',
                                year: edu.year,
                                coachingTips: Array.isArray(edu.coachingTips) ? edu.coachingTips.join(' | ') : (edu.coachingTips || null)
                            })) || []
                        },
                        volunteering: {
                            create: volunteering?.filter((vol: any) => vol.org || vol.organization).map((vol: any) => ({
                                organization: vol.org || vol.organization || 'Unknown Organisation',
                                role: vol.role || 'Volunteer',
                                description: vol.desc || vol.description
                            })) || []
                        },
                        certifications: {
                            create: certifications?.filter((cert: any) => cert.name).map((cert: any) => ({
                                name: cert.name,
                                issuingBody: cert.issuer || cert.issuingBody || 'Unknown',
                                year: cert.year
                            })) || []
                        },
                        languages: {
                            create: languages?.filter((lang: any) => lang.name).map((lang: any) => ({
                                name: lang.name,
                                proficiency: lang.proficiency || 'Conversational'
                            })) || []
                        }
                    },
                    include: { experience: true, achievements: true }
                }) as any;

            } else {
                // ── EXISTING PROFILE — merge, never wipe ──────────────────────

                // Scalar fields: only overwrite when the incoming value is non-empty
                // so a partial re-import doesn't blank out fields already on record.
                const scalarUpdate: Record<string, any> = {};
                if (profile.name)                 scalarUpdate.name                = profile.name;
                if (profile.email)                scalarUpdate.email               = profile.email;
                else if (!existingProfile.email && authEmail) scalarUpdate.email   = authEmail;
                if (profile.professionalSummary)  scalarUpdate.professionalSummary = profile.professionalSummary;
                if (profile.location)             scalarUpdate.location            = profile.location;
                if (profile.phone)                scalarUpdate.phone               = profile.phone;
                if (profile.linkedin)             scalarUpdate.linkedin            = profile.linkedin;
                if (skills)                       scalarUpdate.skills              = typeof skills === 'string' ? skills : JSON.stringify(skills);
                if (coachingAlerts)               scalarUpdate.coachingAlerts      = coachingAlerts;

                await tx.candidateProfile.update({ where: { userId }, data: scalarUpdate });

                // ── Experience: match on (company + title), update or insert ──
                // Entries in DB that are NOT in the incoming payload are left alone.
                if (experience && experience.length > 0) {
                    for (const exp of experience) {
                        const company = exp.company || 'Unknown Company';
                        const role    = exp.role    || 'Unknown Role';
                        const existing = await tx.experience.findFirst({
                            where: {
                                candidateProfileId: existingProfile.id,
                                company: { equals: company, mode: 'insensitive' },
                                role:    { equals: role,    mode: 'insensitive' }
                            }
                        });
                        const expData = {
                            company,
                            role,
                            startDate:    exp.startDate || 'Unknown',
                            endDate:      exp.endDate   ?? null,
                            description:  exp.bullets?.join('\n') || exp.description || '',
                            coachingTips: Array.isArray(exp.coachingTips) ? exp.coachingTips.join(' | ') : (exp.coachingTips || null)
                        };
                        if (existing) {
                            await tx.experience.update({ where: { id: existing.id }, data: expData });
                        } else {
                            await tx.experience.create({ data: { candidateProfileId: existingProfile.id, ...expData } });
                        }
                    }
                }

                // ── Education: match on (institution + degree), update or insert
                if (education && education.length > 0) {
                    for (const edu of education) {
                        const institution = edu.institution || 'Unknown Institution';
                        const degree      = edu.degree      || 'Unknown Degree';
                        const existing = await tx.education.findFirst({
                            where: {
                                candidateProfileId: existingProfile.id,
                                institution: { equals: institution, mode: 'insensitive' },
                                degree:      { equals: degree,      mode: 'insensitive' }
                            }
                        });
                        const eduData = {
                            institution,
                            degree,
                            year:         edu.year          ?? null,
                            coachingTips: Array.isArray(edu.coachingTips) ? edu.coachingTips.join(' | ') : (edu.coachingTips || null)
                        };
                        if (existing) {
                            await tx.education.update({ where: { id: existing.id }, data: eduData });
                        } else {
                            await tx.education.create({ data: { candidateProfileId: existingProfile.id, ...eduData } });
                        }
                    }
                }

                // ── Certifications: append-only, deduplicate by name ───────────
                if (certifications && certifications.length > 0) {
                    const existingCerts = await tx.certification.findMany({
                        where: { candidateProfileId: existingProfile.id },
                        select: { name: true }
                    });
                    const existingCertNames = new Set(existingCerts.map((c: any) => c.name.toLowerCase().trim()));
                    const newCerts = certifications
                        .filter((cert: any) => cert.name && !existingCertNames.has(cert.name.toLowerCase().trim()))
                        .map((cert: any) => ({
                            candidateProfileId: existingProfile.id,
                            name: cert.name,
                            issuingBody: cert.issuer || cert.issuingBody || 'Unknown',
                            year: cert.year ?? null
                        }));
                    if (newCerts.length > 0) await tx.certification.createMany({ data: newCerts });
                }

                // ── Volunteering: append-only, deduplicate by organization+role ─
                if (volunteering && volunteering.length > 0) {
                    const existingVols = await tx.volunteering.findMany({
                        where: { candidateProfileId: existingProfile.id },
                        select: { organization: true, role: true }
                    });
                    const existingVolKeys = new Set(
                        existingVols.map((v: any) => `${v.organization.toLowerCase().trim()}||${v.role.toLowerCase().trim()}`)
                    );
                    const newVols = volunteering
                        .filter((vol: any) => vol.org || vol.organization)
                        .filter((vol: any) => {
                            const org  = (vol.org || vol.organization || '').toLowerCase().trim();
                            const role = (vol.role || 'Volunteer').toLowerCase().trim();
                            return !existingVolKeys.has(`${org}||${role}`);
                        })
                        .map((vol: any) => ({
                            candidateProfileId: existingProfile.id,
                            organization: vol.org || vol.organization || 'Unknown Organisation',
                            role: vol.role || 'Volunteer',
                            description: vol.desc || vol.description || null
                        }));
                    if (newVols.length > 0) await tx.volunteering.createMany({ data: newVols });
                }

                // ── Languages: append-only, deduplicate by name ────────────────
                if (languages && languages.length > 0) {
                    const existingLangs = await tx.language.findMany({
                        where: { candidateProfileId: existingProfile.id },
                        select: { name: true }
                    });
                    const existingLangNames = new Set(existingLangs.map((l: any) => l.name.toLowerCase().trim()));
                    const newLangs = languages
                        .filter((lang: any) => lang.name && !existingLangNames.has(lang.name.toLowerCase().trim()))
                        .map((lang: any) => ({
                            candidateProfileId: existingProfile.id,
                            name: lang.name,
                            proficiency: lang.proficiency || 'Conversational'
                        }));
                    if (newLangs.length > 0) await tx.language.createMany({ data: newLangs });
                }

                // Re-fetch the profile with updated relations so achievement linking
                // (experienceIndex -> experienceId) resolves against the current state.
                updatedProfile = await tx.candidateProfile.findUnique({
                    where: { userId },
                    include: { experience: true, achievements: true }
                }) as any;
            }

            // Process achievements — deduplicate against existing by title to prevent re-import stacking
            if (discoveredAchievements && discoveredAchievements.length > 0) {
                const achievementsToCreate = discoveredAchievements.map((ach: any) => {
                    const experienceId = ach.experienceIndex !== undefined && updatedProfile.experience && updatedProfile.experience[ach.experienceIndex]
                        ? updatedProfile.experience[ach.experienceIndex].id
                        : null;

                    return {
                        candidateProfileId: updatedProfile.id,
                        userId,
                        experienceId,
                        title: ach.title || 'Untitled Achievement',
                        description: ach.description || ach.content || 'No description provided.',
                        metric: ach.metric || null,
                        metricType: ach.metricType || null,
                        industry: ach.industry || null,
                        skills: typeof ach.skills === 'string' ? ach.skills : (Array.isArray(ach.skills) ? ach.skills.join(', ') : (ach.skills || null)),
                        tags: typeof ach.tags === 'string' ? ach.tags : (Array.isArray(ach.tags) ? ach.tags.join(', ') : (ach.tags || null))
                    };
                });

                // Fetch existing titles so re-importing the same resume doesn't stack duplicates
                const existing = await tx.achievement.findMany({
                    where: { candidateProfileId: updatedProfile.id },
                    select: { title: true }
                });
                const existingTitles = new Set(existing.map((a: any) => a.title.toLowerCase().trim()));
                const newOnly = achievementsToCreate.filter((a: any) => !existingTitles.has(a.title.toLowerCase().trim()));

                if (newOnly.length > 0) {
                    await tx.achievement.createMany({ data: newOnly });
                }
            }

            return updatedProfile;
        }, { timeout: 30000 });

        // Record this import as a named resume version in the history log.
        // The label defaults to the current date so the record is always meaningful
        // even when the frontend does not supply one.
        const versionLabel = (typeof resumeLabel === 'string' && resumeLabel.trim())
            ? resumeLabel.trim()
            : `Resume ${new Date().toLocaleDateString('en-AU')}`;

        await prisma.resumeVersion.create({
            data: {
                userId,
                candidateProfileId: result.id,
                label: versionLabel,
                rawText: typeof rawText === 'string' ? rawText : null
            }
        });

        // Re-fetch to get new achievement IDs for Pinecone indexing
        const finalProfile = await prisma.candidateProfile.findUnique({
            where: { id: result.id },
            include: { achievements: true, experience: true }
        }) as any;

        // Index achievements in Pinecone in parallel
        if (finalProfile?.achievements && finalProfile.achievements.length > 0) {
            await Promise.all(finalProfile.achievements.map(async (ach: any) => {
                const experience = finalProfile.experience?.find((e: any) => e.id === ach.experienceId);
                try {
                    await indexAchievement(
                        userId,
                        ach.id,
                        `${ach.title}: ${ach.description}`,
                        {
                            metric: ach.metric,
                            metricType: ach.metricType,
                            industry: ach.industry,
                            role: experience?.role,
                            skills: ach.skills
                        }
                    );
                } catch (idxError) {
                    console.error('Pinecone Index Error (Warning):', idxError);
                }
            }));
        }

        res.json(finalProfile);
    } catch (error: any) {
        console.error('Profile Save Error:', error);
        res.status(500).json({
            error: 'Failed to save profile',
            details: error.message
        });
    }
});

// PATCH /api/profile
router.patch('/profile', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { name, email, phone, linkedin, location, professionalSummary } = req.body;
  const data: Record<string, any> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (linkedin !== undefined) data.linkedin = linkedin;
  if (location !== undefined) data.location = location;
  if (professionalSummary !== undefined) data.professionalSummary = professionalSummary;
  try {
    await prisma.candidateProfile.update({ where: { userId }, data });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/profile/claim
router.post('/profile/claim', authenticate, async (req: any, res: any) => {
  const userId: string = req.user.id;
  const userEmail: string | undefined = req.user.email;

  if (!userEmail) return res.json({ status: 'no_email' });

  try {
    const existing = await prisma.candidateProfile.findUnique({ where: { userId } });

    if (existing) {
      // Never touch a profile that has an active or complete report — it's real data.
      const report = await prisma.diagnosticReport.findUnique({ where: { userId } });
      if (report?.status === 'PROCESSING' || report?.status === 'COMPLETE') {
        return res.json({ status: 'already_complete' });
      }

      // A zombie profile has hasCompletedOnboarding:true but no report AND no resume text.
      // If resumeRawText exists the profile is real but mid-extraction — don't touch it.
      if (existing.resumeRawText) {
        return res.json({ status: 'already_exists' });
      }
      // else: zombie (no resume, no report) — fall through to find a better profile
    }

    // Find a richer profile for this email under a different userId
    const orphaned = await prisma.candidateProfile.findFirst({
      where: {
        OR: [{ marketingEmail: userEmail }, { email: userEmail }],
        NOT: { userId },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!orphaned) return res.json({ status: 'not_found' });

    const oldUserId = orphaned.userId;

    await prisma.$transaction(async (tx) => {
      // Delete zombie rows first so the orphaned profile can take the userId slot
      if (existing) {
        await tx.diagnosticReport.deleteMany({ where: { userId } });
        await tx.achievement.deleteMany({ where: { userId } });
        await tx.candidateProfile.delete({ where: { userId } });
      }

      await tx.candidateProfile.update({ where: { id: orphaned.id }, data: { userId } });
      await tx.achievement.updateMany({ where: { userId: oldUserId }, data: { userId } });
      await tx.jobApplication.updateMany({ where: { userId: oldUserId }, data: { userId } });
      await tx.document.updateMany({ where: { userId: oldUserId }, data: { userId } });
      await tx.resumeVersion.updateMany({ where: { userId: oldUserId }, data: { userId } });
      await tx.diagnosticReport.updateMany({ where: { userId: oldUserId }, data: { userId } });
    }, { timeout: 15000 });

    console.log(`[ProfileClaim] Migrated profile from ${oldUserId} → ${userId} (${userEmail})`);
    return res.json({ status: 'claimed' });
  } catch (error) {
    console.error('[ProfileClaim] Error:', error);
    return res.status(500).json({ error: 'Failed to claim profile' });
  }
});

// GET /api/profile/baseline-resume — check if ready
router.get('/profile/baseline-resume', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const doc = await prisma.document.findFirst({
      where: { userId, type: 'BASELINE_RESUME' },
      select: { id: true },
    });
    if (doc) {
      return res.json({ status: 'ready', documentId: doc.id });
    }
    return res.json({ status: 'pending' });
  } catch (err) {
    console.error('[BaselineResume] Status check failed:', err);
    return res.status(500).json({ error: 'Failed to check baseline resume status' });
  }
});

// POST /api/profile/baseline-resume/generate — on-demand fallback trigger
router.post('/profile/baseline-resume/generate', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const existing = await prisma.document.findFirst({
      where: { userId, type: 'BASELINE_RESUME' },
      select: { id: true },
    });
    if (existing) {
      return res.json({ status: 'ready', documentId: existing.id });
    }

    const [profile, report] = await Promise.all([
      prisma.candidateProfile.findUnique({ where: { userId }, select: { resumeRawText: true } }),
      prisma.diagnosticReport.findUnique({ where: { userId }, select: { reportMarkdown: true, status: true } }),
    ]);

    if (!profile?.resumeRawText || !report?.reportMarkdown) {
      return res.status(400).json({ error: 'Resume or diagnostic report not available' });
    }

    generateBaselineResume(userId, profile.resumeRawText, report.reportMarkdown).catch(err =>
      console.error('[BaselineResume] On-demand generation failed:', err)
    );

    return res.json({ status: 'generating' });
  } catch (err) {
    console.error('[BaselineResume] On-demand trigger failed:', err);
    return res.status(500).json({ error: 'Failed to start generation' });
  }
});

export default router;
