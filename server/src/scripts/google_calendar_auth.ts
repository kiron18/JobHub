/**
 * One-time: connect the sales board to Google Calendar.
 *
 *   npx tsx src/scripts/google_calendar_auth.ts
 *
 * Opens a browser, asks for permission to manage calendar events, and writes
 * the three GOOGLE_CALENDAR_* variables into server/.env. Sign in as
 * kiron@aussiegradcareers.com.au when it asks: whichever account approves is
 * the calendar every sales call lands on.
 *
 * The same three variables then need setting on Railway. They are not printed
 * here, on purpose; copy them from server/.env.
 *
 * Uses the desktop OAuth client the local Python CRM already had, at
 * ~/.hermes/google_client_secret.json. Pass another path as the first argument
 * to use a different one.
 *
 * ⚠️ IF THE TOKEN STOPS WORKING AFTER A WEEK, the OAuth consent screen is in
 * "Testing", where Google expires refresh tokens after seven days. In the
 * Google Cloud console set its user type to Internal (the account is a
 * Workspace one), then run this again.
 */
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import axios from 'axios';
import { CALENDAR_SCOPE } from '../services/googleCalendar';

const WANTED_ACCOUNT = 'kiron@aussiegradcareers.com.au';
const ENV_PATH = path.resolve(__dirname, '../../.env');

function readClient(): { clientId: string; clientSecret: string } {
  const file = process.argv[2] || path.join(os.homedir(), '.hermes', 'google_client_secret.json');
  if (!fs.existsSync(file)) {
    throw new Error(`No OAuth client file at ${file}. Download the desktop client JSON from the Google Cloud console.`);
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const c = json.installed ?? json.web;
  if (!c?.client_id || !c?.client_secret) throw new Error(`${file} is not an OAuth client file.`);
  return { clientId: c.client_id, clientSecret: c.client_secret };
}

/** Replace the variable if it is already in the file, append it if not. */
function writeEnv(vars: Record<string, string>): void {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
  const added: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(text)) text = text.replace(re, () => line);
    else added.push(line);
  }
  if (added.length) {
    text = `${text.replace(/\s*$/, '')}\n\n# Google Calendar for the sales board. Minted by src/scripts/google_calendar_auth.ts.\n${added.join('\n')}\n`;
  }
  fs.writeFileSync(ENV_PATH, text, 'utf-8');
}

async function main() {
  const { clientId, clientSecret } = readClient();

  const code = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const got = url.searchParams.get('code');
      const err = url.searchParams.get('error');
      if (!got && !err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<body style="font-family:system-ui;padding:40px"><h2>${got ? 'Connected.' : 'Not connected.'}</h2><p>${got ? 'You can close this tab.' : err}</p></body>`);
      const port = (server.address() as any).port;
      server.close();
      if (got) resolve({ code: got, redirectUri: `http://127.0.0.1:${port}` });
      else reject(new Error(`Google said: ${err}`));
    });
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port;
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `http://127.0.0.1:${port}`,
        response_type: 'code',
        scope: CALENDAR_SCOPE,
        // Both are what make Google hand back a refresh token every time,
        // rather than only on the very first consent.
        access_type: 'offline',
        prompt: 'consent',
        login_hint: WANTED_ACCOUNT,
      }).toString();
      console.log(`\nOpening the browser. Sign in as ${WANTED_ACCOUNT}.\nIf nothing opens, paste this into a browser:\n\n${auth.toString()}\n`);
      // No shell on Windows. `start` through cmd needs every & in the URL
      // escaped, and escaping inside quotes leaves the carets in the link,
      // which Google rejects as a malformed request.
      const target = auth.toString();
      if (process.platform === 'win32') {
        execFile('powershell', ['-NoProfile', '-Command', `Start-Process '${target}'`], () => {});
      } else {
        execFile(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], () => {});
      }
    });
    setTimeout(() => { server.close(); reject(new Error('Nobody approved it within 10 minutes.')); }, 10 * 60_000).unref();
  });

  const token = await axios.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({
      code: code.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: code.redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  const refreshToken: string | undefined = token.data.refresh_token;
  if (!refreshToken) throw new Error('Google returned no refresh token. Remove the app at myaccount.google.com/permissions and run this again.');

  // Which calendar did we just get? With only the events scope there is no
  // profile call, but the primary calendar's summary is the account's address.
  const probe = await axios.get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    headers: { Authorization: `Bearer ${token.data.access_token}` },
    params: { maxResults: 1 },
  });
  const account: string = probe.data?.summary ?? 'unknown';

  writeEnv({
    GOOGLE_CALENDAR_CLIENT_ID: clientId,
    GOOGLE_CALENDAR_CLIENT_SECRET: clientSecret,
    GOOGLE_CALENDAR_REFRESH_TOKEN: refreshToken,
  });

  console.log(`Connected to the calendar of: ${account}`);
  if (account.toLowerCase() !== WANTED_ACCOUNT) {
    console.log(`⚠️  That is not ${WANTED_ACCOUNT}. Sales calls would land on the wrong calendar. Run this again and pick the right account.`);
  }
  console.log(`Saved to ${ENV_PATH}. Restart the server to pick it up.`);
  console.log('For production, set the same three GOOGLE_CALENDAR_* variables on Railway (copy them from that file).');
}

main().catch((err) => {
  console.error(`\nCalendar not connected: ${err?.response?.data?.error_description ?? err?.message ?? err}`);
  process.exit(1);
});
