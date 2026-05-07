# 11 Fixes — QA Session Checklist
**Date:** 2026-04-23  
**Status:** In progress

---

- [ ] **#1 — Remove "Leave blank" email hint in SkoolGate**
  - File: `src/components/SkoolGate.tsx:166`
  - Remove the line "Leave blank if it's the same as this account." — email is required to proceed

- [ ] **#2 — Resume: education section showing "no data available"**
  - Investigate whether education data is making it into the resume prompt
  - Files: `server/src/routes/generate.ts`, `server/src/services/prompts/generation.ts`
  - Likely cause: profile.education is empty in DB even though onboarding captured it — check extraction pipeline

- [ ] **#3 — Professional summary too long on resume**
  - Resume rules already say 60–90 words. Enforce stricter word cap in prompt.
  - File: `server/rules/resume_rules.md` — strengthen the length instruction

- [ ] **#4 — Cover letter: enforce distinct paragraph breaks in rendered output**
  - Rules say "double spacing between paragraphs" but rendering may collapse them
  - Ensure double `\n\n` between paragraphs is preserved in the frontend display

- [ ] **#5 — Job feed: show "building feed" state instead of "no jobs found" on first load**
  - When feed returns 0 jobs on first visit, distinguish between "building" vs "genuinely empty"
  - Show a loading/building state for ~30s before showing empty state
  - File: `src/pages/JobFeedPage.tsx`, `server/src/routes/job-feed.ts`

- [ ] **#6 — Follow-up reminder text: remove "AI email" wording**
  - Change: "Time to reach out — click to generate an AI email."
  - To: "Time to reach out — click to generate an email."
  - File: `src/components/tracker/JobCard.tsx:222`

- [ ] **#7 — Follow-up email: use brief template + add hunter.io/rocketreach tutorial popup**
  - Generated email must use the "Follow-Up After Application" template structure (short, 5 lines, placeholders pre-filled with role/company from job data)
  - NOT the current long AI-generated cover-letter-style output
  - Add a "How to find the right email?" info button that opens a brief tutorial modal
  - Tutorial content: use hunter.io (enter company domain → find recruiter email) or RocketReach (name + company lookup). Free tiers available. Explain 30-second process.
  - File: `src/components/tracker/JobCard.tsx`, `server/rules/followup_email_rules.md`

- [ ] **#8 — Resume parsing: education not being extracted from PDF**
  - This is a data issue — PDF extraction may be silently failing for education section
  - Add logging to Stage 1 extraction to surface what was/wasn't parsed
  - User should re-upload resume and check Profile & Achievements to see if education appears
  - Note: fix is investigative — check `server/src/routes/extract.ts` and `server/src/services/prompts/index.ts`

- [ ] **#9 — LinkedIn generation: strip all em-dashes from output**
  - The main generate route already strips em-dashes (generate.ts:234)
  - LinkedIn routes use `callClaude` directly and return raw content — em-dashes not stripped
  - File: `server/src/routes/linkedin.ts` — apply same strip to /generate and /outreach responses

- [ ] **#10 — AI Headshot: fix 500 error (Railway FAL_AI_KEY issue)**
  - Error: `POST /api/linkedin/headshot → 500 Internal Server Error`
  - Railway has FAL_AI_KEY set but the fal-ai SDK may expect a different env var name
  - Check: `fal.config({ credentials: process.env.FAL_AI_KEY })` — confirm Railway var name matches exactly
  - Add error logging to surface the actual fal.ai error message

- [ ] **#11 — Friday Brief: email to kiron@aussiegradcareers.com.au, remove from sidebar**
  - Add "Send to my email" button on Friday Brief page → sends generated script via Resend to kiron@aussiegradcareers.com.au
  - Remove Friday Brief nav link from sidebar entirely (still accessible at /admin/friday-brief URL for admin)
  - File: `server/src/services/email.ts` — add sendFridayBrief() function
  - File: `server/src/routes/admin.ts` — add POST /friday-brief/email endpoint
  - File: `src/layouts/DashboardLayout.tsx` — remove Friday Brief nav item
  - File: `src/pages/admin/FridayBriefPage.tsx` — add email button

---

## Notes
- #8 (resume parsing) requires user to re-upload resume to test — cannot be fully fixed in code alone
- #10 (headshot) requires checking Railway env var name matches code exactly
- #5 (job feed empty state) — "Marketing in Sydney" genuinely returning 0 from Adzuna today is possible; improve UX messaging rather than retrying endlessly
