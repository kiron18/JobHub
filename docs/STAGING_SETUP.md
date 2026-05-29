# Staging Environment Setup

This document walks through provisioning the staging environment end-to-end.

## Overview

```
Local dev  →  staging branch  →  master (production)
              Vercel preview     aussiegradcareers.com
              Railway staging    Railway production
              Supabase staging   Supabase production
```

## Prerequisites

- GitHub write access to this repo
- Vercel project owner for this project
- Railway project owner for this project
- Supabase account (dashboard.supabase.com)

---

## Step 1 — Provision Staging Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click **New project**.
2. Give it a name like `jobhub-staging`.
3. Set a **strong database password** (save it — you'll need it in Step 2).
4. Choose the **same region** as production (AWS ap-northeast-1).
5. Wait for the project to provision (~2 min).

After provisioning, go to **Project Settings → Database** and copy:

- **Connection string (URI)**: `postgresql://postgres.<ref>:<password>@<host>:5432/postgres`

Go to **Project Settings → API** and copy:

- **Project URL**: `https://<ref>.supabase.co`
- **anon public key**: the `anon` key
- **service_role key**: the `service_role` key

Do **not** expose the service_role key to any frontend code.

---

## Step 2 — Configure Backend `.env.staging`

Edit `server/.env.staging` and replace all `<your-...>` placeholders:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Project URL from Step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Step 1 |
| `DATABASE_URL` | Connection string from Step 1 |
| `ALLOWED_ORIGIN` | Will fill in after Step 4 (Vercel preview URL) |

For all other service keys (OpenRouter, Stripe, Pinecone, Resend, etc.), copy the values from your production Railway environment or use dedicated staging keys if you prefer isolation.

---

## Step 3 — Deploy Staging Backend on Railway

1. Go to [railway.app](https://railway.app) → your project → **Environments** tab.
2. Click **New Environment** → name it `staging` → select **Duplicate from production**.
3. Railway will create a staging environment with its own URL (e.g. `jobhub-production-staging.up.railway.app`).
4. Go to the **Variables** tab and **replace every value** with the staging `.env.staging` content:
   - `DATABASE_URL` → staging Supabase connection string
   - `SUPABASE_URL` → staging Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` → staging service role key
   - `ALLOWED_ORIGIN` → your Vercel staging URL (get from Step 4)
5. In the **Deployments** tab, trigger a manual deploy or push to the `staging` branch (depending on your Railway Git integration setup).

> **Safety check:** Run `curl https://<staging-railway-url>.up.railway.app/api/health` to verify the backend is running.

---

## Step 4 — Connect Staging Branch on Vercel

1. Go to [vercel.com](https://vercel.com) → your project → **Settings → Git**.
2. Under **Production Branch**, verify it is set to `master`.
3. Under **Preview Branches**, confirm preview deployments are enabled.
4. Scroll to **Ignored Build Step** — leave it blank (deploy on every push to staging).
5. **Optional**: In **Environment Variables**, add the staging-specific values:
   - `VITE_SUPABASE_URL` = staging Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = staging anon key
   - `VITE_API_URL` = Railway staging URL (e.g. `https://jobhub-production-staging.up.railway.app/api`)

6. Push to the `staging` branch — Vercel will auto-deploy and give you a preview URL like:
   `https://jobhub-staging.vercel.app`

7. Copy this URL — you'll need it for `ALLOWED_ORIGIN` in Railway and for Supabase auth redirects.

---

## Step 5 — Configure Staging Auth Redirects (Supabase)

In the staging Supabase dashboard:

1. Go to **Authentication → URL Configuration**.
2. Add the following to **Site URL**: `https://jobhub-staging.vercel.app`
3. Add these to **Redirect URLs**:
   - `https://jobhub-staging.vercel.app/**` (wildcard covers all paths including AuthCallback)
   - `https://jobhub-production-staging.up.railway.app/**` (covers backend auth callbacks if any)
4. Save changes.

---

## Step 6 — Run Staging Database Migrations

In Railway staging environment:

1. Open a Railway shell or run via the deploy command:
   ```bash
   npx prisma migrate deploy
   ```
2. This applies all migrations to the **staging** Supabase database (not production).

The `preDeployCommand` in `railway.json` already runs `node scripts/migrate-safe.js`, so this should happen automatically on deploy.

---

## Step 7 — Final Verification Checklist

- [ ] Staging Supabase project created and reachable
- [ ] `server/.env.staging` has all staging values filled in
- [ ] Railway staging environment deployed and `/api/health` responds 200
- [ ] Vercel staging branch deployed and loads in the browser
- [ ] Auth: Can sign up / sign in on staging (uses staging Supabase auth)
- [ ] Auth callback URL works (redirects after email confirmation)
- [ ] All external APIs (OpenRouter, Stripe, Resend, etc.) functional
- [ ] Staging frontend and backend both point to staging Supabase
- [ ] Production data is NOT accessible from the staging environment

---

## Workflow: Local → Staging → Master

```bash
# Start from your feature branch
git checkout feat/my-feature

# Commit your work
git add .
git commit -m "feat: my feature"

# Merge into staging for testing
git checkout staging
git merge feat/my-feature
git push origin staging     # triggers Vercel + Railway deploy

# Test on staging, then merge to master
git checkout master
git merge staging
git push origin master      # triggers production deploy
```

> **After testing on staging**, reset the staging branch back to match master so it stays clean for the next cycle:
> ```bash
> git checkout staging
> git reset --hard master
> git push --force origin staging   # force push is acceptable here since staging is a shared branch
> ```
> (Alternatively, use `git revert` to back out changes without force push.)
