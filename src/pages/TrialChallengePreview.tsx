/**
 * /dev/trial-preview — every trial-challenge screen, one after another, with
 * fixed sample data. Visual/copy review only: buttons here don't call the
 * real API, so clicking "Begin" can't disturb your actual trial-challenge
 * progress on a real test account. For testing that the state machine itself
 * actually works (buttons really advancing a real account), use the real
 * flow with TRIAL_CHALLENGE_TEST_MODE=on instead — this page is for reading
 * copy and checking layout instantly, not for that.
 *
 * Not linked from anywhere in the app's nav. Visit the URL directly.
 */
import { warm } from '../lib/theme/warmTokens';
import { TrialDayIntro } from '../components/trialChallenge/TrialDayIntro';
import { TrialDayPassScreen } from '../components/trialChallenge/TrialDayPassScreen';
import { TrialWindowBar } from '../components/trialChallenge/TrialWindowBar';
import { TrialDayEndScreen } from '../components/trialChallenge/TrialDayEndScreen';

const C = warm.colors;
const noop = () => {};

const FIVE_MIN_FROM_NOW = new Date(Date.now() + 5 * 60_000).toISOString();
const TWO_DAYS_FROM_NOW = new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString();
const MOCK_WHATSAPP_LINK = 'https://wa.me/61422769597?text=START%20AB3F9K';

interface FrameProps {
  title: string;
  children: React.ReactNode;
}

function Frame({ title, children }: FrameProps) {
  return (
    <div style={{ marginBottom: 48 }}>
      <p style={{
        margin: '0 0 10px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: C.accentPetrol, fontFamily: 'monospace',
      }}>
        {title}
      </p>
      <div style={{
        position: 'relative', height: 640, border: `2px dashed ${C.borderDefined}`,
        borderRadius: 12, overflow: 'hidden', background: '#fff',
        // The real screens use position:fixed (correct in the live app,
        // where they cover the whole page). Nested plainly, "fixed" ignores
        // this box entirely and pins to the browser viewport instead, so
        // every frame overlaps the same spot and only the last one shows.
        // Any transform on an ancestor makes it the containing block for a
        // fixed descendant instead of the viewport — this is that hack.
        transform: 'translateZ(0)',
      }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function TrialChallengePreview() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto', background: '#f4f4f4', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Trial challenge — every screen</h1>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 32 }}>
        Sample data only. Buttons here don't call the real API — see the file header for why.
      </p>

      <Frame title="Day 1 intro (not_started)">
        <TrialDayIntro windowMinutes={30} minimum={2} onBegin={noop} beginning={false} />
      </Frame>

      <Frame title="Day in progress — window bar (minimum not yet met)">
        <div style={{ position: 'relative', height: '100%', background: C.bgCanvas }}>
          <TrialWindowBar windowEndsAt={FIVE_MIN_FROM_NOW} appliedThisWindow={0} minimumRequired={2} linkedinUnlocked={false} />
          <p style={{ padding: '80px 24px 0', color: C.textMuted, fontSize: 13 }}>(rest of /apply renders underneath this bar)</p>
        </div>
      </Frame>

      <Frame title="Day in progress — minimum just crossed (LinkedIn unlock toast)">
        <div style={{ position: 'relative', height: '100%', background: C.bgCanvas }}>
          <TrialWindowBar windowEndsAt={FIVE_MIN_FROM_NOW} appliedThisWindow={2} minimumRequired={2} linkedinUnlocked={true} />
        </div>
      </Frame>

      <Frame title="Day 1 passed -> Day 2 available (with WhatsApp opt-in ask)">
        <TrialDayPassScreen passedDay={1} forfeitureDeadline={TWO_DAYS_FROM_NOW} onBegin={noop} beginning={false} whatsappOptInLink={MOCK_WHATSAPP_LINK} />
      </Frame>

      <Frame title="Day 2 passed -> Day 3 available (no WhatsApp ask — day 1 only)">
        <TrialDayPassScreen passedDay={2} forfeitureDeadline={TWO_DAYS_FROM_NOW} onBegin={noop} beginning={false} />
      </Frame>

      <Frame title="Day failed (minimum not met when window closed)">
        <TrialDayEndScreen variant="day_failed" currentDay={1} appliedThisWindow={0} minimumRequired={2} />
      </Frame>

      <Frame title="Forfeited (didn't come back before the deadline)">
        <TrialDayEndScreen variant="forfeited" currentDay={1} appliedThisWindow={0} minimumRequired={2} />
      </Frame>

      <Frame title="Completed (finished day 3 — the open hour, no target)">
        <TrialDayEndScreen variant="completed" currentDay={3} appliedThisWindow={1} minimumRequired={0} />
      </Frame>
    </div>
  );
}
