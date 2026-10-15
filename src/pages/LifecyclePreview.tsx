import { LifecycleNoticeCard, type Notice, type NoticeKey } from '../components/lifecycle/LifecycleNotice';
import { warm } from '../lib/theme/warmTokens';

/** /dev/lifecycle-preview: every lifecycle login popup side by side, sample data, no login. */
const KEYS: NoticeKey[] = [
  'day3_commit', 'card_added', 'pre_first_charge', 'first_payment',
  'pre_second_charge', 'pre_third_charge', 'plan_completed',
];

const noop = () => {};

export default function LifecyclePreview() {
  return (
    <div style={{ minHeight: '100dvh', background: warm.colors.bgAlt, padding: 24, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
      {KEYS.map((key) => {
        const notice: Notice = {
          key, ackKey: key, amount: '$250', chargeDate: 'Friday 23 October 2026', daysSinceSignup: 3, includedMonths: 12,
        };
        return (
          <div key={key} style={{ width: 460, maxWidth: '100%' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: warm.colors.textMuted, margin: '0 0 6px' }}>{key}</div>
            <LifecycleNoticeCard notice={notice} onDismiss={noop} onStartTrial={noop} onPortal={noop} onNavigate={noop} />
          </div>
        );
      })}
    </div>
  );
}
