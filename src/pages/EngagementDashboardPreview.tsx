/**
 * /dev/engagement-dashboard — the dashboard as the reference draws it.
 *
 * Layout, left to right: the content column (heading with the brain icon
 * in it, the ritual line, then the real paste and follow-up cards), the
 * Day chip with the week as seven dots under it, and the vertical
 * "Today's Mission" rail.
 *
 * The horizontal "Today's applications X of 5" bar and the big S M T W T
 * F S squares that live on production are deliberately NOT here: this
 * layout carries the same two numbers in the Day chip's dots and in the
 * mission rail instead, which is the change being previewed.
 *
 * Everything is local state — "Check eligibility" files a mock
 * application, which raises the rail, advances today's dot, and fires the
 * one post-application popup. The paste and follow-up cards are visual
 * stand-ins for AnalysisHeroCard / StaleApplicationsCard so the new
 * pieces are judged in their real surroundings.
 *
 * Not linked from anywhere in the app's nav. Visit the URL directly.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Clock } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { warm } from '../lib/theme/warmTokens';
import { PulsingBrainIcon } from '../components/engagement/PulsingBrainIcon';
import { BrainPopup } from '../components/engagement/BrainPopup';
import { TodaysRitual } from '../components/engagement/TodaysRitual';
import { DayCounter, type DayState } from '../components/engagement/DayCounter';
import { MissionRail } from '../components/engagement/MissionRail';
import { PostApplicationPopup } from '../components/engagement/PostApplicationPopup';

const C = warm.colors;

const DAILY_GOAL = 5;
const PROGRAM_DAY = 18;
const STREAK = 4;

/** Today's dot: nothing, something, the goal, or past it. */
function todayState(done: number, goal: number): DayState {
  if (done <= 0) return 'none';
  if (done < goal) return 'partial';
  if (done === goal) return 'goal';
  return 'over';
}

export default function EngagementDashboardPreview() {
  const [brainOpen, setBrainOpen] = useState(false);
  const [filedToday, setFiledToday] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);

  const week: DayState[] = ['goal', 'over', 'partial', 'goal', todayState(filedToday, DAILY_GOAL), 'future', 'future'];

  const fileApplication = () => {
    setFiledToday(n => n + 1);
    setPopupOpen(true);
  };

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 28, flexWrap: 'wrap' }}>
        {/* ── The content column ─────────────────────────────────────── */}
        <div style={{ flex: '1 1 520px', maxWidth: 600, minWidth: 0 }}>
          <h1 style={{
            margin: '0 0 10px', fontSize: 26, fontWeight: 700, letterSpacing: '-0.018em',
            color: C.textPrimary, lineHeight: 1.2,
          }}>
            Challenge - {STREAK} day streak{' '}
            <PulsingBrainIcon streak={STREAK} onClick={() => setBrainOpen(true)} size={20} variant="inline" />
          </h1>
          <div style={{ height: 1, background: C.borderWhisper, marginBottom: 12 }} />

          <div style={{ marginBottom: 26 }}>
            <TodaysRitual
              line={`Apply to ${DAILY_GOAL} roles matching your profile`}
              detail="Pulled from your target-role list. Takes about 12 minutes."
              done={filedToday >= DAILY_GOAL}
            />
          </div>

          {/* Stand-in for AnalysisHeroCard — the real paste card. */}
          <div style={{
            background: C.bgSurface, border: `1px solid ${C.borderWhisper}`,
            borderRadius: 16, padding: '24px 28px', marginBottom: 26,
          }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: C.accentPetrol, fontSize: 13.5, fontWeight: 700,
            }}>
              <ChevronDown size={16} /> What exactly should I copy?
            </button>
            <div style={{
              height: 130, borderRadius: 10, border: `1px solid ${C.borderDefined}`,
              padding: '13px 15px', marginBottom: 18, fontSize: 14, color: C.textMuted,
            }}>
              Paste the job description here, or a Seek link...
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 18px',
                borderRadius: 10, border: `1px solid ${C.borderDefined}`,
                fontSize: 13.5, fontWeight: 700, color: C.textPrimary,
              }}>
                Browse coordinator jobs <ExternalLink size={14} />
              </span>
              <button
                onClick={fileApplication}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '11px 18px',
                  borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: C.accentPetrol, color: '#fff', fontSize: 13.5, fontWeight: 700,
                }}
              >
                Check eligibility <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Stand-in for the follow-up card. */}
          <div style={{ background: C.bgSurface, border: `1px solid ${C.borderWhisper}`, borderRadius: 16, padding: '18px 22px' }}>
            <p style={{ ...warm.text.micro, margin: '0 0 6px', color: C.accentPetrol, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} /> Follow up:
            </p>
            <p style={{ margin: 0, fontSize: 13.5, color: C.textSecondary }}>
              Jobs you applied to over a week ago. Click follow up to get a pre-written email.
            </p>
          </div>

          <p style={{ margin: '22px 0 0', fontSize: 11, color: C.textMuted }}>
            Preview · "Check eligibility" files a mock application: the rail rises, today's dot
            advances, and the one popup fires. Press it a few times to hear the line change as the
            count climbs past {DAILY_GOAL}.
          </p>
        </div>

        {/* ── The Day chip, with the week as dots ────────────────────── */}
        <div style={{ paddingTop: 6 }}>
          <DayCounter day={PROGRAM_DAY} of={90} week={week} />
        </div>

        {/* ── The mission rail ───────────────────────────────────────── */}
        <div style={{ paddingTop: 4 }}>
          <MissionRail done={filedToday} goal={DAILY_GOAL} />
        </div>
      </div>

      <BrainPopup
        open={brainOpen}
        onClose={() => setBrainOpen(false)}
        seed={1337}
        programDay={PROGRAM_DAY}
        interviews={3}
        absenceDays={0}
        stats={{ applications: 38, outreach: 21, daysActive: 24, streak: STREAK }}
      />

      <PostApplicationPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        count={filedToday}
        goal={DAILY_GOAL}
        streak={STREAK}
      />
    </DashboardLayout>
  );
}
