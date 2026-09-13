/**
 * Read-only: what the paying clients actually consume, per head, per month.
 *
 * Every API estimate before this was theory — the goal floors say 25
 * applications and 20 outreach a week, which is what a client is ASKED to do,
 * not what they do. This counts what is in the database so the cost model rests
 * on observed behaviour.
 *
 * Run: npx tsx src/scripts/_usage_snapshot.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAYS = 90;
const ADMIN_EMAILS = [
  'kamiproject2021@gmail.com',
  'kiron182@gmail.com',
  'kiron@aussiegradcareers.com.au',
  'kironorik@gmail.com',
];

async function main() {
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  // Who counts as a paying client. dashboardAccess covers comped accounts, and
  // isAdmin is excluded so Kiron's own testing does not inflate the average.
  const clients = await prisma.candidateProfile.findMany({
    where: {
      OR: [
        { plan: { not: 'free' } },
        { dashboardAccess: true },
        { subscriptionStatus: { in: ['active', 'trialing', 'past_due'] } },
      ],
      // isAdmin is not a column — it is an email allowlist in routes/stripe.ts.
      // Excluded so Kiron's own testing does not inflate the per-client average.
      email: { notIn: ADMIN_EMAILS },
    },
    select: { userId: true, email: true, name: true, plan: true, subscriptionStatus: true, createdAt: true },
  });

  console.log(`\n=== ${clients.length} client accounts (excluding admin) ===\n`);

  const rows: Array<Record<string, unknown>> = [];

  for (const c of clients) {
    const [docs, docsByType, apps, outreach, diagnostics] = await Promise.all([
      prisma.document.count({ where: { userId: c.userId, createdAt: { gte: since } } }),
      prisma.document.groupBy({
        by: ['type'],
        where: { userId: c.userId, createdAt: { gte: since } },
        _count: true,
      }),
      prisma.jobApplication.count({ where: { userId: c.userId, createdAt: { gte: since } } }),
      prisma.outreachLog.count({ where: { userId: c.userId, createdAt: { gte: since } } }),
      prisma.diagnosticReport.count({ where: { userId: c.userId, createdAt: { gte: since } } }),
    ]);

    const ageDays = Math.max(1, Math.round((Date.now() - c.createdAt.getTime()) / 86400000));
    const activeDays = Math.min(ageDays, DAYS);

    rows.push({
      who: (c.name || c.email || c.userId).slice(0, 22),
      plan: c.plan ?? '-',
      status: c.subscriptionStatus ?? '-',
      ageD: ageDays,
      docs,
      apps,
      outreach,
      diag: diagnostics,
      docsPerMonth: +(docs / activeDays * 30).toFixed(1),
      appsPerMonth: +(apps / activeDays * 30).toFixed(1),
      outPerMonth: +(outreach / activeDays * 30).toFixed(1),
      types: docsByType.map(d => `${d.type}:${d._count}`).join(' '),
    });
  }

  rows.sort((a, b) => (b.docs as number) - (a.docs as number));
  console.table(rows.map(({ types, ...r }) => r));
  console.log('\nDocument type split per client:');
  for (const r of rows) console.log(`  ${String(r.who).padEnd(24)} ${r.types}`);

  // Totals across the whole install, for the months actually observed.
  const [allDocs, allApps, allOut] = await Promise.all([
    prisma.document.count({ where: { createdAt: { gte: since } } }),
    prisma.jobApplication.count({ where: { createdAt: { gte: since } } }),
    prisma.outreachLog.count({ where: { createdAt: { gte: since } } }),
  ]);
  console.log(`\n=== whole install, last ${DAYS} days ===`);
  console.log(`  documents ${allDocs}   applications ${allApps}   outreach ${allOut}`);
  console.log(`  → per month: documents ${(allDocs / DAYS * 30).toFixed(0)}, applications ${(allApps / DAYS * 30).toFixed(0)}, outreach ${(allOut / DAYS * 30).toFixed(0)}`);

  // Month-by-month, so a ramp is visible rather than averaged away.
  const monthly = await prisma.$queryRawUnsafe<Array<{ month: string; docs: bigint }>>(
    `select to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as month, count(*) as docs
     from "Document" group by 1 order by 1 desc limit 8`
  );
  console.log('\n=== documents per calendar month (all users) ===');
  for (const m of monthly) console.log(`  ${m.month}  ${m.docs}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
