/**
 * /api/admin/expenses: what the business runs on and how close each service
 * is to its limit.
 *
 *   GET /?refresh=1
 *
 * OpenRouter, Apify and SerpApi are read live from their own APIs; the rest
 * are fixed monthly figures typed in below. Cached for an hour.
 *
 * No page reads this yet. It was cut along with the old admin dashboard and
 * put back for the admin redesign.
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { serpApiKey } from '../services/serpapi';

const router = Router();

router.use(authenticate, requireAdmin);

type ExpenseStatus = 'live' | 'manual' | 'error';
type ExpenseUrgency = 'good' | 'warning' | 'critical' | 'unknown';

interface ExpenseEntry {
  id: string;
  name: string;
  category: string;
  status: ExpenseStatus;
  balance?: number;
  used?: number;
  limit?: number;
  usedPct?: number;
  monthlyCostAUD?: number;
  billingCycle: 'monthly' | 'annual' | 'per-transaction' | 'free';
  description: string;
  urgency: ExpenseUrgency;
  lastFetched?: string;
  error?: string;
}

interface ExpensesResponse {
  services: ExpenseEntry[];
  totalMonthlyAUD: number;
  fetchedAt: string;
}

const expensesCache: { data: ExpensesResponse | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
const EXPENSES_CACHE_TTL_MS = 60 * 60 * 1000;
const USD_TO_AUD = 1.55;

function computeUrgency(entry: Partial<ExpenseEntry>): ExpenseUrgency {
  if (entry.status === 'error') return 'unknown';
  if (entry.usedPct !== undefined) {
    if (entry.usedPct >= 90) return 'critical';
    if (entry.usedPct >= 70) return 'warning';
    return 'good';
  }
  if (entry.balance !== undefined && entry.limit === undefined) {
    if (entry.balance < 2) return 'critical';
    if (entry.balance < 5) return 'warning';
    return 'good';
  }
  return 'unknown';
}

async function fetchOpenRouter(): Promise<Partial<ExpenseEntry>> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    const balance = json?.data?.limit_remaining ?? null;
    const usage = json?.data?.usage ?? null;
    const limit = json?.data?.limit ?? null;
    const usedPct = limit && usage !== null ? Math.round((usage / limit) * 100) : undefined;
    return {
      status: 'live',
      balance: balance !== null ? Math.round(balance * 100) / 100 : undefined,
      used: usage !== null ? Math.round(usage * 100) / 100 : undefined,
      limit: limit !== null ? Math.round(limit * 100) / 100 : undefined,
      usedPct,
      lastFetched: new Date().toISOString(),
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

async function fetchApify(): Promise<Partial<ExpenseEntry>> {
  try {
    const key = process.env.APIFY_API_KEY?.trim();
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    const used = json?.data?.plan?.monthlyUsageCredits ?? null;
    const limit = json?.data?.plan?.maxMonthlyUsageCredits ?? null;
    const usedPct = limit && used !== null ? Math.round((used / limit) * 100) : undefined;
    return {
      status: 'live',
      used: used !== null ? used : undefined,
      limit: limit !== null ? limit : undefined,
      usedPct,
      lastFetched: new Date().toISOString(),
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

async function fetchSerpApi(): Promise<Partial<ExpenseEntry>> {
  try {
    const res = await fetch(`https://serpapi.com/account.json?api_key=${serpApiKey()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as any;
    const monthly = json?.searches_per_month ?? null;
    const left = json?.plan_searches_left ?? null;
    const used = monthly !== null && left !== null ? monthly - left : null;
    const usedPct = monthly && used !== null ? Math.round((used / monthly) * 100) : undefined;
    return {
      status: 'live',
      balance: left !== null ? left : undefined,
      used: used !== null ? used : undefined,
      limit: monthly !== null ? monthly : undefined,
      usedPct,
      lastFetched: new Date().toISOString(),
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

async function buildExpensesData(): Promise<ExpensesResponse> {
  const [orResult, apifyResult, serpResult] = await Promise.allSettled([
    fetchOpenRouter(),
    fetchApify(),
    fetchSerpApi(),
  ]);

  const orData  = orResult.status    === 'fulfilled' ? orResult.value    : { status: 'error' as ExpenseStatus, error: 'Fetch failed' };
  const apifyData = apifyResult.status === 'fulfilled' ? apifyResult.value : { status: 'error' as ExpenseStatus, error: 'Fetch failed' };
  const serpData  = serpResult.status  === 'fulfilled' ? serpResult.value  : { status: 'error' as ExpenseStatus, error: 'Fetch failed' };

  const services: ExpenseEntry[] = [
    {
      id: 'openrouter', name: 'OpenRouter', category: 'AI / LLM',
      ...orData, monthlyCostAUD: undefined, billingCycle: 'per-transaction',
      description: 'LLM API gateway — pay per token (USD credits)',
      urgency: computeUrgency(orData),
    } as ExpenseEntry,
    {
      id: 'railway', name: 'Railway', category: 'Hosting',
      status: 'manual', monthlyCostAUD: Math.round(5 * USD_TO_AUD),
      billingCycle: 'monthly', description: 'Hobby plan — usage-based (~$5 base). Agent usage limit: $5 — monitor closely.',
      urgency: 'warning',
    },
    {
      id: 'godaddy', name: 'GoDaddy', category: 'Domain',
      status: 'manual', monthlyCostAUD: 2.08,
      billingCycle: 'annual', description: 'Domain registration (billed annually)',
      urgency: 'good',
    },
    {
      id: 'apify', name: 'Apify', category: 'Scraping',
      ...apifyData, monthlyCostAUD: undefined, billingCycle: 'monthly',
      description: 'Job board scraping — monthly compute credits',
      urgency: computeUrgency(apifyData),
    } as ExpenseEntry,
    {
      id: 'serpapi', name: 'SERP API', category: 'Search',
      ...serpData, monthlyCostAUD: undefined, billingCycle: 'monthly',
      description: 'Search lookups — free 100/mo tier',
      urgency: computeUrgency(serpData),
    } as ExpenseEntry,
    {
      id: 'resend', name: 'Resend', category: 'Email',
      status: 'manual', billingCycle: 'free',
      description: 'Transactional email — free tier (3,000/mo)',
      urgency: 'good',
    },
    {
      id: 'pinecone', name: 'Pinecone', category: 'Vector DB',
      status: 'manual', billingCycle: 'free',
      description: 'Vector search for achievements — free tier',
      urgency: 'good',
    },
    {
      id: 'skool', name: 'Skool', category: 'Community',
      status: 'manual', monthlyCostAUD: Math.round(99 * USD_TO_AUD),
      billingCycle: 'monthly', description: 'Community platform subscription',
      urgency: 'good',
    },
    {
      id: 'nanobanana', name: 'Nano Banana', category: 'Marketing',
      status: 'manual',
      billingCycle: 'per-transaction', description: 'Marketing / outreach tool — pay per use, no flat monthly fee',
      urgency: 'good',
    },
    {
      id: 'stripe', name: 'Stripe', category: 'Payments',
      status: 'manual', billingCycle: 'per-transaction',
      description: '2.9% + $0.30 per transaction (AU cards slightly higher)',
      urgency: 'good',
    },
    {
      id: 'llamacloud', name: 'LlamaCloud', category: 'AI / Parse',
      status: 'manual', billingCycle: 'per-transaction',
      description: 'Document parsing — pay per page processed',
      urgency: 'unknown',
    },
  ];

  const totalMonthlyAUD = services.reduce((sum, s) => {
    if (s.monthlyCostAUD && (s.billingCycle === 'monthly' || s.billingCycle === 'annual')) {
      return sum + s.monthlyCostAUD;
    }
    return sum;
  }, 0);

  return { services, totalMonthlyAUD, fetchedAt: new Date().toISOString() };
}

router.get('/', async (req, res) => {
  const forceRefresh = req.query.refresh === '1';
  const now = Date.now();

  if (!forceRefresh && expensesCache.data && (now - expensesCache.fetchedAt) < EXPENSES_CACHE_TTL_MS) {
    return res.json({ ...expensesCache.data, cached: true });
  }

  try {
    const data = await buildExpensesData();
    expensesCache.data = data;
    expensesCache.fetchedAt = now;
    return res.json({ ...data, cached: false });
  } catch (err) {
    console.error('[admin/expenses] error:', err);
    return res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

export default router;
