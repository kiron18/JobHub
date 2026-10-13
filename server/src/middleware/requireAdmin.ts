/**
 * The one admin check. Every /api/admin route goes through this, after
 * `authenticate`.
 *
 * Two rules:
 *
 *   1. The sign-in email has to be on the owner list (EXEMPT_EMAILS).
 *   2. The request has to carry a real session, not an extension token.
 *
 * The second rule is deliberate. An extension token is long-lived and sits in
 * a browser's extension storage, which is the wrong place for a credential
 * that can send a broadcast or delete leads. An owner using the extension
 * still gets the extension's own routes; they just do not get admin through
 * it.
 *
 * The auth import is type-only on purpose: middleware/auth pulls in the whole
 * server through ../index, and a route test that only wants this check should
 * not have to boot it.
 */
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';
import { EXEMPT_EMAILS } from '../routes/stripe';

export function isAdminRequest(req: AuthRequest): boolean {
  if (req.user?.viaExtensionToken) return false;
  const email = (req.user?.email ?? '').toLowerCase();
  return !!email && EXEMPT_EMAILS.includes(email);
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!isAdminRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  next();
}
