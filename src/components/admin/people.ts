/* Small things the Today, People and person pages all need. */
import api from '../../lib/api';

export type Bucket = 'Client' | 'Trial' | 'Call booked' | 'Pitched' | 'Lead' | 'Lapsed' | 'Dead';
export const BUCKETS: Bucket[] = ['Client', 'Trial', 'Call booked', 'Pitched', 'Lead', 'Lapsed', 'Dead'];

/** The pill's colour class. "Call booked" has a space, a class cannot. */
export const pillClass = (b: Bucket) => `adm-pill ${b === 'Call booked' ? 'Call' : b}`;

/** Where one person's page lives, from whichever ids are known. */
export function personPath(p: { leadId?: string | null; userId?: string | null }): string {
  const q = new URLSearchParams();
  if (p.leadId) q.set('lead', p.leadId);
  if (p.userId) q.set('user', p.userId);
  return `/admin/people/view?${q.toString()}`;
}

/** `3:30 pm`, in the browser's zone. */
export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase();

/** `Tue 14 Oct`. */
export const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** `14 October 2026`, dropping the year when it is this one. */
export function dateOf(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function daysAgoText(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export const money = (n: number) =>
  `$${n.toLocaleString('en-AU', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

/**
 * A WhatsApp chat with this number, opened with a greeting already typed.
 * Nothing is sent: it opens the chat and the message is yours to finish.
 * Australian mobiles written as 04xx are turned into 614xx, which is the form
 * wa.me needs.
 */
export function whatsappLink(phone: string | null | undefined, name?: string | null): string | null {
  let digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = `61${digits.slice(1)}`;
  const first = (name ?? '').trim().split(/\s+/)[0];
  return `https://wa.me/${digits}?text=${encodeURIComponent(first ? `Hey ${first}, ` : 'Hey, ')}`;
}

/**
 * Open whatever resume is on file for someone, lead or account.
 *
 * The tab is opened before the request, not after: a window opened once the
 * await returns is no longer tied to the click and gets popup-blocked.
 */
export async function openPersonResume(p: { email?: string | null; userId?: string | null }) {
  const tab = window.open('', '_blank');
  try {
    const r = await api.get('/admin/people/resume', {
      params: { email: p.email ?? undefined, userId: p.userId ?? undefined },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(r.data as Blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    tab?.close();
    window.alert('No resume on file for this person.');
  }
}
