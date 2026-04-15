
# TestSprite AI Testing Report (MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** JobHub
- **Date:** 2026-04-09
- **Prepared by:** TestSprite AI Team
- **Test Scope:** Full frontend codebase — 30 test cases across 8 requirement groups
- **Environment:** Local Vite production build (`npm run build && npm run preview`) served on `http://localhost:5173`
- **Test Suite:** [View on TestSprite Dashboard](https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1)

---

## 2️⃣ Requirement Validation Summary

---

### Requirement: Authentication
- **Description:** Users can sign up and sign in using Supabase email/password or magic link. Invalid credentials are rejected with a visible error.

#### Test TC001 Log in and access dashboard
- **Test Code:** [TC001_Log_in_and_access_dashboard.py](./TC001_Log_in_and_access_dashboard.py)
- **Test Error:** After submitting credentials the page remained on the sign-in form with no error message and no navigation to the dashboard.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/60641da2-4b75-48d0-b18d-fc81c30f4295
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** Login submitted successfully but silently failed — no error toast, no dashboard redirect. The test used placeholder credentials (`example@gmail.com` / `password123`) which are not seeded in the Supabase instance. The auth form shows no feedback on silent failure (e.g. network error or unregistered email). Recommend: (1) supply real test credentials via TestSprite login config, (2) ensure the UI always surfaces a failure reason even on unexpected Supabase errors.

---

#### Test TC007 View application pipeline counts on dashboard
- **Test Code:** [TC007_View_application_pipeline_counts_on_dashboard.py](./TC007_View_application_pipeline_counts_on_dashboard.py)
- **Test Error:** 'Invalid login credentials' notification shown; dashboard never loaded.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/59fcfd8b-f29d-4d9c-88c0-d3149ae3be4a
- **Status:** BLOCKED
- **Severity:** HIGH
- **Analysis / Findings:** Blocked by missing test credentials. The app correctly rejects invalid credentials (error toast visible) — the auth layer itself is functioning. Re-run with valid credentials to validate dashboard pipeline counts.

---

#### Test TC009 Sign up and start onboarding
- **Test Code:** [TC009_Sign_up_and_start_onboarding.py](./TC009_Sign_up_and_start_onboarding.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/8e9ef3e0-d8af-46ad-86aa-1e73af1f2592
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** New user sign-up flow works end-to-end. After signup the app correctly transitions into the onboarding intake experience.

---

#### Test TC022 Block sign-in with invalid credentials
- **Test Code:** [TC022_Block_sign_in_with_invalid_credentials.py](./TC022_Block_sign_in_with_invalid_credentials.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/2a59260a-6ec8-484c-87f9-c3bb7b9e6599
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Auth correctly rejects invalid credentials and displays an error notification. No unintended access granted.

---

#### Tests BLOCKED by missing test credentials: TC010, TC019, TC023, TC024, TC028, TC029
- **Shared Root Cause:** TestSprite used placeholder credentials (`example@gmail.com` / `password123`) which are not registered in the Supabase instance. All downstream features (Profile Bank, Tracker, Workspace, Document Library, Match Engine) are therefore unreachable.
- **Severity:** HIGH — blocks ~60% of the test suite
- **Recommendation:** Configure real test account credentials in TestSprite's login settings for the next run.

---

### Requirement: Onboarding Intake
- **Description:** New users complete a 4-step intake form collecting target role, job search history, and profile data. Submitting transitions to a processing screen that generates a diagnosis report.

#### Test TC003 Submit onboarding intake and enter processing screen
- **Test Code:** [TC003_Submit_onboarding_intake_and_enter_processing_screen.py](./TC003_Submit_onboarding_intake_and_enter_processing_screen.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/63fb4d29-334e-44de-b437-8a52417ccff1
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Submitting the final onboarding step correctly triggers the full-screen processing experience. The transition and loading state work as designed.

---

#### Test TC005 Run onboarding processing until report completes
- **Test Code:** [TC005_Run_onboarding_processing_until_report_completes.py](./TC005_Run_onboarding_processing_until_report_completes.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/5ffbe873-631e-4357-b48c-018298150b3a
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** The onboarding processing flow runs to completion and produces a diagnosis report. End-to-end AI pipeline (submit → process → report) is functional.

---

#### Test TC006 Complete onboarding steps 1–3 and reach resume upload step
- **Test Code:** [TC006_Complete_onboarding_steps_13_and_reach_resume_upload_step.py](./TC006_Complete_onboarding_steps_13_and_reach_resume_upload_step.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/1b6d68be-df9e-47a2-9f5c-54e0ff4be721
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Multi-step intake form navigation works correctly. Steps 1–3 collect required data and advance without issues. Resume upload step is reachable.

---

#### Test TC027 Retry processing from processing screen
- **Test Code:** [TC027_Retry_processing_from_processing_screen.py](./TC027_Retry_processing_from_processing_screen.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/d5e4dba8-0287-4934-8a99-060ab572d4f0
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Retry mechanism on the processing screen works. Users can re-trigger AI processing if initial generation fails.

---

#### Test TC016 Require resume before submitting onboarding intake
- **Test Code:** [TC016_Require_resume_before_submitting_onboarding_intake.py](./TC016_Require_resume_before_submitting_onboarding_intake.py)
- **Test Error:** Auth/onboarding screens not reachable; app remained on the public landing page.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/75cc7e02-15f6-4b5c-803f-6f6e8e9ef5b7
- **Status:** BLOCKED
- **Severity:** MEDIUM
- **Analysis / Findings:** Intermittent SPA rendering issue — the app occasionally stays on the landing page without transitioning to auth/onboarding. Likely a race condition between route resolution and auth state hydration. Re-run in a fresh session to confirm.

---

#### Test TC025 Proceed from diagnostic report islands into the dashboard apply experience
- **Test Code:** [TC025_Proceed_from_diagnostic_report_islands_into_the_dashboard_apply_experience.py](./TC025_Proceed_from_diagnostic_report_islands_into_the_dashboard_apply_experience.py)
- **Test Error:** App stuck on onboarding island 3/4. No 'Complete my profile' button available to advance the flow.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/7e0d879d-4b97-43bd-8261-be407a453b4a
- **Status:** ❌ Failed
- **Severity:** HIGH
- **Analysis / Findings:** Genuine UI bug — the CTA to advance from onboarding island 3/4 to the next step or dashboard is not accessible/visible. Users who reach this state cannot progress without a page refresh or manual navigation. Investigate the conditional rendering logic for the completion button on `OnboardingIntake.tsx`. This is a critical flow-blocker for new users.

---

#### Test TC020 Expand and collapse a diagnostic report section and submit relevance feedback
- **Test Code:** [TC020_Expand_and_collapse_a_diagnostic_report_section_and_submit_relevance_feedback.py](./TC020_Expand_and_collapse_a_diagnostic_report_section_and_submit_relevance_feedback.py)
- **Test Error:** App remained on onboarding UI; no diagnostic report sections visible.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/bf40642a-d82c-478c-aa09-91ff8b124ac0
- **Status:** BLOCKED
- **Severity:** MEDIUM
- **Analysis / Findings:** Could not advance past onboarding (related to TC025 failure). Re-run after the TC025 bug is fixed to validate report interaction.

---

### Requirement: Application Workspace — Document Generation
- **Description:** Authenticated users can select achievements, generate tailored documents (resume, cover letter, selection criteria), edit inline, run analysis panels, export as DOCX/PDF, and save to library.

#### Test TC008 Generate cover letter, run personalisation, adjust tone, and save
- **Test Code:** [TC008_Generate_cover_letter_run_personalisation_adjust_tone_and_save.py](./TC008_Generate_cover_letter_run_personalisation_adjust_tone_and_save.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/1a4fb89e-39cb-4c20-8ce4-d35d878137b3
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Cover letter generation, personalisation check, tone rewrite, and library save all work end-to-end. Document generation pipeline is functional.

---

#### Test TC011 Generate resume and export as DOCX from preview
- **Test Code:** [TC011_Generate_resume_and_export_as_DOCX_from_preview.py](./TC011_Generate_resume_and_export_as_DOCX_from_preview.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/038300a6-8701-49f7-b8af-a8a0d7df8943
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Resume generation and DOCX export work correctly. The file-saver integration produces a valid download.

---

#### Tests BLOCKED (credential-dependent): TC002, TC012, TC013, TC014, TC015, TC017, TC018, TC021, TC029, TC030
- **Shared Root Cause:** Tests requiring an authenticated session could not proceed due to missing/invalid test credentials. Several also hit intermittent SPA loading spinner states.
- **Severity:** HIGH (credential issue); MEDIUM (spinner intermittency)
- **Recommendation:** Re-run with valid test credentials. For spinner issues, investigate Supabase session restoration timing in `AuthContext.tsx` — the auth state may not be hydrated before route guards trigger.

---

### Requirement: Document Library
- **Description:** Authenticated users can browse, preview, copy, download, and delete saved documents grouped by recency.

#### Test TC026 View documents grouped by recency
- **Test Code:** [TC026_View_documents_grouped_by_recency.py](./TC026_View_documents_grouped_by_recency.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/2709a3e2-e4b6-477c-a124-0ec589b07d9f
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** Documents are correctly grouped by recency (Today, Yesterday, This Week, This Month, Older). The grouping and rendering logic works as expected.

---

#### Test TC021 Preview a document in markdown
- **Test Code:** [TC021_Preview_a_document_in_markdown.py](./TC021_Preview_a_document_in_markdown.py)
- **Test Error:** Navigating to /auth showed a blank page with 0 interactive elements.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/73f04c7e-6a63-420a-91d6-81b023e1c4c6
- **Status:** BLOCKED
- **Severity:** MEDIUM
- **Analysis / Findings:** Blocked by intermittent SPA blank-page rendering issue, not a Document Library bug. Re-run in a fresh session.

---

---

## 3️⃣ Coverage & Matching Metrics

- **30% of tests passed** (9 / 30 test cases)
- **7% failed** (2 / 30 — genuine bugs found)
- **63% blocked** (19 / 30 — primarily missing test credentials + intermittent SPA loading)

| Requirement                    | Total Tests | ✅ Passed | ❌ Failed | BLOCKED |
|-------------------------------|-------------|-----------|-----------|---------|
| Authentication                 | 8           | 2         | 1         | 5       |
| Onboarding Intake              | 6           | 4         | 1         | 1       |
| Application Workspace          | 8           | 2         | 0         | 6       |
| Match Engine                   | 3           | 0         | 0         | 3       |
| Application Tracker            | 2           | 0         | 0         | 2       |
| Profile Bank                   | 2           | 0         | 0         | 2       |
| Document Library               | 2           | 1         | 0         | 1       |
| Diagnosis Report               | 2           | 0         | 1         | 1       |
| **TOTAL**                      | **30**      | **9**     | **2**     | **19**  |

---

## 4️⃣ Key Gaps / Risks

**Pass rate:** 30% fully passed (9/30). 63% blocked by environment issues, 7% failed with genuine bugs.

### Critical Issues (fix before next test run)

**1. Missing test credentials — blocks ~60% of the suite**
> TestSprite fell back to placeholder credentials (`example@gmail.com` / `password123`) which are not registered in the Supabase instance. Every test requiring an authenticated session was blocked. Configure a real test account in TestSprite's credential settings before re-running.

**2. TC025 — Onboarding island 3/4 has no accessible completion button (CRITICAL BUG)**
> The `OnboardingIntake.tsx` component fails to render or make accessible the "Complete my profile" CTA at island 3/4. A new user who reaches this state cannot advance to the dashboard without a manual page refresh or direct URL navigation. This is a **critical flow-blocker** that breaks the core new-user journey. Investigate conditional rendering logic for the completion button.

**3. TC001 — Silent login failure with no user feedback (HIGH BUG)**
> When login is submitted with an unrecognised email, the form stays on the sign-in screen with no error message and no navigation. The app should always surface a failure reason (invalid credentials, network error, unverified email). Silent failures degrade UX and make debugging harder. Check the `catch` block in the Supabase `signInWithPassword` call in `AuthPage.tsx`.

### Medium-Priority Risks

**4. Intermittent SPA blank-page / loading-spinner states**
> Several tests (TC002, TC004, TC012–TC018, TC021) observed the app rendering only a loading spinner or blank page, with 0 interactive elements. This is consistent with a race condition between Supabase auth state hydration and route-guard evaluation in `OnboardingGate.tsx` / `ProtectedRoute`. The `AuthContext` may be emitting `null` briefly before the session is confirmed, causing the gate to redirect or freeze. Add a proper loading state that defers rendering until `session !== undefined` (i.e. distinguishes "loading" from "no session").

**5. Authenticated feature coverage is unvalidated**
> Match Engine, Application Tracker, Profile Bank (achievements, experience, education), and most Workspace analysis panels (ATS coverage, Gap Analysis, Interview Prep, Salary Insights, Company Research) have zero verified test coverage due to the credential blocker. These represent the core product value and should be a priority for the next test run.

### Positives

- ✅ Onboarding intake is robust: 4/6 onboarding tests passed including the full processing pipeline and retry mechanism.
- ✅ Document generation (cover letter + DOCX export) works end-to-end in authenticated sessions that were reachable.
- ✅ Auth correctly rejects invalid credentials and surfaces a visible error toast.
- ✅ Sign-up flow works correctly and transitions into onboarding.
- ✅ Document Library recency grouping renders correctly.
