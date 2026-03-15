import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import fs from 'fs';
import path from 'path';

const logFile = path.join(__dirname, '../../server.log');
const log = (msg: string) => {
    const entry = `${new Date().toISOString()} - [Auth] ${msg}\n`;
    fs.appendFileSync(logFile, entry);
};

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    log('No authorization header provided');
    return res.status(401).json({ error: 'No authorization header provided' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    log('No bearer token provided');
    return res.status(401).json({ error: 'No bearer token provided' });
  }

  log(`Authenticating token: ${token.substring(0, 10)}...`);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    log(`Supabase auth check finished. Error: ${error?.message || 'None'}, User: ${user?.id || 'None'}`);

    if (error || !user) {
      log(`Invalid or expired token: ${error?.message || 'User not found'}`);
      return res.status(401).json({ error: 'Invalid or expired token', details: error?.message });
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    log(`Auth successful for user: ${user.id}`);
    next();
  } catch (error) {
    log(`Auth Middleware Crash: ${error instanceof Error ? error.message : String(error)}`);
    console.error('Auth Middleware Error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
};
