/**
 * Who sees admin-only surfaces in the UI.
 *
 * Mirrors EXEMPT_EMAILS in server/src/routes/stripe.ts. This list only decides
 * what is worth *drawing*: every one of those surfaces is gated server-side as
 * well, because a hidden link has never been access control.
 */
export const ADMIN_EMAILS = [
    'kamiproject2021@gmail.com',
    'kiron182@gmail.com',
    'kiron@aussiegradcareers.com.au',
    'kironorik@gmail.com',
];

export function isAdminEmail(email?: string | null): boolean {
    return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
