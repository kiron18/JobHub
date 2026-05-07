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

export function trackUpgradeModalOpened(trigger: string) {
  posthog.capture('upgrade_modal_opened', { trigger });
}

export function trackCheckoutStarted(plan: string) {
  posthog.capture('checkout_started', { plan });
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
