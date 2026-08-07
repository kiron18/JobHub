/**
 * Coach quality control — mounted under /api/admin/coach/qc, so it inherits
 * that router's admin gate.
 *
 * Two passes, deliberately separated by cost:
 *
 *   GET  /qc/sweep            reads every recent document, no model call, no
 *                             cost. Ranks them worst first so a coach knows
 *                             which handful are worth opening.
 *   GET  /qc/document/:id     one document in full, with its advert alongside
 *                             it and any verdict already cached.
 *   POST /qc/review           spends money, once, on one document — and only
 *                             when a coach clicks. Cached against what was
 *                             judged, so re-opening it is free and an edit
 *                             earns a fresh read.
 *
 * The sweep is what makes the audit affordable: reviewing a month of output
 * with a model call each would cost real money and mostly confirm that most
 * documents are fine. Reviewing the five the sweep ranks worst costs cents.
 */
import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '../index';
import type { AuthRequest } from '../middleware/auth';
import { getRealUserIds } from './admin';
import { runDeterministicChecks, type QcInput, type QcProfileSnapshot } from '../services/qc/checks';
import { auditDocument, auditHash, type QcAuditVerdict } from '../services/qc/audit';

const router = Router();

const DAY_MS = 86400000;
/** Reviewable output. Interview prep is a private working note, not something an employer sees. */
const REVIEWABLE_TYPES = ['RESUME', 'COVER_LETTER', 'STAR_RESPONSE', 'BASELINE_RESUME'] as const;
/** Upper bound on one sweep. The whole point is triage, not a full archive read. */
const SWEEP_MAX = 300;
const SWEEP_DEFAULT = 100;
/** Cap on one batch of paid audits, so a stuck click cannot run up a bill. */
const BATCH_MAX = 10;

const clampInt = (raw: unknown, def: number, min: number, max: number) => {
    const n = parseInt(String(raw ?? ''), 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

const isTestAccount = (email: string | null | undefined) =>
    (email ?? '').endsWith('@jobhub-test.local');

type ProfileRow = {
    userId: string;
    name: string | null;
    email: string | null;
    resumeRawText: string | null;
    resumeOriginalText: string | null;
    yearsOfExperience: number | null;
    experience: Array<{ company: string; role: string }>;
    achievements: Array<{ description: string | null; metric: string | null }>;
};

function toSnapshot(p: ProfileRow | undefined): QcProfileSnapshot {
    return {
        name: p?.name ?? null,
        resumeRawText: p?.resumeRawText ?? null,
        resumeOriginalText: p?.resumeOriginalText ?? null,
        yearsOfExperience: p?.yearsOfExperience ?? null,
        experience: p?.experience ?? [],
        achievements: p?.achievements ?? [],
    };
}

/**
 * Ground truth for a set of clients, in one round-trip.
 *
 * The achievement bank and work history are pulled because the honesty checks
 * are only as good as the source they compare against — a metric that is in the
 * bank but not in the resume text is legitimate, and without this it would be
 * reported as invented.
 */
async function loadProfiles(userIds: string[]): Promise<Map<string, ProfileRow>> {
    if (userIds.length === 0) return new Map();
    const rows = await prisma.candidateProfile.findMany({
        where: { userId: { in: userIds } },
        select: {
            userId: true, name: true, email: true,
            resumeRawText: true, resumeOriginalText: true, yearsOfExperience: true,
            experience: { select: { company: true, role: true } },
            achievements: { select: { description: true, metric: true } },
        },
    });
    return new Map(rows.map(r => [r.userId, r as ProfileRow]));
}

/** Every other employer this client has applied to — the wrong-employer check needs it. */
async function loadCompaniesByUser(userIds: string[]): Promise<Map<string, string[]>> {
    if (userIds.length === 0) return new Map();
    const rows = await prisma.jobApplication.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, company: true },
        distinct: ['userId', 'company'],
    });
    const out = new Map<string, string[]>();
    for (const r of rows) {
        if (!r.company) continue;
        const list = out.get(r.userId) ?? [];
        list.push(r.company);
        out.set(r.userId, list);
    }
    return out;
}

type DocRow = {
    id: string;
    userId: string;
    type: string;
    content: string;
    createdAt: Date;
    edited: boolean;
    qualitySignals: unknown;
    jobApplication: { id: string; title: string; company: string; description: string } | null;
};

function buildQcInput(doc: DocRow, profile: ProfileRow | undefined, otherCompanies: string[]): QcInput {
    return {
        docType: doc.type as QcInput['docType'],
        content: doc.content ?? '',
        jobDescription: doc.jobApplication?.description ?? null,
        jobTitle: doc.jobApplication?.title ?? null,
        company: doc.jobApplication?.company ?? null,
        profile: toSnapshot(profile),
        otherCompanies,
        generationSignals: (doc.qualitySignals as QcInput['generationSignals']) ?? null,
    };
}

/**
 * GET /api/admin/coach/qc/sweep?days=30&userId=&type=&limit=100
 *
 * Deterministic only. Costs nothing, so it can be refreshed freely.
 */
router.get('/sweep', async (req: AuthRequest, res: Response) => {
    try {
        const days = clampInt(req.query.days, 30, 1, 180);
        const limit = clampInt(req.query.limit, SWEEP_DEFAULT, 1, SWEEP_MAX);
        const since = new Date(Date.now() - days * DAY_MS);
        const onlyUser = typeof req.query.userId === 'string' ? req.query.userId : null;
        const typeFilter = typeof req.query.type === 'string' && REVIEWABLE_TYPES.includes(req.query.type as never)
            ? [req.query.type]
            : [...REVIEWABLE_TYPES];

        const realUserIds = onlyUser ? [onlyUser] : await getRealUserIds();
        if (realUserIds.length === 0) {
            return res.json({ days, scanned: 0, summary: emptySummary(), documents: [] });
        }

        const docs = await prisma.document.findMany({
            where: {
                userId: { in: realUserIds },
                createdAt: { gte: since },
                type: { in: typeFilter as never },
            },
            select: {
                id: true, userId: true, type: true, content: true, createdAt: true,
                edited: true, qualitySignals: true,
                jobApplication: { select: { id: true, title: true, company: true, description: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        }) as unknown as DocRow[];

        if (docs.length === 0) {
            return res.json({ days, scanned: 0, summary: emptySummary(), documents: [] });
        }

        const userIds = [...new Set(docs.map(d => d.userId))];
        const [profiles, companiesByUser, cachedReviews] = await Promise.all([
            loadProfiles(userIds),
            loadCompaniesByUser(userIds),
            prisma.documentQcReview.findMany({
                where: { documentId: { in: docs.map(d => d.id) } },
                select: { documentId: true, contentHash: true, createdAt: true, verdict: true },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        const reviewsByDoc = new Map<string, typeof cachedReviews>();
        for (const r of cachedReviews) {
            const list = reviewsByDoc.get(r.documentId) ?? [];
            list.push(r);
            reviewsByDoc.set(r.documentId, list);
        }

        const summary = emptySummary();
        const byCheck: Record<string, number> = {};
        const rows = [];

        for (const doc of docs) {
            const profile = profiles.get(doc.userId);
            // Automated flow-test accounts generate documents too; they are not
            // client work and would swamp the ranking.
            if (isTestAccount(profile?.email)) continue;

            const input = buildQcInput(doc, profile, companiesByUser.get(doc.userId) ?? []);
            const result = runDeterministicChecks(input);

            summary.scanned += 1;
            summary[result.level] += 1;
            for (const f of result.findings) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;

            const hash = auditHash({
                docType: doc.type,
                content: doc.content ?? '',
                jobDescription: doc.jobApplication?.description ?? null,
                profile: toSnapshot(profile),
            });
            const current = (reviewsByDoc.get(doc.id) ?? []).find(r => r.contentHash === hash);

            rows.push({
                id: doc.id,
                type: doc.type,
                createdAt: doc.createdAt,
                edited: doc.edited,
                student: { userId: doc.userId, name: profile?.name ?? null, email: profile?.email ?? null },
                job: doc.jobApplication
                    ? { id: doc.jobApplication.id, title: doc.jobApplication.title, company: doc.jobApplication.company }
                    : null,
                score: result.score,
                level: result.level,
                metrics: result.metrics,
                unassessable: result.unassessable,
                findings: result.findings,
                // Whether a paid audit already exists for this exact version.
                audit: current
                    ? { reviewedAt: current.createdAt, scores: (current.verdict as unknown as QcAuditVerdict)?.scores ?? null }
                    : null,
            });
        }

        // Worst first: that is the entire job of this endpoint.
        rows.sort((a, b) => a.score - b.score || b.createdAt.getTime() - a.createdAt.getTime());

        res.json({ days, scanned: summary.scanned, summary, byCheck, documents: rows });
    } catch (e) {
        console.error('[coach/qc/sweep]', e);
        res.status(500).json({ error: 'failed' });
    }
});

function emptySummary() {
    return { scanned: 0, clean: 0, info: 0, warning: 0, critical: 0 };
}

/**
 * GET /api/admin/coach/qc/document/:id
 * One document in full, with the advert it was written against, the
 * deterministic findings recomputed, and any cached verdict.
 */
router.get('/document/:id', async (req: AuthRequest, res: Response) => {
    try {
        const doc = await prisma.document.findUnique({
            where: { id: String(req.params.id) },
            select: {
                id: true, userId: true, type: true, content: true, createdAt: true, updatedAt: true,
                edited: true, title: true, qualitySignals: true,
                jobApplication: { select: { id: true, title: true, company: true, description: true, status: true, dateApplied: true } },
            },
        }) as unknown as (DocRow & { title: string | null; updatedAt: Date }) | null;
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        const [profiles, companiesByUser] = await Promise.all([
            loadProfiles([doc.userId]),
            loadCompaniesByUser([doc.userId]),
        ]);
        const profile = profiles.get(doc.userId);
        const input = buildQcInput(doc, profile, companiesByUser.get(doc.userId) ?? []);
        const deterministic = runDeterministicChecks(input);

        const hash = auditHash({
            docType: doc.type,
            content: doc.content ?? '',
            jobDescription: doc.jobApplication?.description ?? null,
            profile: toSnapshot(profile),
        });
        const cached = await prisma.documentQcReview.findUnique({
            where: { documentId_contentHash: { documentId: doc.id, contentHash: hash } },
        });

        res.json({
            document: {
                id: doc.id, type: doc.type, title: doc.title, content: doc.content,
                createdAt: doc.createdAt, updatedAt: doc.updatedAt, edited: doc.edited,
            },
            student: { userId: doc.userId, name: profile?.name ?? null, email: profile?.email ?? null },
            job: doc.jobApplication,
            deterministic,
            audit: cached
                ? {
                    verdict: cached.verdict,
                    reviewedAt: cached.createdAt,
                    model: cached.model,
                    costUsd: cached.costUsd,
                    stale: false,
                }
                : null,
        });
    } catch (e) {
        console.error('[coach/qc/document]', e);
        res.status(500).json({ error: 'failed' });
    }
});

/** Runs, or serves from cache, one audit. Shared by the single and batch routes. */
async function reviewOne(documentId: string, reviewedBy: string | null, force: boolean) {
    const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
            id: true, userId: true, type: true, content: true,
            jobApplication: { select: { title: true, company: true, description: true } },
        },
    });
    if (!doc) return { documentId, error: 'not_found' as const };

    const profiles = await loadProfiles([doc.userId]);
    const profile = profiles.get(doc.userId);

    const auditInput = {
        docType: doc.type as string,
        content: doc.content ?? '',
        jobDescription: doc.jobApplication?.description ?? null,
        jobTitle: doc.jobApplication?.title ?? null,
        company: doc.jobApplication?.company ?? null,
        profile: toSnapshot(profile),
    };
    const hash = auditHash(auditInput);

    if (!force) {
        const cached = await prisma.documentQcReview.findUnique({
            where: { documentId_contentHash: { documentId: doc.id, contentHash: hash } },
        });
        if (cached) {
            return {
                documentId,
                cached: true,
                verdict: cached.verdict as unknown as QcAuditVerdict,
                reviewedAt: cached.createdAt,
                costUsd: 0,
            };
        }
    }

    const result = await auditDocument(auditInput);

    // upsert, not create: two coaches opening the same document at once would
    // otherwise collide on the unique pair.
    const saved = await prisma.documentQcReview.upsert({
        where: { documentId_contentHash: { documentId: doc.id, contentHash: result.contentHash } },
        create: {
            documentId: doc.id,
            contentHash: result.contentHash,
            verdict: result.verdict as never,
            model: result.model,
            promptTokens: result.tokens.input,
            outputTokens: result.tokens.output,
            costUsd: result.tokens.costUsd,
            reviewedBy,
        },
        update: {
            verdict: result.verdict as never,
            model: result.model,
            promptTokens: result.tokens.input,
            outputTokens: result.tokens.output,
            costUsd: result.tokens.costUsd,
            reviewedBy,
        },
    });

    return {
        documentId,
        cached: false,
        verdict: result.verdict,
        reviewedAt: saved.createdAt,
        costUsd: result.tokens.costUsd,
    };
}

/**
 * POST /api/admin/coach/qc/review { documentId, force? }
 * The only route here that spends money, and only for one document.
 */
router.post('/review', async (req: AuthRequest, res: Response) => {
    try {
        const { documentId, force } = req.body ?? {};
        if (!documentId) return res.status(400).json({ error: 'documentId required' });

        const result = await reviewOne(String(documentId), req.user?.email ?? null, force === true);
        if ('error' in result) return res.status(404).json({ error: 'Document not found' });
        res.json(result);
    } catch (e: any) {
        console.error('[coach/qc/review]', e);
        res.status(502).json({ error: e?.message ?? 'The quality audit could not be completed.' });
    }
});

/**
 * POST /api/admin/coach/qc/review-batch { documentIds: [] }
 * Audits a handful in sequence — usually the worst few from a sweep. Sequential
 * on purpose: a burst of parallel calls buys nothing here and is the quickest
 * way to a rate limit mid-batch.
 */
router.post('/review-batch', async (req: AuthRequest, res: Response) => {
    try {
        const ids = Array.isArray(req.body?.documentIds) ? req.body.documentIds.map(String) : [];
        if (ids.length === 0) return res.status(400).json({ error: 'documentIds required' });
        if (ids.length > BATCH_MAX) {
            return res.status(400).json({ error: `At most ${BATCH_MAX} documents per batch.` });
        }

        const results = [];
        let spent = 0;
        for (const id of ids) {
            try {
                const r = await reviewOne(id, req.user?.email ?? null, false);
                if (!('error' in r)) spent += r.costUsd;
                results.push(r);
            } catch (e: any) {
                // One bad document must not lose the audits already paid for.
                results.push({ documentId: id, error: e?.message ?? 'failed' });
            }
        }
        res.json({ results, costUsd: spent });
    } catch (e) {
        console.error('[coach/qc/review-batch]', e);
        res.status(500).json({ error: 'failed' });
    }
});

export default router;
