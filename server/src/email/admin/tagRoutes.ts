import { Router } from 'express';
import type { Response, NextFunction } from 'express';
import { prisma } from '../../index';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { handleTagAssigned } from '../engine/enrollment';

const router = Router();

router.use(authenticate);

// GET /admin/tags — List all tags (ordered by name asc)
router.get('/admin/tags', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
    });
    return res.json({ tags });
  } catch (err) {
    console.error('[tagRoutes] GET /admin/tags error:', err);
    return res.status(500).json({ error: 'Failed to list tags' });
  }
});

// POST /admin/contacts/:contactId/tags — Assign tag to contact
router.post('/admin/contacts/:contactId/tags', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tagId } = req.body;

    if (!tagId || typeof tagId !== 'string') {
      return res.status(400).json({ error: 'tagId is required' });
    }

    // Validate tag exists
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    await prisma.contactTag.upsert({
      where: {
        contactId_tagId: { contactId: req.params.contactId as string, tagId },
      },
      create: { contactId: req.params.contactId as string, tagId },
      update: {},
    });

    await prisma.contact.update({
      where: { id: req.params.contactId as string },
      data: { lastActivityAt: new Date() },
    });

    // Fire enrollment logic
    handleTagAssigned(req.params.contactId as string, tag.name).catch((err) => {
      console.error(`[tagRoutes] handleTagAssigned failed for contact ${req.params.contactId as string}, tag ${tag.name}:`, err);
    });

    return res.status(201).json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Contact not found' });
    }
    console.error('[tagRoutes] POST /admin/contacts/:contactId/tags error:', err);
    return res.status(500).json({ error: 'Failed to assign tag' });
  }
});

// DELETE /admin/contacts/:contactId/tags/:tagId — Remove tag from contact
router.delete('/admin/contacts/:contactId/tags/:tagId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.contactTag.delete({
      where: {
        contactId_tagId: {
          contactId: req.params.contactId as string,
          tagId: req.params.tagId as string,
        },
      },
    });

    await prisma.contact.update({
      where: { id: req.params.contactId as string },
      data: { lastActivityAt: new Date() },
    });

    return res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return res.status(404).json({ error: 'Contact or tag assignment not found' });
    }
    console.error('[tagRoutes] DELETE /admin/contacts/:contactId/tags/:tagId error:', err);
    return res.status(500).json({ error: 'Failed to remove tag' });
  }
});

export default router;
