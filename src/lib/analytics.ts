import posthog from 'posthog-js';

// ── Initialisation ────────────────────────────────────────────────────────────

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';
  if (!key) return;

  posthog.init(key, {
    api_host: host,
    capture_pageview: true,        // auto-tracks every route change
    capture_pageleave: true,
    autocapture: false,            // we control events explicitly
    persistence: 'localStorage+cookie',
    // Don't track anonymous sessions — wait for identify()
    bootstrap: {},
    // Session replay: mask anything that can carry resume contents, answers or
    // credentials. `[data-ph-mask]` is the opt-in hook — see the resume paper
    // and question inputs in WelcomePage/StepperWorkspace, which carry it.
    // Password fields are masked by posthog-js itself regardless of this config.
    session_recording: {
      maskTextSelector: '[data-ph-mask]',
      maskInputOptions: { password: true },
    },
  });
}

// ── Acquisition source ────────────────────────────────────────────────────────
// One bucket per campaign so "Instagram vs LinkedIn" is a straight breakdown
// instead of everyone reconciling utm_source spellings by hand. utm_source
// wins when present; otherwise inferred from the referrer. Registered as a
// SESSION super-property (register, not register_once) so it rides on every
// event for this visit, and PostHog's own $initial_utm_source /
// $initial_referrer already carry the true first-touch onto the person once
// they identify — this is the human-readable label next to that raw data.
function resolveAcquisitionSource(): string {
  const params = new URLSearchParams(window.location.search);
  const utmSource = (params.get('utm_source') || '').toLowerCase();
  if (utmSource.includes('instagram') || utmSource === 'ig') return 'Instagram';
  if (utmSource.includes('linkedin')) return 'LinkedIn';
  if (utmSource.includes('google')) return 'Google';
  if (utmSource) return 'Other';

  const ref = (document.referrer || '').toLowerCase();
  if (ref.includes('instagram.com')) return 'Instagram';
  if (ref.includes('linkedin.com')) return 'LinkedIn';
  if (ref.includes('google.')) return 'Google';
  if (!ref) return 'Direct';
  return 'Other';
}

/** Call once at boot, after initAnalytics(). Safe to call with no PostHog key. */
export function registerAcquisitionSource() {
  posthog.register({
    acquisition_source: resolveAcquisitionSource(),
    landing_page: window.location.pathname,
  });
}

// ── Identity ──────────────────────────────────────────────────────────────────

export function identifyUser(userId: string, props: {
  email?: string | null;
  plan?: string;
  planStatus?: string;
  isAdmin?: boolean;
}) {
  posthog.identify(userId, {
    email: props.email ?? undefined,
    plan: props.plan ?? 'free',
    plan_status: props.planStatus ?? 'active',
    is_admin: props.isAdmin ?? false,
  });
}

export function resetAnalytics() {
  posthog.reset();
}

// ── Onboarding funnel ─────────────────────────────────────────────────────────

export function trackOnboardingStepViewed(step: number, stepName: string) {
  posthog.capture('onboarding_step_viewed', { step, step_name: stepName });
}

export function trackOnboardingStepCompleted(step: number, stepName: string) {
  posthog.capture('onboarding_step_completed', { step, step_name: stepName });
}

export function trackOnboardingSubmitted() {
  posthog.capture('onboarding_submitted');
}

export function trackDiagnosticReportViewed() {
  posthog.capture('diagnostic_report_viewed');
}

// ── Community (the free Skool group) ─────────────────────────────────────────
// Every route into the group goes through /community?src=…, so this one event
// answers a question nothing else in the funnel can: which moment actually
// produces a member. `src` is normalised to a small set so the breakdown stays
// readable; `src_raw` keeps whatever was on the URL for anything unexpected.

export function trackCommunityClick(src: string, srcRaw: string | null) {
  posthog.capture('community_link_clicked', { src, src_raw: srcRaw });
}

// ── Welcome funnel (the public scan at /welcome) ──────────────────────────────
// This is the acquisition flow: anonymous resume upload through to signup.
// It ran completely untracked until 2026-08-07, so the only thing we knew about
// it was the pageview count. One event per step, fired wherever the step is set.

/** Ordered so a PostHog funnel can be built straight off step_index. */
export const WELCOME_STEPS = [
  'upload', 'loading', 'brief', 'questions', 'roles',
  'building', 'resume', 'email', 'code', 'finishing',
] as const;

export type WelcomeStep = (typeof WELCOME_STEPS)[number];

export function trackWelcomeStep(step: WelcomeStep) {
  posthog.capture('welcome_step_viewed', {
    step,
    step_index: WELCOME_STEPS.indexOf(step),
  });
}

/** A step the user could not get past. `reason` should be short and stable. */
export function trackWelcomeFailed(step: WelcomeStep, reason: string) {
  posthog.capture('welcome_step_failed', { step, reason });
}

/** Terminal success: account created (or signed in) with a resume attached. */
export function trackWelcomeCompleted(wasNewUser: boolean) {
  posthog.capture('welcome_completed', { new_user: wasNewUser });
}

export function trackSection5CtaClicked() {
  posthog.capture('section_5_cta_clicked');
}

export function trackBaselineResumeDownloadedFromWizard() {
  posthog.capture('baseline_resume_downloaded_from_wizard');
}

// ── Core value moments ────────────────────────────────────────────────────────

export function trackMatchAnalysisRun() {
  posthog.capture('match_analysis_run');
}

export function trackDocumentGenerated(docType: string, regenerate = false) {
  posthog.capture('document_generated', { doc_type: docType, regenerate });
}

export function trackDocumentCopied(docType: string) {
  posthog.capture('document_copied', { doc_type: docType });
}

// ── Feature adoption ──────────────────────────────────────────────────────────

export function trackFeatureOpened(feature: string) {
  posthog.capture('feature_opened', { feature });
}

export function trackApplicationSaved() {
  posthog.capture('application_saved');
}

export function trackApplicationStatusChanged(fromStatus: string, toStatus: string) {
  posthog.capture('application_status_changed', { from_status: fromStatus, to_status: toStatus });
}

export function trackAchievementAdded() {
  posthog.capture('achievement_added');
}

export function trackJobSavedFromFeed() {
  posthog.capture('job_saved_from_feed');
}

// ── Conversion ────────────────────────────────────────────────────────────────

export function trackUpgradeModalOpened(trigger: string, paywallVariant?: string) {
  posthog.capture('upgrade_modal_opened', { trigger, paywall_variant: paywallVariant });
}

export function trackCheckoutStarted(plan: string, paywallVariant?: string) {
  posthog.capture('checkout_started', { plan, paywall_variant: paywallVariant });
}

export function trackFreeLimitHit(feature: string) {
  posthog.capture('free_limit_hit', { feature });
}

// ── Retention / cancellation ──────────────────────────────────────────────────

export function trackManageSubscriptionOpened() {
  posthog.capture('manage_subscription_opened');
}

export function trackCancellationReasonSelected(reason: string) {
  posthog.capture('cancellation_reason_selected', { reason });
}

export function trackCancellationPortalOpened() {
  posthog.capture('cancellation_portal_opened');
}

/** The pre-cancel letter's primary button: booking a call instead of leaving. */
export function trackCancellationReachOutClicked() {
  posthog.capture('cancellation_reach_out_clicked');
}

/** The pre-cancel letter's quiet exit: "I think I'll call it quits", moving
 * on to the reason picker rather than opening the portal directly. */
export function trackCancellationIntroDismissed() {
  posthog.capture('cancellation_intro_dismissed');
}

// ── Landing page funnel ───────────────────────────────────────────────────────

export function trackLandingViewed(variant: string) {
  posthog.capture('landing_viewed', { hero_variant: variant });
}

export function trackLandingSectionViewed(section: string, variant: string) {
  posthog.capture('landing_section_viewed', { section, hero_variant: variant });
}

export function trackLandingCtaClicked(position: 'hero' | 'spotlight' | 'final', variant: string) {
  posthog.capture('landing_cta_clicked', { position, hero_variant: variant });
}

export function trackLandingLogInClicked(variant: string) {
  posthog.capture('landing_login_clicked', { hero_variant: variant });
}

// ── Book-a-call funnel ────────────────────────────────────────────────────────

export function trackBookCallCtaClicked(position: 'hero' | 'mid' | 'final') {
  posthog.capture('book_call_cta_clicked', { position });
}

// ── Sponsor directory funnel ──────────────────────────────────────

export function trackSponsorDirectoryViewed() {
  posthog.capture('sponsor_directory_viewed');
}

export function trackSponsorSearchPerformed(q: string, filters: Record<string, string>, resultCount: number) {
  posthog.capture('sponsor_search_performed', { query: q, ...filters, result_count: resultCount });
}

export function trackSponsorEmailGateShown() {
  posthog.capture('sponsor_email_gate_shown');
}

export function trackSponsorEmailCaptured() {
  posthog.capture('sponsor_email_captured');
}

export function trackSponsorLinksUnlocked() {
  posthog.capture('sponsor_links_unlocked');
}

export function trackSponsorOutreachLockedClicked() {
  posthog.capture('sponsor_outreach_locked_clicked');
}

export function trackSponsorTrialCtaClicked() {
  posthog.capture('sponsor_trial_cta_clicked');
}

// ── Free resource pages (/free/:slug) ────────────────────────────────────────
// Each giveaway has its own URL, so these three events answer the only question
// that matters about them: which asset pulls traffic, which asset's traffic
// hands over an email, and which converts into a registration.
//
// The unlock is the one to watch. It is the step that turns an anonymous visit
// into a person on the sales board, so a slug with plenty of views and a poor
// unlock rate is a promise problem, not a traffic problem.

export function trackFreeResourceUnlocked(slug: string) {
  posthog.capture('free_resource_unlocked', { slug });
}

export function trackFreeResourceDownloaded(slug: string, fileLabel: string) {
  posthog.capture('free_resource_downloaded', { slug, file: fileLabel });
}

export function trackFreeResourceRegistered(slug: string, challenge: string) {
  posthog.capture('free_resource_registered', { slug, challenge });
}

// ── Question-level drop-off (the 8-10 welcome questions) ─────────────────────
// The step-level welcome_step_viewed funnel cannot say WHICH question loses
// people — everyone answering 0 of 6 and everyone answering 5 of 6 both just
// show up as "reached brief, never reached roles". These pair up so a funnel
// built on resume_question_started -> resume_question_completed, broken down
// by question_index, makes that visible. Abandonment is inferred from a
// started with no matching completed — no separate "abandoned" event, per spec.

export function trackResumeQuestionStarted(questionIndex: number, questionId: string, questionType: string) {
  posthog.capture('resume_question_started', {
    question_index: questionIndex,
    question_id: questionId,
    question_type: questionType,
  });
}

export function trackResumeQuestionCompleted(
  questionIndex: number,
  questionId: string,
  questionType: string,
  timeOnQuestionMs: number,
  whetherSuggestionWasUsed: boolean,
  skipped: boolean,
) {
  posthog.capture('resume_question_completed', {
    question_index: questionIndex,
    question_id: questionId,
    question_type: questionType,
    time_on_question_ms: timeOnQuestionMs,
    whether_suggestion_was_used: whetherSuggestionWasUsed,
    skipped,
  });
}

/**
 * The welcome flow's email step already fires welcome_step_viewed('email') on
 * arrival; this is the actual submit, which the brief calls out separately
 * (view vs. submit is exactly the gap that matters on a form step). Domain
 * only, never the full address — see the brief's explicit privacy note.
 */
export function trackEmailSubmitted(email: string) {
  const domain = email.split('@')[1]?.toLowerCase() || 'unknown';
  posthog.capture('email_submitted', { email_domain: domain });
}

// ── Job matching (/check) ─────────────────────────────────────────────────────
// FitCheckPage is the live "paste a job, see if you should apply" screen —
// MatchEngine.tsx/match_analysis_run is dead code (unrouted since StrategyHub
// replaced the old dashboard) and was left alone rather than reused here.

export function trackJobMatchStarted() {
  posthog.capture('job_match_started');
}

export function trackJobMatchCompleted(matchScore: number, band: string, outcome: string, targetRole?: string | null, targetLocation?: string | null) {
  posthog.capture('job_match_completed', {
    match_score: matchScore,
    band,
    outcome,
    target_role: targetRole ?? undefined,
    target_location: targetLocation ?? undefined,
  });
}

export function trackJobsDashboardViewed() {
  posthog.capture('jobs_dashboard_viewed');
}

// ── Apply flow ─────────────────────────────────────────────────────────────

export function trackApplyStarted(applicationType: 'workspace' | 'preview_gate', jobMatchScore?: number | null) {
  posthog.capture('apply_started', {
    application_type: applicationType,
    job_match_score: jobMatchScore ?? undefined,
  });
}

/**
 * Additive to trackUpgradeModalOpened, not a replacement — that event already
 * covers "an upgrade prompt appeared" across every surface that shows one.
 * This is the specific one from the brief: the paywall inside the apply
 * animation, with the properties the brief asks to break it down by.
 */
export function trackPaywallViewed(paywallPosition: string, triggerStage: string) {
  posthog.capture('paywall_viewed', { paywall_position: paywallPosition, trigger_stage: triggerStage });
}

// ── Technical failures (kept apart from behavioural abandonment) ─────────────
// welcome_step_failed already covers upload/build/finish in the welcome flow.
// These cover the surfaces that had no failure signal at all.

export function trackJobMatchFailed(errorType: string, errorCode: string | number | undefined, retryCount = 0) {
  posthog.capture('job_match_failed', { error_type: errorType, error_code: errorCode ?? undefined, stage: 'job_match', retry_count: retryCount });
}

export function trackApplicationFailed(stage: string, errorType: string, errorCode: string | number | undefined, retryCount = 0) {
  posthog.capture('application_failed', { stage, error_type: errorType, error_code: errorCode ?? undefined, retry_count: retryCount });
}
