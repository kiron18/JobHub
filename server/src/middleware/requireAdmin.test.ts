import { describe, it, expect, vi } from 'vitest';

vi.mock('../routes/stripe', () => ({ EXEMPT_EMAILS: ['owner@test.dev'] }));

import { isAdminRequest, requireAdmin } from './requireAdmin';

const req = (user: any) => ({ user }) as any;

describe('requireAdmin', () => {
  it('lets an owner through on a real session, whatever the case of the email', () => {
    expect(isAdminRequest(req({ id: 'u', email: 'Owner@Test.dev' }))).toBe(true);
  });

  it('refuses anyone not on the owner list, and a request with no user', () => {
    expect(isAdminRequest(req({ id: 'u', email: 'client@test.dev' }))).toBe(false);
    expect(isAdminRequest(req({ id: 'u' }))).toBe(false);
    expect(isAdminRequest(req(undefined))).toBe(false);
  });

  // The hole this file closed: an extension token used to carry whatever
  // email the candidate had typed onto their own profile.
  it('refuses an extension token even when it belongs to an owner', () => {
    expect(isAdminRequest(req({ id: 'u', email: 'owner@test.dev', viaExtensionToken: true }))).toBe(false);
  });

  it('answers 403 and does not call next', () => {
    const res: any = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    requireAdmin(req({ id: 'u', email: 'client@test.dev' }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
