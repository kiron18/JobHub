import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: 'http://localhost:3002/api',
  timeout: 70000, // 70s timeout to allow server-side LLM calls (60s) to finish
});

// Add a request interceptor to inject the Supabase JWT
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
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
