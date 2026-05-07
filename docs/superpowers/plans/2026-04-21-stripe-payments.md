# Stripe Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual Skool-membership access flow with Stripe subscriptions ($67/mo or $497/yr AUD), a 5-job free trial, and automatic access grant/revocation via webhooks.

**Architecture:** Stripe Checkout (hosted page) handles all payment UI — no Stripe.js on the frontend. Server creates a checkout session and returns a URL; browser redirects there. On completion Stripe fires a webhook to the server which updates `dashboardAccess` in the DB. Three exempt emails bypass payment entirely. Free trial is tracked server-side via `freeJobsUsed` on `CandidateProfile` and enforced in a middleware that wraps the `/api/analyze/job` endpoint.

**Tech Stack:** `stripe` npm package (server), Stripe Checkout hosted page, Prisma migration, Express middleware, React state for trial counter + post-payment polling.

---

## Environment variables

These must already be set (user confirmed):

**Railway (server):**
- `STRIPE_SECRET_KEY` — `sk_live_...`
- `WEBHOOK_SECRET` — `whsec_...`
- `MONTHLY_PRICE_ID` — `price_...`
- `ANNUAL_PRICE_ID` — `price_...`

**Vercel (frontend):** none needed — Stripe Checkout is a server-side redirect, no publishable key required.

---

## Exempt emails (always have full access, no charge)

```
kamiproject2021@gmail.com
kiron182@gmail.com
kiron@aussiegradcareers.com.au
```

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/prisma/schema.prisma` | Modify | Add 4 Stripe fields to `CandidateProfile` |
| `server/src/routes/stripe.ts` | Create | Checkout session, portal session, webhook handler |
| `server/src/index.ts` | Modify | Register webhook route BEFORE `express.json()`, register stripe router after |
| `server/src/routes/analyze.ts` | Modify | Add trial guard to `POST /job` — increment `freeJobsUsed`, block at 5 |
| `server/src/routes/profile/profile-core.ts` | Modify | Auto-grant `dashboardAccess` for exempt emails on `GET /profile` |
| `src/App.tsx` | Modify | Redesign `DashboardGate`: trial counter, Stripe checkout buttons, post-payment polling, past_due banner |

---

## Task 1: Prisma schema — add Stripe fields

**Files:**
- Modify: `server/prisma/schema.prisma`

- [ ] **Step 1: Add 4 fields to `CandidateProfile` in schema.prisma**

Open `server/prisma/schema.prisma`. Inside `model CandidateProfile { ... }`, add these four lines after the `skoolCommunityEmail` field:

```prisma
  stripeCustomerId     String?
  stripeSubscriptionId String?
  subscriptionStatus   String?
  freeJobsUsed         Int     @default(0)
```

- [ ] **Step 2: Generate and apply the migration**

```bash
cd server
npx prisma migrate dev --name add_stripe_fields
```

Expected output ends with: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify the fields exist in the DB**

```bash
npx prisma studio
```

Open `CandidateProfile` table — confirm columns `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `freeJobsUsed` are present. Close studio (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
cd ..
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add Stripe subscription fields to CandidateProfile"
```

---

## Task 2: Install Stripe and create the stripe routes file

**Files:**
- Create: `server/src/routes/stripe.ts`

- [ ] **Step 1: Install the stripe package**

```bash
cd server
npm install stripe
```

Expected: `added 1 package` (stripe has no sub-dependencies).

- [ ] **Step 2: Create `server/src/routes/stripe.ts`**

Create the file with the full content below. This file exports three things:
- `stripeWebhookHandler` — a raw-body Express handler used for webhooks (registered before `express.json()`)
- `stripeRouter` — an Express Router with the checkout and portal endpoints (registered after `express.json()`)
- The `EXEMPT_EMAILS` constant used by the analyze guard in Task 4

```typescript
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

export const EXEMPT_EMAILS = [
  'kamiproject2021@gmail.com',
  'kiron182@gmail.com',
  'kiron@aussiegradcareers.com.au',
];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
});

const APP_URL = (process.env.ALLOWED_ORIGIN ?? 'https://job-hub-snowy-ten.vercel.app')
  .split(',')[0]
  .trim();

// ── Webhook handler — must receive raw body, registered before express.json() ──
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      process.env.WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('[stripe/webhook] Signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook signature error: ${err.message}` });
    return;
  }

  console.log(`[stripe/webhook] Event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) {
          console.warn('[stripe/webhook] No userId in session metadata — skipping');
          break;
        }
        // Retrieve full subscription details
        const subscriptionId = session.subscription as string | null;
        await prisma.candidateProfile.update({
          where: { userId },
          data: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId ?? undefined,
            subscriptionStatus: 'active',
            dashboardAccess: true,
          },
        });
        console.log(`[stripe/webhook] Granted access to userId=${userId}`);
        break;
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.warn(`[stripe/webhook] Async payment failed for session=${session.id}`);
        // No access granted — no DB change needed
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!profile) {
          console.warn(`[stripe/webhook] No profile for subscriptionId=${sub.id}`);
          break;
        }
        const isActive = sub.status === 'active' || sub.status === 'trialing';
        const isPastDue = sub.status === 'past_due' || sub.status === 'unpaid';
        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: sub.status,
            // Only revoke immediately on canceled/incomplete_expired — past_due gets grace
            dashboardAccess: isActive || isPastDue ? true : false,
          },
        });
        console.log(`[stripe/webhook] Subscription ${sub.id} → status=${sub.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!profile) break;
        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: 'canceled',
            dashboardAccess: false,
          },
        });
        console.log(`[stripe/webhook] Revoked access for subscriptionId=${sub.id}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice.subscription as string) ?? null;
        if (!subId) break;
        const profile = await prisma.candidateProfile.findFirst({
          where: { stripeSubscriptionId: subId },
        });
        if (!profile) break;
        // Mark past_due but keep access — Stripe retries over 7 days
        await prisma.candidateProfile.update({
          where: { id: profile.id },
          data: { subscriptionStatus: 'past_due' },
        });
        console.log(`[stripe/webhook] Payment failed for subscriptionId=${subId} — marked past_due`);
        break;
      }

      default:
        console.log(`[stripe/webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('[stripe/webhook] Handler error:', err);
    res.status(500).json({ error: 'Webhook handler error' });
    return;
  }

  res.json({ received: true });
}

// ── Router — checkout and portal (registered after express.json()) ──
const router = Router();

// POST /api/stripe/checkout
// Creates a Stripe Checkout session and returns the redirect URL.
// Body: { plan: 'monthly' | 'annual' }
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const userEmail = req.user!.email ?? '';
  const { plan } = req.body as { plan?: string };

  if (plan !== 'monthly' && plan !== 'annual') {
    res.status(400).json({ error: 'plan must be "monthly" or "annual"' });
    return;
  }

  if (EXEMPT_EMAILS.includes(userEmail.toLowerCase())) {
    res.status(400).json({ error: 'This account has complimentary access.' });
    return;
  }

  const priceId = plan === 'monthly'
    ? process.env.MONTHLY_PRICE_ID!
    : process.env.ANNUAL_PRICE_ID!;

  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Reuse existing Stripe customer if the user has subscribed before
      ...(profile?.stripeCustomerId
        ? { customer: profile.stripeCustomerId }
        : { customer_email: userEmail }
      ),
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId },
      success_url: `${APP_URL}/dashboard?payment=success`,
      cancel_url: `${APP_URL}/dashboard`,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[stripe/checkout] Error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/stripe/portal
// Creates a Stripe Customer Portal session so users can manage/cancel their subscription.
router.post('/portal', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const profile = await prisma.candidateProfile.findUnique({ where: { userId } });
    if (!profile?.stripeCustomerId) {
      res.status(400).json({ error: 'No Stripe customer found for this account' });
      return;
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${APP_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[stripe/portal] Error:', err.message);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

export default router;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server
npx tsc --noEmit
```

Expected: no errors. If you see `apiVersion` type error, update the version string to match what the `stripe` package accepts — check `node_modules/stripe/types/index.d.ts` for the literal union.

- [ ] **Step 4: Commit**

```bash
cd ..
git add server/src/routes/stripe.ts server/package.json server/package-lock.json
git commit -m "feat(stripe): checkout, portal, and webhook route handlers"
```

---

## Task 3: Register Stripe routes in index.ts

The webhook must be registered **before** `app.use(express.json())` because Stripe signature verification requires the raw request body. All other stripe routes go after.

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: Add the import for stripe routes at the top of index.ts**

Find the block of router imports (around line 8–20). Add these two lines after the existing imports:

```typescript
import stripeRouter, { stripeWebhookHandler } from './routes/stripe';
```

- [ ] **Step 2: Register the webhook route before `express.json()`**

Find this line in `index.ts`:

```typescript
app.use(express.json({ limit: '10mb' }));
```

Add the webhook route **immediately before** it:

```typescript
// Stripe webhook — must use raw body BEFORE express.json() parses the request
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({ limit: '10mb' }));
```

- [ ] **Step 3: Register the stripe router after the JSON middleware**

Find the block of `app.use(...)` route registrations (around line 100–115). Add this line after `app.use('/api/admin', adminRouter)`:

```typescript
app.use('/api/stripe', stripeRouter);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke test locally**

```bash
npm run dev
```

In a separate terminal:

```bash
curl -X POST http://localhost:3002/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: invalid" \
  -d '{}'
```

Expected response: `{"error":"Webhook signature error: ..."}` with status 400. This confirms the route is reachable and signature verification is running.

- [ ] **Step 6: Commit**

```bash
cd ..
git add server/src/index.ts
git commit -m "feat(stripe): register webhook before JSON middleware, add stripe router"
```

---

## Task 4: Add trial guard to the job analysis endpoint

When a user runs a job analysis (`POST /api/analyze/job`), the server must:
1. Let exempt emails through unconditionally
2. Let active subscribers through (`dashboardAccess = true`)
3. Let users with `freeJobsUsed < 5` through, then increment `freeJobsUsed`
4. Block anyone else with `402 Payment Required`

**Files:**
- Modify: `server/src/routes/analyze.ts`

- [ ] **Step 1: Import `EXEMPT_EMAILS` at the top of analyze.ts**

Find the existing imports in `server/src/routes/analyze.ts` (around line 1–15). Add:

```typescript
import { EXEMPT_EMAILS } from './stripe';
```

- [ ] **Step 2: Add the trial guard inside the `POST /job` handler**

In `server/src/routes/analyze.ts`, find the `router.post('/job', ...)` handler. After this block that fetches the profile:

```typescript
const profile = await prisma.candidateProfile.findUnique({
    where: { userId } as any,
    include: { achievements: true }
}) as any;

if (!profile) {
    return res.status(404).json({ error: 'Please set up your profile first.' });
}
```

Add the trial guard immediately after the `if (!profile)` block:

```typescript
// ── Trial / subscription guard ───────────────────────────────────────────────
const userEmail = (req.user?.email ?? '').toLowerCase();
const isExempt = EXEMPT_EMAILS.includes(userEmail);
const hasPaidAccess = profile.dashboardAccess === true;
const trialJobsUsed: number = profile.freeJobsUsed ?? 0;
const hasTrialLeft = trialJobsUsed < 5;

if (!isExempt && !hasPaidAccess && !hasTrialLeft) {
  return res.status(402).json({
    error: 'Trial limit reached',
    freeJobsUsed: trialJobsUsed,
    upgradeRequired: true,
  });
}

// Increment trial counter for non-exempt, non-paid users
if (!isExempt && !hasPaidAccess && hasTrialLeft) {
  await prisma.candidateProfile.update({
    where: { userId },
    data: { freeJobsUsed: { increment: 1 } },
  });
}
// ────────────────────────────────────────────────────────────────────────────
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ..
git add server/src/routes/analyze.ts
git commit -m "feat(stripe): trial guard on job analysis — 5 free jobs then paywall"
```

---

## Task 5: Auto-grant access for exempt emails in profile endpoint

When an exempt user fetches their profile, ensure `dashboardAccess` is set to `true` in the DB so the frontend consistently shows them as having full access.

**Files:**
- Modify: `server/src/routes/profile/profile-core.ts`

- [ ] **Step 1: Import `EXEMPT_EMAILS` in profile-core.ts**

At the top of `server/src/routes/profile/profile-core.ts`, add:

```typescript
import { EXEMPT_EMAILS } from '../stripe';
```

- [ ] **Step 2: Add exempt check after profile is fetched in `GET /profile`**

In the `GET /profile` handler, find this block (around line 15–20):

```typescript
if (!profile) return res.json(null);
```

Immediately after it, add:

```typescript
// Auto-grant access for exempt accounts
const authEmail = ((req as any).user?.email ?? '').toLowerCase();
if (EXEMPT_EMAILS.includes(authEmail) && !profile.dashboardAccess) {
  await prisma.candidateProfile.update({
    where: { userId },
    data: { dashboardAccess: true },
  });
  profile.dashboardAccess = true;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ..
git add server/src/routes/profile/profile-core.ts
git commit -m "feat(stripe): auto-grant dashboardAccess for exempt email accounts"
```

---

## Task 6: Redesign DashboardGate in App.tsx

Replace the manual request flow with:
- **Trial users** (`freeJobsUsed < 5`, `!dashboardAccess`): see the dashboard with a top banner showing how many free analyses remain
- **Paywall** (`freeJobsUsed >= 5`, `!dashboardAccess`): see the locked tools grid + Stripe checkout buttons
- **Paid users** (`dashboardAccess = true`): see the dashboard, optionally a "Manage subscription" link
- **`past_due`**: see dashboard with a payment-failed banner
- **`?payment=success`**: poll profile every 2s until `dashboardAccess` flips to `true` (webhook delay), then clear the query param

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace the entire `DashboardGate` function**

Find and replace the current `DashboardGate` function (and keep `AccessRequestModal` if you want, but it will no longer be used — delete it). Replace with the following:

```tsx
// ── Trial counter banner shown to free-trial users inside the dashboard ──────
export function TrialBanner({ freeJobsUsed }: { freeJobsUsed: number }) {
  const remaining = 5 - freeJobsUsed;
  const [checkingOut, setCheckingOut] = React.useState(false);

  async function handleCheckout(plan: 'monthly' | 'annual') {
    setCheckingOut(true);
    try {
      const { data } = await api.post('/stripe/checkout', { plan });
      window.location.href = data.url;
    } catch {
      setCheckingOut(false);
    }
  }

  return (
    <div style={{
      background: remaining <= 1
        ? 'linear-gradient(90deg, rgba(220,38,38,0.12), rgba(220,38,38,0.06))'
        : 'linear-gradient(90deg, rgba(15,118,110,0.12), rgba(15,118,110,0.06))',
      borderBottom: `1px solid ${remaining <= 1 ? 'rgba(220,38,38,0.2)' : 'rgba(15,118,110,0.2)'}`,
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap',
    }}>
      <p style={{ margin: 0, fontSize: 13, color: remaining <= 1 ? '#fca5a5' : '#99F6E4', fontWeight: 600 }}>
        {remaining === 0
          ? 'You have used all 5 free job analyses.'
          : `${remaining} free job ${remaining === 1 ? 'analysis' : 'analyses'} remaining.`}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => handleCheckout('monthly')}
          disabled={checkingOut}
          style={{
            background: 'linear-gradient(135deg, #0F766E, #134E4A)',
            color: 'white', border: 'none', borderRadius: 8,
            padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {checkingOut ? '...' : 'Subscribe $67/mo →'}
        </button>
        <button
          onClick={() => handleCheckout('annual')}
          disabled={checkingOut}
          style={{
            background: 'none', border: '1px solid rgba(45,212,191,0.3)',
            color: '#2dd4bf', borderRadius: 8,
            padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {checkingOut ? '...' : '$497/yr (save 38%)'}
        </button>
      </div>
    </div>
  );
}

// ── Past-due warning banner ───────────────────────────────────────────────────
function PastDueBanner() {
  const [loading, setLoading] = React.useState(false);

  async function handlePortal() {
    setLoading(true);
    try {
      const { data } = await api.post('/stripe/portal');
      window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(220,38,38,0.12), rgba(220,38,38,0.06))',
      borderBottom: '1px solid rgba(220,38,38,0.2)',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <p style={{ margin: 0, fontSize: 13, color: '#fca5a5', fontWeight: 600 }}>
        Your last payment failed. Update your payment method to keep access.
      </p>
      <button
        onClick={handlePortal}
        disabled={loading}
        style={{
          background: '#dc2626', color: 'white', border: 'none',
          borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {loading ? '...' : 'Update payment →'}
      </button>
    </div>
  );
}

function DashboardGate({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await api.get('/profile');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { signOut } = useAuth();
  const [checkingOut, setCheckingOut] = useState(false);

  // Post-payment polling: Stripe webhook may arrive after redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;

    // Remove the query param immediately so refreshing doesn't re-trigger
    window.history.replaceState({}, '', '/dashboard');

    // Poll profile every 2s until dashboardAccess is true or 30s elapses
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      const cached = queryClient.getQueryData<any>(['profile']);
      if (cached?.dashboardAccess || attempts >= 15) {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [queryClient]);

  if (isLoading) return null;

  const freeJobsUsed: number = profile?.freeJobsUsed ?? 0;
  const hasTrialLeft = freeJobsUsed < 5;
  const isPaid = profile?.dashboardAccess === true;
  const isPastDue = profile?.subscriptionStatus === 'past_due';

  // Has access — either paid or trial remaining
  if (isPaid || hasTrialLeft) {
    return (
      <>
        {isPastDue && <PastDueBanner />}
        {!isPaid && hasTrialLeft && <TrialBanner freeJobsUsed={freeJobsUsed} />}
        {children}
      </>
    );
  }

  // No access — paywall
  async function handleCheckout(plan: 'monthly' | 'annual') {
    setCheckingOut(true);
    try {
      const { data } = await api.post('/stripe/checkout', { plan });
      window.location.href = data.url;
    } catch {
      setCheckingOut(false);
    }
  }

  async function handlePortal() {
    setCheckingOut(true);
    try {
      const { data } = await api.post('/stripe/portal');
      window.location.href = data.url;
    } catch {
      setCheckingOut(false);
    }
  }

  const TOOLS = [
    { icon: '🎯', label: 'Job Match Analyser', desc: 'Score any job against your profile and get ranked achievements in seconds' },
    { icon: '✉️', label: 'Cover Letter Generator', desc: 'Personalised cover letters written for the specific company and role' },
    { icon: '📊', label: 'Application Tracker', desc: 'Track every application, interview, and offer in one place' },
    { icon: '🧠', label: 'Achievement Bank', desc: 'Your experience organised for instant retrieval and tailoring' },
    { icon: '💼', label: 'Resume Versions', desc: 'Store and switch between targeted resume versions' },
    { icon: '📧', label: 'Email Templates', desc: "Follow-up and networking templates that don't sound like templates" },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, overflowY: 'auto',
      background: 'linear-gradient(160deg, #060b14 0%, #0a1628 50%, #060b14 100%)',
      padding: '48px 24px 80px',
    }}>
      <button
        onClick={() => signOut()}
        style={{
          position: 'absolute', top: 20, right: 24,
          background: 'none', border: '1px solid rgba(255,255,255,0.10)',
          color: '#6b7280', borderRadius: 10, padding: '8px 14px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Sign out
      </button>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#4b5563', marginBottom: 16 }}>
              JobHub Pro
            </p>
            <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, color: '#f3f4f6', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.025em' }}>
              You've used your 5 free analyses.<br />
              <span style={{ color: '#FCD34D' }}>Ready to keep going?</span>
            </h1>
            <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.7, maxWidth: 480, margin: '0 auto' }}>
              Subscribe to unlock unlimited job analyses, cover letters, selection criteria, and everything below.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}>
            {TOOLS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.05 }}
                style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '16px', filter: 'grayscale(0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{t.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>{t.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#374151', fontWeight: 700, background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '2px 6px' }}>locked</span>
                </div>
                <p style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5, margin: 0 }}>{t.desc}</p>
              </motion.div>
            ))}
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '32px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                background: 'linear-gradient(135deg, #0F766E22, #13224422)',
                border: '1px solid rgba(45,212,191,0.2)',
                borderRadius: 12, padding: '10px 14px', flex: 1,
              }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#99F6E4' }}>Monthly</p>
                <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 900, color: 'white' }}>$67<span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>/month</span></p>
              </div>
              <div style={{ color: '#374151', fontWeight: 700, fontSize: 12 }}>or</div>
              <div style={{
                background: 'linear-gradient(135deg, #0F766E22, #13224422)',
                border: '1px solid rgba(45,212,191,0.2)',
                borderRadius: 12, padding: '10px 14px', flex: 1,
              }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#99F6E4' }}>Annual</p>
                <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 900, color: 'white' }}>$497<span style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>/year</span></p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#0F766E', fontWeight: 600 }}>Save 38%</p>
              </div>
            </div>

            <button
              onClick={() => handleCheckout('monthly')}
              disabled={checkingOut}
              style={{
                width: '100%',
                background: checkingOut ? 'rgba(15,118,110,0.4)' : 'linear-gradient(135deg, #0F766E, #134E4A)',
                color: 'white', border: 'none', borderRadius: 14, padding: '15px',
                fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em',
                cursor: checkingOut ? 'default' : 'pointer',
                boxShadow: '0 6px 24px rgba(15,118,110,0.30)', marginBottom: 10,
              }}
            >
              {checkingOut ? 'Redirecting...' : 'Subscribe monthly — $67/mo →'}
            </button>
            <button
              onClick={() => handleCheckout('annual')}
              disabled={checkingOut}
              style={{
                width: '100%', background: 'none',
                border: '1px solid rgba(45,212,191,0.25)',
                color: '#2dd4bf', borderRadius: 14, padding: '14px',
                fontSize: 15, fontWeight: 700, cursor: checkingOut ? 'default' : 'pointer',
                marginBottom: 10,
              }}
            >
              {checkingOut ? 'Redirecting...' : 'Subscribe annually — $497/yr (best value)'}
            </button>
            {profile?.stripeCustomerId && (
              <button
                onClick={handlePortal}
                disabled={checkingOut}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  color: '#4b5563', fontSize: 12, cursor: 'pointer', padding: '8px',
                }}
              >
                Manage existing subscription
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove the `AccessRequestModal` function**

Delete the `AccessRequestModal` function entirely from `src/App.tsx` — it is no longer used.

- [ ] **Step 3: Add `useQueryClient` to the import if not already there**

Check the top of `src/App.tsx`. The import line should already include `useQueryClient`:

```tsx
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
```

If `useQueryClient` is missing, add it to this import.

- [ ] **Step 4: Build the frontend to check for TypeScript errors**

```bash
cd E:/AntiGravity/JobHub
npm run build
```

Expected: build completes with no errors. Fix any TypeScript errors before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(stripe): DashboardGate with trial counter, Stripe checkout, post-payment polling"
```

---

## Task 7: End-to-end test with Stripe test mode

Before going live, verify the full flow using Stripe's test card numbers.

**Prerequisites:** Switch to test mode in the Stripe dashboard (toggle in top-left). Your `.env` will need test keys (different from live keys). Create test products with the same prices and update `MONTHLY_PRICE_ID` / `ANNUAL_PRICE_ID` in `.env` to the test price IDs.

- [ ] **Step 1: Set up Stripe CLI for local webhook forwarding**

Install the Stripe CLI: https://stripe.com/docs/stripe-cli

```bash
stripe login
stripe listen --forward-to http://localhost:3002/api/stripe/webhook
```

Leave this running. It will print a webhook signing secret — use this as `WEBHOOK_SECRET` in `.env` for local testing (different from the production webhook secret).

- [ ] **Step 2: Start the dev server**

```bash
cd server && npm run dev
```

- [ ] **Step 3: Test the monthly checkout flow**

1. Log in to the app locally as a non-exempt user
2. Click "Subscribe monthly" in DashboardGate
3. You should be redirected to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`, expiry `12/34`, CVC `123`, postcode `2000`
5. Complete payment
6. You should be redirected to `/dashboard?payment=success`
7. The app should poll and then grant access — `DashboardGate` renders children
8. Check the Stripe CLI terminal — it should show `checkout.session.completed` was received

- [ ] **Step 4: Test the cancellation flow**

1. In Stripe dashboard (test mode) → Customers → find the test customer → cancel the subscription
2. The Stripe CLI should show `customer.subscription.deleted`
3. Refresh the app — `dashboardAccess` should be `false`, paywall appears

- [ ] **Step 5: Test the trial limit**

1. Clear the DB: `UPDATE "CandidateProfile" SET "freeJobsUsed" = 5 WHERE "userId" = '<your-test-user-id>';`
2. Try running a job analysis in the MatchEngine
3. Expected: `402` response, trial banner shows paywall

- [ ] **Step 6: Test an exempt email**

1. Log in with `kiron182@gmail.com` (or whichever is set in DEV_BYPASS_AUTH)
2. Dashboard should load with no paywall and no trial counter
3. Running a job analysis should succeed regardless of `freeJobsUsed`

- [ ] **Step 7: Switch back to live keys before deploying**

Restore `STRIPE_SECRET_KEY`, `WEBHOOK_SECRET`, `MONTHLY_PRICE_ID`, `ANNUAL_PRICE_ID` to live values in Railway. The production webhook URL (`https://your-server.railway.app/api/stripe/webhook`) should already be registered in the Stripe dashboard under live mode.

- [ ] **Step 8: Commit and push**

```bash
git add -A
git commit -m "test(stripe): verified full checkout, cancellation, and trial guard flows"
git push
```

---

## Post-deploy checklist

- [ ] Confirm the Stripe webhook in live mode is pointing at the production Railway URL (not localhost)
- [ ] Confirm `WEBHOOK_SECRET` in Railway matches the live webhook signing secret (not the CLI test secret)
- [ ] Make a real $1 test purchase using a real card (Stripe has a refund tool) to confirm the end-to-end flow in production
- [ ] In Stripe → Settings → Customer portal, configure: allow plan switching, allow cancellation, show invoices. Set the return URL to your production app URL.
- [ ] Add GST note to your Stripe product description if required by ATO (currently not mandatory under the $75k threshold, but worth checking)
