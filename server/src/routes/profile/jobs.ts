import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';
import { sendStatusEmail } from '../../services/email';
import { fetchCompanyIntel, buildSkillsPreview } from '../../services/companyIntel';

const router = Router();

// GET /api/jobs
router.get('/jobs', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const jobs = await prisma.jobApplication.findMany({
            where: { candidateProfile: { userId } },
            orderBy: { createdAt: 'desc' },
            include: { documents: true }
        });
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// GET /api/jobs/sent-count — count of applications the user has actually sent
// (status != SAVED). Used by the Strategic Intelligence card to decide which
// insights are unlocked.
router.get('/jobs/sent-count', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const count = await prisma.jobApplication.count({
            where: {
                candidateProfile: { userId },
                status: { not: 'SAVED' },
            },
        });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sent count' });
    }
});

// POST /api/jobs
router.post('/jobs', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { title, company, description, status, dateApplied, notes, closingDate } = req.body;

    if (!title || !company) {
        return res.status(400).json({ error: 'Title and company are required.' });
    }

    try {
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId },
            select: { id: true, skills: true },
        });
        if (!profile) return res.status(404).json({ error: 'Profile not found.' });

        const job = await prisma.jobApplication.create({
            data: {
                title: title.trim(),
                company: company.trim(),
                description: description || `${title} at ${company}`,
                status: status || 'SAVED',
                dateApplied: dateApplied ? new Date(dateApplied) : null,
                notes: notes || null,
                closingDate: closingDate ? new Date(closingDate) : null,
                userId,
                candidateProfileId: profile.id,
            },
            include: { documents: true }
        });
        res.status(201).json(job);

        // ── Background: fetch company intel ────────────────────────────────────
        // Fire-and-forget — never blocks the response. Uses skills from the
        // profile already loaded above.
        if (company && company.trim() !== 'Unknown Company') {
            const skillsPreview = buildSkillsPreview(profile.skills, 7);

            // Use short excerpts from the job description for context
            const jobExcerpts = (description || '')
                .split('\n')
                .filter((l: string) => l.trim().length > 20)
                .slice(0, 3);

            if (jobExcerpts.length > 0 || skillsPreview.length > 0) {
                fetchCompanyIntel({
                    companyName: company.trim(),
                    jobTitle: title.trim(),
                    jobExcerpts,
                    candidateSkills: skillsPreview,
                })
                    .then(intel =>
                        prisma.jobApplication.update({
                            where: { id: job.id },
                            data: { companyIntel: intel as any },
                        })
                    )
                    .then(() => console.log(`[companyIntel] saved for job ${job.id}`))
                    .catch((err: Error) =>
                        console.warn('[companyIntel] background fetch failed:', err.message)
                    );
            }
        }
    } catch (error) {
        console.error('Create Job Error:', error);
        res.status(500).json({ error: 'Failed to create job application' });
    }
});

// PATCH /api/jobs/:id
router.patch('/jobs/:id', authenticate, async (req, res) => {
    const { id } = req.params as any;
    const userId = (req as any).user.id;
    const { status, dateApplied, notes, priority, closingDate } = req.body;

    try {
        // Fetch current status before update so we can detect a genuine transition.
        const existing = await prisma.jobApplication.findFirst({
            where: { id, candidateProfile: { userId } },
            select: { status: true, title: true, company: true },
        });

        const job = await prisma.jobApplication.update({
            where: {
                id,
                candidateProfile: { userId }
            },
            data: {
                ...(status && { status }),
                ...(dateApplied !== undefined && { dateApplied: dateApplied ? new Date(dateApplied) : null }),
                ...(notes !== undefined && { notes }),
                ...(priority !== undefined && { priority: priority || null }),
                ...(closingDate !== undefined && { closingDate: closingDate ? new Date(closingDate) : null }),
            },
            include: { documents: true }
        });

        // Fire status-triggered email — best-effort, never blocks the response.
        const statusChanged = status && existing && status !== existing.status;
        if (statusChanged && (status === 'APPLIED' || status === 'REJECTED')) {
            // Resolve the user's email from their auth record.
            const userEmail: string | undefined = (req as any).user?.email;
            if (userEmail) {
                sendStatusEmail({
                    to: userEmail,
                    status,
                    jobTitle: existing!.title,
                    company: existing!.company,
                }).catch((err: any) => {
                    console.error('[jobs] Status email failed (non-fatal):', err?.message ?? err);
                });
            }
        }

        res.json(job);
    } catch (error) {
        console.error('Update Job Error:', error);
        res.status(500).json({ error: 'Failed to update job application' });
    }
});

// DELETE /api/jobs/:id
router.delete('/jobs/:id', authenticate, async (req, res) => {
    const { id } = req.params as any;
    const userId = (req as any).user.id;
    try {
        // Delete linked documents first, then the job
        await prisma.document.deleteMany({ where: { jobApplicationId: id, userId } });
        await prisma.jobApplication.delete({
            where: { id, candidateProfile: { userId } }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Delete Job Error:', error);
        res.status(500).json({ error: 'Failed to delete job application' });
    }
});

export default router;
