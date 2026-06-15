import { prisma } from '../../index';

// ---------------------------------------------------------------------------
// TAG → Sequence mapping
// ---------------------------------------------------------------------------
// Priority scale (defined in seed data): 1 = highest, 4 = lowest.
//   client_onboarding  -> priority 1
//   sales_nurture      -> priority 2
//   cv_scan_followup   -> priority 3
//   welcome_sequence   -> priority 4
//
// When a tag is assigned that has cleanupTags, any existing ContactTag rows
// for those tag names are removed first — this keeps the contact's tag set
// clean as they progress through the funnel.
// ---------------------------------------------------------------------------

const TAG_SEQUENCE_MAP: Record<string, { sequenceName: string; cleanupTags?: string[] }> = {
  signed_up:         { sequenceName: 'welcome_sequence' },
  cv_scanned:        { sequenceName: 'cv_scan_followup' },
  sales_call_booked: { sequenceName: 'sales_nurture' },
  client:            { sequenceName: 'client_onboarding', cleanupTags: ['sales_call_booked', 'sales_call_completed', 'hot_lead'] },
};

// ---------------------------------------------------------------------------
// handleTagAssigned
// ---------------------------------------------------------------------------

export async function handleTagAssigned(contactId: string, tagName: string): Promise<void> {
  const mapping = TAG_SEQUENCE_MAP[tagName];
  if (!mapping) {
    // Tag is not mapped to any sequence — no-op.
    return;
  }

  // If the mapping defines cleanup tags, remove all ContactTag rows for those tags
  // on this contact.
  if (mapping.cleanupTags && mapping.cleanupTags.length > 0) {
    const tagsToClean = await prisma.tag.findMany({
      where: { name: { in: mapping.cleanupTags } },
      select: { id: true },
    });

    if (tagsToClean.length > 0) {
      await prisma.contactTag.deleteMany({
        where: {
          contactId,
          tagId: { in: tagsToClean.map(t => t.id) },
        },
      });
    }
  }

  await enrollInSequence(contactId, mapping.sequenceName);
}

// ---------------------------------------------------------------------------
// enrollInSequence
// ---------------------------------------------------------------------------

export async function enrollInSequence(contactId: string, sequenceName: string): Promise<void> {
  // 1. Fetch the EmailSequence by name; bail if not found or not active.
  const sequence = await prisma.emailSequence.findUnique({
    where: { name: sequenceName },
  });

  if (!sequence) {
    console.warn(`[enrollInSequence] Sequence "${sequenceName}" not found — skipping`);
    return;
  }

  if (!sequence.active) {
    console.warn(`[enrollInSequence] Sequence "${sequenceName}" is not active — skipping`);
    return;
  }

  // 2. Check for existing active enrollment for this contact + sequence.
  const existingEnrollment = await prisma.contactSequence.findUnique({
    where: {
      contactId_sequenceId: { contactId, sequenceId: sequence.id },
    },
  });

  if (existingEnrollment && !existingEnrollment.completed && existingEnrollment.unenrolledAt === null) {
    // Already enrolled and active — no-op.
    return;
  }

  // 3. Find all currently active sequences for this contact.
  const activeSequences = await prisma.contactSequence.findMany({
    where: {
      contactId,
      completed: false,
      unenrolledAt: null,
    },
    include: {
      sequence: true,
    },
  });

  // 4. Compare priorities: if any active sequence has a LOWER priority number
  //    (higher priority), do NOT enroll the new one.
  const hasHigherPriorityActive = activeSequences.some(cs => cs.sequence.priority < sequence.priority);
  if (hasHigherPriorityActive) {
    console.warn(
      `[enrollInSequence] Contact ${contactId} already has a higher-priority sequence active — ` +
      `not enrolling into "${sequenceName}"`
    );
    return;
  }

  // 5. For active sequences with HIGHER priority number (lower priority than
  //    new one), unenroll them.
  const lowerPriorityActive = activeSequences.filter(cs => cs.sequence.priority > sequence.priority);
  for (const cs of lowerPriorityActive) {
    await prisma.contactSequence.update({
      where: { id: cs.id },
      data: {
        completed: true,
        unenrolledAt: new Date(),
        unenrolledReason: 'upgraded_sequence',
      },
    });
  }

  // 6 & 7. Create or reset the ContactSequence row.
  if (existingEnrollment) {
    // Re-enrolling a previously completed/unenrolled enrollment — reset it.
    await prisma.contactSequence.update({
      where: { id: existingEnrollment.id },
      data: {
        currentStep: 0,
        completed: false,
        lastStepSentAt: null,
        enrolledAt: new Date(),
        unenrolledAt: null,
        unenrolledReason: null,
        completedAt: null,
      },
    });
  } else {
    // Fresh enrollment.
    await prisma.contactSequence.create({
      data: {
        contactId,
        sequenceId: sequence.id,
      },
    });
  }

  // 8. Update Contact.lastActivityAt.
  await prisma.contact.update({
    where: { id: contactId },
    data: { lastActivityAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// unenrollFromSequence
// ---------------------------------------------------------------------------

export async function unenrollFromSequence(contactId: string, sequenceName: string, reason?: string): Promise<void> {
  const sequence = await prisma.emailSequence.findUnique({
    where: { name: sequenceName },
  });

  if (!sequence) {
    console.warn(`[unenrollFromSequence] Sequence "${sequenceName}" not found — skipping`);
    return;
  }

  await prisma.contactSequence.updateMany({
    where: {
      contactId,
      sequenceId: sequence.id,
      completed: false,
      unenrolledAt: null,
    },
    data: {
      completed: true,
      unenrolledAt: new Date(),
      unenrolledReason: reason ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// unenrollFromAllSequences
// ---------------------------------------------------------------------------

export async function unenrollFromAllSequences(contactId: string, reason?: string): Promise<void> {
  await prisma.contactSequence.updateMany({
    where: {
      contactId,
      completed: false,
      unenrolledAt: null,
    },
    data: {
      completed: true,
      unenrolledAt: new Date(),
      unenrolledReason: reason ?? null,
    },
  });
}
