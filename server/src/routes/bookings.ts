import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { extractTextFromBuffer } from '../services/pdf';
import { sendBookingIntakeNotification } from '../services/email';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF and DOCX files are accepted'));
  },
});

// POST /api/bookings/intake
// Public — called from the /book-a-call intake form before the user lands on Calendly.
router.post('/intake', upload.single('resume'), async (req, res) => {
  const { name, email, linkedinUrl, currentRole, targetRole, visaStatus, biggestChallenge } =
    req.body as {
      name?: string;
      email?: string;
      linkedinUrl?: string;
      currentRole?: string;
      targetRole?: string;
      visaStatus?: string;
      biggestChallenge?: string;
    };

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  let resumeText: string | undefined;
  if (req.file) {
    try {
      resumeText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch {
      // Non-fatal — proceed without resume text
    }
  }

  // Keep the original file, even when text extraction failed: a resume we
  // could not parse is still one Kiron can open and read before the call.
  const fileFields = req.file
    ? { resumeFile: new Uint8Array(req.file.buffer), resumeFilename: req.file.originalname, resumeMime: req.file.mimetype }
    : {};

  try {
    const intake = await prisma.bookingIntake.upsert({
      where: { email: email.toLowerCase().trim() },
      update: {
        name: name.trim(),
        linkedinUrl: linkedinUrl?.trim() || null,
        currentRole: currentRole?.trim() || null,
        targetRole: targetRole?.trim() || null,
        visaStatus: visaStatus?.trim() || null,
        biggestChallenge: biggestChallenge?.trim() || null,
        // Only overwrite resumeText if a new file was actually uploaded
        ...(resumeText ? { resumeText } : {}),
        ...fileFields,
        // Changed since the CRM last saw it, so hand it over again
        crmSyncedAt: null,
        // Reset battle card so it regenerates with the latest data
        obsidianSynced: false,
        battleCard: null,
        battleCardAt: null,
      },
      create: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        linkedinUrl: linkedinUrl?.trim() || null,
        currentRole: currentRole?.trim() || null,
        targetRole: targetRole?.trim() || null,
        visaStatus: visaStatus?.trim() || null,
        biggestChallenge: biggestChallenge?.trim() || null,
        resumeText: resumeText || null,
        ...fileFields,
      },
      // Never read the file bytes back just to learn the id
      select: { id: true },
    });

    console.log(`[bookings/intake] stored intake for ${email} (id=${intake.id})`);
    res.json({ ok: true, id: intake.id });

    // After the response: the visitor is already on Calendly, and a mail
    // problem must never be the reason an intake looks like it failed.
    sendBookingIntakeNotification({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      visaStatus: visaStatus?.trim() || null,
      biggestChallenge: biggestChallenge?.trim() || null,
      resume: req.file ? { filename: req.file.originalname, content: req.file.buffer } : null,
      resumeReadable: !!resumeText,
    }).catch(err => console.error('[bookings/intake] notification failed:', err));
    return;
  } catch (err) {
    console.error('[bookings/intake] DB error:', err);
    return res.status(500).json({ error: 'Failed to store intake' });
  }
});

// GET /api/bookings/ready-cards
// Private — called by the local obsidian-sync.js script.
// Returns battle cards that haven't been written to Obsidian yet.
router.get('/ready-cards', async (req, res) => {
  const key = req.headers['x-obsidian-sync-key'];
  if (!key || key !== process.env.OBSIDIAN_SYNC_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const cards = await prisma.bookingIntake.findMany({
      where: { battleCard: { not: null }, obsidianSynced: false },
      select: {
        id: true,
        name: true,
        email: true,
        callScheduledAt: true,
        battleCard: true,
        resumeText: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = cards.map(c => ({
      id: c.id,
      clientName: c.name,
      folderDate: buildDatePrefix(c.callScheduledAt ?? c.createdAt),
      battleCard: c.battleCard!,
      resumeText: c.resumeText ?? null,
    }));

    return res.json(result);
  } catch (err) {
    console.error('[bookings/ready-cards] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// PATCH /api/bookings/ready-cards/:id/ack
// Called by the local script after successfully writing the file.
router.patch('/ready-cards/:id/ack', async (req, res) => {
  const key = req.headers['x-obsidian-sync-key'];
  if (!key || key !== process.env.OBSIDIAN_SYNC_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    await prisma.bookingIntake.update({
      where: { id: req.params.id },
      data: { obsidianSynced: true },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[bookings/ack] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/bookings/crm-pending
// Private, called by the local sales CRM (Daekwon/crm/booking_sync.py).
// Returns intakes the CRM has not picked up yet, original resume file included.
router.get('/crm-pending', async (req, res) => {
  const key = req.headers['x-obsidian-sync-key'];
  if (!key || key !== process.env.OBSIDIAN_SYNC_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const rows = await prisma.bookingIntake.findMany({
      where: { crmSyncedAt: null },
      orderBy: { createdAt: 'asc' },
      // Small batches: each row can carry a 5 MB file
      take: 10,
    });

    return res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      linkedinUrl: r.linkedinUrl,
      visaStatus: r.visaStatus,
      biggestChallenge: r.biggestChallenge,
      callScheduledAt: r.callScheduledAt ? r.callScheduledAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      resumeFilename: r.resumeFile ? (r.resumeFilename || 'resume') : null,
      resumeBase64: r.resumeFile ? Buffer.from(r.resumeFile).toString('base64') : null,
      // Rows from before the file was kept only have the extracted text
      resumeText: r.resumeFile ? null : r.resumeText,
    })));
  } catch (err) {
    console.error('[bookings/crm-pending] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// PATCH /api/bookings/crm-pending/:id/ack
// Called by the CRM once the lead is written. The CRM sends back the call time
// it saw: if a booking landed in between, the row stays pending and the next
// poll carries the call time across.
router.patch('/crm-pending/:id/ack', async (req, res) => {
  const key = req.headers['x-obsidian-sync-key'];
  if (!key || key !== process.env.OBSIDIAN_SYNC_KEY) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const seen = (req.body?.callScheduledAt as string | null | undefined) || null;
  try {
    const result = await prisma.bookingIntake.updateMany({
      where: { id: req.params.id, callScheduledAt: seen ? new Date(seen) : null },
      data: { crmSyncedAt: new Date() },
    });
    return res.json({ ok: true, acked: result.count === 1 });
  } catch (err) {
    console.error('[bookings/crm-ack] error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

function buildDatePrefix(date: Date): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default router;
