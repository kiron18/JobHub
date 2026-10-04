import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const readEnv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const fe = readEnv('.env.local'), be = readEnv('server/.env.local');
if (!fe.VITE_SUPABASE_URL.includes('eijnehebvhapmeudfjtj')) throw new Error('not staging');
const admin = createClient(fe.VITE_SUPABASE_URL, be.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'kiron182@gmail.com' });
const anon = createClient(fe.VITE_SUPABASE_URL, fe.VITE_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
let { data: v, error } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'email' });
if (error) ({ data: v, error } = await anon.auth.verifyOtp({ email: 'kiron182@gmail.com', token: data.properties.email_otp, type: 'email' }));
if (error) throw error;
const slot = process.argv[2] || 'morning';
const r = await fetch('https://aussiegradcareers-staging-production.up.railway.app/api/admin/coach-checkin/run', {
  method: 'POST', headers: { Authorization: `Bearer ${v.session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ slot, email: 'kironburn@gmail.com' }),
});
console.log(r.status, JSON.stringify(await r.json(), null, 1));
