# LinkedIn Hub — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Scope:** Four independent features shipped in two phases — Phase 1: Google OAuth fix; Phase 2: LinkedIn Hub page (profile optimisation, outreach templates, AI headshot, banner editor)

---

## Overview

The LinkedIn Hub transforms the existing job-specific LinkedIn popout (in ApplicationWorkspace) into a standalone, profile-driven page that covers everything a candidate needs to show up well on LinkedIn: an optimised profile, a professional headshot, a polished banner, and AI-personalised outreach messages. All sections are generated in one coherent pass so they reinforce the same narrative.

The existing LinkedIn popout in ApplicationWorkspace is left untouched during this work. It can be removed separately once the new page is validated.

---

## Phase 1 — Google OAuth Fix

### What changes
- `src/pages/AuthPage.tsx` — add "Continue with Google" button below the existing magic link / password tabs
- Supabase Google OAuth provider enabled in Supabase dashboard (config, not code)
- `src/components/OnboardingGate.tsx` — detect post-OAuth redirect and restore any in-progress onboarding answers from localStorage

### What does not change
- Magic link flow
- Password flow
- Auth middleware
- Protected routes
- Any other component

### Isolation
Entirely additive. No existing auth logic is modified.

---

## Phase 2 — LinkedIn Hub Page

### Route and Navigation
- Route: `/linkedin`
- Sidebar nav item: "LinkedIn" with the LinkedIn icon (blue `#0A66C2`), positioned between "Documents" and "Email Templates"
- Protected route (requires auth)

### Isolation Strategy
- All new code lives in new files: `src/pages/LinkedInPage.tsx`, `src/components/linkedin/` subdirectory
- `src/components/ApplicationWorkspace.tsx` is not touched
- New backend endpoints only — existing `/generate/linkedin-profile` endpoint is not modified
- New backend files: `server/src/routes/linkedin.ts`, `server/rules/linkedin_outreach_rules.md`

---

## Page Structure

The page has two tabs at the top:

```
[ Profile ]  [ Outreach ]
```

---

## Tab 1 — Profile

### Profile Strip (read-only)
Displays at the top of the tab. Shows:
- Headshot (generated or placeholder avatar)
- Candidate name and current title (pulled from profile)
- Sets the visual tone — mirrors LinkedIn's own profile header aesthetic

### Target Role Input
- Optional text field: "What roles are you targeting? (optional)"
- Ghost placeholder suggestions: *"e.g. Senior Product Manager · B2B SaaS"*, *"e.g. Data Engineer · FinTech"*
- Coaching hint: "Adding a target role sharpens the output. Leave blank for a general profile."

### Generate All Button
- Single LLM call to new endpoint `POST /api/linkedin/generate`
- Input: `{ profileData, diagnosticReport, targetRole? }`
- Output: `{ headline, about, skills[], experienceBullets[], openToWork, bannerCopies[] }`
- All sections generated with a single unified narrative frame
- Each section card has a small "↻ Regenerate" icon for targeted regeneration after the initial pass (separate LLM call scoped to that section only)

### Profile Sections
Each section rendered as a card with:
- Section label and LinkedIn character limit / count badge
- Generated content (editable inline)
- "Copy" button with "Copied ✓" flash on click

| Section | Limit | Notes |
|---|---|---|
| Headline | 220 chars | Live char count |
| About | 1,800–2,200 chars (max 2,600) | Target range shown |
| Skills | 10 items | Displayed as pill tags |
| Experience bullets | 3–4 bullets | Most recent role only |
| Open to Work signal | ~150 chars | Single sentence |

### Banner Section
Follows the profile sections. Flow:

1. `bannerCopies[]` from the generation call arrives as 3 formula variation cards:
   - Value proposition ("I help [audience] [achieve outcome]")
   - Bold positioning ("Your [role] shortcut to [big result]")
   - Credibility + offer ("[Achievement] | Now helping [audience] do the same")
2. User picks one card → text fields appear pre-loaded:
   - **Main message** (editable, soft warning at 12 words / hard warning at 15)
   - **Sub-line** (optional — for proof elements: "3,000+ helped · Forbes · Kajabi")
   - Character count shown; guidance: "Aim for 5–12 words. People scan on mobile."
3. "Open Banner Editor" button opens the canvas editor:
   - Live preview at 792×198px (50% scale of 1584×396px export size)
   - Text locked to right 60% of canvas (not user-adjustable — guards against profile photo overlap on mobile)
   - Font locked to Inter/system sans-serif
   - **Background colour picker** (default: dark navy `#0F172A`)
   - **Texture preset** (3 options): Clean (flat colour), Gradient (left-dark → right-lighter), Grid (subtle dot pattern overlay)
   - "Download Banner" → `html2canvas` export at 1584×396px PNG, no server call

### Headshot Section
Below the banner section.

**Upload flow:**
1. Drop zone: "Upload a clear photo of your face" (accepts JPG/PNG, max 10MB)
2. Preview shown on upload
3. "Generate Headshot" button activates
4. Generation runs via `POST /api/linkedin/headshot` (10–20s), spinner shown
5. Result displayed at portrait crop ratio
6. Two actions: **"Save to Profile"** (saves URL to profile record) and **"Try Again"** (uses one credit)
7. Credit counter: *"2 of 3 generations used today"*

**Rate limiting:**
- `MAX_DAILY_HEADSHOTS=3` in server `.env` — single line to change
- Counter stored on user profile record: `headshotGenerationsToday` (Int) + `headshotGenerationsDate` (DateTime)
- Resets at midnight UTC

**Model:** `fal-ai/photomaker` via fal.ai API (`FAL_AI_KEY` in server `.env`)

**Prompt (locked, never exposed to user):**
> "A hyper-realistic headshot portrait of the uploaded image in DSLR-style realism with a soft pastel teal studio background and high quality studio lighting. The result should look clean and professional"

**Estimated cost:** ~$0.05–$0.08 per generation

---

## Tab 2 — Outreach

### Before You Start (collapsible guide)
Collapsed by default. Contains the 7-step networking playbook principles as static reading — steps 1 and 2 (find the right people, comment before connecting) cannot be templated and are presented as guidance only. Expands with a "Read the playbook" toggle.

### Template Generator

**User inputs:**
| Field | Description |
|---|---|
| First name | Target person's first name |
| Company | Their company |
| What they work on / posted about | One line — their topic or area |
| A specific question to ask | Free text; 3 AI-generated suggestions returned as part of the same `POST /api/linkedin/outreach` call and shown as selectable chips below the field |

On "Generate Templates", the AI calls `POST /api/linkedin/outreach` with the user inputs + candidate profile context. The candidate's name, background, current situation, and relevant skills are auto-filled from the profile — the user only provides the target-person details.

**Output — four template cards, each with a copy button:**

| Template | Key constraint |
|---|---|
| Connection request note | Hard 300-char limit shown live; AI keeps within it |
| First message after connecting | Candidate situation auto-filled; specific question embedded |
| After-call follow-up | One editable field: "What specific point did they make?" |
| Direct ask for help | Shown with coaching note: *"Use this only after at least one meaningful exchange"* |

Each card has a collapsible coaching tip (static, from the playbook):
- Connection note: *"The specificity of the reference is what makes it work. Generic openers get ignored."*
- First message: *"A precise question about something they actually know is hard to walk away from."*
- After call: *"Shows you were paying attention. Plants a seed of reciprocity without being transactional."*
- Direct ask: *"Ask for a name or a direction, not a job. Small ask, high likelihood of yes."*

---

## Backend

### New endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/linkedin/generate` | POST | Profile sections + banner copies — one unified LLM call |
| `/api/linkedin/outreach` | POST | Personalised outreach templates |
| `/api/linkedin/headshot` | POST | fal.ai image generation, rate-limited |

### Generation context (both endpoints)
- `profileData`: name, title, location, achievements, skills, work history from `CandidateProfile`
- `diagnosticReport`: the AI-generated narrative from the diagnostic service
- `targetRole` (optional): user-provided string

### Rules files
- `server/rules/linkedin_profile_rules.md` — **left unchanged** to preserve the existing `/generate/linkedin-profile` endpoint behaviour in ApplicationWorkspace
- `server/rules/linkedin_hub_profile_rules.md` — **new file**: profile-based framing (no JD references), same output structure (headline, about, skills, experience, open-to-work), plus banner copy generation (3 formula variations) as an added section. Used exclusively by the new `/api/linkedin/generate` endpoint.
- `server/rules/linkedin_outreach_rules.md` — new: contains the playbook's template logic, formula instructions, and tone guidance for generating the four outreach messages.

### Headshot endpoint
- Accepts multipart form upload (image file)
- Checks rate limit before calling fal.ai
- Calls `fal-ai/photomaker` with locked prompt
- Returns `{ imageUrl: string }`
- On save-to-profile: updates `CandidateProfile.headshotUrl` (new field)

### Schema additions
```prisma
model CandidateProfile {
  // existing fields ...
  headshotUrl               String?
  headshotGenerationsToday  Int       @default(0)
  headshotGenerationsDate   DateTime?
}
```

---

## Cohesion Principle

The entire page is designed around one idea: everything a recruiter or connection sees when they land on a candidate's LinkedIn profile should tell the same story. The banner hooks them, the headline confirms it, the about section proves it, and the outreach message sounds like the same human who wrote all of the above. The app closes the loop that external tools (Canva, ChatGPT, Ideogram) break open.

---

## Out of Scope
- Removing the old LinkedIn popout from ApplicationWorkspace (post-validation cleanup)
- Direct LinkedIn API integration (publish to LinkedIn)
- Saving / versioning multiple profile drafts
- Banner logo/icon uploads (template option B only)
