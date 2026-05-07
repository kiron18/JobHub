# JobHub QA Checklist — Manual Review
**Date:** 2026-04-23  
**Tester:** Kiron  
**Version:** post-audit deploy (5 commits pushed today)

Mark each item: ✅ Pass | ❌ Fail | ⚠️ Partial | N/A

---

## 1. GLOBAL / THEME

- [ ] **Dark navy theme is default** — no user should land on a white/light page without toggling it themselves
- [ ] **Sidebar background** is deep navy (#0f172a range), not grey or black
- [ ] **Text contrast** — white/light text on dark backgrounds throughout; no grey-on-grey combos
- [ ] **Cards** use `glass-card` effect (subtle border, slight transparency) not flat white boxes
- [ ] **Teal accent** (#0d9488 / emerald-600) used consistently for CTAs and active nav items
- [ ] **Logo** "JobReady" / "JobHub" renders correctly in sidebar
- [ ] **No orphaned light-mode white panels** — check Email Templates, Documents, Profile pages specifically

---

## 2. AUTH / ONBOARDING

- [ ] **Sign up** with a fresh email → lands on onboarding intake, not dashboard
- [ ] **Login** with existing account → lands on dashboard (skips onboarding if already done)
- [ ] **Onboarding intake form** — all fields visible, dark background, correct text contrast
- [ ] **Resume upload** — accepts PDF, rejects .exe/.docx/images (should show error)
- [ ] **Cover letter upload** (optional) — can skip without error
- [ ] **Submitting intake** → spinner/loading state appears immediately
- [ ] **Diagnostic report loading modal** — progress bar advances from ~5% to ~88% over ~60 seconds
- [ ] **Progress bar** has shimmer animation (not a static bar)
- [ ] **Step labels change** — "Reading your intake answers" → "Analysing your resume" → "Identifying gaps" → "Writing diagnosis" → "Finalising"
- [ ] **Skool CTA card** appears below the progress bar with teal gradient border and "Join free on Skool →" button
- [ ] **Report renders** once complete — markdown sections visible, dark background

---

## 3. DASHBOARD

- [ ] **Dark navy background** matches onboarding colour scheme exactly
- [ ] **Match score widget** shows (or prompts to analyse a job if no jobs saved yet)
- [ ] **Job Feed widget** shows today's feed count or prompts to visit Job Feed
- [ ] **Quick-start cards** / feature tiles render with correct contrast
- [ ] **"Go to workspace" CTA** (post-diagnosis) is prominent and has persuasive copy
- [ ] **No broken widgets** — no blank white boxes, no "undefined" text

---

## 4. SIDEBAR NAVIGATION

- [ ] **Dashboard** link active and highlighted when on /
- [ ] **Job Feed** link present and working
- [ ] **Applications** link present and working
- [ ] **Documents** link present and working
- [ ] **Email Templates** link present and working
- [ ] **Profile & Achievements** link present and working
- [ ] **LinkedIn** — shows as a live link (NOT "Coming Soon" / greyed out)
- [ ] **Friday Brief** — only visible when logged in as admin (kiron182@gmail.com / kamiproject2021@gmail.com). Invisible to regular paid users.
- [ ] **Account section** at bottom — shows user email

---

## 5. JOB FEED

- [ ] **Feed loads** — jobs appear within 2–3 seconds on first visit of the day
- [ ] **Dark card styling** — job cards have dark background, correct text contrast
- [ ] **Company, title, location, salary** all visible on collapsed card
- [ ] **Match score badge** (if analysed) shows coloured grade
- [ ] **Platform badge** (Seek / LinkedIn / Other) shown correctly
- [ ] **Expand card** → reveals full description, bullets, addressee section, apply section
- [ ] **Hiring manager search** — on expand, a search triggers automatically. After a few seconds either:
  - A name appears ("Dear Sarah Chen,") with source label ("Found via web search")
  - OR "No specific contact found — we'll use 'Hiring Manager'"
  - NOT a permanent "Searching…" spinner
- [ ] **Addressee Edit button** — click Edit → input field appears → can type override name
- [ ] **Truncated description warning** — amber banner "Description is a preview" appears on Adzuna jobs with short descriptions; "Load full →" button works
- [ ] **"Open listing →" link** opens the source URL in a new tab
- [ ] **Generate Documents button** → navigates to workspace with JD pre-loaded
- [ ] **Save job button** → turns teal / confirmed; second click doesn't create duplicate
- [ ] **Refresh feed button** — triggers new Adzuna fetch; jobs list resets to page 1 (not appends)
- [ ] **"Search again" button** in empty state works (triggers refresh)
- [ ] **Load More** pagination — appends next page of jobs without duplicating
- [ ] **Profile incomplete banner** — if target role / city missing, shows prompt not a broken state

---

## 6. APPLICATION WORKSPACE (Document Generation)

- [ ] **Job description pre-filled** when coming from Job Feed "Generate Documents" button
- [ ] **Company Research Panel** auto-runs on load — fires Serper search and populates:
  - Salutation ("Dear [Name]," or "Dear Hiring Manager,")
  - Company highlights (2–4 bullet points)
  - Company size indicator
- [ ] **Salutation editable** — click edit → type override → saves
- [ ] **Analyse button** → triggers job scoring + match details
- [ ] **Match score** and dimension breakdown appears after analysis
- [ ] **Cover Letter tab** → Generate → loading spinner appears
- [ ] **Cover Letter** generates with correct salutation (hiring manager name if found, not hardcoded "Hiring Manager")
- [ ] **"Yours sincerely"** used when named salutation; **"Yours faithfully"** when "Dear Hiring Manager"
- [ ] **Resume tab** → generates a tailored resume
- [ ] **Selection Criteria tab** → visible; generates SC responses if criteria text pasted
- [ ] **Export .docx** button — disabled while generating; enabled once doc is ready; downloads a .docx file
- [ ] **Export .pdf** button — disabled while generating; spinner during export; downloads PDF
- [ ] **Daily limit** — after 10 generations, shows "Daily generation limit reached" message (not a 500 error)

---

## 7. LINKEDIN TOOLS

- [ ] **LinkedIn page accessible** — clicking LinkedIn in sidebar loads the page (no 403 or blank screen) for paid users
- [ ] **Unpaid users** → see a paywall / "requires subscription" message (not a 500 or blank)
- [ ] **LinkedIn Bio / About section generator** — paste target role → generates a LinkedIn About section
- [ ] **Headline generator** — generates 3–5 headline options
- [ ] **Outreach message generator** — fill in contact name, company, topic → generates personalised message
- [ ] **AI Headshot** — upload a photo → generates professional headshot
  - Accept: JPG, PNG, WebP
  - Reject: PDF, GIF (should show error)
  - Max 3 headshots per day shown / enforced
- [ ] **Save headshot** → saves to profile

---

## 8. EMAIL TEMPLATES

- [ ] **Page loads** with dark background (not the white/grey shown in screenshot)
- [ ] **8 templates** visible across categories: Outreach, Follow-Up, Interview, Networking, Offer
- [ ] **Filter tabs** (ALL / OUTREACH / FOLLOW-UP etc.) work — filters visible list
- [ ] **Expand template** → shows full email body with [placeholders] highlighted
- [ ] **Copy button** → copies to clipboard; shows confirmation toast
- [ ] **Category badge colours** match their category (teal = outreach, amber = follow-up, etc.)

---

## 9. PROFILE & ACHIEVEMENTS

- [ ] **Profile form** loads pre-filled with onboarding data
- [ ] **Edit fields** — name, location, target role, target city, skills, seniority
- [ ] **Work Experience** — can add / edit / delete entries
- [ ] **Achievements** — can add / edit / delete; metric field optional
- [ ] **Education** — can add / edit / delete
- [ ] **Profile completion score** visible (e.g. "74% complete")
- [ ] **Save changes** → success toast; data persists on reload

---

## 10. APPLICATIONS / JOB TRACKER

- [ ] **Saved jobs appear** after saving from Job Feed
- [ ] **Status column** — can change status (Saved → Applied → Interview → Offer)
- [ ] **Application detail view** — opens correct job
- [ ] **No duplicate entries** for the same job (save button guard working)

---

## 11. DOCUMENTS

- [ ] **Generated documents appear** in the list
- [ ] **Filter by type** — resume / cover letter / selection criteria
- [ ] **Open document** → full content visible
- [ ] **Upload resume** → accepts PDF, rejects other types (new MIME filter working)
- [ ] **No white/light background** on the documents page

---

## 12. PAYMENT / SUBSCRIPTION

- [ ] **Stripe checkout** loads when clicking upgrade (if tested with a non-exempt account)
- [ ] **Post-payment** → `dashboardAccess` flips to true; LinkedIn and full workspace unlock
- [ ] **Exempt emails** (kiron182@gmail.com, kamiproject2021@gmail.com, kiron@aussiegradcareers.com.au) — bypass payment gate with no subscription required
- [ ] **Trial** — non-exempt, non-paying users get 5 free job analyses; counter shown
- [ ] **Trial exhausted** → prompt to subscribe appears; does NOT crash

---

## 13. ADMIN (exempt email accounts only)

- [ ] **Friday Brief** page loads for admin accounts
- [ ] **Friday Brief** NOT visible in sidebar for regular paid users
- [ ] **Admin API routes** return 403 for non-admin accounts (cannot be accessed directly via URL)

---

## 14. SECURITY SPOT-CHECKS

- [ ] **Logout and try accessing /job-feed directly** → redirected to auth, not shown data
- [ ] **Try uploading a .exe file** on resume upload → error shown, not stored
- [ ] **Try a manual save on an already-saved job** → 409 response (no duplicate created)
- [ ] **Dev auth bypass** — confirm `DEV_BYPASS_AUTH` is NOT set in Railway production env vars

---

## 15. MOBILE / RESPONSIVE (if applicable)

- [ ] **Sidebar collapses** on mobile or small screens
- [ ] **Job cards readable** on a phone screen
- [ ] **Document generation** usable on tablet

---

## KNOWN DEFERRED ITEMS (not blocking, don't fail these)

- Welcome modal after first diagnosis (not yet built)
- Email verification before first job analysis (not yet built)
- `req as any` TypeScript cleanup in server routes (code quality, no user impact)

---

## NOTES / BUGS FOUND

| Page | Issue | Severity |
|------|-------|----------|
|      |       |          |
|      |       |          |
|      |       |          |
