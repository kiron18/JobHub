/**
 * /api/feedback
 *
 * POST /document   Submit a star rating + optional weak-section + free text for a generated document.
 *
 * Ownership is verified server-side — client never supplies documentType (derived from DB record).
 */
import { Router } from 'express';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';

const router = Router();

// Valid weak-section values per document type — prevents arbitrary strings being stored
const WEAK_SECTIONS: Record<string, string[]> = {
    RESUME:             ['opening', 'evidence', 'overall'],
    COVER_LETTER:       ['opening', 'evidence', 'company_connection', 'closing', 'overall'],
    STAR_RESPONSE:      ['star_situation', 'star_action', 'star_result', 'evidence', 'overall'],
    SELECTION_CRITERIA: ['criterion_address', 'evidence_quality', 'word_count', 'star_proportion', 'overall'],
};

router.post('/document', authenticate, async (req: any, res: any) => {
    const userId = req.user.id;
    const { documentId, rating, weakSection, freeText } = req.body;

    if (!documentId || typeof documentId !== 'string') {
        return res.status(400).json({ error: 'documentId is required.' });
    }
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'rating must be an integer 1–5.' });
    }

    // Fetch document for ownership check + type derivation
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) {
        return res.status(404).json({ error: 'Document not found.' });
    }
    if (document.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden.' });
    }

    // Validate weakSection if provided
    if (weakSection != null) {
        const valid = WEAK_SECTIONS[document.type] ?? [];
        if (!valid.includes(weakSection)) {
            return res.status(400).json({ error: `Invalid weakSection for ${document.type}.` });
        }
    }

    try {
        await prisma.documentFeedback.create({
            data: {
                documentId,
                userId,
                rating: Math.round(rating),
                documentType: document.type,
                weakSection: weakSection ?? null,
                freeText: typeof freeText === 'string' ? freeText.slice(0, 500) : null,
            },
        });

        return res.json({ success: true });
    } catch (err: any) {
        console.error('[Feedback] Error:', err.message);
        return res.status(500).json({ error: 'Failed to save feedback.' });
    }
});

export default router;
