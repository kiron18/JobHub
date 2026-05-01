import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabase } from '../lib/supabase';
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
