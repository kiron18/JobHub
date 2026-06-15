import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from './api';

// ─────────────────────────────────────────────────────────────────────────────
// COPY — owned by the plan author. Do NOT reword, expand, or "improve" these.
// ─────────────────────────────────────────────────────────────────────────────
export const MARK_APPLIED_COPY = {
  cardButton: 'Mark as applied',
  createdToast: 'Added to your tracker as applied',
  promotedToast: 'Marked as applied',
  undoLabel: 'Undo',
  undoneToast: 'Reverted',
  errorToast: 'Could not update your tracker. Try again.',
} as const;

// Server response from POST /api/job-feed/:id/mark-applied
export interface MarkAppliedResult {
  jobApplicationId: string;
  created: boolean;          // true = we created a fresh row (likely an external apply)
  previousStatus: string | null; // the status before this call (null when created)
  alreadyApplied: boolean;   // true = it was already APPLIED; nothing changed
}

// Implemented in Task 5.
export async function markFeedItemApplied(
  _feedItemId: string,
  _queryClient: QueryClient,
): Promise<MarkAppliedResult | null> {
  throw new Error('not implemented — see Task 5');
}

void api;
void toast;
