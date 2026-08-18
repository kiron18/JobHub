/**
 * Reconcile the sales board against the registrations it is supposed to reflect.
 *
 * The CRM import of 14 Aug wrote names and stages from the old Python board on
 * top of people who had already registered through the funnel. Three separate
 * ways the board can now be wrong, all of them silent:
 *
 *   1. registeredAt is null on someone who demonstrably registered. The import
 *      carried the stage across but had no date to carry, so the board shows a
 *      grey "Registered" chip beside a stage that says Registered.
 *
 *   2. The lead's name is not the name the person typed. The import matched on
 *      email and overwrote the name, which is backwards: `recordLeadSignal`
 *      says a name someone typed beats one that was imported, and the import
 *      did not honour that. This is the one that costs something real, because
 *      it is the name read off the board before a call.
 *
 *   3. A registration with no lead at all, so a real registrant is missing from
 *      the board and from every count taken off it.
 *
 * Stages are never touched. A stage the import brought over is the only record
 * of what the old board thought, and guessing at it here would be worse than
 * leaving it visibly odd.
 *
 * Dry run by default. Pass --apply to write.
 *
 *   npx tsx -r dotenv/config src/scripts/reconcile_leads_with_registrations.ts
 *   npx tsx -r dotenv/config src/scripts/reconcile_leads_with_registrations.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const apply = process.argv.includes('--apply');

async function main() {
  const prisma = new PrismaClient();

  const regs = await prisma.sessionRegistration.findMany({
    select: { name: true, email: true, createdAt: true, sessionKey: true, resumeText: true },
  });
  const leads = await prisma.salesLead.findMany({
    select: { id: true, name: true, email: true, stage: true, registeredAt: true },
  });
  const byEmail = new Map(leads.filter((l) => l.email).map((l) => [l.email as string, l]));

  const missingDate: typeof regs = [];
  const wrongName: { lead: (typeof leads)[number]; should: string }[] = [];
  const missingLead: typeof regs = [];

  for (const r of regs) {
    const lead = byEmail.get(r.email);
    if (!lead) { missingLead.push(r); continue; }
    if (!lead.registeredAt) missingDate.push(r);
    if (r.name.trim() && r.name.trim() !== lead.name.trim()) wrongName.push({ lead, should: r.name.trim() });
  }

  console.log(`\n1. ${missingDate.length} registered with no registeredAt on the board`);
  for (const r of missingDate) console.log(`   ${r.email} -> ${r.createdAt.toISOString()} (session ${r.sessionKey})`);

  console.log(`\n2. ${wrongName.length} whose board name is not the name they typed`);
  for (const w of wrongName) console.log(`   ${w.lead.email}: "${w.lead.name}" -> "${w.should}"`);

  console.log(`\n3. ${missingLead.length} registered but not on the board at all`);
  for (const r of missingLead) console.log(`   ${r.name} <${r.email}> (session ${r.sessionKey})`);

  if (!apply) {
    console.log('\nDry run. Nothing written. Re-run with --apply.');
    await prisma.$disconnect();
    return;
  }

  for (const r of missingDate) {
    const lead = byEmail.get(r.email)!;
    await prisma.salesLead.update({ where: { id: lead.id }, data: { registeredAt: r.createdAt } });
  }
  for (const w of wrongName) {
    await prisma.salesLead.update({ where: { id: w.lead.id }, data: { name: w.should } });
  }
  for (const r of missingLead) {
    await prisma.salesLead.create({
      data: {
        email: r.email,
        name: r.name,
        source: 'session',
        stage: 'Registered',
        registeredAt: r.createdAt,
        hasResume: !!r.resumeText,
      },
    });
  }
  console.log(`\nWrote ${missingDate.length} date(s), ${wrongName.length} name(s), ${missingLead.length} new lead(s). Stages untouched.`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
