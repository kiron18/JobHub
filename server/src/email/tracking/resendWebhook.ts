/**
 * Resend's webhook: what happened to each email after it left.
 *
 *   email.delivered   the receiving server accepted it      -> EmailSend.deliveredAt
 *   email.opened      Resend's own open pixel loaded         -> an EmailOpen row
 *   email.bounced     it never arrived                       -> EmailSend.bouncedAt + reason
 *   email.complained  the reader marked it as spam           -> EmailSend.complainedAt
 *
 * Opens come from Resend because open tracking is switched on for the domain
 * there already. Click tracking is off at Resend on purpose: clicks are counted
 * on our own site instead (see tagEmailLinks in email/send/sendEmail.ts).
 *
 * Mounted before express.json() in index.ts, because the signature is over the
 * raw body. Signed the Svix way, with RESEND_WEBHOOK_SECRET ("whsec_..."). With
 * no secret set, every call is refused rather than trusted.
 *
 * Only sends recorded through sendLogged or sendEmail have a row to update.
 * Mail to Kiron himself is not recorded, so its events are acknowledged and
 * dropped.
 */
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../index';

/** Svix refuses anything older than this, and so do we: a replayed event. */
const TOLERANCE_S = 5 * 60;

export function verifySvixSignature(
  rawBody: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  secret: string,
  nowS: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > TOLERANCE_S) return false;

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();

  // The header can hold several signatures ("v1,abc v1,def") during a key roll.
  for (const part of signature.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    const given = Buffer.from(sig, 'base64');
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return true;
  }
  return false;
}

interface ResendEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    bounce?: { message?: string; type?: string; subType?: string };
  };
}

export async function applyResendEvent(event: ResendEvent): Promise<'applied' | 'ignored'> {
  const emailId = event.data?.email_id;
  if (!emailId) return 'ignored';
  const send = await prisma.emailSend.findFirst({ where: { resendEmailId: emailId }, select: { id: true } });
  if (!send) return 'ignored';
  const at = event.created_at && !Number.isNaN(Date.parse(event.created_at)) ? new Date(event.created_at) : new Date();

  switch (event.type) {
    case 'email.delivered':
      await prisma.emailSend.update({ where: { id: send.id }, data: { deliveredAt: at } });
      return 'applied';
    case 'email.opened':
      await prisma.emailOpen.create({ data: { emailSendId: send.id, openedAt: at } });
      return 'applied';
    case 'email.bounced': {
      const b = event.data?.bounce;
      const reason = [b?.type, b?.subType, b?.message].filter(Boolean).join(': ').slice(0, 500) || null;
      await prisma.emailSend.update({ where: { id: send.id }, data: { bouncedAt: at, bounceReason: reason } });
      return 'applied';
    }
    case 'email.complained':
      await prisma.emailSend.update({ where: { id: send.id }, data: { complainedAt: at } });
      return 'applied';
    default:
      return 'ignored';
  }
}

export async function resendWebhookHandler(req: Request, res: Response) {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? '';
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const ok = verifySvixSignature(raw, {
    id: req.header('svix-id'),
    timestamp: req.header('svix-timestamp'),
    signature: req.header('svix-signature'),
  }, secret);
  if (!ok) {
    res.status(401).json({ error: 'Bad signature' });
    return;
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    res.status(400).json({ error: 'Bad JSON' });
    return;
  }

  try {
    await applyResendEvent(event);
  } catch (err) {
    // A 500 makes Resend retry, which is what we want for a database blip.
    console.error('[resend-webhook] could not apply', event.type, (err as Error).message);
    res.status(500).json({ error: 'Could not record' });
    return;
  }
  res.status(200).json({ ok: true });
}
