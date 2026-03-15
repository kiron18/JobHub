import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../index';
import { authenticate } from '../middleware/auth';
import { extractTextFromPDF } from '../services/pdf';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- Document Routes ---
router.get('/documents', authenticate, async (req, res) => {
    const userId = (req as any).user.id;
    try {
        const docs = await prisma.document.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(docs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

router.post('/documents', authenticate, async (req, res) => {
    const { title, content, type } = req.body;
    const userId = (req as any).user.id;
    try {
        const doc = await prisma.document.create({
            data: {
                title,
                content,
                type: type || 'RESUME',
                userId
            }
        });
        res.json(doc);
    } catch (error) {
        console.error('Save Document Error:', error);
        res.status(500).json({ error: 'Failed to save document' });
    }
});

router.post('/documents/upload', authenticate, upload.single('file'), async (req, res) => {
    const userId = (req as any).user.id;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let content = '';
        if (req.file.mimetype === 'application/pdf') {
            content = await extractTextFromPDF(req.file.buffer);
        } else {
            content = req.file.buffer.toString('utf-8');
        }

        const doc = await prisma.document.create({
            data: {
                title: req.file.originalname,
                content: content,
                type: 'RESUME',
                userId
            }
        });

        res.json({ success: true, document: doc });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to process file upload' });
    }
});

router.post('/tracker/finalize', authenticate, async (req, res) => {
    const { type, content, jobDescription, company, role } = req.body;
    const userId = (req as any).user.id;
    try {
        const profile = await prisma.candidateProfile.findUnique({
            where: { userId }
        });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        // 1. Create JobApplication
        const jobApp = await prisma.jobApplication.create({
            data: {
                candidateProfileId: profile.id,
                title: role || 'Unknown Role',
                company: company || 'Unknown Company',
                description: jobDescription,
                status: 'SAVED',
                userId
            }
        });

        // 2. Map frontend type to Prisma enum DocumentType
        let docType: any = 'RESUME';
        if (type === 'cover-letter') docType = 'COVER_LETTER';
        if (type === 'selection-criteria') docType = 'STAR_RESPONSE';

        // 3. Create Document linked to JobApplication
        const doc = await prisma.document.create({
            data: {
                title: `${type.toUpperCase()} - ${company || 'General'}`,
                content,
                type: docType,
                jobApplicationId: jobApp.id,
                userId
            }
        });

        res.json({ success: true, jobAppId: jobApp.id, documentId: doc.id });
    } catch (error) {
        console.error('Finalize Error:', error);
        res.status(500).json({ error: 'Failed to finalize application' });
    }
});

router.patch('/documents/:id', authenticate, async (req, res) => {
    const { id } = req.params as any;
    const { content } = req.body as any;
    const userId = (req as any).user.id;
    try {
        const doc = await prisma.document.update({
            where: { id: id as string, userId: userId as string },
            data: { content: content as string }
        });
        res.json(doc);
    } catch (error) {
        console.error('Update Document Error:', error);
        res.status(500).json({ error: 'Failed to update document' });
    }
});

export default router;
