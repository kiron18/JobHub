# JobHub Database Migration Audit

**Total Migrations: 32**  
**Date: 2026-06-20**

---

## CORE TABLES (Must Keep)

| # | Migration | What It Creates | Keep? |
|---|-----------|-----------------|-------|
| 1 | `20240101000000_baseline` | CandidateProfile, User, Document, JobApplication, Experience, Education, all core tables | **YES** |
| 2 | `20250615034000_add_is_casual_to_experience` | `isCasual` flag on Experience | YES |

---

## CRM / EMAIL SYSTEM (3 migrations)

| # | Migration | What It Creates | Decision |
|---|-----------|-----------------|----------|
| 3 | `20250616000001_add_crm_email_system` | Contact, ContactSequence, ContactSequenceEnrollment tables | KEEP if using email sequences |
| 4 | `20250616000004_add_contact_id_to_candidate_profile` | Links CandidateProfile to Contact | KEEP |
| 5 | `20250619000001_add_followup_columns` | `followUpSentAt`, `followUpDismissedAt` on JobApplication | KEEP |

**Action:** These are your email marketing/follow-up system. Keep if using.

---

## VISA SPONSOR FEATURE (3 migrations)

| # | Migration | What It Creates | Decision |
|---|-----------|-----------------|----------|
| 6 | `20260529000001_add_sponsor_model` | Sponsor table, SponsorConfidence enum | **KEEP** |
| 7 | `20250616000002_add_sponsor_job_model` | SponsorJob table with `confidence` column | **KEEP** |
| 8 | `20260529100000_add_sponsor_lead` | SponsorLead table | **KEEP** |

**Note:** This is your "crown jewel" visa sponsor feature.

---

## CV SCAN / LEAD CAPTURE (2 migrations)

| # | Migration | What It Creates | Decision |
|---|-----------|-----------------|----------|
| 9 | `20250616000003_add_cv_scan_lead_model` | **CvScanLead table** - original schema | **KEEP** |
| 10 | `20260620000001_reconcile_cv_scan_lead` | **ADDS fullName, inferredRole, score** | **CRITICAL** |

**Status:** Migration #10 was created today to fix the missing `fullName` column.

---

## JOB FEED / INGESTION (6 migrations)

| # | Migration | What It Creates | Decision |
|---|-----------|-----------------|----------|
| 11 | `20250617000000_add_job_ingestion_models` | Job table | KEEP |
| 12 | `20260416000001_add_job_feed_item` | JobFeedItem table | KEEP |
| 13 | `20260417000001_add_skool_gate_and_friday_brief` | FridayBrief table, skoolJoined column | REVIEW |
| 14 | `20260424000001_seek_cache_and_sourceurl` | SeekJobCache table, sourceUrl column | KEEP |
| 15 | `20260614000003_add_job_skip` | `skipped`, `skippedAt` on JobFeedItem | KEEP |
| 16 | `20260614230300_add_skipped_job_model` | SkippedJob table | REVIEW (duplicate?) |

---

## APPLICATION TRACKING (5 migrations)

| # | Migration | What It Creates | Decision |
|---|-----------|-----------------|----------|
| 17 | `20260329025053_add_job_notes` | `notes` on JobApplication | KEEP |
| 18 | `20260329091002_add_job_priority` | `priority` enum (DREAM/TARGET/BACKUP) | KEEP |
| 19 | `20260329093806_add_closing_date` | `closingDate` on JobApplication | KEEP |
| 20 | `20260330105901_add_blueprint_cache` | `blueprintJson` JSONB on JobApplication | KEEP |
| 21 | `20260428000001_add_missing_analysis_and_profile_fields` | `australianFlags`, `dimensions`, `overallGrade`, etc. | KEEP |

---

## DOCUMENT GENERATION (3 migrations)

| # | Migration | What It Creates | Decision |
|---|-----------|-----------------|----------|
| 22 | `20260330103014_add_document_feedback` | DocumentFeedback table | REVIEW |
| 23 | `20260505000001_add_baseline_resume_type` | BASELINE_RESUME enum value | KEEP |
| 24 | `20260526000001_add_quality_signals` | `qualitySignals` JSONB on Document | KEEP |

---

## USER PROFILE / MARKETING (7 migrations)

| # | Migration | What It Creates | Decision |
|---|-----------|-----------------|----------|
| 25 | `20260326072517_add_marketing_consent` | `marketingConsent`, `marketingEmail` | KEEP |
| 26 | `20260409000001_add_visa_status` | `visaStatus` on CandidateProfile | **KEEP** |
| 27 | `20260410000000_add_headshot_fields` | `headshotUrl`, headshot generation tracking | REVIEW |
| 28 | `20260415000001_add_dashboard_access` | `dashboardAccess` boolean | REVIEW |
| 29 | `20260415000002_add_dashboard_access_requested` | `dashboardAccessRequested` boolean | REVIEW |
| 30 | `20260512000001_add_positioning_statement` | `positioningStatement` JSONB | KEEP |
| 31 | `20260614000001_add_target_roles` | `targetRoles` JSONB | KEEP |
| 32 | `20260614000002_add_years_of_experience` | `yearsOfExperience` integer | KEEP |

---

## MISC

| # | Migration | What It Creates | Decision |
|---|-----------|-----------------|----------|
| 33 | `20250617000001_add_daily_application_goal` | `dailyApplicationGoal` default 5 | KEEP |
| 34 | `20240527_enable_rls.sql` | Row Level Security policies | **KEEP** |

---

## THE PROBLEM

Your `CvScanLead` table is **missing the `fullName` column** because:

1. Migration `20250616000003_add_cv_scan_lead_model` created the table WITHOUT `fullName`
2. Your **code expects `fullName`** but it was never in the schema
3. Migration `20260620000001_reconcile_cv_scan_lead` was created today to add it

**But the migrations aren't syncing between environments properly.**

---

## RECOMMENDED CLEANUP PLAN

### Phase 1: Fix the Immediate Issue
1. ✅ Run `20260620000001_reconcile_cv_scan_lead` in Railway shell
2. Restart Railway service
3. Test CV scan

### Phase 2: Audit Unused Features (Do Later)
These could potentially be removed if not used:
- `FridayBrief` table (Skool community feature?)
- `SkippedJob` table (duplicate of `JobFeedItem.skipped`?)
- `DocumentFeedback` table
- Headshot generation fields
- Dashboard access flags (if not using gated dashboard)

### Phase 3: Consolidate (Long Term)
Consider squashing migrations into a clean baseline.

---

## CURRENT STATUS

| Environment | Migrations Applied | Schema Matches? |
|-------------|-------------------|-----------------|
| Local dev | 32 | Yes |
| Railway | 32 (claimed) | **NO - missing columns** |
| Supabase DB | Unknown | **NO - missing fullName** |

---

## NEXT STEPS

1. **Run the reconcile migration manually in Railway:**
   ```bash
   npx prisma migrate deploy
   ```

2. **If that fails, manually add the column:**
   ```bash
   npx prisma db execute --stdin <<< 'ALTER TABLE "CvScanLead" ADD COLUMN "fullName" TEXT;'
   ```

3. **Restart Railway service**

4. **Test CV scan**
