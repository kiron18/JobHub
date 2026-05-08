import * as Sentry from '@sentry/react';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './lib/analytics'

initAnalytics();

// Keep Railway server warm — ping every 4 minutes to prevent cold-start CORS failures
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
setInterval(() => {
  fetch(`${API_URL}/health`, { method: 'GET' }).catch(() => {});
}, 4 * 60 * 1000);

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.1,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
