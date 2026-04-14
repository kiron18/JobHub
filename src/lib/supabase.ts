import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Auth will not function.');
}

// Purge any stale Supabase IndexedDB data left over from before we switched to
// localStorage. Old IDB entries cause 'put on IDBObjectStore: transaction finished'
// errors during OAuth redirects because the transaction from the anonymous session
// expires mid-redirect. Safe to delete — localStorage is the sole store going forward.
if (typeof window !== 'undefined' && window.indexedDB) {
  ['supabase', 'supabase-js-v2'].forEach(name => {
    try { window.indexedDB.deleteDatabase(name); } catch {}
  });
  if (supabaseUrl) {
    try {
      const ref = supabaseUrl.split('//')[1]?.split('.')[0];
      if (ref) window.indexedDB.deleteDatabase(`sb-${ref}-auth-token`);
    } catch {}
  }
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
