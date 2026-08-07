import { Router } from 'express';
import { prisma } from '../../index';
import { authenticate } from '../../middleware/auth';
import { sendStatusEmail } from '../../services/email';
import { isSentStatus } from '../../services/tracker/metricHelpers';
import { linkDocumentsToApplication } from '../../services/qc/linkDocuments';

const router = Router();

/**
 * Columns of a document the tracker list actually needs: enough to draw the
 * badges and know what exists. The generated text itself is deliberately left
 * out — see the note on GET /api/jobs.
 */
const DOCUMENT_LIST_FIELDS = {
    id: true, type: true, title: true, edited: true, createdAt: true, updatedAt: true,
} as const;

// GET /api/jobs
//
// The list used to `include: { documents: true }`, which shipped the full text
// of every resume, cover letter and prep pack the client had ever generated on
// every dashboard load — megabytes for an active client, none of it rendered
// until they open a document. The bodies are fetched one at a time from
// /api/documents/:id when something is actually opened.
//
// The job description stays: it is what the tracker's "Job description" panel
// shows and what the in-card generation actions are grounded on, and losing it
// here would quietly downgrade them to "Title at Company".
router.get('/jobs', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const jobs = await prisma.jobApplication.findMany({
            where: { candidateProfile: { userId } },
            orderBy: { createdAt: 'desc' },
            include: { documents: { select: DOCUMENT_LIST_FIELDS } },
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

// GET /api/jobs/:id — one application in full, document bodies included.
// Must stay below /jobs/sent-count: a bare :id pattern matches that literal
// path too, and whichever is registered first wins.
router.get('/jobs/:id', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params as any;
    try {
        const job = await prisma.jobApplication.findFirst({
            where: { id: id as string, candidateProfile: { userId } },
            include: { documents: true },
        });
        if (!job) return res.status(404).json({ error: 'Application not found' });
        res.json(job);
    } catch (error) {
        console.error('Get Job Error:', error);
        res.status(500).json({ error: 'Failed to fetch job application' });
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
            select: { id: true },
        });
        if (!profile) return res.status(404).json({ error: 'Profile not found.' });

        const job = await prisma.jobApplication.create({
            data: {
                title: title.trim(),
                company: company.trim(),
                description: description || `${title} at ${company}`,
                status: status || 'SAVED',
                // Jobs created already at INTERVIEW/OFFER still get milestone stamps.
                ...(status === 'INTERVIEW' || status === 'OFFER' ? { interviewReachedAt: new Date() } : {}),
                ...(status === 'OFFER' ? { offerReachedAt: new Date() } : {}),
                // A job created straight into a sent status is a sent
                // application and needs a date, or it counts nowhere.
                dateApplied: dateApplied
                    ? new Date(dateApplied)
                    : (status && isSentStatus(status) ? new Date() : null),
                notes: notes || null,
                closingDate: closingDate ? new Date(closingDate) : null,
                userId,
                candidateProfileId: profile.id,
            },
            include: { documents: true }
        });

        // The workspace generates the documents first and saves this row after,
        // so attach anything already generated against the same advert.
        // Never fatal: the application is saved either way.
        try {
            const linked = await linkDocumentsToApplication(userId, job.id, description);
            if (linked > 0) {
                console.log(`[jobs] linked ${linked} existing document(s) to application ${job.id}`);
                const withDocs = await prisma.jobApplication.findUnique({
                    where: { id: job.id },
                    include: { documents: true },
                });
                if (withDocs) return res.status(201).json(withDocs);
            }
        } catch (err: any) {
            console.error('[jobs] document linking failed (non-fatal):', err?.message ?? err);
        }

        res.status(201).json(job);
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
            select: { status: true, title: true, company: true, interviewReachedAt: true, offerReachedAt: true, dateApplied: true },
        });

        // Milestone timestamps power the leaderboard: stamp the first time a job
        // reaches INTERVIEW/OFFER, never overwrite on later status flips.
        const reachedInterview =
            (status === 'INTERVIEW' || status === 'OFFER') && existing && !existing.interviewReachedAt;
        const reachedOffer = status === 'OFFER' && existing && !existing.offerReachedAt;

        // dateApplied has to follow status, or the application goes missing.
        //
        // Moving a job out of SAVED without supplying a date used to leave
        // dateApplied null, and the client's own tracker, the leaderboard and
        // the coach view all filter on dateApplied — so a real application the
        // client had sent counted nowhere they could see it. Moving one back to
        // SAVED left the old date behind, which counted the opposite way.
        //
        // An explicit dateApplied in the request always wins; these only fill
        // the gap when the caller says nothing.
        const movingToSent = status && isSentStatus(status);
        const movingToSaved = status === 'SAVED';
        const stampDateApplied =
            movingToSent && dateApplied === undefined && existing && !existing.dateApplied;
        const clearDateApplied =
            movingToSaved && dateApplied === undefined && existing && existing.dateApplied;

        const job = await prisma.jobApplication.update({
            where: {
                id,
                candidateProfile: { userId }
            },
            data: {
                ...(status && { status }),
                ...(reachedInterview && { interviewReachedAt: new Date() }),
                ...(reachedOffer && { offerReachedAt: new Date() }),
                ...(dateApplied !== undefined && { dateApplied: dateApplied ? new Date(dateApplied) : null }),
                ...(stampDateApplied ? { dateApplied: new Date() } : {}),
                ...(clearDateApplied ? { dateApplied: null } : {}),
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
