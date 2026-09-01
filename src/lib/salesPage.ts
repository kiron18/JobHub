/**
 * The one sales page the funnel points at.
 *
 * Several places now offer a way to read about the product rather than buy it
 * on the spot: the welcome flow's "see how", and the paywall's "let me see how
 * this works". They must all land in the same place, and when that place moves
 * it has to move once.
 *
 * NOT BUILT YET. `/how-it-works` does not exist as a route, so today this falls
 * back to `/pricing`, which is real and says what the product costs. Point
 * SALES_PAGE_URL at the new page the day it ships and every link in the funnel
 * follows, with nothing else to change.
 *
 * Always open it in a new tab from inside a paywall or an onboarding step. A
 * 404 or a detour must never take somebody out of a flow they cannot get back
 * into, which is the same reason the welcome flow already opens its explainer
 * that way.
 */
export const SALES_PAGE_URL = '/pricing';

/** Where the sales page will live once it is written. */
export const SALES_PAGE_PLANNED_URL = '/how-it-works';
