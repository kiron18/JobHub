/**
 * /dev/engagement-dashboard — the real dashboard (StrategyHub) with the
 * engagement changes on it, and nothing else changed.
 *
 * What is REAL on this page, rendered by the actual production components:
 *   - DailyProgressBar  ("Today's applications X of 5")
 *   - WeekStrip         (the S M T W T F S squares)
 * Both read their own endpoints and fall back to 0 of 5 exactly as the
 * live dashboard does, so the numbers here are not invented.
 *
 * What is NEW, and the entire point of this page:
 *   1. one ritual line under the header
 *   2. the pulsing brain icon beside the header, opening the tree popup
 *   3. one popup after an application is filed — congratulation (from the
 *      existing applause.ts lines) plus a quick quiz, in the same popup,
 *      click anywhere to dismiss
 *
 * The paste card and follow-up card below are visual stand-ins for the
 * real AnalysisHeroCard / StaleApplicationsCard, present so the new pieces
 * are judged in their real surroundings. "Check eligibility" is wired to
 * fire the post-application popup so the moment can actually be felt.
 *
 * Not linked from anywhere in the app's nav. Visit the URL directly.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Clock } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { warm } from '../lib/theme/warmTokens';
import { DailyProgressBar } from '../components/jobs/DailyProgressBar';
import { WeekStrip } from '../components/jobs/WeekStrip';
import { PulsingBrainIcon } from '../components/engagement/PulsingBrainIcon';
import { BrainPopup } from '../components/engagement/BrainPopup';
import { TodaysRitual } from '../components/engagement/TodaysRitual';
import { PostApplicationPopup } from '../components/engagement/PostApplicationPopup';

const C = warm.colors;

const DAILY_GOAL = 5;

export default function EngagementDashboardPreview() {
  const [brainOpen, setBrainOpen] = useState(false);
  const [filedToday, setFiledToday] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);

  // Mock account behind the brain popup — stands in for /profile + /tracker.
  const streak = 4;

  const fileApplication = () => {
    setFiledToday(n => n + 1);
    setPopupOpen(true);
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <p style={{ margin: '0 0 20px', fontSize: 11, color: C.textMuted, textAlign: 'center' }}>
          Preview · the progress bar and week strip are the real components; the paste card below is a stand-in.
        </p>

        {/* Header: the real identity line, with the brain icon beside it. */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
            textTransform: 'uppercase', color: C.textSecondary,
          }}>
            Agricultural Coordinator · Brisbane, Queensland
          </p>
          <PulsingBrainIcon streak={streak} onClick={() => setBrainOpen(true)} />
        </header>

        {/* NEW: the one ritual line. */}
        <div style={{ marginBottom: 20 }}>
          <TodaysRitual
            line={`Apply to ${DAILY_GOAL} roles matching your profile`}
            detail="Paste a job ad below to start. About 12 minutes."
          />
        </div>

        {/* UNCHANGED: the real progress bar and week strip, where they already sit. */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 20, flexWrap: 'wrap', marginBottom: 32,
        }}>
          <div style={{ flex: '0 1 240px', minWidth: 180 }}>
            <DailyProgressBar />
          </div>
          <WeekStrip />
        </div>

        {/* Stand-in for AnalysisHeroCard — the real paste card. */}
        <div style={{
          background: C.bgSurface, border: `1px solid ${C.borderWhisper}`,
          borderRadius: 16, padding: '28px 32px', marginBottom: 32,
        }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: C.accentPetrol, fontSize: 13.5, fontWeight: 700,
          }}>
            <ChevronDown size={16} /> What exactly should I copy?
          </button>
          <div style={{
            height: 150, borderRadius: 10, border: `1px solid ${C.borderDefined}`,
            background: C.bgSurface, padding: '14px 16px', marginBottom: 20,
            fontSize: 14, color: C.textMuted,
          }}>
            Paste the job description here, or a Seek link...
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '12px 20px',
              borderRadius: 10, border: `1px solid ${C.borderDefined}`, background: C.bgSurface,
              fontSize: 14, fontWeight: 700, color: C.textPrimary,
            }}>
              Browse coordinator jobs <ExternalLink size={14} />
            </span>
            <button
              onClick={fileApplication}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '12px 20px',
                borderRadius: 10, border: 'none', cursor: 'pointer',
                background: C.accentPetrol, color: '#fff', fontSize: 14, fontWeight: 700,
              }}
            >
              Check eligibility <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Stand-in for the follow-up card. */}
        <div style={{ background: C.bgSurface, border: `1px solid ${C.borderWhisper}`, borderRadius: 16, padding: '20px 24px' }}>
          <p style={{ ...warm.text.micro, margin: '0 0 6px', color: C.accentPetrol, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} /> Follow up:
          </p>
          <p style={{ margin: 0, fontSize: 13.5, color: C.textSecondary }}>
            Jobs you applied to over a week ago. Click follow up to get a pre-written email.
          </p>
        </div>

        <p style={{ margin: '24px 0 0', fontSize: 11, color: C.textMuted, textAlign: 'center' }}>
          "Check eligibility" fires the post-application popup — press it a few times to see the
          line change as the count climbs toward {DAILY_GOAL}.
        </p>
      </div>

      <BrainPopup
        open={brainOpen}
        onClose={() => setBrainOpen(false)}
        seed={1337}
        programDay={58}
        interviews={3}
        absenceDays={0}
        stats={{ applications: 38, outreach: 21, daysActive: 24, streak }}
      />

      <PostApplicationPopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        count={filedToday}
        goal={DAILY_GOAL}
        streak={streak}
      />
    </DashboardLayout>
  );
}
