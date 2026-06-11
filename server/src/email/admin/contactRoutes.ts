import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /admin/contacts — List contacts with search, pagination
router.get('/admin/contacts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastActivityAt: { sort: 'desc', nulls: 'last' } },
        include: {
          tags: {
            include: { tag: true },
          },
          sequences: {
            where: {
              completed: false,
              unenrolledAt: null,
            },
            include: {
              sequence: { select: { name: true } },
            },
          },
          emailSends: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: { sentAt: true, subject: true },
          },
          _count: {
            select: { emailSends: true },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return res.json({
      contacts: contacts.map((c) => ({
        ...c,
        lastEmailSent: c.emailSends[0] ?? null,
        emailSendCount: c._count.emailSends,
        emailSends: undefined,
        _count: undefined,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[contactRoutes] GET /admin/contacts error:', err);
    return res.status(500).json({ error: 'Failed to list contacts' });
  }
});

// GET /admin/contacts/:id — Get single contact with full details
router.get('/admin/contacts/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id as string },
      include: {
        tags: {
          include: { tag: true },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        sequences: {
          orderBy: { enrolledAt: 'desc' },
          include: {
            sequence: { select: { name: true, priority: true } },
          },
        },
        emailSends: {
          orderBy: { sentAt: 'desc' },
          take: 50,
          include: {
            sequence: { select: { name: true } },
            opens: { select: { openedAt: true } },
            clicks: { select: { url: true, clickedAt: true } },
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    return res.json({ contact });
  } catch (err) {
    console.error('[contactRoutes] GET /admin/contacts/:id error:', err);
    return res.status(500).json({ error: 'Failed to get contact' });
  }
});

// POST /admin/contacts — Create contact
router.post('/admin/contacts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, firstName, lastName, source, tagIds } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const contact = await prisma.contact.create({
      data: {
        email,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        source: source ?? 'manual',
        lastActivityAt: new Date(),
        ...(Array.isArray(tagIds) && tagIds.length > 0
          ? {
              tags: {
                create: tagIds.map((tagId: string) => ({ tagId })),
              },
            }
          : {}),
      },
      include: {
        tags: { include: { tag: true } },
      },
    });

    return res.status(201).json({ contact });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'A contact with this email already exists' });
    }
    console.error('[contactRoutes] POST /admin/contacts error:', err);
    return res.status(500).json({ error: 'Failed to create contact' });
  }
});

// PATCH /admin/contacts/:id — Update contact
router.patch('/admin/contacts/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, email, emailOptIn, source, metadata } = req.body;

    const data: Record<string, any> = { lastActivityAt: new Date() };
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (email !== undefined) data.email = email;
    if (emailOptIn !== undefined) data.emailOptIn = emailOptIn;
    if (source !== undefined) data.source = source;
    if (metadata !== undefined) data.metadata = metadata;

    const contact = await prisma.contact.update({
      where: { id: req.params.id as string },
      data,
      include: {
        tags: { include: { tag: true } },
      },
    });

    return res.json({ contact });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'A contact with this email already exists' });
    }
    console.error('[contactRoutes] PATCH /admin/contacts/:id error:', err);
    return res.status(500).json({ error: 'Failed to update contact' });
  }
});

// POST /admin/contacts/:id/notes — Add note to contact
router.post('/admin/contacts/:id/notes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    const [note] = await Promise.all([
      prisma.contactNote.create({
        data: {
        contactId: req.params.id as string,
          content,
        },
      }),
      prisma.contact.update({
        where: { id: req.params.id as string },
        data: { lastActivityAt: new Date() },
      }),
    ]);

    return res.status(201).json({ note });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    console.error('[contactRoutes] POST /admin/contacts/:id/notes error:', err);
    return res.status(500).json({ error: 'Failed to add note' });
  }
});

export default router;
