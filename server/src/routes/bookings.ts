import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { extractTextFromBuffer } from '../services/pdf';

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
        resumeText: resumeText || null,
        // Reset synced flag if they resubmit so a fresh card is generated
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
      },
    });

    console.log(`[bookings/intake] stored intake for ${email} (id=${intake.id})`);
    return res.json({ ok: true, id: intake.id });
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
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = cards.map(c => ({
      id: c.id,
      filename: buildFilename(c.name, c.callScheduledAt ?? c.createdAt),
      content: c.battleCard!,
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

function buildFilename(name: string, date: Date): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const safe = name.replace(/[^a-zA-Z0-9 -]/g, '').trim();
  return `${yyyy}-${mm}-${dd} — ${safe}.md`;
}

export default router;
