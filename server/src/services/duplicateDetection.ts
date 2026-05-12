/**
 * Duplicate-job detection.
 *
 * Used by /api/analyze/dual to flag when a candidate is analysing a role
 * they've already applied to (or saved). Surfaces inline as a soft warning
 * with options to view the existing application or analyse anyway.
 *
 * Heuristic: case-insensitive token match on company + role title.
 * Looking for at least 70% token overlap on company AND 50% overlap on
 * role title. Limits to applications created in the last 180 days so
 * candidates aren't permanently blocked from re-targeting old roles.
 *
 * Not LLM-based — we keep this cheap and deterministic.
 */
import { prisma } from '../index';

export interface DuplicateMatch {
    applicationId: string;
    title: string;
    company: string;
    status: string;
    dateApplied: string | null;
    createdAt: string;
}

function tokenise(s: string): Set<string> {
    return new Set(
        (s ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length > 1),
    );
}

function overlap(a: Set<string>, b: Set<string>): number {
    if (!a.size || !b.size) return 0;
    let hit = 0;
    for (const tok of a) if (b.has(tok)) hit += 1;
    return hit / Math.min(a.size, b.size);
}

const LOOKBACK_DAYS = 180;
const COMPANY_OVERLAP_MIN = 0.7;
const TITLE_OVERLAP_MIN = 0.5;

export async function findDuplicateApplication(params: {
    userId: string;
    company: string;
    role: string;
}): Promise<DuplicateMatch | null> {
    const { userId, company, role } = params;
    if (!company || !role || company === 'Unknown Company' || role === 'Unknown Position') {
        return null;
    }

    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);

    const candidates = await prisma.jobApplication.findMany({
        where: {
            userId,
            createdAt: { gte: since },
        },
        select: {
            id: true,
            title: true,
            company: true,
            status: true,
            dateApplied: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    const targetCompany = tokenise(company);
    const targetTitle = tokenise(role);

    for (const candidate of candidates) {
        const cCompany = tokenise(candidate.company);
        const cTitle = tokenise(candidate.title);
        if (overlap(targetCompany, cCompany) >= COMPANY_OVERLAP_MIN
            && overlap(targetTitle, cTitle) >= TITLE_OVERLAP_MIN) {
            return {
                applicationId: candidate.id,
                title: candidate.title,
                company: candidate.company,
                status: candidate.status,
                dateApplied: candidate.dateApplied?.toISOString() ?? null,
                createdAt: candidate.createdAt.toISOString(),
            };
        }
    }

    return null;
}
