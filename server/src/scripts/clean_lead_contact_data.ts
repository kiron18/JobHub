/**
 * Repair contact details the CRM import mangled.
 *
 * Three faults, all from the same 14 Aug import, all of which make a row look
 * like a person you can contact when you cannot:
 *
 *   1. Column drift. One row came through with `email = "phone:"` and
 *      `phone = "accepted_on: …"`, which is a header and a field name landing
 *      in the wrong columns. The junk is cleared and the row is archived,
 *      because a LinkedIn URL is still a way to reach someone by hand but an
 *      email that is the word "phone:" is not.
 *
 *   2. A space inside an address (`…@gm ail.com`). Repaired rather than
 *      deleted: the intent is unambiguous and the person is real.
 *
 *   3. Typo duplicates. Someone who mistyped their address, noticed, and
 *      registered again leaves two rows, one of which bounces every email we
 *      will ever send it. Only reported here, never auto-deleted: "these two
 *      are the same person" is a judgement, and the board has a Delete button
 *      for it now.
 *
 * Dry run by default. Pass --apply to write.
 */
import { PrismaClient } from '@prisma/client';

const apply = process.argv.includes('--apply');
const VALID = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/** Endings that are only ever a slip of the finger off a real TLD. */
const TYPO_TLDS = ['.con', '.cim', '.comm', '.co,', '.vom', '.xom'];

async function main() {
  const prisma = new PrismaClient();
  const leads = await prisma.salesLead.findMany({
    select: { id: true, name: true, email: true, phone: true, linkedinUrl: true },
  });

  const spaced: { id: string; name: string; from: string; to: string }[] = [];
  const junk: { id: string; name: string; email: string | null; phone: string | null }[] = [];

  for (const l of leads) {
    if (!l.email) continue;
    const squashed = l.email.replace(/\s+/g, '');
    if (l.email !== squashed && VALID.test(squashed)) {
      spaced.push({ id: l.id, name: l.name, from: l.email, to: squashed.toLowerCase() });
    } else if (!VALID.test(l.email)) {
      junk.push({ id: l.id, name: l.name, email: l.email, phone: l.phone });
    }
  }

  // Reported only. Deleting the wrong half of a pair is not recoverable.
  const typos = leads.filter((l) => l.email && TYPO_TLDS.some((t) => l.email!.toLowerCase().endsWith(t)));

  console.log(`\n1. ${junk.length} lead(s) whose email is not an email (clearing it and archiving):`);
  for (const j of junk) console.log(`   "${j.name}" email=${JSON.stringify(j.email)} phone=${JSON.stringify(j.phone)}`);

  console.log(`\n2. ${spaced.length} address(es) with a space in them (repairing):`);
  for (const s of spaced) console.log(`   "${s.name}" ${s.from} -> ${s.to}`);

  console.log(`\n3. ${typos.length} address(es) that look like a mistyped TLD (report only, delete from the board if it is a duplicate):`);
  for (const t of typos) console.log(`   "${t.name}" <${t.email}>`);

  if (!apply) {
    console.log('\nDry run. Nothing written. Re-run with --apply.');
    await prisma.$disconnect();
    return;
  }

  for (const s of spaced) {
    // A collision means the corrected address is already on the board, which is
    // a merge rather than a rename and is not this script's call to make.
    const clash = await prisma.salesLead.findUnique({ where: { email: s.to }, select: { id: true } });
    if (clash && clash.id !== s.id) {
      console.log(`   skipped "${s.name}": ${s.to} is already another lead. Merge by hand.`);
      continue;
    }
    await prisma.salesLead.update({ where: { id: s.id }, data: { email: s.to } });
  }
  for (const j of junk) {
    const phoneIsJunk = !j.phone || !/\d/.test(j.phone);
    await prisma.salesLead.update({
      where: { id: j.id },
      data: { email: null, archived: true, ...(phoneIsJunk ? { phone: null } : {}) },
    });
  }
  console.log(`\nRepaired ${spaced.length} address(es), cleared and archived ${junk.length}. Typos left for you.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
