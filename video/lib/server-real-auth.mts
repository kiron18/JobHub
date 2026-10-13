/**
 * Runs the local API with real sign-in, against staging.
 *
 * Two things in a normal `npm run dev` get in the way of filming a demo account:
 *
 * 1. server/.env.local sets DEV_BYPASS_AUTH=true, which makes every request act
 *    as one shared dev user whatever token it carries. A shoot run like that
 *    films, and writes to, that dev user instead of the demo account.
 * 2. lib/supabase.ts calls a bare dotenv.config() as it is imported, before
 *    index.ts gets to load .env.local. So the server's Supabase client is built
 *    from plain .env, which is PRODUCTION, and it cannot verify a staging
 *    sign-in at all. Loading .env.local first, here, means .env only fills gaps.
 *
 * Neither env file is edited; this only changes this one process.
 *
 *   cd server && npx tsx ../video/lib/server-real-auth.mts
 */
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
if (!process.env.SUPABASE_URL?.includes('eijnehebvhapmeudfjtj')) throw new Error('not staging: refusing to start');
await import('../../server/src/index.ts');
process.env.DEV_BYPASS_AUTH = 'false';
console.log('[video] real sign-in on, Supabase =', process.env.SUPABASE_URL);
