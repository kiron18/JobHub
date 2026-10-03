/**
 * One way in.
 *
 * New people start at the home page: drop a resume, get it rebuilt, create the
 * account, start the free trial. Every other public route that let someone in
 * another way (a second resume upload, an account with no resume, a paid
 * trial) is closed here, decided by Kiron on 2026-10-03 so the funnel and its
 * numbers have a single shape.
 *
 * Closed means redirected to the home page, keeping the query string so a
 * utm-tagged old link still attributes. Nothing is deleted: reopening a route
 * is removing its line.
 *
 *   'everyone'    nobody reaches it
 *   'signed_out'  strangers are sent home; members still reach it. /pricing is
 *                 where a member pays (the app and Stripe's cancel URL send them
 *                 there) and /classroom is linked from the WhatsApp check-ins.
 *
 * Keyed by the route's first path segment, so '/free' covers every /free/:slug.
 */
export type ClosedFor = 'everyone' | 'signed_out';

export const CLOSED_ROUTES: Record<string, ClosedFor> = {
  // The group-session funnel (workshop finished): its own resume upload, gap
  // report and account claim.
  '/session': 'everyone',
  '/webinar': 'everyone',
  '/register': 'everyone',
  '/claim': 'everyone',
  // Signed in still opens: /admin/sales links each lead's report here.
  '/report': 'signed_out',
  // Email-gated downloads that fed the session signup.
  '/free': 'everyone',
  '/classroom': 'signed_out',
  // The Stripe card trial, a second route to a trial.
  '/pricing': 'signed_out',
  // Internal review and test pages.
  '/styleguide': 'signed_out',
  '/dev': 'signed_out',
  '/anim-test': 'signed_out',
};

/** Whether /auth offers "Sign up". Off: an account only comes from the home page, with a resume. */
export const AUTH_PAGE_SIGNUP = false;
