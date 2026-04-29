import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * Handles the redirect after Supabase email confirmation.
 * Supabase redirects here with either:
 *   - a PKCE code in the query string (?code=...)
 *   - an implicit access_token in the hash fragment (#access_token=...)
 * Either way, we wait for the session to be established then send the user home,
 * where OnboardingGate will detect pending IDB files and trigger resumeMode.
 */
export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // PKCE flow: exchange the code for a session
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(() => navigate('/', { replace: true }))
        .catch(() => navigate('/auth', { replace: true }));
      return;
    }

    // Implicit flow: Supabase JS processes the hash automatically — listen for SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate('/', { replace: true });
      }
    });

    // Already signed in (e.g. page refresh on this route)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/', { replace: true });
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}
