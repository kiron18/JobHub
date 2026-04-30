import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002/api',
  timeout: 70000, // 70s timeout to allow server-side LLM calls (60s) to finish
});

// Inject Supabase JWT on every request
api.interceptors.request.use(
  async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('API Request:', config.method?.toUpperCase(), config.url, 'Token injected');
    } else {
      console.warn('API Request:', config.method?.toUpperCase(), config.url, 'No token found');
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Retry 401s once — Supabase's getUser() API can take ~1-2s to recognise a brand-new
// session token after signUp(). Only retry when we have a valid session (so we don't
// silently swallow legitimate auth errors from unauthenticated requests).
// Never retry multipart/form-data — FormData is a consumed stream and the retry would
// send an empty body, causing silent data loss on file uploads.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as typeof error.config & { _retried?: boolean };
    const contentType = String(config.headers?.['Content-Type'] ?? config.headers?.['content-type'] ?? '');
    const isMultipart = contentType.includes('multipart');
    if (error.response?.status === 401 && !config._retried && !isMultipart) {
      config._retried = true;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await new Promise(r => setTimeout(r, 1500));
        config.headers.Authorization = `Bearer ${session.access_token}`;
        return api(config);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
