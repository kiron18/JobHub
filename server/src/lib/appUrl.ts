/**
 * Canonical public origin for links we put in front of users (emails, auth
 * redirects).
 *
 * This is deliberately NOT derived from ALLOWED_ORIGIN. That variable is a CORS
 * setting listing every origin the API accepts calls from, which is a different
 * question from "which single URL do we send people to". Deriving link bases
 * from it caused a live outage: ALLOWED_ORIGIN is the apex domain, but
 * Supabase's redirect allowlist only accepts the www host, so every emailed
 * set-password link was silently rejected and bounced to the site root instead
 * of reaching /set-password.
 *
 * Must match an entry in Supabase Auth > URL Configuration > Redirect URLs.
 */
export const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL ?? 'https://www.aussiegradcareers.com.au')
  .trim()
  .replace(/\/+$/, '');
