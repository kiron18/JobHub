import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002/api',
  timeout: 70000, // 70s timeout to allow server-side LLM calls (60s) to finish
});

// Inject Supabase JWT on every request. If no session, try refreshing first.
api.interceptors.request.use(
  async (config) => {
    let { data: { session } } = await supabase.auth.getSession();

    // If no in-memory session, attempt a silent token refresh before giving up.
    if (!session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session;
    }

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

// On 401: attempt one token refresh and retry. If refresh also fails, redirect to /auth
// (but not during onboarding submission — let the caller handle that gracefully).
let isRefreshing = false;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retried && !isRefreshing) {
      originalRequest._retried = true;
      isRefreshing = true;
      try {
        const { data } = await supabase.auth.refreshSession();
        if (data.session?.access_token) {
          isRefreshing = false;
          originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`;
          return api.request(originalRequest);
        }
      } catch {
        // refresh failed — fall through
      }
      isRefreshing = false;
      // During onboarding submission, let the caller surface the error rather than
      // hard-redirecting and losing the user's uploaded files.
      const isOnboardingSubmit = originalRequest.url?.includes('/onboarding/submit');
      if (!isOnboardingSubmit) {
        window.location.href = '/auth';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
