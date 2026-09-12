import { describe, it, expect, vi } from 'vitest';

vi.mock('../../index', () => ({
  prisma: {
    candidateProfile: { findUnique: vi.fn(), updateMany: vi.fn() },
    jobApplication: { findMany: vi.fn() },
  },
}));

async function mod() {
  const m = await import('./milestones');
  const { prisma } = await import('../../index');
  return { m, prisma };
}

function app(i: number, opts: Partial<{ tag: string | null; interviewed: boolean; sourceUrl: string | null }> = {}) {
  return {
    id: `id-${i}`,
    sourceUrl: opts.sourceUrl === undefined ? `url-${i}` : opts.sourceUrl,
    matchedIdentityCard: opts.tag ?? null,
    interviewReachedAt: opts.interviewed ? new Date() : null,
    offerReachedAt: null,
  };
}

describe('getMilestoneState', () => {
  it('is not eligible below the first hundred', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({ applicationMilestoneSeen: 0 });
    (prisma.jobApplication.findMany as any).mockResolvedValue(Array.from({ length: 99 }, (_, i) => app(i)));
    const state = await m.getMilestoneState('u1');
    expect(state.eligible).toBe(false);
    expect(state.totalSent).toBe(99);
  });

  it('is eligible exactly at a hundred not yet seen', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({ applicationMilestoneSeen: 0 });
    (prisma.jobApplication.findMany as any).mockResolvedValue(Array.from({ length: 100 }, (_, i) => app(i)));
    const state = await m.getMilestoneState('u1');
    expect(state.eligible).toBe(true);
    expect(state.milestone).toBe(100);
  });

  it('is not eligible again once that milestone was already seen', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({ applicationMilestoneSeen: 100 });
    (prisma.jobApplication.findMany as any).mockResolvedValue(Array.from({ length: 150 }, (_, i) => app(i)));
    const state = await m.getMilestoneState('u1');
    expect(state.eligible).toBe(false);
  });

  it('dedupes the same job logged twice', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({ applicationMilestoneSeen: 0 });
    (prisma.jobApplication.findMany as any).mockResolvedValue([
      app(1, { sourceUrl: 'same' }),
      app(2, { sourceUrl: 'same' }),
      app(3),
    ]);
    const state = await m.getMilestoneState('u1');
    expect(state.totalSent).toBe(2);
  });

  it('ranks tags by interview rate and drops tags below the sample floor', async () => {
    const { m, prisma } = await mod();
    (prisma.candidateProfile.findUnique as any).mockResolvedValue({ applicationMilestoneSeen: 0 });
    const rows = [
      // 'Analyst': 3 applied, 2 interviewed -> 0.667
      ...Array.from({ length: 3 }, (_, i) => app(i, { tag: 'Analyst', interviewed: i < 2, sourceUrl: `a${i}` })),
      // 'Coordinator': 3 applied, 1 interviewed -> 0.333
      ...Array.from({ length: 3 }, (_, i) => app(10 + i, { tag: 'Coordinator', interviewed: i < 1, sourceUrl: `c${i}` })),
      // 'Rare': only 2 applied — below MIN_TAG_SAMPLE, should be excluded
      ...Array.from({ length: 2 }, (_, i) => app(20 + i, { tag: 'Rare', interviewed: true, sourceUrl: `r${i}` })),
    ];
    (prisma.jobApplication.findMany as any).mockResolvedValue(rows);
    const state = await m.getMilestoneState('u1');
    expect(state.byTag.map(t => t.tag)).toEqual(['Analyst', 'Coordinator']);
    expect(state.byTag[0].interviewRate).toBeCloseTo(2 / 3);
  });
});

describe('ackMilestone', () => {
  it('only advances the seen marker forward', async () => {
    const { m, prisma } = await mod();
    await m.ackMilestone('u1', 200);
    expect(prisma.candidateProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', applicationMilestoneSeen: { lt: 200 } },
      data: { applicationMilestoneSeen: 200 },
    });
  });
});
