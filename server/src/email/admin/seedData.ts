import type { PrismaClient } from '@prisma/client';

/**
 * Seed default tags used for contact classification.
 * Uses upsert so it's safe to call on every boot.
 */
export async function seedTags(prisma: PrismaClient): Promise<void> {
  const tags = [
    { name: 'cv-scan-lead', label: 'CV Scan Lead' },
    { name: 'diy-job-seeker', label: 'DIY Job Seeker' },
    { name: 'coaching-prospect', label: 'Coaching Prospect' },
    { name: 'referred', label: 'Referred' },
    { name: 'high-intent', label: 'High Intent' },
    { name: 'paused', label: 'Paused / Do Not Contact' },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: tag,
    });
  }

  console.log(`[seedTags] seeded ${tags.length} default tags`);
}

/**
 * Seed default email templates used by the automated sequences.
 * Uses upsert on name so it's safe to call on every boot.
 */
export async function seedTemplates(prisma: PrismaClient): Promise<void> {
  const templates = [
    {
      name: 'welcome-cv-scan',
      subject: 'Your CV Scan Results Are Ready',
      bodyText: `Hi {{firstName}},

Thanks for trusting us with your CV. Here's what we found — and what's costing you callbacks.

[Link to scan report]

Cheers,
The Aussie Grad Careers Team`,
    },
    {
      name: 'day-3-follow-up',
      subject: 'Did you check your CV scan?',
      bodyText: `Hi {{firstName}},

Just a quick nudge — your free CV scan report is waiting. Most grads find at least 3 blind spots in their application.

[Link to scan report]

Cheers,
The Aussie Grad Careers Team`,
    },
    {
      name: 'day-7-educational',
      subject: 'The #1 mistake Aussie grads make on their resume',
      bodyText: `Hi {{firstName}},

Hope the scan was helpful. Here's a quick tip most grads miss: your resume needs to pass the 6-second test before it even gets read.

Want to make sure yours does?

[Link to resource or booking]

Cheers,
The Aussie Grad Careers Team`,
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
 * Seed default email sequences (CV scan follow-up nurture).
 * References templates by name. Uses upsert on sequence name.
 */
export async function seedSequences(prisma: PrismaClient): Promise<void> {
  // Define the sequence
  const sequenceName = 'cv-scan-nurture';
  const sequenceDesc = '3-step nurture sequence for new CV scan leads';

  // Upsert the sequence
  const sequence = await prisma.emailSequence.upsert({
    where: { name: sequenceName },
    update: { description: sequenceDesc, priority: 100, active: true },
    create: {
      name: sequenceName,
      description: sequenceDesc,
      priority: 100,
      active: true,
    },
  });

  // Map template names -> templates
  const templates = await prisma.emailTemplate.findMany({
    where: { name: { in: ['welcome-cv-scan', 'day-3-follow-up', 'day-7-educational'] } },
  });
  const templateByName = Object.fromEntries(templates.map((t) => [t.name, t.id]));

  // Define steps — delete existing and recreate to keep in sync
  await prisma.sequenceStep.deleteMany({ where: { sequenceId: sequence.id } });

  const steps = [
    { stepOrder: 0, delayDays: 0, templateName: 'welcome-cv-scan' },
    { stepOrder: 1, delayDays: 3, templateName: 'day-3-follow-up' },
    { stepOrder: 2, delayDays: 7, templateName: 'day-7-educational' },
  ];

  for (const step of steps) {
    const templateId = templateByName[step.templateName];
    if (!templateId) {
      console.warn(`[seedSequences] template "${step.templateName}" not found, skipping step`);
      continue;
    }
    await prisma.sequenceStep.create({
      data: {
        sequenceId: sequence.id,
        stepOrder: step.stepOrder,
        delayDays: step.delayDays,
        templateId,
      },
    });
  }

  console.log(`[seedSequences] seeded "${sequenceName}" with ${steps.length} steps`);
}
