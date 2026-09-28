/**
 * /dev/interview-prep-redesign — the two-card interview-prep redesign,
 * mocked up in its actual position, not just as two cards side by side.
 *
 * Card 1 (UniversalPlaybook) is static, identical for every candidate, and
 * lives ONCE at the top of the Interview Prep index — not repeated on every
 * job. Card 2 (JobPrepCard) is what a specific job's /interview/:jobId page
 * becomes: specialized only, no general content duplicated into it.
 *
 * Sample data only, not wired to the real generator or a real job list.
 * The app hides scroll on <body> globally and expects each full-page view to
 * own its own scroll container — this page does that itself instead of
 * relying on the document to scroll.
 *
 * Not linked from anywhere in the app's nav. Visit the URL directly.
 */
import { useState } from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { warm } from '../lib/theme/warmTokens';
import { UniversalPlaybook } from '../components/interview/UniversalPlaybook';
import { JobPrepCard } from '../components/interview/JobPrepCard';
import type { CheatSheet as Sheet } from '../components/interview/parseCheatSheet';

const C = warm.colors;

const SAMPLE_SHEET: Sheet = {
    oneRule: 'Every answer comes back to one thing: you have already done this work, just for a different employer.',
    opening: {
        say: "I'm a business analyst with three years across retail and financial services, most recently at Torrens Retail Group, where I rebuilt the weekly demand-forecasting process the merchandising team relied on. I moved to Sydney last year specifically to work in a market where that kind of analytical role sits closer to the business decisions it feeds, which is exactly what drew me to this role at Meridian.",
        why: 'Names the years, names a concrete result, and lands on why THIS role, in that order, in under 45 seconds.',
    },
    gap: {
        label: 'No local Australian client-facing experience',
        say: "My client-facing work has been with internal stakeholders rather than external clients so far, but the skill is the same one, translating what someone needs into an analysis they can act on, and I've done that weekly for three years.",
        why: "Names it before they have to ask, then moves straight back to evidence rather than apologising for it.",
    },
    inTheAd: [
        { left: 'about', right: 'Meridian is a 40-person analytics consultancy that spun out of a Big Four practice in 2019, working mostly with mid-market retailers and logistics firms on demand and inventory forecasting.' },
        { left: 'news', right: 'Their most recent LinkedIn post (three weeks ago) announced a new partnership with a supply-chain software vendor, which is likely why this role exists.' },
    ],
    proofPoints: [
        { left: 'Forecasting / demand modelling', right: "Rebuilt Torrens Retail's weekly demand forecast in Python, cutting the manual reconciliation step from two days to four hours." },
        { left: 'Stakeholder communication', right: 'Presented forecast variance to the merchandising leadership team fortnightly for two years, translating model output into buying decisions.' },
        { left: 'Client-facing analytics (their stated priority)', right: 'No direct external-client experience, but led the requirements-gathering for three internal "client" teams, same skill, different label.' },
    ],
    spares: [
        { left: 'Excel / SQL depth', right: 'Built and maintained the SQL views the whole merchandising team queried directly, not just consumed a report from.' },
    ],
    caution: "Don't lead with the tools (Python, SQL). Lead with the business result the tools produced.",
    showDontSay: [
        { left: "I'm a hard worker and a fast learner.", right: 'When I joined Torrens with no retail background, I was running the forecast independently within six weeks.' },
    ],
    questions: [
        { q: "Walk me through a time you had to change a stakeholder's mind with data.", say: "The merchandising director wanted to keep buying to last year's numbers. I built a side-by-side model showing the seasonal shift, walked her through it live, and she changed the order before the cutoff.", tactic: 'Name the disagreement plainly before you resolve it. It shows you can hold a position.', back: '' },
        { q: 'How do you handle a forecast that turns out to be wrong?', say: "I treat it as a model problem, not a blame problem. After one bad quarter I audited every input, found a seasonality assumption that no longer held post-COVID, and rebuilt it. The revised model is the one still in use.", tactic: 'Own the miss fast, then show the fix. Nobody is hiring for a perfect forecaster.', back: '' },
        { q: 'Why leave a role you were succeeding in?', say: "I wasn't leaving the work, I was leaving the ceiling. The role had gone as far as it could go without moving into a market with more of these positions, which is why I relocated.", tactic: '', back: '' },
        { q: 'What do you know about our clients?', say: "Mostly mid-market retail and logistics, similar scale to Torrens, which is exactly the segment I've been forecasting for.", tactic: '', back: 'What does a typical first project for someone in this role look like?' },
    ],
    cannotFumble: [
        { left: 'Work rights', right: 'Full working rights, no sponsorship required.' },
        { left: 'Notice period', right: 'Two weeks.' },
        { left: 'Salary expectation', right: '$85,000-$95,000 base, open to discuss.' },
    ],
    beforeCall: [
        'Re-read your three proof points once, out loud.',
        'Confirm the panel names and who is dialling in vs. who is in the room.',
    ],
    yourQuestions: [
        'What does success in this role look like at the six-month mark?',
        'What made the person who had this role before either succeed or move on?',
    ],
    close: "This sounds like exactly the kind of forecasting-to-decision work I moved to Sydney to do. What would be a good next step from here?",
    tone: [
        'Warm but not chatty, this is a technical role, precision reads as confidence here.',
        'Slow down on numbers. Rushing a figure makes it sound made up even when it is not.',
    ],
    onePara: "Open with the three-year forecasting arc and why Sydney. When they raise the client-facing gap, name it and redirect to the internal-stakeholder evidence. Lead every proof point with the business result, not the tool. Close by asking what success looks like at six months.",
};

const ROLE = 'Graduate Business Analyst';
const COMPANY = 'Meridian Consulting Group · Sydney';

function DevLabel({ children }: { children: React.ReactNode }) {
    return (
        <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.accentPetrol, margin: '0 0 10px' }}>
            {children}
        </p>
    );
}

function MockPanel({ children, width = 640 }: { children: React.ReactNode; width?: number }) {
    return (
        <div style={{ background: '#fff', border: `1px solid ${C.borderDefined}`, borderRadius: 16, padding: '24px 28px', maxWidth: width }}>
            {children}
        </div>
    );
}

export default function InterviewPrepRedesignPreview() {
    const [showPlaybook, setShowPlaybook] = useState(false);

    return (
        <div style={{ height: '100dvh', overflowY: 'auto', background: '#f4f4f4' }}>
            <div style={{ padding: '32px 20px 100px', maxWidth: 900, margin: '0 auto' }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: C.textPrimary }}>
                    Interview prep redesign — where each card lives
                </h1>
                <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 36, maxWidth: 640 }}>
                    Sample data only, not wired to the real generator or a real job list. The general playbook
                    lives once, at the index. A job's prep page is specialized only — nothing generic repeated into it.
                </p>

                {/* ── Mock 1: the Interview Prep index, as it would actually look ── */}
                <DevLabel>Mock — the Interview Prep index page</DevLabel>
                <MockPanel width={760}>
                    <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: C.textPrimary }}>Interview prep</h2>
                    <p style={{ margin: '0 0 20px', fontSize: 14, color: C.textSecondary }}>
                        Pick the job you are interviewing for. We write the prep against that exact ad.
                    </p>

                    <button
                        onClick={() => setShowPlaybook(s => !s)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                            padding: '14px 16px', marginBottom: 20, cursor: 'pointer', textAlign: 'left',
                            background: C.bgAlt, border: `1px solid ${C.borderWhisper}`, borderRadius: 12,
                        }}
                    >
                        <span>
                            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: C.textPrimary }}>
                                Before any interview
                            </span>
                            <span style={{ display: 'block', fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>
                                The same five things, every time. Read this once, not per job.
                            </span>
                        </span>
                        <ChevronRight size={16} style={{ color: C.textMuted, transform: showPlaybook ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
                    </button>

                    {showPlaybook && (
                        <div style={{ marginBottom: 24, padding: '20px 22px', border: `1px solid ${C.borderWhisper}`, borderRadius: 14 }}>
                            <UniversalPlaybook />
                        </div>
                    )}

                    <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.textMuted }}>
                        You are interviewing
                    </p>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
                        padding: '14px 16px', background: C.bgSurface, border: `1px solid ${C.borderWhisper}`, borderRadius: 12,
                    }}>
                        <div>
                            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: C.textPrimary }}>{ROLE}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.textMuted }}>{COMPANY}</p>
                        </div>
                        <span style={{
                            fontSize: 13, fontWeight: 700, color: '#fff', background: C.accentPetrol,
                            padding: '8px 14px', borderRadius: 10, flexShrink: 0,
                        }}>
                            Open prep ↓
                        </span>
                    </div>
                </MockPanel>

                {/* ── Mock 2: what "Open prep" actually leads to ── */}
                <div style={{ margin: '36px 0 14px', display: 'flex', alignItems: 'center', gap: 8, color: C.textMuted }}>
                    <ArrowLeft size={14} style={{ transform: 'rotate(-90deg)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>tapping "Open prep" above goes here</span>
                </div>
                <DevLabel>Mock — /interview/:jobId (specialized only, nothing general repeated)</DevLabel>
                <MockPanel>
                    <JobPrepCard sheet={SAMPLE_SHEET} company={COMPANY} role={ROLE} />
                </MockPanel>
            </div>
        </div>
    );
}
