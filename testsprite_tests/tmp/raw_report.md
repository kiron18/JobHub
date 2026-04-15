
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** JobHub
- **Date:** 2026-04-09
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Log in and access dashboard
- **Test Code:** [TC001_Log_in_and_access_dashboard.py](./TC001_Log_in_and_access_dashboard.py)
- **Test Error:** TEST FAILURE

Signing in did not land the user on the authenticated dashboard using the provided email and password.

Observations:
- After submitting credentials the page still shows the sign-in form (heading: 'Sign in to JobHub').
- No dashboard indicators were found (no 'Dashboard', 'Sign out', 'Profile', user avatar, 'Jobs', or navigation menu).
- There are no visible error or notification messages explaining the failure.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/60641da2-4b75-48d0-b18d-fc81c30f4295
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Generate resume with selected achievements and save to library
- **Test Code:** [TC002_Generate_resume_with_selected_achievements_and_save_to_library.py](./TC002_Generate_resume_with_selected_achievements_and_save_to_library.py)
- **Test Error:** TEST BLOCKED

The feature could not be reached — the application is stuck on a loading spinner and the authentication/workspace UI cannot be accessed.

Observations:
- The page shows a central loading spinner on a blank/dark background (screenshot confirms spinner).
- Only a Notifications section exists; no login fields, buttons, or workspace navigation are visible after multiple attempts.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/28bcf5ca-8785-40ce-bc98-6c92422c50b8
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Submit onboarding intake and enter processing screen
- **Test Code:** [TC003_Submit_onboarding_intake_and_enter_processing_screen.py](./TC003_Submit_onboarding_intake_and_enter_processing_screen.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/63fb4d29-334e-44de-b437-8a52417ccff1
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Analyse a pasted job description and see match score with ranked achievements
- **Test Code:** [TC004_Analyse_a_pasted_job_description_and_see_match_score_with_ranked_achievements.py](./TC004_Analyse_a_pasted_job_description_and_see_match_score_with_ranked_achievements.py)
- **Test Error:** TEST BLOCKED

The feature could not be reached — the app appears stuck on a loading spinner and the login/dashboard cannot be accessed.

Observations:
- The page shows a central loading spinner and no login or dashboard elements are visible.
- Navigation to /auth repeatedly displays the spinner instead of the authentication form.
- Only a notifications landmark is interactive on the page; no auth controls or job-analysis UI are present.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/d9322077-e01a-4616-9387-04b215c3c504
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Run onboarding processing until report completes
- **Test Code:** [TC005_Run_onboarding_processing_until_report_completes.py](./TC005_Run_onboarding_processing_until_report_completes.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/5ffbe873-631e-4357-b48c-018298150b3a
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 Complete onboarding steps 1–3 and reach resume upload step
- **Test Code:** [TC006_Complete_onboarding_steps_13_and_reach_resume_upload_step.py](./TC006_Complete_onboarding_steps_13_and_reach_resume_upload_step.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/1b6d68be-df9e-47a2-9f5c-54e0ff4be721
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 View application pipeline counts on dashboard
- **Test Code:** [TC007_View_application_pipeline_counts_on_dashboard.py](./TC007_View_application_pipeline_counts_on_dashboard.py)
- **Test Error:** TEST BLOCKED

The test could not run to completion because the account could not be authenticated with the available credentials.

Observations:
- A red notification 'Invalid login credentials' is shown in the top-right of the page.
- The sign-in form remains on /auth after multiple submit attempts; the dashboard did not load.
- Email and password inputs are filled but repeated submissions did not authenticate the user.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/59fcfd8b-f29d-4d9c-88c0-d3149ae3be4a
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Generate cover letter, run personalisation, adjust tone, and save
- **Test Code:** [TC008_Generate_cover_letter_run_personalisation_adjust_tone_and_save.py](./TC008_Generate_cover_letter_run_personalisation_adjust_tone_and_save.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/1a4fb89e-39cb-4c20-8ce4-d35d878137b3
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Sign up and start onboarding
- **Test Code:** [TC009_Sign_up_and_start_onboarding.py](./TC009_Sign_up_and_start_onboarding.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/8e9ef3e0-d8af-46ad-86aa-1e73af1f2592
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 Open workspace for an analysed job and see it preloaded
- **Test Code:** [TC010_Open_workspace_for_an_analysed_job_and_see_it_preloaded.py](./TC010_Open_workspace_for_an_analysed_job_and_see_it_preloaded.py)
- **Test Error:** TEST BLOCKED

The test cannot continue because the provided login credentials are rejected.

Observations:
- After submitting the sign-in form the page shows a red notification: 'Invalid login credentials'.
- The app remained on the /auth page and did not navigate to the dashboard/workspace.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/2b8e4f45-3b26-410d-bc54-a17787b2bbc6
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC011 Generate resume and export as DOCX from preview
- **Test Code:** [TC011_Generate_resume_and_export_as_DOCX_from_preview.py](./TC011_Generate_resume_and_export_as_DOCX_from_preview.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/038300a6-8701-49f7-b8af-a8a0d7df8943
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC012 Advance a job through pipeline and see funnel update
- **Test Code:** [TC012_Advance_a_job_through_pipeline_and_see_funnel_update.py](./TC012_Advance_a_job_through_pipeline_and_see_funnel_update.py)
- **Test Error:** TEST BLOCKED

The app could not be reached — the authentication/dashboard UI never rendered, so the login and tracker flows cannot be executed.

Observations:
- The page shows a central loading spinner and only a Notifications region; no auth or tracker UI is available.
- Multiple attempts to complete onboarding and to navigate to /auth did not render the auth/dashboard.
- Onboarding submissions did not persist and did not grant access to the dashboard.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/310f57f4-11e9-44d1-9ccb-18a3a79c6b68
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC013 Save an analysed job to the application tracker
- **Test Code:** [TC013_Save_an_analysed_job_to_the_application_tracker.py](./TC013_Save_an_analysed_job_to_the_application_tracker.py)
- **Test Error:** TEST BLOCKED

The authentication and match engine UI could not be reached from the running app, preventing the test from continuing.

Observations:
- The app only displays a landing page with a central CTA ("Let's find out") and a dark-mode toggle.
- Navigating to /auth repeatedly shows a loading spinner and does not reveal any login fields or match engine controls.
- Clicking the CTA once did not progress to any authentication or match UI.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/ac91083d-9dc5-4f6c-965f-e8bdf66f4d87
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC014 Export generated document as PDF from preview
- **Test Code:** [TC014_Export_generated_document_as_PDF_from_preview.py](./TC014_Export_generated_document_as_PDF_from_preview.py)
- **Test Error:** TEST BLOCKED

The test cannot run because the application is not reachable and the SPA did not render any interactive UI.

Observations:
- The main page showed a blank/empty render with 0 interactive elements.
- Navigating directly to /auth produced no interactive elements (login not reachable).
- A subsequent reload/navigation attempt returned 'site unavailable'.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/7487bf2d-08ce-4a4f-8166-b6e0111fbf73
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC015 Set closing date, generate follow-up email, and copy output
- **Test Code:** [TC015_Set_closing_date_generate_follow_up_email_and_copy_output.py](./TC015_Set_closing_date_generate_follow_up_email_and_copy_output.py)
- **Test Error:** TEST BLOCKED

The app did not render so the test cannot reach the login screen or any functionality to perform the requested verification.

Observations:
- The page shows a persistent loading spinner and no application UI.
- Navigating to /auth produced the same blank/spinner state; no login form appeared.
- Only a Notifications section element is present on the page.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/753f705a-25b3-4d74-af62-41421fadafac
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC016 Require resume before submitting onboarding intake
- **Test Code:** [TC016_Require_resume_before_submitting_onboarding_intake.py](./TC016_Require_resume_before_submitting_onboarding_intake.py)
- **Test Error:** TEST BLOCKED

The onboarding/auth screens could not be reached so the intake form and resume upload step are not accessible.

Observations:
- The app stayed on the public landing page (only a dark-mode button and landing content are visible).
- Multiple attempts to navigate to /auth and clicks to start onboarding left the app on the landing page or showed a spinner.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/75cc7e02-15f6-4b5c-803f-6f6e8e9ef5b7
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC017 Filter applications by status and sort by match score
- **Test Code:** [TC017_Filter_applications_by_status_and_sort_by_match_score.py](./TC017_Filter_applications_by_status_and_sort_by_match_score.py)
- **Test Error:** TEST BLOCKED

The authentication and tracker pages required for this test could not be reached because the SPA did not render the login/tracker UI.

Observations:
- Navigating to /auth sometimes showed a centered loading spinner and did not display a login form; the current page only exposes a dark-mode control.
- Clicking the landing CTA briefly produced onboarding in earlier attempts but subsequent tries reverted to the landing page without access to /auth or /tracker.
- Multiple navigations, waits, and clicks (as recorded) did not surface the login or tracker interfaces needed to perform filtering/sorting.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/57949e24-0562-4749-9822-5ca1f0edbdfe
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC018 Generate selection criteria, edit, and save to library
- **Test Code:** [TC018_Generate_selection_criteria_edit_and_save_to_library.py](./TC018_Generate_selection_criteria_edit_and_save_to_library.py)
- **Test Error:** TEST BLOCKED

The application cannot be reached because the SPA is stuck on a loading screen and the UI never renders, preventing the test from proceeding.

Observations:
- The page displays a central loading spinner and the text 'Loading...'.
- There are effectively 0 interactive UI elements available (only a notifications region is present), so the login form and workspace cannot be accessed.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/b15c3b96-6fbf-4182-94f0-f994485c3032
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC019 Open a deadline item from dashboard to view application details in tracker
- **Test Code:** [TC019_Open_a_deadline_item_from_dashboard_to_view_application_details_in_tracker.py](./TC019_Open_a_deadline_item_from_dashboard_to_view_application_details_in_tracker.py)
- **Test Error:** TEST BLOCKED

The feature could not be reached — login with the provided credentials failed, so the dashboard and upcoming deadlines are inaccessible.

Observations:
- The page showed 'Invalid login credentials' in a notification.
- The auth form remained on-screen with email and password populated; no navigation to the dashboard occurred.
- Sign in was attempted twice using example@gmail.com / password123 and both attempts failed.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/4ba90aa7-f951-4b66-9b0f-d0b56ac40147
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC020 Expand and collapse a diagnostic report section and submit relevance feedback
- **Test Code:** [TC020_Expand_and_collapse_a_diagnostic_report_section_and_submit_relevance_feedback.py](./TC020_Expand_and_collapse_a_diagnostic_report_section_and_submit_relevance_feedback.py)
- **Test Error:** TEST BLOCKED

The diagnostic report panel could not be reached so the test could not run to completion.

Observations:
- The app remains on the onboarding/landing UI ("Building your profile") with profile fields present.
- Clicking 'Lock in my target' did not navigate to or reveal the dashboard/diagnostic report panel.
- No diagnostic report sections (e.g., Targeting Assessment) are visible to expand/collapse or rate.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/bf40642a-d82c-478c-aa09-91ff8b124ac0
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC021 Preview a document in markdown
- **Test Code:** [TC021_Preview_a_document_in_markdown.py](./TC021_Preview_a_document_in_markdown.py)
- **Test Error:** TEST BLOCKED

The feature could not be reached — the single-page app (SPA) did not load so the login and document library pages are inaccessible.

Observations:
- Navigating to /auth shows a blank page with 0 interactive elements.
- Waiting for the page to finish loading did not change the state (still blank).
- No login form or navigation to the Document Library was available.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/73f04c7e-6a63-420a-91d6-81b023e1c4c6
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC022 Block sign-in with invalid credentials
- **Test Code:** [TC022_Block_sign_in_with_invalid_credentials.py](./TC022_Block_sign_in_with_invalid_credentials.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/2a59260a-6ec8-484c-87f9-c3bb7b9e6599
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC023 Analyse a job description and view extracted metadata and AU-specific flags
- **Test Code:** [TC023_Analyse_a_job_description_and_view_extracted_metadata_and_AU_specific_flags.py](./TC023_Analyse_a_job_description_and_view_extracted_metadata_and_AU_specific_flags.py)
- **Test Error:** TEST BLOCKED

The test cannot proceed because the provided credentials were rejected and I cannot sign in to access the match analysis feature.

Observations:
- After submitting the email and password, the UI shows a persistent 'Invalid login credentials' notification.
- The sign-in form remained visible with email and password populated and no post-login UI rendered.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/1838c0fc-ea27-41a1-9274-cb79654cc634
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC024 Add achievement and link it to an experience entry
- **Test Code:** [TC024_Add_achievement_and_link_it_to_an_experience_entry.py](./TC024_Add_achievement_and_link_it_to_an_experience_entry.py)
- **Test Error:** TEST BLOCKED

Login with the provided test credentials failed, so the authenticated features (Profile Bank and achievement creation) could not be reached.

Observations:
- The page displayed a red notification reading 'Invalid login credentials'.
- The sign-in form remained on the /auth page after submitting the credentials, preventing access to the Profile Bank or the achievement creation UI.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/4cb34eaa-1d03-4c0a-a207-e22ed3b71586
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC025 Proceed from diagnostic report islands into the dashboard apply experience
- **Test Code:** [TC025_Proceed_from_diagnostic_report_islands_into_the_dashboard_apply_experience.py](./TC025_Proceed_from_diagnostic_report_islands_into_the_dashboard_apply_experience.py)
- **Test Error:** TEST FAILURE

Could not progress to the main dashboard — the final step to advance the diagnostic is not reachable.

Observations:
- The page currently displays diagnostic island 3/4 with response options and blockers selected.
- There is no interactive 'Complete my profile' button available in the page's interactive element list, so the flow cannot be advanced from this screen.
- Clicking the available controls (response/blocker options) does not trigger navigation to the next island or dashboard.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/7e0d879d-4b97-43bd-8261-be407a453b4a
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC026 View documents grouped by recency
- **Test Code:** [TC026_View_documents_grouped_by_recency.py](./TC026_View_documents_grouped_by_recency.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/2709a3e2-e4b6-477c-a124-0ec589b07d9f
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC027 Retry processing from processing screen
- **Test Code:** [TC027_Retry_processing_from_processing_screen.py](./TC027_Retry_processing_from_processing_screen.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/d5e4dba8-0287-4934-8a99-060ab572d4f0
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC028 Edit and save professional summary
- **Test Code:** [TC028_Edit_and_save_professional_summary.py](./TC028_Edit_and_save_professional_summary.py)
- **Test Error:** TEST BLOCKED

The test cannot proceed because the provided credentials were not accepted and the user could not be authenticated.

Observations:
- After submitting the sign-in form the app displayed an 'Invalid login credentials' notification.
- The page remained on the sign-in screen with email and password fields visible.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/2ecac6ff-19b7-412d-b674-ed732c6454ab
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC029 Delete a document with confirmation
- **Test Code:** [TC029_Delete_a_document_with_confirmation.py](./TC029_Delete_a_document_with_confirmation.py)
- **Test Error:** TEST BLOCKED

The feature could not be reached because signing in with the provided test credentials failed, preventing access to the application workspace and Document Library.

Observations:
- The page displayed a red notification stating 'Invalid login credentials'.
- Submitting email 'example@gmail.com' and password 'password123' produced the error and did not navigate to the workspace.
- Because authentication failed, the Document Library cannot be opened to create or delete documents.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/3dcea5a3-ea76-4d2b-b542-2c36ca696986
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC030 Prevent generation when no achievements are selected
- **Test Code:** [TC030_Prevent_generation_when_no_achievements_are_selected.py](./TC030_Prevent_generation_when_no_achievements_are_selected.py)
- **Test Error:** TEST BLOCKED

The onboarding flow that leads to the achievements selector could not be reached, so the test cannot proceed to verify whether generation is blocked when required achievements are not selected.

Observations:
- On /application-workspace the only interactive element visible is the dark-mode button; the onboarding entry button is not accessible.
- The profile/achievement selection UI cannot be reached from the current page state, preventing the validation check from running.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/a37596c4-c740-4dce-9952-fb47592478c1/61aa2188-e07c-4d61-b60c-6405cb9ca485
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **30.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---