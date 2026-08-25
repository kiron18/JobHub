/**
 * Editing the bank — `profile.resumeRawText`.
 *
 * This is the field generate.ts reads for every resume and cover letter, so
 * these routes are the only ones whose changes actually reach future
 * generations. Writing anywhere else would leave the edit hanging in the air.
 *
 * Deliberately NOT a return to structured editing. The mutation routes for
 * achievements/experience/education were removed in June because extraction
 * into rows dropped content. Nothing here re-extracts or regenerates: every
 * operation is a string change to one line of the document, verified by
 * bankEdit to have touched nothing else, with a ResumeVersion snapshot taken
 * before the write so any mistake is one click back.
 */
import { Router, Response } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import {
  replaceLine, insertLine, removeLine, replaceDocument, describeEdit, BankEditResult,
} from '../../services/bankEdit';
import { assertResumeSource, ResumeSourceCheck } from '../../lib/resumeSourceGate';

const router = Router();

/** Snapshots kept per user. Enough to undo a bad session, not unbounded. */
const MAX_VERSIONS = 20;

async function loadBank(userId: string) {
  return prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true, resumeRawText: true, resumeOriginalText: true },
  });
}

/**
 * Saves the new document, snapshotting the previous one first. The snapshot is
 * taken inside the same transaction as the write, so an undo point can never be
 * missing for a change that landed.
 */
async function commit(
  userId: string,
  profileId: string,
  previous: string,
  next: string,
  label: string,
  sources: (string | null)[] = [],
): Promise<ResumeSourceCheck> {
  // The gate on resumeRawText, human mode. A candidate may legitimately add a
  // real figure the original document never mentioned, so this never blocks the
  // edit; it returns the figures we could not find a source for, so the UI can
  // ask them to confirm rather than letting an unverifiable claim become the
  // truth every future application is graded against. Length and placeholders
  // still throw: those are defects, not claims.
  const check = assertResumeSource(
    next,
    [previous, ...sources.filter((x): x is string => !!x)],
    'human',
    'bank/edit',
  );

  await prisma.$transaction(async (tx) => {
    await tx.resumeVersion.create({
      data: { userId, candidateProfileId: profileId, label, rawText: previous },
    });

    await tx.candidateProfile.update({
      where: { userId },
      data: { resumeRawText: next, documentsUpdatedAt: new Date() },
    });

    const stale = await tx.resumeVersion.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_VERSIONS,
      select: { id: true },
    });
    if (stale.length) {
      await tx.resumeVersion.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
  });

  return check;
}

/** Shared handling so every edit route behaves identically on failure. */
async function applyEdit(
  req: AuthRequest,
  res: Response,
  label: string,
  edit: (doc: string) => BankEditResult,
) {
  const userId = req.user!.id;
  const profile = await loadBank(userId);

  if (!profile?.resumeRawText) {
    res.status(409).json({ error: 'You do not have a resume saved yet.' });
    return;
  }

  const previous = profile.resumeRawText;
  const result = edit(previous);

  if (!result.ok) {
    // 409, not 400: the request was well formed, the document had moved on.
    res.status(409).json({ error: result.message, failure: result.failure });
    return;
  }

  const check = await commit(
    userId, profile.id, previous, result.text, label, [profile.resumeOriginalText],
  );

  res.json({
    ok: true,
    text: result.text,
    summary: describeEdit(previous, result.text),
    // Figures we could not trace to their original resume. Not an error: the
    // client asks them to confirm each one before it is relied on.
    unverifiedFigures: check.ungroundedFigures,
  });
}

// ── GET /api/profile/bank ────────────────────────────────────────────────────
// The document itself. Nothing in the app exposed this before, which is how 155
// profiles went unlooked-at.
router.get('/profile/bank', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profile = await loadBank(req.user!.id);
    const text = profile?.resumeRawText ?? '';
    const versions = profile
      ? await prisma.resumeVersion.count({ where: { userId: req.user!.id } })
      : 0;
    res.json({ text, hasBank: text.length > 0, versions });
  } catch (err) {
    console.error('[profile/bank] read failed:', err);
    res.status(500).json({ error: 'Could not load your bank.' });
  }
});

// ── PUT /api/profile/bank ────────────────────────────────────────────────────
// Whole-document edit — the candidate edits their bank as one piece of text.
// This is the primary path: simpler to use and to reason about than per-line
// operations, and the snapshot makes any mistake one click away from undone.
router.put('/profile/bank', authenticate, async (req: AuthRequest, res: Response) => {
  const { text } = req.body || {};
  if (typeof text !== 'string') {
    res.status(400).json({ error: 'text is required.' });
    return;
  }

  const userId = req.user!.id;
  try {
    const profile = await loadBank(userId);
    if (!profile) { res.status(409).json({ error: 'No profile found.' }); return; }

    const previous = profile.resumeRawText ?? '';
    const result = replaceDocument(previous, text);

    if (!result.ok) {
      res.status(409).json({ error: result.message, failure: result.failure });
      return;
    }
    if (result.text === previous) {
      res.json({ ok: true, text: previous, summary: 'No change.' });
      return;
    }

    const check = await commit(
      userId, profile.id, previous, result.text, 'Before editing your bank',
      [profile.resumeOriginalText],
    );

    const c = result.change!;
    const parts: string[] = [];
    if (c.linesAdded) parts.push(`${c.linesAdded} line${c.linesAdded === 1 ? '' : 's'} added`);
    if (c.linesRemoved) parts.push(`${c.linesRemoved} line${c.linesRemoved === 1 ? '' : 's'} removed`);

    res.json({
      ok: true,
      text: result.text,
      summary: parts.length ? `Saved. ${parts.join(', ')}.` : 'Saved.',
      warning: c.warning ?? null,
      unverifiedFigures: check.ungroundedFigures,
    });
  } catch (err) {
    console.error('[profile/bank] save failed:', err);
    res.status(500).json({ error: 'Could not save your bank.' });
  }
});

// ── PATCH /api/profile/bank/line ─────────────────────────────────────────────
// Fix a line: a wrong figure, clumsy wording.
router.patch('/profile/bank/line', authenticate, async (req: AuthRequest, res: Response) => {
  const { before, after } = req.body || {};
  if (typeof before !== 'string' || typeof after !== 'string') {
    res.status(400).json({ error: 'before and after are required.' });
    return;
  }
  try {
    await applyEdit(req, res, `Before editing a line`, (doc) => replaceLine(doc, before, after));
  } catch (err) {
    console.error('[profile/bank] edit failed:', err);
    res.status(500).json({ error: 'Could not save your change.' });
  }
});

// ── POST /api/profile/bank/line ──────────────────────────────────────────────
// Add something new. `afterLine` places it under the right role rather than at
// the end of the document.
router.post('/profile/bank/line', authenticate, async (req: AuthRequest, res: Response) => {
  const { line, afterLine } = req.body || {};
  if (typeof line !== 'string') {
    res.status(400).json({ error: 'line is required.' });
    return;
  }
  try {
    await applyEdit(req, res, `Before adding a line`, (doc) =>
      insertLine(doc, line, typeof afterLine === 'string' ? afterLine : null));
  } catch (err) {
    console.error('[profile/bank] add failed:', err);
    res.status(500).json({ error: 'Could not add that line.' });
  }
});

// ── POST /api/profile/bank/line/delete ───────────────────────────────────────
// A POST rather than DELETE because the target is a line of text, not an id,
// and request bodies on DELETE are poorly supported.
router.post('/profile/bank/line/delete', authenticate, async (req: AuthRequest, res: Response) => {
  const { line } = req.body || {};
  if (typeof line !== 'string') {
    res.status(400).json({ error: 'line is required.' });
    return;
  }
  try {
    await applyEdit(req, res, `Before removing a line`, (doc) => removeLine(doc, line));
  } catch (err) {
    console.error('[profile/bank] delete failed:', err);
    res.status(500).json({ error: 'Could not remove that line.' });
  }
});

// ── POST /api/profile/bank/undo ──────────────────────────────────────────────
// Restores the most recent snapshot. The current text is snapshotted first, so
// undo is itself undoable.
router.post('/profile/bank/undo', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const profile = await loadBank(userId);
    if (!profile) { res.status(409).json({ error: 'No profile found.' }); return; }

    const last = await prisma.resumeVersion.findFirst({
      where: { userId, rawText: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, rawText: true },
    });
    if (!last?.rawText) {
      res.status(409).json({ error: 'There is nothing to undo.' });
      return;
    }

    // An undo restores a document that already passed the gate on its way in,
    // so it is grounded against itself and can only trip the structural checks.
    await commit(
      userId, profile.id, profile.resumeRawText ?? '', last.rawText, 'Before undo',
      [last.rawText, profile.resumeOriginalText],
    );
    await prisma.resumeVersion.delete({ where: { id: last.id } });

    res.json({ ok: true, text: last.rawText, summary: 'Undone.' });
  } catch (err) {
    console.error('[profile/bank] undo failed:', err);
    res.status(500).json({ error: 'Could not undo.' });
  }
});

export default router;
