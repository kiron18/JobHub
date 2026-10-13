/**
 * Switches for surfaces that are built but not shown yet.
 *
 * WHATSAPP_VISIBLE: every WhatsApp opt-in in the app (the dashboard pill, the
 * tracker's coach card and the trial's day-pass opt-in). Hidden 2026-09-29, back on
 * 2026-09-30 for testing with a spare phone.
 *
 * The pill and the coach card additionally wait for the server: they only show
 * where COACH_CHECKINS_ENABLED is on and the member is on a paid plan (GET
 * /tracker/whatsapp returns `enabled` and `paid`), so production does not
 * promise daily check-ins it is not sending.
 */
export const WHATSAPP_VISIBLE = true;
