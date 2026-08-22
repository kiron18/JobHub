/**
 * Wipe one person's story intake so it can be started again from scratch.
 *
 *   npx tsx src/scripts/reset_answer_bank.ts kiron182@gmail.com
 *   npx tsx src/scripts/reset_answer_bank.ts kiron182@gmail.com --yes
 *
 * This exists because the local server talks to the production database, so
 * "let me just start over" is a real delete against a real row, not a local
 * reset. It therefore refuses to run without naming exactly whose intake it is
 * about to destroy, prints what it found, and asks before doing anything.
 *
 * Scope is deliberately narrow. It deletes the AnswerBankIntake and its
 * entries, and touches NOTHING else: not the resume, not the profile, not the
 * applications. A reset script that quietly widens its blast radius is how a
 * test run turns into an incident.
 */
import { PrismaClient } from '@prisma/client';
import readline from 'node:readline/promises';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith('--'));
  const skipPrompt = args.includes('--yes');

  if (!email) {
    console.error('Usage: npx tsx src/scripts/reset_answer_bank.ts <email> [--yes]');
    process.exit(1);
  }

  const profile = await prisma.candidateProfile.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, userId: true, name: true, email: true },
  });

  if (!profile) {
    console.error(`No profile found for ${email}. Nothing was changed.`);
    process.exit(1);
  }

  const intake = await prisma.answerBankIntake.findUnique({
    where: { candidateProfileId: profile.id },
    include: { entries: true },
  });

  if (!intake) {
    console.log(`${profile.name || profile.email} has no intake to reset. Nothing to do.`);
    return;
  }

  const approved = intake.entries.filter((e) => e.approvedAt).length;
  const spoken = intake.entries.filter((e) => e.spoken).length;

  console.log('');
  console.log(`  Person    ${profile.name || '(no name)'}  <${profile.email}>`);
  console.log(`  Started   ${intake.startedAt.toISOString().slice(0, 16).replace('T', ' ')}`);
  console.log(`  Answers   ${intake.entries.length} touched, ${spoken} with words in them, ${approved} confirmed`);
  console.log('');
  console.log('  This deletes the intake and every answer in it, permanently.');
  console.log('  The resume, the profile and everything else are left alone.');
  console.log('');

  if (!skipPrompt) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`  Type the email again to confirm: `);
    rl.close();
    if (answer.trim().toLowerCase() !== profile.email!.toLowerCase()) {
      console.log('\n  Did not match. Nothing was changed.');
      return;
    }
  }

  // Entries cascade from the intake, but they are deleted explicitly so the
  // count printed below is the real number of rows removed rather than a guess.
  const removed = await prisma.$transaction(async (tx) => {
    const entries = await tx.answerBankEntry.deleteMany({ where: { intakeId: intake.id } });
    await tx.answerBankIntake.delete({ where: { id: intake.id } });
    return entries.count;
  });

  console.log(`\n  Done. Removed the intake and ${removed} answers. Start again at /answer-bank.\n`);
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
