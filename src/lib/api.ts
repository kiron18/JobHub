import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002/api',
  timeout: 120000,
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

// On a 401, try refreshing the session once and retry.
// This handles genuinely expired tokens (Supabase tokens last 1 hour).
// Does NOT retry multipart/form-data — a consumed stream can't be resent.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as typeof error.config & { _retried?: boolean };
    const contentType = String(config.headers?.['Content-Type'] ?? config.headers?.['content-type'] ?? '');
    if (error.response?.status === 401 && !config._retried && !contentType.includes('multipart')) {
      config._retried = true;
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
        return api(config);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
