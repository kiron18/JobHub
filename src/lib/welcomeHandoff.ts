/**
 * "The welcome flow is still finishing. Do not mount the dashboard yet."
 *
 * The bug this exists for: signing up is what creates the Supabase session, so
 * the moment `supabase.auth.signUp` resolves, `user` flips non-null and the
 * route at `/` re-renders from WelcomePage to the authenticated tree. That
 * happens BEFORE `POST /welcome/finish` has written the profile, so
 * OnboardingGate mounts against a userId that genuinely has no profile row,
 * finds nothing to claim, and renders "Complete your profile" over the top of
 * somebody who is three seconds from having completed it. It disappears again
 * when the write lands, which is what made it read as a flash of a dead route.
 *
 * The gate cannot fix this on its own. Every guard it has is about not trusting
 * a stale or in-flight answer, and this is neither: at that instant the answer
 * really is "no profile". The fix has to be that the dashboard does not mount
 * during the handoff at all.
 *
 * Module state rather than context, because the two ends are on opposite sides
 * of a route swap and the whole point is that one of them is being unmounted.
 * useSyncExternalStore so the flag is read during render without an effect,
 * which would run a frame too late and show the flash it exists to prevent.
 */
import { useSyncExternalStore } from 'react';

let handingOff = false;
const listeners = new Set<() => void>();

function emit() {
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/**
 * Called before the credentials are submitted, not after.
 *
 * The window that has to be covered opens the instant Supabase returns a
 * session, and that is inside the same await that creates the account, so it is
 * already too late to raise the flag once it resolves.
 */
export function beginWelcomeHandoff(): void {
    if (handingOff) return;
    handingOff = true;
    emit();
}

/**
 * Called once the profile is written AND the cache holds it, immediately before
 * navigating. Ending it any earlier just reopens the window.
 */
export function endWelcomeHandoff(): void {
    if (!handingOff) return;
    handingOff = false;
    emit();
}

export function useWelcomeHandoff(): boolean {
    return useSyncExternalStore(subscribe, () => handingOff, () => false);
}
