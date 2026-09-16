/**
 * WhatsApp for the trial-challenge reminder — via Baileys (WhatsApp Web
 * protocol automation), not Twilio/Meta Business API.
 *
 * The official path needs Meta Business Manager verification and an
 * approved message template, both blocked (see the plan this was built
 * from). This automates the owner's own real WhatsApp account instead —
 * paired once by QR code, same as linking a new device by hand.
 *
 * The one rule everything here is built around, taken directly from
 * Daekwon's own WhatsApp doctrine ("don't automate outbound messaging to
 * people who haven't messaged first"): THIS SERVICE NEVER INITIATES A
 * CONVERSATION. `sendTrialChallengeReminderWhatsApp` (called by the cron)
 * only ever sends to a candidate whose number has already texted the
 * keyword in and been verified — see `handleIncoming`. Typing a number into
 * the app is not enough on its own; nothing sends until that number
 * messages this bot itself.
 */
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import { prisma } from '../index';
import { PUBLIC_APP_URL } from '../lib/appUrl';
import type { WASocket, AuthenticationCreds, AuthenticationState } from 'baileys';

/**
 * baileys (and its whatsapp-rust-bridge dependency) is pure ESM with no
 * CommonJS require support — `export { md5, hkdf } from 'whatsapp-rust-bridge'`
 * inside baileys' own crypto.js can't be satisfied by Node's CJS resolver,
 * because that package's package.json only declares an "import" export
 * condition, no "require" one. This server has no "type": "module" (it's
 * CommonJS throughout), and a plain top-level `import ... from 'baileys'`
 * compiles down to a CJS `require('baileys')` — which crashed the ENTIRE
 * server on boot the first time this shipped, before any of this file's own
 * code ever ran, because requiring baileys transitively requires that
 * ESM-only package. A dynamic `import()` is Node's actual sanctioned path
 * from CommonJS into ESM and goes through the ESM loader instead, which DOES
 * understand that package's "import" condition. Loaded once, memoised.
 */
let baileysModule: typeof import('baileys') | null = null;
async function loadBaileys() {
  if (!baileysModule) baileysModule = await import('baileys');
  return baileysModule;
}

// Baileys is chatty at info level. Set WHATSAPP_DEBUG=1 when diagnosing a
// pairing problem; everything else stays quiet.
const waLogger = pino({ level: process.env.WHATSAPP_DEBUG ? 'debug' : 'error' }) as any;

// Same defaults Daekwon's own WhatsApp bot uses — proven numbers, not guesses.
const MIN_SEND_GAP_MS = Number(process.env.WHATSAPP_MIN_GAP_MS || 4000);
const DAILY_CAP = Number(process.env.WHATSAPP_DAILY_CAP || 60);

const AUTH_KEY_PREFIX = 'authstate:';
const CONFIRM_TEXT = "You're set. I'll message you here the moment your next day unlocks.";
const NO_MATCH_TEXT =
  "Thanks for messaging! To get trial reminders, enter this number on the app's day-pass screen first, then text START again.";
const START_WORDS = new Set(['start', 'ready', 'apply']);

let sock: WASocket | null = null;
let connecting = false;
let lastSendAt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Baileys' auth state, backed by the WhatsAppSession key-value table instead
 * of local disk. Mirrors Baileys' own useMultiFileAuthState exactly (same
 * one-key-per-file shape, same BufferJSON (de)serialisation for the Buffers
 * embedded in signal-protocol key data) — Railway's filesystem doesn't
 * survive a redeploy, so a local .wa_auth/ folder would force a re-pair
 * every single deploy.
 */
async function usePostgresAuthState() {
  const { BufferJSON, initAuthCreds, proto } = await loadBaileys();

  const readData = async (file: string): Promise<any> => {
    const row = await prisma.whatsAppSession.findUnique({ where: { key: AUTH_KEY_PREFIX + file } });
    if (!row) return null;
    try {
      return JSON.parse(row.value, BufferJSON.reviver);
    } catch {
      return null;
    }
  };
  const writeData = async (data: unknown, file: string): Promise<void> => {
    const value = JSON.stringify(data, BufferJSON.replacer);
    await prisma.whatsAppSession.upsert({
      where: { key: AUTH_KEY_PREFIX + file },
      create: { key: AUTH_KEY_PREFIX + file, value },
      update: { value },
    });
  };
  const removeData = async (file: string): Promise<void> => {
    await prisma.whatsAppSession.delete({ where: { key: AUTH_KEY_PREFIX + file } }).catch(() => {});
  };

  const creds: AuthenticationCreds = (await readData('creds')) || initAuthCreds();

  return {
    // Baileys' own signal-key types (SignalDataTypeMap) are a closed union
    // keyed by a runtime string, which this generic get/set pair can't
    // satisfy structurally without reimplementing Baileys' internal typing —
    // exactly what its own useMultiFileAuthState (plain JS, untyped) sidesteps
    // by not being TypeScript. Cast at the boundary; the logic mirrors that
    // reference implementation's shape exactly.
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: Record<string, unknown> = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }),
          );
          return data;
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const file = `${category}-${id}`;
              tasks.push(value ? writeData(value, file) : removeData(file));
            }
          }
          await Promise.all(tasks);
        },
      },
    } as unknown as AuthenticationState,
    saveCreds: async () => writeData(creds, 'creds'),
  };
}

function todayAESTKey(): string {
  const s = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [day, month, year] = s.split('/');
  return `${year}-${month}-${day}`;
}

// Counted from a DB row rather than an in-memory number, so a Railway
// restart mid-day can't quietly reset the cap to zero.
async function sentTodayCount(): Promise<number> {
  const row = await prisma.whatsAppSession.findUnique({ where: { key: `sendcount:${todayAESTKey()}` } });
  return row ? Number(row.value) || 0 : 0;
}

async function incrementSentToday(): Promise<void> {
  const key = `sendcount:${todayAESTKey()}`;
  const next = (await sentTodayCount()) + 1;
  await prisma.whatsAppSession.upsert({
    where: { key },
    create: { key, value: String(next) },
    update: { value: String(next) },
  });
}

/** Every outbound send, whatever triggered it, goes through here — the throttle applies no matter who's calling. */
async function sendThrottled(socketRef: WASocket, jid: string, text: string): Promise<void> {
  const gap = Date.now() - lastSendAt;
  if (gap < MIN_SEND_GAP_MS) {
    await new Promise((r) => setTimeout(r, MIN_SEND_GAP_MS - gap));
  }
  await socketRef.sendMessage(jid, { text });
  lastSendAt = Date.now();
}

/**
 * The only place a phone number gets promoted to "may receive automated
 * reminders" — and only because it messaged in first. `whatsappNumber` is
 * validated as E.164 with a leading '+' at the point the candidate types it
 * into the app (see routes/trialChallenge.ts), and a WhatsApp JID's number
 * part is that same digit string with no '+' — so the match is a direct
 * string comparison, no fuzzy normalisation needed.
 */
async function handleIncoming(socketRef: WASocket, msg: any): Promise<void> {
  if (msg.key?.fromMe) return;
  const remoteJid: string | undefined = msg.key?.remoteJid;
  if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) return; // ignore groups/broadcast/status

  const text: string = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
  if (!START_WORDS.has(text.toLowerCase())) return; // only ever react to the actual keyword, never anything else they send

  const senderE164 = `+${remoteJid.split('@')[0]}`;
  const profile = await prisma.candidateProfile.findFirst({ where: { whatsappNumber: senderE164 } });

  if (!profile) {
    await sendThrottled(socketRef, remoteJid, NO_MATCH_TEXT);
    return;
  }

  await prisma.candidateProfile.updateMany({
    where: { id: profile.id, whatsappVerifiedAt: null },
    data: { whatsappVerifiedAt: new Date() },
  });
  await sendThrottled(socketRef, remoteJid, CONFIRM_TEXT);
}

/**
 * Opens (or re-opens) the WhatsApp connection. Safe to call more than once —
 * a live socket or an in-flight connection attempt short-circuits.
 */
export async function startWhatsApp(): Promise<void> {
  if (sock || connecting) return;
  connecting = true;

  try {
    const { default: makeWASocket, DisconnectReason, Browsers, fetchLatestBaileysVersion } = await loadBaileys();
    const { state, saveCreds } = await usePostgresAuthState();
    const { version } = await fetchLatestBaileysVersion();

    const newSock = makeWASocket({
      version,
      auth: state,
      logger: waLogger,
      // A stock browser identity — a custom name here is a known cause of
      // pairing-code requests failing outright (not used here, QR only, but
      // cheap insurance either way).
      browser: Browsers.ubuntu('Chrome'),
      // Leave the phone as the "primary" so its own notifications keep
      // arriving normally.
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getMessage: async () => undefined,
    });

    newSock.ev.on('creds.update', saveCreds);

    newSock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[whatsapp] Scan this QR with WhatsApp on the reminder phone (Settings -> Linked Devices). Expires in under a minute:');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'open') {
        console.log(`[whatsapp] connected as ${newSock.user?.id ?? 'unknown'}`);
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        sock = null;

        if (loggedOut) {
          // The phone unlinked this device — stored creds are dead.
          // Reconnecting would just spin; a human has to re-scan a QR.
          console.error('[whatsapp] logged out on the phone. Clear the WhatsAppSession table rows and redeploy to re-pair.');
          return;
        }

        console.warn('[whatsapp] connection closed, reconnecting in 5s');
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          startWhatsApp().catch((err) => console.error('[whatsapp] reconnect failed:', err?.message));
        }, 5000);
      }
    });

    newSock.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        handleIncoming(newSock, msg).catch((err) => console.error('[whatsapp] inbound handler failed:', err?.message));
      }
    });

    sock = newSock;
  } finally {
    connecting = false;
  }
}

/**
 * Called only by the trial-challenge reminder cron, only for a profile with
 * whatsappVerifiedAt already set (checked by the caller before this runs).
 * Never call this for a number that hasn't texted in — that's the entire
 * point of this file.
 */
export async function sendTrialChallengeReminderWhatsApp(
  to: string,
  variables: Record<string, string>,
): Promise<void> {
  if (!sock) {
    console.warn('[whatsapp] not connected — skipping WhatsApp reminder (email still sends)');
    return;
  }
  const used = await sentTodayCount();
  if (used >= DAILY_CAP) {
    console.warn(`[whatsapp] daily cap of ${DAILY_CAP} reached — skipping`);
    return;
  }

  const name = variables['1'] || 'there';
  const day = variables['2'] || '';
  const text = `Hi ${name}, day ${day} of your free trial is unlocked. Come back and keep going: ${PUBLIC_APP_URL}/check`;
  const jid = `${to.replace(/^\+/, '')}@s.whatsapp.net`;

  await sendThrottled(sock, jid, text);
  await incrementSentToday();
}
