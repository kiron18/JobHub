// QA: probe every API route on STAGING, signed out and signed in.
// Signed out: every method (a 404 means the route is not mounted; 5xx is a crash).
// Signed in: GET only (as admin with data, and as a brand-new user), plus a
// short list of safe writes. Nothing here generates AI output or sends email.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const API = 'https://aussiegradcareers-staging-production.up.railway.app';
const OUT = process.argv[2];
const routes = JSON.parse(fs.readFileSync(path.join(OUT, 'routes.json'), 'utf8'));

const readEnv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const fe = readEnv('.env.local');
const be = readEnv('server/.env.local');
const SUPA = fe.VITE_SUPABASE_URL, ANON = fe.VITE_SUPABASE_ANON_KEY, SERVICE = be.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA.includes('eijnehebvhapmeudfjtj')) throw new Error('refusing: Supabase is not the staging project');

const admin = createClient(SUPA, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
async function session(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`generateLink ${email}: ${error.message}`);
  const anon = createClient(SUPA, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  let { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'email' });
  if (e2) ({ data: v, error: e2 } = await anon.auth.verifyOtp({ email, token: data.properties.email_otp, type: 'email' }));
  if (e2) throw new Error(`verifyOtp ${email}: ${e2.message}`);
  return v.session.access_token;
}
const FRESH = 'qa-fresh@jobhub-test.local';
{
  const { error } = await admin.auth.admin.createUser({ email: FRESH, email_confirm: true });
  if (error && !/already/i.test(error.message)) throw error;
}
const tokens = { admin: await session('kiron182@gmail.com'), fresh: await session(FRESH) };

const SKIP_SIGNED_IN = new Set(['/api/job-feed/feed']); // scrapes when empty
const fill = (p) => p.replace(/:[^/]+/g, '00000000-0000-0000-0000-000000000000');

async function hit(method, p, token, body) {
  const t0 = Date.now();
  try {
    const r = await fetch(API + p, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const text = await r.text();
    const expressMiss = r.status === 404 && /Cannot (GET|POST|PATCH|PUT|DELETE)/.test(text);
    return { status: r.status, ms: Date.now() - t0, expressMiss, snippet: text.slice(0, 140).replace(/\s+/g, ' ') };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, snippet: String(e.message) };
  }
}

const results = [];
for (const r of routes) {
  const p = fill(r.path);
  const out = { method: r.method, path: r.path };
  // Writes are only ever sent signed out with no body: the auth check or body
  // validation answers first, and nothing is created.
  out.anon = await hit(r.method, p, null, r.method === 'GET' ? undefined : {});
  if (r.method === 'GET' && !SKIP_SIGNED_IN.has(r.path)) {
    out.admin = await hit('GET', p, tokens.admin);
    out.fresh = await hit('GET', p, tokens.fresh);
  }
  results.push(out);
  process.stdout.write('.');
}
fs.writeFileSync(path.join(OUT, 'api-results.json'), JSON.stringify(results, null, 2));

const bad = [];
for (const r of results) for (const who of ['anon', 'admin', 'fresh']) {
  const x = r[who]; if (!x) continue;
  if (x.status >= 500 || x.status === 0 || x.expressMiss) bad.push(`${who.padEnd(5)} ${r.method} ${r.path} -> ${x.status}${x.expressMiss ? ' (NOT MOUNTED)' : ''} ${x.snippet}`);
}
console.log(`\n${results.length} routes probed. Problems: ${bad.length}`);
for (const b of bad) console.log('  ' + b);
const slow = results.flatMap(r => ['admin', 'fresh'].filter(w => r[w]?.ms > 3000).map(w => `${w} ${r.path} ${r[w].ms}ms`));
if (slow.length) console.log('Slow (>3s):\n  ' + slow.join('\n  '));
