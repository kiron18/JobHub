import { useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const SEEN_KEY = 'jobhub_resources_update_nudge_seen';

/**
 * One-time toast pointing people at the reworked Resources section
 * (Classroom + Video cover letter, 2026-10). Non-blocking by design —
 * this is an FYI, not an onboarding gate, so a toast rather than a modal.
 * Self-managed via localStorage, same pattern as FirstApplicationCelebration.
 */
export function ResourcesUpdateNudge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    localStorage.setItem(SEEN_KEY, '1');
    toast('Check out the new and improved Resources section', {
      duration: 8000,
      action: {
        label: 'Take a look',
        onClick: () => navigate('/resources'),
      },
    });
  }, [navigate]);

  return null;
}
