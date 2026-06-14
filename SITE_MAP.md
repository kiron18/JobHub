# Aussie Grad Careers — Complete Site Map

> Generated 2026-06-09 from source code. All copy pasted verbatim.

---

## Table of Contents

1. [Landing Page (`/mock-landing`)](#1-landing-page-mock-landing)
2. [Auth Page (`/auth`)](#2-auth-page-auth)
3. [Pricing Page (`/pricing`)](#3-pricing-page-pricing)
4. [Legal Page (`/legal/:policy`)](#4-legal-page-legalpolicy)
5. [Visa Sponsors Page (`/visa-sponsors`)](#5-visa-sponsors-page-visa-sponsors)
6. [Dashboard (all protected routes)](#6-dashboard-all-protected-routes)
   - [6.1 Dashboard Layout (global shell)](#61-dashboard-layout-global-shell)
   - [6.2 Strategy Hub / Dashboard (`/`)](#62-strategy-hub-dashboard-)
   - [6.3 Application Tracker (`/tracker`)](#63-application-tracker-tracker)
   - [6.4 Documents Library (`/documents`)](#64-documents-library-documents)
   - [6.5 Profile (`/workspace`)](#65-profile-workspace)
   - [6.6 Job Feed (`/jobs`)](#66-job-feed-jobs)
   - [6.7 LinkedIn Hub (`/linkedin`)](#67-linkedin-hub-linkedin)
   - [6.8 Email Templates (`/email-templates`)](#68-email-templates-email-templates)
   - [6.9 Stepper Workspace / Apply (`/apply`)](#69-stepper-workspace-apply-apply)
   - [6.10 Mindset Page (`/mindset`)](#610-mindset-page-mindset)
   - [6.11 Admin Pages (`/admin`, `/admin/funnel`, `/admin/users`, `/admin/friday-brief`)](#611-admin-pages-admin)
7. [Footer Link (visible on all dashboard pages)](#7-footer-link-visible-on-all-dashboard-pages)
8. [Server-Side API Endpoints](#8-server-side-api-endpoints)

---

## 1. Landing Page (`/mock-landing`)

**Route:** `/mock-landing`
**Component:** `MockLandingPage` (`src/pages/MockLandingPage.tsx`)
**Page title:** "Mock · Aussie Grad Careers"

### 1.1 Nav Bar

**Text:**
"Aussie Grad Careers"

"Log in" (button)

### 1.2 Hero Section

**Eyebrow:**
"For graduates job-hunting in Australia"

**Headline (h1):**
"Get your first Australian job in 90 days. Guaranteed *"

**Subheadline (paragraph):**
"Drop your CV and we will show you the exact gaps a recruiter spots in their six-second scan."

### 1.3 CV Scan Panel (interactive component)

**Eyebrow (idle state):**
"Your resume"

**Label text:**
"Drop your CV or click to upload"
"PDF or Word. Everything else we infer for you."

**Pill selector label:**
"What are you getting back? (optional. sharpens the scan)"

**Pill options (5 buttons):**
- "Mostly silence"
- "Mostly rejections"
- "Interviews that stall"
- "Interviews, no offers"
- "A mix"

**CTA button (idle state):**
- `"Show me the gaps in my CV"` (when no file selected)
- `"Scan my CV for gaps"` (when file selected)

**Scanning state (animated):**
Eyebrow: "Scanning your CV…"

Status messages (cycling):
1. "Reading your experience…"
2. "Checking how recruiters read it…"
3. "Comparing against live Australian job ads…"
4. "Spotting the gaps costing you callbacks…"
5. "Writing your verdict…"

**Results state (after scan):**

Score card heading: `"{firstName}, here's where your resume is letting you down"`
Or (no name): `"Here's where your resume is letting you down"`

"Scanned as: {inferredRole}"

"{firstName}, these are the fixes that'll get you seen."

**Pill feedback (shown if user selected one):**
"You reported: {pill label}"

- Silence: "Your scan reflects that no response at all means your application likely isnt getting past the ATS filter."
- Rejections: "Rejections suggest the recruiter spot gaps before they reach the interview stage."
- Stall: "Interviews that stall often means strong recent experience but gaps in how you frame your earlier roles."
- No offers: "If interviews are not converting, the issue might be how your resume positions you against the job requirements."
- Mix: "A mixed response pattern means targeted fixes across multiple areas could move the needle."

**Quick Wins section:**
"2 quick wins you can do right now"

{quickWins — each with heading + description}

**Big Reveal section:**
"**These 2 fixes will help, but there are 7 other gaps** that take most internationals 6+ months to figure out on their own."

**Email capture section:**
"Get the **complete roadmap to fix all 9 issues** (plus the Australian hiring secrets recruiters do not tell you)"

Input placeholder: "Enter your email"
Button: "Unlock my roadmap →" (or "Building…" while loading)

"Your {rank}-step roadmap" (when roadmap generated — each step has rank number, title, and "why" text)

"We will email your roadmap and job-search tips. No spam, unsubscribe anytime. [Privacy](legal/privacy)"

"Scan a different CV" (link)

**Error state:**
"Scan failed. Please try again."
"Try again" (button)

### 1.4 Scan Panel Error Boundary

"Something went wrong rendering the results."
"Try again" (button)

### 1.5 Founder Section

**Eyebrow:** "ABOUT ME"

**Quote:**
"Coming to Australia as a student, I learned the job hunt here is not won on talent, it is won on knowing the local rules. The moment I learned them, the silence turned into callbacks and an offer I did not think was possible. I built this so you reach that moment in weeks, not the years it took me."

**Body:**
"I figured out that landing a high-paying role is not luck. It is a system: clarity, speed, measurable feedback, and support through the grind. That system took me from ghosted to a $150K government-adjacent role. I built Aussie Grad Careers so you do not have to figure it out the hard way."

**Name + tagline:**
"Kiron"
"The guy who will make sure you land your dream job in Australia"

### 1.6 Testimonials Section

**Heading:** "Real Aussie grads. Real offers."

**Testimonials (5):**

1. "I have got a job as a Technical BA with TAC. Thank you for your support and assistance in helping me with the process."
   — Jebby Joseph · Technical BA · TAC

2. "I believe the whole of your report really helped throughout my resume editing. It actually counselled, not just mentioned the format, that gave a lot of insight as to why it needed to be done a certain way. This gave me confidence."
   — Nithya · Data Analyst · Melbourne

3. "This is really awesome and helps me to stay focussed. The tracker feature helps me with follow-up templates which was very convenient."
   — Diluk Chandrashekar · Project Coordinator · Brisbane

4. "I used it in the morning to send out applications and within 2 months landed a new role, finally a job I am proud of. Thank you."
   — Krisheela Bhatia · Administration Officer · Perth

5. "The feedback really helped with a more structured application process and the right keywords. I have managed to land a fulltime gig."
   — Kunal · Marketing Coordinator · Sydney

### 1.7 Features Section

**Heading:** "Three wins. One system."

**Feature 1 — "STEP 1 · AUDIT":**
**Icon:** FileSearch
**Title:** "See the gaps a recruiter spots in six seconds."
**Body:** "We read your CV and cover letter the way a hiring manager does on a fast first scan. We show you the exact lines that make them move on, with a clear fix for each one. No jargon, no scores you cannot act on."
**Preview:** Animated scan demo (upload → scanning → report cycle with sample data)

**Feature 2 — "STEP 2 · APPLY":**
**Icon:** Sparkles
**Title:** "Send a high-quality application in under 5 minutes."
**Body:** "Our AI is trained on proprietary data. Interviews with real hiring managers and thousands of successful resume scans. You get ATS-friendly, well-formatted documents in clean Australian English that recruiters actually enjoy reading, with the right keywords matched to each role."
**Preview:** Animated preview showing: JD card → Generate button → 3 docs animate in (Resume, Cover Letter, Selection Criteria) with typewriter effect and labels

**Feature 3 — "STEP 3 · GET FOUND":**
**Icon:** Linkedin
**Title:** "Unlock the hidden job market."
**Body:** "Everyone talks about the hidden job market. We hand you the tools to actually reach it. LinkedIn profile and banner generators, a sharper About section, and proven outreach templates for every situation you will hit in your career."
**Preview:** LinkedIn profile cards (Arjun Mehta / Ananya Nanya) transforming from amateur to optimised, plus outreach templates

### 1.8 Guarantee Section

**Heading:** "The 90-day guarantee and the deal"

**Body:**
"Do the work with us for 90 days and you will land interviews. Or we will keep working with you free until you do. The catch is not hidden: the guarantee holds when you actually run the system, because the system is what gets you hired."

**Conditions (4 checkmarks):**
- "Complete your CV + cover letter fixes from the gap report"
- "Optimise your LinkedIn with our generator"
- "Send the recommended tailored applications each week"
- "Run our proven outreach templates and log your follow-ups"

**Footnote:**
"Demanding, but every condition is a step that genuinely moves you toward an offer, not a hoop. (Final terms to be set with you.)"

### 1.9 Footer

"Aussie Grad Careers"
"Built for grads job-hunting in Australia. Mock landing /mock-landing"

---

## 2. Auth Page (`/auth`)

**Route:** `/auth`
**Component:** `AuthPage` (`src/pages/AuthPage.tsx`)

### Copy

**Heading (h1):** "Sign in to JobHub"
**Subheading (sign in):** "Welcome back"
**Subheading (sign up):** "Create a new account"

**Label:** "Email"
**Input placeholder:** "you@example.com"

**Label:** "Password"
**Input placeholder:** "••••••••"

**Button (sign in):** "Sign in"
**Button (sign up):** "Create account"
**Loading state:** spinner shown below button

**Toggle link:**
- Sign in context: "Don't have an account yet? Sign up"
- Sign up context: "Already have an account? Sign in"

**Footer:**
"New user? Start fresh →"

**Already signed in state:**
"Signed in as" + user email
"Buttons: Go to app / Sign out"

---

## 3. Pricing Page (`/pricing`)

**Route:** `/pricing`
**Component:** `PricingPage` (`src/pages/PricingPage.tsx`)

### Nav Bar

"Zap icon · Aussie Grad Careers"
"Log in →" (or "Go to dashboard →") (button)

### Hero

**Tagline badge:** "Simple Pricing"
**Heading (h1):** "Get the job. Stop paying."
**Subheading:**
"The average Australian graduate earns $1,200+ per week in their first role. This is how you get there."

### Plans (3 columns)

**Plan 1 — Monthly:**
- Name: "Monthly"
- Price: "$97 AUD"
- Billing: "per month, billed monthly"
- Weekly: "≈ $25/week"
- Trial: "7-day free trial — no charge until day 8"
- CTA: "Start Free Trial"
- Features:
  - "Unlimited document generations"
  - "Unlimited job analyses"
  - "Daily AI job feed"
  - "Match scoring"
  - "Cancel anytime"

**Plan 2 — 3-Month Bundle** (tagged "Recommended"):
- Name: "3-Month Bundle"
- Price: "$197 AUD"
- Billing: "one payment · 90 days access"
- Weekly: "Best value for active job seekers"
- CTA: "Get 3-Month Access"
- Savings text:
  "Three months for $197. That's $65 a month — $94 less than paying monthly.\nAfterpay and Zip both work at checkout."
- Features:
  - "Everything in Monthly"
  - "No recurring charge"
  - "Pay once, apply for 90 days"
  - "Great for structured job hunts"
  - "Lifetime access to your documents"

**Plan 3 — Annual:**
- Name: "Annual"
- Price: "$597 AUD"
- Billing: "per year, billed annually"
- Weekly: "≈ $11.50/week"
- Trial: "7-day free trial — no charge until day 8"
- CTA: "Start Free Trial"
- Features:
  - "Everything in Monthly"
  - "Lowest weekly rate"
  - "Best for ongoing career management"
  - "Annual billing saves $567 vs monthly"
  - "Cancel anytime"

### Free Tier Note

"Not ready? Start free — 5 document generations, 5 job analyses, 1 job feed search included on the free tier."

### FAQ Section (5 items)

"Questions"
"Everything you need to know before signing up."

**Q: "Can I cancel anytime?"**
A: "Yes. Monthly and Annual plans can be cancelled any time from your account. You retain access until the end of the billing period. The 3-Month Bundle is a one-time payment — no recurring charge, no cancellation needed."

**Q: "What happens when I get a job?"**
A: "Congratulations — that's exactly what this is for. You can cancel your subscription immediately and keep all the documents you've created. We don't lock anything away."

**Q: "Why is there a 3-month option?"**
A: "Most job searches take 6–12 weeks. The 3-Month Bundle is designed to match a focused job hunt — pay once, get full access for 90 days, no ongoing commitment. It's our most popular plan for a reason."

**Q: "Is my card charged immediately?"**
A: "For the 3-Month Bundle, yes — it's a one-time payment charged immediately. For Monthly and Annual plans, your free trial starts immediately and your card is charged on day 8 unless you cancel first."

**Q: "Can I use Afterpay or Zip for the 3-Month Bundle?"**
A: "Yes. Both are supported at checkout. Afterpay splits $197 into four fortnightly payments. No interest, no ongoing commitment."

### Bottom CTA

"Questions? Reach us at support@aussiegradcareers.com.au"
"Get started free →" (or "Go to dashboard →") (button)

### Legal Footer

Links to:
- Terms of Service
- Privacy Policy
- Refund Policy
- Cancellation Policy
- Free Trial Terms
- Disclaimer

---

## 4. Legal Page (`/legal/:policy`)

**Route:** `/legal/:policy` (or `/legal` defaults to terms)
**Component:** `LegalPage` (`src/pages/LegalPage.tsx`)

### Layout

- Nav bar: "Zap icon · Aussie Grad Careers" + "Back to pricing" button
- Left sidebar: Legal navigation (sticky)
- Right panel: policy content in a card

### Sidebar Navigation

- Terms of Service *(default)*
- Privacy Policy
- Refund Policy
- Cancellation Policy
- Free Trial Terms
- Disclaimer

---

**4.1 Terms of Service** (last updated "April 2026")

**1. Acceptance:**
"By creating an account or using Aussie Grad Careers, you agree to these terms. If you do not agree, do not use the service."

**2. What we provide:**
"Aussie Grad Careers is an AI-powered job application platform for people seeking work in Australia. We provide resume tailoring, cover letter generation, job feed aggregation, LinkedIn profile generation, and related tools."

**3. Your account:**
- "You are responsible for keeping your login credentials secure."
- "You must not share your account with others."
- "You must be at least 18 years old to use this service."
- "You must be located in Australia and eligible to work here."

**4. Acceptable use:**
- "Use the service to generate false or misleading job application documents."
- "Attempt to reverse-engineer, scrape, or abuse the platform."
- "Use the service on behalf of others without their knowledge."
- "Resell or redistribute any outputs from the service."

**5. No employment guarantee:**
"We provide tools to improve your job application materials. We do not guarantee job interviews, offers, or employment outcomes. Results depend on factors outside our control including employer decisions, market conditions, and your individual circumstances."

**6. Intellectual property:**
"Content you upload (resumes, cover letters) remains yours. AI-generated outputs are provided for your personal use. You may not resell or redistribute them."

**7. Limitation of liability:**
"To the maximum extent permitted by Australian law, we are not liable for any indirect, incidental, or consequential loss arising from your use of the service. Our total liability is limited to the amount you paid us in the 30 days before the claim."

**8. Changes to terms:**
"We may update these terms from time to time. We will notify you by email of material changes. Continued use of the service after changes constitutes acceptance."

**9. Governing law:**
"These terms are governed by the laws of Victoria, Australia. Any disputes are subject to the exclusive jurisdiction of Victorian courts."

**10. Contact:**
"Questions about these terms: kiron@aussiegradcareers.com.au"

---

**4.2 Privacy Policy** (last updated "April 2026")

**1. Who we are:**
"Aussie Grad Careers operates at aussiegradcareers.com.au. This policy explains how we collect, use, and protect your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles."

**2. What we collect:**
- **Account data:** name, email address
- **Resume and career data:** resume text, work history, achievements, education, skills
- **Onboarding answers:** job search stage, target role, location, visa status, application history
- **Usage data:** pages visited, features used, document generation history
- **Payment data:** handled entirely by Stripe. We do not store card details.

**3. Why we collect it:**
- "Generate personalised resumes, cover letters, and LinkedIn profiles"
- "Match you with relevant job listings"
- "Improve the accuracy of AI-generated content over time"
- "Send service-related emails (account, billing, product updates)"
- "With your consent: send job search tips and product news"

**4. Who we share it with:**
- Anthropic (Claude AI) — resume and career data
- Google (Gemini AI) — headshot generation only
- Supabase — database and file storage
- Stripe — payment processing

**5–9:** Data storage/security, Your rights, Data retention, Cookies, Contact

---

**4.3 Refund Policy** (last updated "April 2026")

Sections: Overview, When you are entitled to a refund, Goodwill refunds, How to request a refund, What we do not refund

---

**4.4 Cancellation Policy** (last updated "April 2026")

Sections: Monthly and Annual plans, 3-Month Bundle, Free trial cancellation, Your data after cancellation, How to cancel

---

**4.5 Free Trial Terms** (last updated "April 2026")

Sections: Which plans include a free trial, How the trial works, Cancelling before the trial ends, One trial per person, After the trial

---

**4.6 Disclaimer** (last updated "April 2026")

Sections: No employment guarantee, AI-generated content, Job listings, Not professional career advice, Third-party services

---

## 5. Visa Sponsors Page (`/visa-sponsors`)

**Route:** `/visa-sponsors`
**Component:** `VisaSponsorsPage` (`src/pages/VisaSponsorsPage.tsx`)

### Structure

- `SponsorHero` component — search bar at top
- `SponsorFilterBar` — industry, location, high-confidence filters
- `SponsorResultsGrid` — paginated grid of employers
- `SponsorEmailModal` — email gate for full access
- `LandingFooter`

### Interactive Elements

- Search input
- Industry dropdown filter
- Location dropdown filter
- High-confidence toggle
- Load more button (pagination: 20 per page)
- "Locked" results trigger email modal
- Email modal: enter email, unlock full results

---

## 6. Dashboard (all protected routes)

### 6.1 Dashboard Layout (global shell)

**Component:** `DashboardLayout` (`src/layouts/DashboardLayout.tsx`)

#### Sidebar — Brand
- Logo: "J" in a rounded square (petrol background)
- Brand name: "JobReady" (shown when sidebar expanded)

#### Sidebar — Navigation Items

| Icon | Label | Route |
|------|-------|-------|
| LayoutDashboard | Dashboard | `/` |
| Briefcase | Applications | `/tracker` |
| Library | Documents | `/documents` |
| FileText | Profile | `/workspace` |
| Sparkles | Job Feed | `/jobs` |
| Stethoscope | Diagnostic | *(dispatches `show-diagnostic` custom event)* |
| Linkedin | LinkedIn | `/linkedin` |
| Mail | Email Templates | `/email-templates` |
| ShieldCheck | Visa Sponsors | `/visa-sponsors` |

- Badge shown on "Applications" when follow-ups are due (applications >7 days with no update)

#### Sidebar — Account Section
- User email displayed
- "Sign Out" button with LogOut icon

#### Footer Link (all dashboard pages)
"Dealing with silence? Quick-ref mindset tips →" — links to `/mindset`

#### Desktop Behavior
- Sidebar starts expanded for 2s on mount, then collapses to icons-only
- Expands on hover (mouse enter)
- Animated width transition between collapsed (72px) and expanded (240px)

#### Mobile Behavior
- Hamburger button (top-left)
- Slide-in drawer overlay
- Backdrop closes drawer

---

### 6.2 Strategy Hub / Dashboard (`/`)

**Route:** `/` (protected)
**Component:** `StrategyHub` (`src/pages/StrategyHub.tsx`)

#### HubHeader

**Identity line** (if profile has targetRole or targetCity):
"{targetRole} · {targetCity}"

**Heading (h1):**
"Land Your Next Australian Role Faster"

**Subheading:**
"Real roles we found for you, ready to apply to in minutes. Pick one and we will tailor your resume and cover letter."

#### GoalChip (appears after first application submitted)

"Set a goal" chip → expands to Goal Editor popover

**First-time tooltip:**
"Nice. First application in."
"Set a small daily or weekly goal. Steady beats burnout. We track it gently, no streaks to break."
"Set my goal" (button)

**Goal Editor:**
"Application goal"
"Target (per day / per week)" — input field
"We count APPLIED roles in a rolling window. No streak shaming, no notifications. Edit or clear anytime."
Buttons: Clear / Cancel / Save (with checkmark)

**Active goal display:** "{progress} / {target} · Today / This week"

#### AnalysisHeroCard (main interaction card)

**Labels:**
- "Analyse a role"

**Buttons:**
- "Paste your own job" — toggles JD textarea
- "Selection criteria" — toggles JD textarea

**JD textarea placeholder:** "Paste the job description here…"

**SC auto-flip notification:**
"This role lists selection criteria. We'll generate responses as a separate document."

**Toggle:**
"Generate selection criteria responses"

**Primary button:**
"Apply →" (or "Applying…" with spinner)

**Cap message (rate limit 429):**
"That is 25 applications today. Serious effort."
"Come back tomorrow for a fresh batch. Your trial keeps running, and the more you apply, the sooner the callbacks start."

**Analysis result:** Inline `AnalysisResult` component with bridgeable gaps

#### PipelineGlance

**No applications yet:**
"No applications yet. Analyse a role to begin." (links to /tracker)

**With applications:**
"{count} Saved · {count} Applied · {count} Interview · {count} Offer · {count} Rejected →" (links to /tracker)

#### StaleApplicationsCard
*(component for nudging follow-ups)*

#### JobStream component
*(inline job feed strip for quick apply)*

---

### 6.3 Application Tracker (`/tracker`)

**Route:** `/tracker`
**Component:** `ApplicationTracker` (`src/components/ApplicationTracker.tsx`)

**Section Intro Banner:** *(component)*

#### Core Features

- Filter by status (ALL / individual statuses)
- Filter by grade (ALL / AB / C / DF)
- Sort controls (by match, date, priority)
- Pipeline funnel visualization
- Each application rendered as `JobCard` with:
  - Status update (drag through STATUS_FLOW)
  - Follow-up nudge (after 7 days silence)
  - Thank-you nudge
  - Notes editing
  - Priority setting (DREAM / TARGET / BACKUP)
  - Delete / remove
- Add application form (manual entry)

---

### 6.4 Documents Library (`/documents`)

**Route:** `/documents`
**Component:** `DocumentLibrary` (`src/components/DocumentLibrary.tsx`)

**Section Intro Banner:** *(component)*

#### Features

- Search/filter documents
- Documents grouped by date: Today / Yesterday / This Week / This Month / Older
- Document type badges: RESUME (green), COVER LETTER (gold), SELECTION CRITERIA (petrol), STARTER RESUME (green)
- Per-document actions: View (modal), Copy to clipboard, Download as .docx, Download as PDF, Delete
- Quality signals displayed per document (info / warning / critical)

---

### 6.5 Profile (`/workspace`)

**Route:** `/workspace`
**Component:** `Workspace` wrapping `ProfileBank` (`src/components/ProfileBank.tsx`)

**Section Intro Banner:** *(component)*

#### Profile Sections

- **Identity:** name, email, phone, LinkedIn URL, location, target role, professional summary
- **Skills:** technical, industry knowledge, soft skills (JSON parse)
- **Experience:** company, role, dates, description + coaching tips
- **Education:** institution, degree, field, year + coaching tips
- **Achievements:** linked to experience, with metrics and coaching tips
- **Certifications:** name, issuing body, year
- **Volunteering:** organization, role, description
- **Source documents:** resume upload (PDF/DOCX)

#### Coaching Hints (inline)

- Summary: "Lead with years of experience and your biggest achievement. Aim for 2-3 sentences." or "Summary looks solid."
- Experience: "No achievements linked to {role} at {company}. Add at least one to strengthen this role."

---

### 6.6 Job Feed (`/jobs`)

**Route:** `/jobs`
**Component:** `JobFeedPage` (`src/pages/JobFeedPage.tsx`)

**Section Intro Banner:**
"Curated Australian roles matched against your profile. Skim daily; analyse the ones worth your time."

**Heading (h2):** "Job Feed"

**"Refresh" button** (top right)

#### States

**Loading:** Spinner

**Building (first load):**
- Spinner
- "Searching live listings for you…"
- "Finding {targetRole} roles in {targetCity} on Seek."
- "This takes 1–2 minutes on first load. Grab a coffee, we'll check back automatically."
- After 8 minutes: "Taking longer than usual, try refreshing manually."

**Profile incomplete (no location set):**
- Alert icon
- "Location required"
- "Add your city to the Location field in Profile & Achievements to enable your job feed."
- "Go to Profile & Achievements →" link

**Error:**
- Alert icon
- "Couldn't load today's jobs"
- "Try refreshing in a few minutes."

**Empty (no results):**
- Briefcase icon
- "No listings found today"
- "We searched for {targetRole} roles in {targetCity} but found nothing today. Try broadening your target role in your profile, or check back tomorrow."
- "Search again" button

**Results:**
- Animated `JobCard` list with cards per job
- "Showing {count} of {total} jobs"
- "Load 10 more" button (pagination)

---

### 6.7 LinkedIn Hub (`/linkedin`)

**Route:** `/linkedin`
**Component:** `LinkedInPage` (`src/pages/LinkedInPage.tsx`)

**Section Intro Banner:**
"Around 70% of Aussie roles are filled via networking. This is your LinkedIn toolkit: profile rewrite, outreach templates, and headline drafts."

**Heading (h1):** "LinkedIn Hub"
**Subheading:** "Profile · Outreach · Headshot · Banner — one cohesive system"

#### Tabs

**Profile tab:**
- ProfileStrip (name, title, headshot)
- Target role input + "Generate All" button
- ProfileSections (auto-generated sections: headline, about, experience, skills, recommendations)
- Per-section regenerate buttons
- BannerCopyPicker (choose from AI-generated banner copy options)
- BannerCanvas (editor: main message, subline, background colour, texture)
- HeadshotGenerator (upload → AI headshot generation → save)

**Outreach tab:**
- `OutreachTemplates` component

---

### 6.8 Email Templates (`/email-templates`)

**Route:** `/email-templates`
**Component:** `EmailTemplatesLibrary` (`src/components/EmailTemplatesLibrary.tsx`)

**Section Intro Banner:** *(component)*

#### Templates (7 templates)

1. **"Cold Outreach to Recruiter"** (Outreach category)
   Subject: "Experienced [Your Role] — Open to Opportunities"
   Body: *(full template with [placeholder] fields)*

2. **"Follow-Up After Application"** (Follow-Up category)
   *(stored in external data)*

3. **"Thank-You After Interview"** (Interview category)
   *(stored in external data)*

4. **"Request for Informational Interview"** (Networking category)
   Subject: "Quick Chat? — Learning About [Company/Industry]"
   Body: *(full template)*

5. **"Acknowledge Job Offer (Buying Time)"** (Offer category)
   Subject: "Re: Offer for [Job Title] — Thank You"
   Body: *(full template)*

6. **"Counter-Offer on Salary"** (Offer category)
   Subject: "Re: Offer for [Job Title]"
   Body: *(full template)*

7. **"Response to Rejection"** (Follow-Up category)
   Subject: "Re: [Job Title] Application — Thank You"
   Body: *(full template)*

#### Features per template
- Copy to clipboard (with check animation)
- Expand/collapse body
- Categorised

---

### 6.9 Stepper Workspace / Apply (`/apply`)

**Route:** `/apply`
**Component:** `StepperWorkspace` (`src/pages/StepperWorkspace.tsx`)

#### Flow (sequential stepper)

**Steps:**
1. **Resume** (FileText icon) — "Tailored Resume"
2. **Cover Letter** (Mail icon) — "Cover Letter"
3. **[Selection Criteria]** (ListChecks icon, optional) — shown only when SC toggle was enabled
4. **Track** (Briefcase icon)

#### Stepper UI
- Step indicators with check/chevron icons
- Active step highlighted in gold
- Completed steps in petrol
- Clickable steps (with draft available)

#### Resume Step

**Review framing text:**
*(from `applyWorkspaceCopy`)*

**Cover Letter educational note:**
"Most candidates skip the cover letter. Australian recruiters use it to filter genuine interest from automated applications, a tailored cover letter measurably increases callback rates."

**Company Insight panel:**
Shows Perplexity intel: summary, suggested contact, source citations

**Toolbar:**
- "Review" button (triggers DraftCritiquePanel)
- "Copy" button
- Download split button: ".docx" / ".pdf" format chooser
- "Download both" (cover-letter step only)
- "Edit" toggle (inline editing)

**Selection Criteria step:**
- Criteria paste panel (animating pill/panel)
- Placeholder text explains what SC are and where to find them
- Character count + "Use these criteria" button

**Track step:**
- "Saved to your tracker"
- "Nice work. This one is in your tracker."
- Draft checklist: Resume ✓, Cover letter ✓, SC if applicable
- "Apply on platform" section with `ApplyDeepLinkButton`
- Options: "Back" / "Open tracker" / "Apply for another role"

**Bridged gaps modal:**
"GapConfirmModal" — derived gaps confirmation before generation

---

### 6.10 Mindset Page (`/mindset`)

**Route:** `/mindset`
**Component:** `MindsetPage` (`src/pages/MindsetPage.tsx`)

**Section Intro Banner:**
"Quick-reference mindset prompts for when the job search wears you down. Read one when you need it."

**Back link:** "Back to dashboard"

**Heading (h1):** "A few notes for the hard stretches."

**Opening:**
"This page is not advice. It is a set of quiet reminders, written for the days when the silence is loud."
"You can leave it open in a tab. You can come back to it. Nothing on it will change."

#### 7 Sections

**1. "Silence isn't rejection."**
"Most silence after an application is not personal and not a verdict.
The role gets frozen. Internal candidates emerge. The recruiter goes on leave. A hiring manager changes priorities. A reorg quietly kills the headcount. None of those reach you as an email. They just look like no reply.
If you've sent the application and followed up once, you've done your part. The next move belongs to them. Don't fill the silence with stories about what you did wrong."

**2. "You're not behind."**
"Time-to-offer for international graduates in Australia varies wildly. Three weeks for some roles. Eight months for others. The median is somewhere around four months, and that figure hides everyone who paused, changed direction, or took an interim role on the way through.
Your timeline is not the average and the average is not a deadline.
If you are still applying, still tightening your profile, still showing up, you are not behind. You are in the middle of a process that was always going to take time."

**3. "What to do when nothing is moving."**
"When the pipeline is silent and the calendar feels heavy, pick three things and stop there:
1. Tighten one application you've already sent. Refine the cover letter, sharpen one bullet. Quality work on something you've already produced.
2. Send one short message to a former colleague, a connection two roles deep, or someone you admire. Not asking for a job. Asking a single, specific question.
3. Take a real rest day. Not a guilt-rest. A planned one.
The temptation in dead weeks is to apply to more roles. That rarely changes the outcome. Sharpening one thing, talking to one person, and resting properly will move you further than another twenty applications you don't believe in."

**4. "When to step back."**
"There are signs that the hunt has shifted from work to compulsion:
• You're applying to roles you wouldn't take.
• You can't remember which company you've spoken to.
• The first thing you do in the morning is check email for replies that aren't there.
• You're being short with the people you live with.
When you notice two or more, the right move is to stop for two or three days. Not to push through. The cost of stopping is small. The cost of burning out mid-search is months.
Stepping back is part of the process, not a failure of it."

**5. "On rejection emails."**
"Most rejection emails say very little. 'We've decided to progress with other candidates.' That is the whole sentence.
What it does not say: that you weren't qualified, that you weren't a good candidate, that there was something visibly wrong. It says one thing only. That this company, on this day, went with someone else.
You will not get a real reason. Asking is fine but rarely productive. The most useful thing you can do with a rejection is write down one line about it: what you learned, what you'd frame differently next time, and then move on. You can save the line in your tracker. Over months, those lines become a real record of what's working and what isn't."

**6. "A note on visa stress."**
"If your visa is tied to your search, your urgency is real and not in your head. The deadline pressure is structural, not psychological.
Two things worth saying. First: panic narrows your thinking. The roles you can see when you're stressed are a smaller subset than the roles that actually exist. Second: visa advice is specialist work. We are not migration agents. If your situation is changing, talk to a registered migration agent before you make decisions you can't reverse.
You can carry the stress without letting it drive every choice."

**7. "You've already done the hard part."**
"You moved countries. You built a profile in a system that didn't know you. You're doing a job hunt in a market that has its own conventions and you're learning them in real time.
The fact that you're still pushing on means most of the hard work is behind you, not ahead. The role you land won't feel like a reward for that work. It'll just feel like a Tuesday, like any other start date.
What you've done to get here is the part that counts. Whatever comes next is the easier half."

**Footer:**
"This page does not track you. Nothing on it changes. Bookmark it if it helps."

---

### 6.11 Admin Pages (`/admin`)

#### Admin Dashboard (`/admin`)
**Component:** `AdminDashboard` (`src/pages/AdminDashboard.tsx`)
Quick stats: users, generations, analyses, diagnostics, applications, feedback

#### Admin Funnel (`/admin/funnel`)
**Component:** `AdminFunnel` (`src/pages/AdminFunnel.tsx`)
Funnel overview, trials, user usage stats

#### Admin User Usage (`/admin/users`)
**Component:** `AdminUserUsage` (`src/pages/AdminUserUsage.tsx`)
Per-user usage data

#### Admin Friday Brief (`/admin/friday-brief`)
**Component:** `FridayBriefPage` (`src/pages/FridayBriefPage.tsx`)
Generate and email Friday briefs

---

## 7. Footer Link (visible on all dashboard pages)

"Dealing with silence? Quick-ref mindset tips →" — links to `/mindset`

---

## 8. Server-Side API Endpoints

*(Routes only — this is the site map, not API docs)*

### Health
- `GET /api/health`

### Auth
- *(router mounted, no explicit routes defined)*

### Analyze
- `POST /api/analyze/job`
- `POST /api/analyze/gap`
- `POST /api/analyze/achievement-suggestions`
- `POST /api/analyze/jd-summary`
- `POST /api/analyze/dual`
- `POST /api/analyze/draft-achievement`
- `POST /api/analyze/critique`

### AI Tools
- `POST /api/analyze/polish-achievement`
- `POST /api/analyze/interview-questions`
- `POST /api/analyze/email-cover-letter`
- `POST /api/analyze/profile-advisor`
- `POST /api/analyze/notes-actions`

### Document QA
- `POST /api/analyze/ats-coverage`
- `POST /api/analyze/resume-score`
- `POST /api/analyze/cover-letter-personalisation`
- `POST /api/analyze/tone-rewrite`

### Extract
- `POST /api/extract/resume`

### Generate
- `POST /api/generate/extract-criteria`
- `POST /api/generate/:type`
- `POST /api/generate/resume-structured`
- `POST /api/generate/cover-letter-structured`

### Documents
- `GET /api/documents`
- `POST /api/documents`
- `POST /api/documents/upload`
- `POST /api/tracker/finalize`
- `GET /api/documents/:id`
- `DELETE /api/documents/:id`
- `PATCH /api/documents/:id`

### Onboarding
- `POST /api/onboarding/submit`
- `GET /api/onboarding/report`
- `POST /api/onboarding/retry`
- `POST /api/onboarding/report/:reportId/feedback`
- `POST /api/onboarding/backfill-achievements`
- `POST /api/onboarding/backfill-extras`
- `POST /api/onboarding/rating`

### Profile
- `GET /api/profile`
- `GET /api/profile/resumes`
- `DELETE /api/profile/resumes/:id`
- `POST /api/profile`
- `PATCH /api/profile`
- `POST /api/profile/claim`
- `GET /api/profile/baseline-resume`
- `POST /api/profile/baseline-resume/generate`
- `POST /api/profile/regenerate-identity`
- `POST /api/profile/source-documents`

### Experience / Education / Achievements / Jobs
- `POST /api/experience`, `PATCH /api/experience/:id`
- `PATCH /api/education/:id`, `POST /api/education`, `DELETE /api/education/:id`
- `GET /api/achievements`, `POST /api/achievements`, `PATCH /api/achievements/:id`, `DELETE /api/achievements/:id`
- `GET /api/jobs`, `POST /api/jobs`, `PATCH /api/jobs/:id`, `DELETE /api/jobs/:id`
- Certifications and Volunteering CRUD

### Research
- `POST /api/research/company`
- `POST /api/research/employer-framework`
- `POST /api/research/job-url`
- `POST /api/research/salary`
- `POST /api/research/company-intel`

### Job Feed
- `POST /api/job-feed/refresh`
- `GET /api/job-feed/feed`
- `POST /api/job-feed/:id/score`
- `POST /api/job-feed/:id/find-addressee`
- `POST /api/job-feed/:id/save`
- `POST /api/job-feed/:id/mark-applied`
- `POST /api/job-feed/application/:applicationId/revert`
- `POST /api/job-feed/:id/start-apply`
- `POST /api/job-feed/:id/fetch-description`

### Feedback
- `POST /api/feedback/document`

### LinkedIn
- `POST /api/linkedin/generate`
- `POST /api/linkedin/outreach`
- `POST /api/linkedin/headshot`
- `POST /api/linkedin/headshot/save`

### Webhooks
- `POST /api/webhooks/membership`
- `POST /api/webhooks/request-access`

### Skool
- `POST /api/skool/join`

### Admin
- `GET /api/admin/stats`
- `GET /api/admin/friday-brief`
- `POST /api/admin/friday-brief/generate`
- `POST /api/admin/friday-brief/email`
- `GET /api/admin/analysis`
- `GET /api/admin/posthog-stats`
- `GET /api/admin/expenses`

### Admin Funnel
- `GET /api/admin/funnel/overview`
- `GET /api/admin/funnel/trials`
- `GET /api/admin/funnel/user-usage`

### Stripe
- `POST /api/stripe/checkout`
- `POST /api/stripe/portal`
- `GET /api/stripe/status`

### Enrichment
- `POST /api/enrichment/questions`
- `POST /api/enrichment/parse-answer`

### Insights
- `GET /api/insights/application-pattern`

### Sponsors
- `GET /api/sponsors/search`
- `POST /api/sponsors/unlock`

### CV Scan
- `POST /api/cv-scan/`
- `POST /api/cv-scan/lead`
- `POST /api/cv-scan/job-titles`
- `POST /api/cv-scan/scrape-jobs`
- `GET /api/cv-scan/scrape-jobs`
- `POST /api/cv-scan/claim`

---

## Complete Route Map Summary

### Client-Side Routes

| Route | Page | Auth Required |
|-------|------|:---:|
| `/` | Landing Page (if unauthenticated) → Dashboard (if authenticated) | No |
| `/mock-landing` | MockLandingPage | No |
| `/auth` | AuthPage (sign in / sign up) | No |
| `/pricing` | PricingPage | No |
| `/legal/:policy` | LegalPage (6 policies) | No |
| `/visa-sponsors` | VisaSponsorsPage | No |
| `/anim-test` | AnimationTest | No |
| `/apply` | StepperWorkspace | Yes |
| `/tracker` | ApplicationTracker | Yes |
| `/documents` | DocumentLibrary | Yes |
| `/workspace` | ProfileBank | Yes |
| `/email-templates` | EmailTemplatesLibrary | Yes |
| `/linkedin` | LinkedInPage | Yes |
| `/jobs` | JobFeedPage | Yes |
| `/mindset` | MindsetPage | Yes |
| `/admin` | AdminDashboard | Yes (admin) |
| `/admin/funnel` | AdminFunnel | Yes (admin) |
| `/admin/users` | AdminUserUsage | Yes (admin) |
| `/admin/friday-brief` | FridayBriefPage | Yes (admin) |

All copy on this site map was extracted verbatim from the source code as of 2026-06-09. No content was invented or summarised.

---

## 9. Gap Analysis — Tool vs Outcome (Farhoon Asim Model)

> This section maps every page against the Farhoon Asim breakdown. The diagnosis is uniform: **you sell a tool (features, speed, automation). He sells an outcome (a job).** Below is the specific treatment per page.

### The Core Problem (Read This First)

| You currently say | What you should say |
|---|---|
| "AI job application platform" | "Get your first Australian job in 90 days, guaranteed." |
| "Apply faster with AI" | "We help international graduates get their first Australian job in 90 days using AI + proven application systems + daily guidance." |
| "Features, speed, automation" | "Outcome, certainty, accountability." |
| Subscription pricing ($97/mo) | High-ticket program pricing (£1K-3K equivalent) with payment plan options |
| Free CV scan → email → free dashboard | Free diagnostic → urgency → paid program |

**Same product. Different perception. Different price.**

---

### 9.1 Landing Page — Gaps

| Element | Current (Tool) | Needed (Outcome) |
|---|---|---|
| Hero subhead | "Drop your CV and we will show you the exact gaps a recruiter spots in their six-second scan." | "Drop your CV. We'll show you exactly why you're not getting callbacks — and map every fix to a job offer within 90 days." |
| CTA buttons | "Show me the gaps in my CV" / "Scan my CV for gaps" | "Show me why I'm not getting hired" / "Start my job outcome plan" |
| Feature 1 heading | "See the gaps a recruiter spots in six seconds." | "Know exactly what's blocking your offer — and exactly how to fix it." |
| Feature 2 heading | "Send a high-quality application in under 5 minutes." | "Send applications that actually get read. In 5 minutes." |
| Feature 3 heading | "Unlock the hidden job market." | (Strong as is — keep this) |
| Features body | Describes *how the tool works* (proprietary data, interviews, keywords, ATS-friendly) | Should describe *what the user gets* (callback rate increase, interview invites) |
| Guarantee section | Present but buried in its own section at the bottom | Must be hero-level. The guarantee is your single biggest weapon — lead with it, don't hide it. |
| Missing entirely | No social proof of *job offer outcomes* (the 5 testimonials are good but don't say "I got a job using this" strongly enough) | Every testimonial should name the job title, company, and time-to-offer. Like Jebby's — but all 5 should be that specific. |
| Missing entirely | No accountability / coaching mention anywhere | Must say: "Weekly check-in calls" / "We track your progress" / "You don't do this alone" |
| Missing entirely | No controlled guarantee conditions visible on the page | The 4 conditions should be in the hero, not in a separate section below the fold |

**Landing Page — Priority fixes:**
1. Hero must lead with OUTCOME, not AUDIT
2. Add accountability/coaching mention
3. Surface guarantee conditions at hero level
4. Every testimonial must include time-to-offer

---

### 9.2 Pricing Page — Gaps

| Element | Current (Tool) | Needed (Outcome) |
|---|---|---|
| Hero heading | "Get the job. Stop paying." | (This is actually good — keep it) |
| Hero subhead | "The average Australian graduate earns $1,200+ per week in their first role. This is how you get there." | (Solid — keep) |
| Plan pricing | $97/mo, $197/3mo, $597/yr | Far too cheap for an outcome business. You need a high-ticket tier: £1K-3K equivalent "Get Hired Program" with coaching + accountability |
| Plan naming | "Monthly" / "3-Month Bundle" / "Annual" | Needs a "Get Hired Program" tier — done-with-you, coaching calls, accountability |
| Feature lists | Document features (generations, analyses, feed, scoring) | Should frame as outcomes: "Tailored resumes that pass ATS" / "Cover letters that get interviews" / "Direct job leads" |
| FAQ missing | No question about coaching, accountability, or what makes this different from a tool | Add: "Is this just an AI tool or is there human support?" / "What happens if I don't get results?" |
| Free tier note | "5 document generations, 5 job analyses, 1 job feed search" | Frame as a risk-free trial of the outcome system, not a feature cap |
| Bottom CTA | "Get started free →" | "Start your 90-day job outcome plan →" |

**Pricing Page — Priority fixes:**
1. Add a high-ticket "Get Hired Program" tier ($1,000–$3,000 AUD) with coaching calls
2. Rename existing tiers to outcome-focused names
3. Rewrite feature lists to describe outcomes, not features
4. Add FAQ about coaching and accountability

---

### 9.3 Auth Page — Gaps

| Element | Current (Tool) | Needed (Outcome) |
|---|---|---|
| Heading | "Sign in to JobHub" | "Sign in to your job outcome plan" |
| Sign-up subhead | "Create a new account" | "Start your 90-day program" |
| Missing entirely | No outcome context — it's a blank form | Should remind user what they're signing up FOR: "You're one step away from your tailored job plan" |

**Auth Page — Priority fix:**
- Reframe heading/subhead to connect to the outcome promise

---

### 9.4 Dashboard / Strategy Hub — Gaps

| Element | Current (Tool) | Needed (Outcome) |
|---|---|---|
| Dashboard heading | "Land Your Next Australian Role Faster" | (Good — keep) |
| Dashboard subhead | "Real roles we found for you, ready to apply to in minutes. Pick one and we will tailor your resume and cover letter." | Replace with outcome + accountability framing: "Your personalised job plan. Today's priority targets, your weekly application goal, and your next milestone. We track everything." |
| Goal editor copy | "Steady beats burnout. We track it gently, no streaks to break." | Good voice — keep. But add a public accountability angle: "Share your goal with your coach (coming soon)" |
| Cap message (429) | "That is 25 applications today. Serious effort. Come back tomorrow." | Reframe: "You've sent 25 applications this week. Quality over quantity now — let's tighten the ones you've already sent." |
| Pipeline glance | Shows counts only | Should show: goal progress, days since last activity, nudge to apply if falling behind |
| Missing entirely | No coaching/accountability dashboard section | Add a "Your progress" card: days in program, applications sent, interviews secured, coach notes |

---

### 9.5 Application Tracker — Gaps

| Element | Current (Tool) | Needed (Outcome) |
|---|---|---|
| Status labels | SAVED → APPLIED → INTERVIEW → OFFER → REJECTED | (Good structure — keep) |
| Follow-up nudge | Passive — nudges only after 7 days silence | Should be active: "You're eligible for a follow-up template. Write it now. Your coach will review." |
| Missing entirely | No coaching overlay — the tracker is purely self-serve | Add: ability for a coach to comment on applications, weekly review prompts, auto-generated "next action" per application |

---

### 9.6 Job Feed — Gaps

| Element | Current (Tool) | Needed (Outcome) |
|---|---|---|
| Section banner | "Curated Australian roles matched against your profile. Skim daily; analyse the ones worth your time." | Roles your profile scores highest on should be called "Priority applications — these are where you're most likely to get an interview" |
| Building state | "Searching live listings for you…" | Should set expectation: "Finding the roles where you have the best chance of an interview this week" |
| Empty state | "Try broadening your target role in your profile, or check back tomorrow." | Should trigger coaching action: "No matches today. Your coach will suggest alternative target roles." |

---

### 9.7 LinkedIn Hub — Gaps

| Element | Current (Tool) | Needed (Outcome) |
|---|---|---|
| Section banner | "Around 70% of Aussie roles are filled via networking. This is your LinkedIn toolkit." | "Around 70% of Aussie roles are filled via networking. We help you get found — and get the message right." |
| Subheading | "Profile · Outreach · Headshot · Banner — one cohesive system" | "Your complete LinkedIn transformation. Write once, send everywhere." |
| Missing entirely | No coaching/accountability on outreach | Each template should have: "Send this. Mark it sent. Your coach will check in 3 days." |

---

### 9.8 Apply / Stepper — Gaps

| Element | Current (Tool) | Needed (Outcome) |
|---|---|---|
| Cover letter note | "Most candidates skip the cover letter. Australian recruiters use it to filter genuine interest… a tailored cover letter measurably increases callback rates." | (Good — keep this. It's outcome-framed) |
| Track step heading | "Saved to your tracker. Nice work. This one is in your tracker." | "Application submitted. That's {X} toward your weekly goal. Your coach will review your documents within 24 hours." |
| CTAs | "Apply for another role" | "Apply for another role" → AND "Review my application pipeline" → AND "Book a progress check" |

---

### 9.9 Mindset Page — Gaps

| Element | Current (Tool) | Needed (Outcome) |
|---|---|---|
| Section banner | "Quick-reference mindset prompts for when the job search wears you down. Read one when you need it." | (This is excellent — keep entirely. It's the closest thing you have to the "coaching/accountability" layer.) |
| Footer (dashboard) | "Dealing with silence? Quick-ref mindset tips →" | (Good — keep. But note: this link is doing heavy emotional lifting alone. Add a companion "Book a check-in" link nearby.) |

---

### 9.10 Missing Pages / Features (What You Don't Have That He Does)

| What Farhoon has | You | Priority |
|---|---|---|
| High-ticket program (£1K-3K) | $97/mo subscription only | **HIGH** — this is where the real revenue is |
| Coaching / accountability calls | Nothing | **HIGH** — this is his unfair advantage |
| Controlled guarantee with conditions | You have one but it's buried | **HIGH** — surface it to hero level |
| Weekly group calls | Nothing | **MEDIUM** — high leverage, low effort |
| Student success page with before/after | 5 testimonials on landing only | **MEDIUM** — make testimonials more specific |
| Job outcome tracking per user | Pipeline counts only | **MEDIUM** — count time-to-offer, show progress |
| Direct job leads with coaching | Automated job feed only | **LOW** — your feed is better for scale |
| Refund/guarantee terms visible at checkout | Not asked | **MEDIUM** — add guarantee to checkout flow |

---

### 9.11 The One-Page Action Plan

**The shortest path to fixing the positioning gap:**

1. **Add a "Get Hired Program" tier on the Pricing page** — $1,000-$3,000, includes tool access + weekly coaching calls + accountability tracking + controlled guarantee. Existing $97/$197 tiers stay for self-service users.

2. **Reframe every hero headline to lead with outcome, not feature.** Start with the landing page hero.

3. **Surface the guarantee and its conditions at hero level** on the landing page. This is your biggest trust builder.

4. **Add weekly group coaching calls** — low cost, high retention, solves the self-motivation problem.

5. **Turn the dashboard into a progress tracker** — days in program, apps sent, interviews, coach notes. Not just a tool launcher.

6. **Make testimonials specific** — every one must name the role, company, and time-to-offer.

**Your advantage over him:**
- You have better technology (AI automation, speed, scale)
- He has better positioning and accountability
- Combine both and you're unbeatable

**The single sentence that changes everything:**
> "We help international graduates get their first Australian job in 90 days using AI + proven application systems + daily guidance."

Same product. Different perception.
