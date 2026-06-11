import type { PrismaClient } from '@prisma/client';

/**
 * Seed default tags used for contact classification.
 * Matches the spec: signed_up, cv_scanned, cv_fixed, sales_call_booked,
 * sales_call_completed, hot_lead, client.
 * Uses upsert so it's safe to call on every boot.
 */
export async function seedTags(prisma: PrismaClient): Promise<void> {
  const tags = [
    { name: 'signed_up', label: 'Signed Up' },
    { name: 'cv_scanned', label: 'CV Scanned' },
    { name: 'cv_fixed', label: 'CV Fixed' },
    { name: 'sales_call_booked', label: 'Sales Call Booked' },
    { name: 'sales_call_completed', label: 'Sales Call Completed' },
    { name: 'hot_lead', label: 'Hot Lead' },
    { name: 'client', label: 'Client' },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: { label: tag.label },
      create: tag,
    });
  }

  console.log(`[seedTags] seeded ${tags.length} default tags`);
}

/**
 * Seed default email templates used by automated sequences.
 * Uses upsert on name so it's safe to call on every boot.
 */
export async function seedTemplates(prisma: PrismaClient): Promise<void> {
  const templates = [
    {
      name: 'welcome_step0',
      subject: 'Welcome to Aussie Grad Careers',
      bodyText: 'Welcome aboard!\n\nGet started by optimising your resume and finding the right roles.',
    },
    {
      name: 'cv_scan_followup_day3',
      subject: 'Your CV roadmap — 3 day check-in',
      bodyText: "Hi,\n\nIt's been a few days since your CV scan. Have you started on the first fix?",
    },
  ];

  for (const tpl of templates) {
    await prisma.emailTemplate.upsert({
      where: { name: tpl.name },
      update: { subject: tpl.subject, bodyText: tpl.bodyText },
      create: tpl,
    });
  }

  console.log(`[seedTemplates] seeded ${templates.length} email templates`);
}

/**
 * Seed default email sequences with priority-based nurture funnel.
 * Priority scale: 1=highest (client_onboarding), 4=lowest (welcome_sequence).
 * Uses upsert on sequence name so it's safe to call on every boot.
 */
export async function seedSequences(prisma: PrismaClient): Promise<void> {
  // welcome_sequence: priority 4 (lowest nurture)
  const welcomeSeq = await prisma.emailSequence.upsert({
    where: { name: 'welcome_sequence' },
    update: { description: 'Welcome drip for new signups', priority: 4, active: true },
    create: { name: 'welcome_sequence', description: 'Welcome drip for new signups', priority: 4, active: true },
  });
  await seedStep(prisma, welcomeSeq.id, 0, 0, 'welcome_step0');

  // cv_scan_followup: priority 3
  const cvSeq = await prisma.emailSequence.upsert({
    where: { name: 'cv_scan_followup' },
    update: { description: 'Follow-up sequence after CV scan', priority: 3, active: true },
    create: { name: 'cv_scan_followup', description: 'Follow-up sequence after CV scan', priority: 3, active: true },
  });
  await seedStep(prisma, cvSeq.id, 0, 3, 'cv_scan_followup_day3');

  // sales_nurture: priority 2
  await prisma.emailSequence.upsert({
    where: { name: 'sales_nurture' },
    update: { description: 'Nurture sequence for sales call booked contacts', priority: 2, active: true },
    create: { name: 'sales_nurture', description: 'Nurture sequence for sales call booked contacts', priority: 2, active: true },
  });

  // client_onboarding: priority 1 (highest)
  await prisma.emailSequence.upsert({
    where: { name: 'client_onboarding' },
    update: { description: 'Onboarding sequence for paying clients', priority: 1, active: true },
    create: { name: 'client_onboarding', description: 'Onboarding sequence for paying clients', priority: 1, active: true },
  });

  console.log('[seedSequences] seeded sequences');
}

async function seedStep(prisma: PrismaClient, sequenceId: string, stepOrder: number, delayDays: number, templateName: string): Promise<void> {
  const template = await prisma.emailTemplate.findUnique({ where: { name: templateName } });
  if (!template) {
    console.warn(`[seedSequences] template "${templateName}" not found, skipping step`);
    return;
  }

  try {
    await prisma.sequenceStep.upsert({
      where: { sequenceId_stepOrder: { sequenceId, stepOrder } },
      update: { delayDays, templateId: template.id },
      create: { sequenceId, stepOrder, delayDays, templateId: template.id },
    });
  } catch {
    // Race condition on concurrent seed — safe to ignore
  }
}
