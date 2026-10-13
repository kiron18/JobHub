/**
 * The demo account the signed-in chapters are shot from: Maya Fernando, a
 * person who does not exist, on the STAGING database. Never film a real
 * client's account.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const APP = process.env.CAPTURE_APP_URL || 'http://localhost:5173';
export const API = 'http://localhost:3002/api';
export const DEMO_EMAIL = 'maya.fernando@jobhub-test.local';

const readEnv = (f) => Object.fromEntries(
  fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
);
const fe = readEnv('.env.local');
const be = readEnv(path.join('server', '.env.local'));
export const SUPA = fe.VITE_SUPABASE_URL;
// Staging's project ref. Production accounts are real people; refuse to touch them.
if (!SUPA.includes('eijnehebvhapmeudfjtj')) throw new Error('not staging: refusing to create or sign in a demo account');
const REF = new URL(SUPA).hostname.split('.')[0];

export const admin = createClient(SUPA, be.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

/** A signed-in session for the demo account, creating the login if it is not there yet. */
export async function demoSession() {
  await admin.auth.admin.createUser({ email: DEMO_EMAIL, email_confirm: true }).catch(() => {});
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: DEMO_EMAIL });
  if (error) throw new Error(`generateLink failed: ${error.message}`);
  const anon = createClient(SUPA, fe.VITE_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  let { data: v, error: e } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'email' });
  if (e) ({ data: v, error: e } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' }));
  if (e) throw new Error(`verifyOtp failed: ${e.message}`);
  return v.session;
}

/** Sign a browser context in as the demo account before any page loads. */
export async function signIn(ctx, extraStorage = {}) {
  const session = await demoSession();
  await ctx.addInitScript(([k, s, extra]) => {
    try {
      localStorage.setItem(k, s);
      for (const [key, val] of Object.entries(extra)) localStorage.setItem(key, val);
    } catch { /* ignore */ }
  }, [`sb-${REF}-auth-token`, JSON.stringify(session), extraStorage]);
  return session;
}
