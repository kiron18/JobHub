/**
 * The rule worth pinning down here is not that the bytes get stored. It is that
 * uploading a document must never quietly register someone for a workshop.
 * A row created to hold a file gets a session key no roster and no cron asks
 * for, so the person cannot appear on tonight's list or receive the reminder.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../index', () => ({
  prisma: {
    sessionRegistration: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    salesLead: { updateMany: vi.fn() },
  },
}));
vi.mock('./pdf', () => ({ extractTextFromBuffer: vi.fn() }));

import { attachResumeToLead, MANUAL_UPLOAD_SESSION } from './leadResume';
import { prisma } from '../index';
import { extractTextFromBuffer } from './pdf';

const db = prisma as any;
const extract = vi.mocked(extractTextFromBuffer);

const file = {
  buffer: Buffer.from('%PDF-1.4 pretend'),
  mimetype: 'application/pdf',
  originalname: 'cv.pdf',
};

describe('attachResumeToLead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extract.mockResolvedValue('Some resume text');
  });

  it('updates the registration someone already has, leaving their session alone', async () => {
    db.sessionRegistration.findUnique.mockResolvedValue({ id: 'reg1' });

    const r = await attachResumeToLead({ email: 'A@Example.com', fallbackName: 'A', ...file });

    expect(r.createdRegistration).toBe(false);
    expect(db.sessionRegistration.create).not.toHaveBeenCalled();
    const arg = db.sessionRegistration.update.mock.calls[0][0];
    expect(arg.where).toEqual({ email: 'a@example.com' });
    expect(arg.data.sessionKey).toBeUndefined();
    expect(arg.data.resumeText).toBe('Some resume text');
  });

  it('files a brand new row under the manual key, never a real session', async () => {
    db.sessionRegistration.findUnique.mockResolvedValue(null);

    const r = await attachResumeToLead({ email: 'b@example.com', fallbackName: 'Bee', ...file });

    expect(r.createdRegistration).toBe(true);
    const arg = db.sessionRegistration.create.mock.calls[0][0];
    expect(arg.data.sessionKey).toBe(MANUAL_UPLOAD_SESSION);
    expect(MANUAL_UPLOAD_SESSION).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(arg.data.name).toBe('Bee');
  });

  /**
   * A scan extracts to nothing. The bytes are still worth keeping, and the
   * caller is told so it can say so rather than reporting a clean upload.
   */
  it('keeps the file when nothing can be read out of it, and says so', async () => {
    db.sessionRegistration.findUnique.mockResolvedValue({ id: 'reg1' });
    extract.mockResolvedValue('   ');

    const r = await attachResumeToLead({ email: 'c@example.com', fallbackName: 'C', ...file });

    expect(r.chars).toBe(0);
    const arg = db.sessionRegistration.update.mock.calls[0][0];
    expect(arg.data.resumeFile).toBeDefined();
    // Must not blank out better text from an earlier, successful extraction.
    expect(arg.data.resumeText).toBeUndefined();
  });

  it('does not lose the upload when extraction throws', async () => {
    db.sessionRegistration.findUnique.mockResolvedValue({ id: 'reg1' });
    extract.mockRejectedValue(new Error('LlamaParse exploded'));

    const r = await attachResumeToLead({ email: 'd@example.com', fallbackName: 'D', ...file });

    expect(r.chars).toBe(0);
    expect(db.sessionRegistration.update).toHaveBeenCalled();
    expect(db.salesLead.updateMany).toHaveBeenCalledWith({
      where: { email: 'd@example.com' }, data: { hasResume: true },
    });
  });
});
