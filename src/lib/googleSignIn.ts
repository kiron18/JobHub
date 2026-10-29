import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from './supabase';
import { SHOW_GOOGLE_SIGN_IN } from '../config/features';

/*
  Google sign-in, shared by the welcome flow's claim step and /auth. The button
  is components/auth/GoogleSignInButton.tsx.

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
