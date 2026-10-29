import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { SHOW_GOOGLE_SIGN_IN } from '../../config/features';

/*
  Google sign-in, shared by the welcome flow's claim step and /auth.

  Google was removed in April 2026 because the redirect crashed. That crash was
  the old intake stashing the resume FILE in IndexedDB before leaving the page.
  Nothing here stores a file: the welcome flow's resume already lives on the
  server under its session token, so the redirect only has to carry that token.
*/

let providerCheck: Promise<boolean> | null = null;

/**
 * Whether the Supabase project has the Google provider switched on. Staging has
 * it off, and a button that opens Google's error page is worse than no button.
 * Asked once per page load.
 */
function googleEnabled(): Promise<boolean> {
  if (!SHOW_GOOGLE_SIGN_IN) return Promise.resolve(false);
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return Promise.resolve(false);
  providerCheck ??= fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then(r => (r.ok ? r.json() : null))
    .then(j => !!j?.external?.google)
    .catch(() => false);
  return providerCheck;
}

export function useGoogleSignInAvailable(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void googleEnabled().then(v => { if (live) setOn(v); });
    return () => { live = false; };
  }, []);
  return on;
}

/** Leaves the page for Google. `redirectTo` must be in Supabase's allowed redirect URLs. */
export async function startGoogleSignIn(redirectTo: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, queryParams: { prompt: 'select_account' } },
  });
  if (error) {
    toast.error(error.message || 'Google sign-in failed. Try again, or use a password.');
    return false;
  }
  return true;
}

const GOOGLE_G = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335" />
  </svg>
);

/**
 * "Continue with Google". `beforeLeave` runs first, for anything the page needs
 * to find again when Google sends them back.
 */
export function GoogleSignInButton({ redirectTo, beforeLeave, fontFamily, onClicked }: {
  redirectTo: string;
  beforeLeave?: () => void;
  fontFamily?: string;
  onClicked?: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  return (
    <button
      type="button"
      disabled={leaving}
      onClick={async () => {
        setLeaving(true);
        onClicked?.();
        beforeLeave?.();
        if (!(await startGoogleSignIn(redirectTo))) setLeaving(false);
      }}
      style={{
        width: '100%', minHeight: 48, padding: '12px 18px', borderRadius: 12,
        border: '1px solid #d0d5dd', background: '#fff', color: '#1f2937',
        fontFamily: fontFamily ?? 'inherit', fontSize: 15, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        cursor: leaving ? 'wait' : 'pointer', opacity: leaving ? 0.7 : 1,
      }}
    >
      {leaving ? <Loader2 size={18} className="animate-spin" /> : GOOGLE_G}
      Continue with Google
    </button>
  );
}

/** The "or" rule between Google and the email form. */
export function OrDivider({ color = '#98a2b3' }: { color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25, color }} />
      <span style={{ fontSize: 12, fontWeight: 600, color }}>or</span>
      <div style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25, color }} />
    </div>
  );
}
