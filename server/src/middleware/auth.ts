import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabase';
import { prisma } from '../index';
import fs from 'fs';
import path from 'path';

const logFile = path.join(__dirname, '../../server.log');
const log = (msg: string) => {
  const entry = `${new Date().toISOString()} - [Auth] ${msg}\n`;
  fs.appendFileSync(logFile, entry);
};

export interface AuthRequest extends Request {
  user?: { id: string; email?: string };
}

const DEV_BYPASS_USER_ID = 'dev-test-00000000-0000-0000-0000-000000000001';
const DEV_BYPASS_EMAIL   = 'dev-test@jobhub.local';

// Verify a Supabase JWT locally using HMAC-SHA256 — no network call, no race conditions.
// Supabase tokens are standard signed JWTs; we just need the project JWT secret.
function verifyJWT(token: string, secret: string): { sub: string; email?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');
  const [headerB64, payloadB64, signatureB64] = parts;

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  const sigA = Buffer.from(signatureB64);
  const sigB = Buffer.from(expectedSig);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return { sub: payload.sub, email: payload.email };
}

/**
 * Extension tokens.
 *
 * The browser extension cannot hold a Supabase JWT: those expire, and an
 * extension sitting in a toolbar has no way to refresh one. So it carries a
 * long-lived opaque token instead, prefixed `agc_` so it is distinguishable
 * from a JWT at a glance and in a log.
 *
 * Only the hash is ever stored. A leak of the database must not hand anyone a
 * working token.
 */
export const EXTENSION_TOKEN_PREFIX = 'agc_';

export function hashExtensionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function mintExtensionToken(): string {
  return EXTENSION_TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
}

/** Resolve an `agc_` token to its owner, or null. */
async function userFromExtensionToken(token: string): Promise<{ id: string; email?: string } | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { extensionTokenHash: hashExtensionToken(token) },
    select: { userId: true, email: true },
  });
  if (!profile?.userId) return null;
  return { id: profile.userId, email: profile.email ?? undefined };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') return next();

  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
    req.user = { id: DEV_BYPASS_USER_ID, email: DEV_BYPASS_EMAIL };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No bearer token' });
  }

  // Extension token before JWT: it is a different shape entirely, and running
  // it through verifyJWT would only produce a confusing "malformed" log line.
  if (token.startsWith(EXTENSION_TOKEN_PREFIX)) {
    try {
      const user = await userFromExtensionToken(token);
      if (!user) {
        log('Extension token not recognised');
        return res.status(401).json({ error: 'Invalid extension token' });
      }
      req.user = user;
      return next();
    } catch (e: any) {
      log(`Extension token lookup failed: ${e.message}`);
      return res.status(500).json({ error: 'Internal server error during authentication' });
    }
  }

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (jwtSecret) {
    // Fast path — local verification, instant, no external dependency
    try {
      const { sub, email } = verifyJWT(token, jwtSecret);
      req.user = { id: sub, email };
      return next();
    } catch (e: any) {
      log(`JWT verification failed: ${e.message}`);
      return res.status(401).json({ error: 'Invalid or expired token', details: e.message });
    }
  }

  // Slow path — SUPABASE_JWT_SECRET not configured, fall back to API call
  // Add SUPABASE_JWT_SECRET to Railway env vars to eliminate this network dependency.
  log('SUPABASE_JWT_SECRET not set — falling back to API verification (add it to Railway env)');
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      log(`API auth failed: ${error?.message}`);
      return res.status(401).json({ error: 'Invalid or expired token', details: error?.message });
    }
    req.user = { id: user.id, email: user.email };
    return next();
  } catch (error) {
    log(`Auth error: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// Optional authentication — populates req.user when a valid token is present,
// but never blocks the request. Use on routes that serve both anonymous and
// logged-in visitors (e.g. the public visa-sponsor directory, where logged-in
// users get full data and anonymous users hit the email gate).
export const optionalAuthenticate = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') return next();

  if (process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_AUTH === 'true') {
    req.user = { id: DEV_BYPASS_USER_ID, email: DEV_BYPASS_EMAIL };
    return next();
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next(); // anonymous — continue without a user

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (jwtSecret) {
    try {
      const { sub, email } = verifyJWT(token, jwtSecret);
      req.user = { id: sub, email };
    } catch (e: any) {
      log(`Optional JWT verification failed (continuing anonymous): ${e.message}`);
    }
    return next();
  }

  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) req.user = { id: user.id, email: user.email };
  } catch (error) {
    log(`Optional auth error (continuing anonymous): ${error instanceof Error ? error.message : String(error)}`);
  }
  return next();
};
