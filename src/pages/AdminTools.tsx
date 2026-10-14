/**
 * Two tools that used to sit on the coach page and made it too much to read:
 * the quality-control sweep and the hand-kept leaderboard. Each is its own
 * page now, reached from the bottom of the rail.
 */
import { AdminShell } from '../components/admin/AdminShell';
import { QualityControlPanel } from '../components/coach/QualityControlPanel';
import { ManualLeaderboardPanel } from '../components/coach/ManualLeaderboardPanel';

export function AdminQualityTool() {
  return (
    <AdminShell title="Quality control" subtitle="Generated documents worth a second look before a client sends them.">
      <QualityControlPanel />
    </AdminShell>
  );
}

export function AdminLeaderboardTool() {
  return (
    <AdminShell title="Leaderboard" subtitle="The entries added by hand, alongside the real ones.">
      <ManualLeaderboardPanel />
    </AdminShell>
  );
}
