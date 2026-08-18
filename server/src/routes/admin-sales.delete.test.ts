/**
 * Deleting from the sales board.
 *
 * The thing worth a test here is not that the row goes. It is that the
 * REGISTRATION goes with it. A delete that removed only the lead would leave
 * the person on the workshop roster, still in line for the reminder email, and
 * one funnel signal away from being rebuilt on the board from the registration
 * that was never removed — a delete that appeared to work and did not.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../index', () => ({
  prisma: {
    salesLead: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    sessionRegistration: { deleteMany: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { email: 'admin@test.dev' };
    next();
  },
}));

vi.mock('./stripe', () => ({ EXEMPT_EMAILS: ['admin@test.dev'] }));

import express from 'express';
import request from 'supertest';
import adminSalesRouter from './admin-sales';
import { prisma } from '../index';

const app = express();
app.use(express.json());
app.use('/api/admin/sales', adminSalesRouter);

const db = prisma as any;

/** Runs the callback against the same mocked client, which is what the route's
 *  interactive transaction does in production too. */
function passthroughTransaction() {
  db.$transaction.mockImplementation((fn: any) => fn(db));
}

describe('POST /api/admin/sales/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passthroughTransaction();
    db.sessionRegistration.deleteMany.mockResolvedValue({ count: 0 });
    db.salesLead.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('takes the registration with the lead, matched on email', async () => {
    db.salesLead.findMany.mockResolvedValue([
      { id: 'a', name: 'Test One', email: 'one@example.com' },
      { id: 'b', name: 'Test Two', email: 'two@example.com' },
    ]);
    db.sessionRegistration.deleteMany.mockResolvedValue({ count: 2 });

    const res = await request(app).post('/api/admin/sales/delete').send({ ids: ['a', 'b'] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: 2, registrationsDeleted: 2 });
    expect(db.sessionRegistration.deleteMany).toHaveBeenCalledWith({
      where: { email: { in: ['one@example.com', 'two@example.com'] } },
    });
    expect(db.salesLead.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] } } });
  });

  /**
   * An imported lead can have no email at all. `{ email: { in: [] } }` would
   * match nothing, but sending the query anyway is one round trip spent to
   * learn what we already knew, so the route must skip it entirely.
   */
  it('does not go looking for registrations when nobody has an email', async () => {
    db.salesLead.findMany.mockResolvedValue([{ id: 'a', name: 'Imported', email: null }]);

    const res = await request(app).post('/api/admin/sales/delete').send({ ids: ['a'] });

    expect(res.status).toBe(200);
    expect(res.body.registrationsDeleted).toBe(0);
    expect(db.sessionRegistration.deleteMany).not.toHaveBeenCalled();
    expect(db.salesLead.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['a'] } } });
  });

  /** A stale id is a board that was open in another tab, not an error. */
  it('is a no-op for ids that are already gone', async () => {
    db.salesLead.findMany.mockResolvedValue([]);

    const res = await request(app).post('/api/admin/sales/delete').send({ ids: ['ghost'] });

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(0);
    expect(db.salesLead.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses an empty list rather than deleting nothing quietly', async () => {
    const res = await request(app).post('/api/admin/sales/delete').send({ ids: [] });
    expect(res.status).toBe(400);
    expect(db.salesLead.findMany).not.toHaveBeenCalled();
  });

  it('only ever deletes the ids it was handed, deduplicated', async () => {
    db.salesLead.findMany.mockResolvedValue([{ id: 'a', name: 'One', email: 'one@example.com' }]);

    await request(app).post('/api/admin/sales/delete').send({ ids: ['a', 'a', ' a ', ''] });

    expect(db.salesLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['a'] } } }),
    );
  });
});
