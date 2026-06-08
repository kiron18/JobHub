/**
 * Pure decision for "mark this job applied": given the existing tracker row for a
 * job (or null when none exists), decide what the mark-applied route must do.
 * No DB access here — keeps the branching logic unit-testable.
 */
export type ReconcileAction =
  | { kind: 'create' }                              // no row exists → create an APPLIED row
  | { kind: 'already_applied' }                     // row exists and is already APPLIED → no-op
  | { kind: 'promote'; previousStatus: string };    // row exists, not APPLIED → flip to APPLIED

export function reconcileApplication(
  existing: { status: string } | null,
): ReconcileAction {
  if (!existing) return { kind: 'create' };
  if (existing.status === 'APPLIED') return { kind: 'already_applied' };
  return { kind: 'promote', previousStatus: existing.status };
}
