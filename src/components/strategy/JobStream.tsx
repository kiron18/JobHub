import type { JobFeedItem } from '../jobs/JobCard';

interface JobStreamProps {
  onApply: (job: JobFeedItem) => void;
  applyingId?: string | null;
  appliedId?: string | null;
}

/**
 * Job feed removed — the app runs on pasted jobs only.
 *
 * This stub keeps the dashboard call site type-safe without rendering the
 * scraped Seek feed (which was 403-blocked at source and never returned jobs).
 * The full streaming feed — query, cards, applied-celebration — lives in git
 * history. To restore it, revert this file.
 */
export function JobStream(_props: JobStreamProps) {
  return null;
}
