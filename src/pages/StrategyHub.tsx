/**
 * Strategy Hub — the calm-ally dashboard.
 *
 * Single-purpose: anchor identity, surface the analysis primary action, give
 * a rotating qualitative insight, and orient the user against their pipeline.
 *
 * Clicking Apply navigates directly to the StepperWorkspace where resume
 * and cover letter generation happens.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { DimRegion, DimTarget, DimPeer } from '../components/Dim';
import { pickInsights } from '../data/strategicInsights';
import { StrategicIntelligenceCard } from '../components/StrategicIntelligenceCard';
import { JobStream } from '../components/strategy/JobStream';
import { StaleApplicationsCard } from '../components/strategy/StaleApplicationsCard';
import { FirstApplicationCelebration } from '../components/FirstApplicationCelebration';
import { EligibilityIntroModal } from '../components/EligibilityIntroModal';
import type { JobFeedItem } from '../components/jobs/JobCard';
import { DailyProgressBar } from '../components/jobs/DailyProgressBar';
import { WeekStrip } from '../components/jobs/WeekStrip';
import { WeekGlance } from '../components/tracker/WeekGlance';
import { warm } from '../lib/theme/warmTokens';
import { jdMentionsSelectionCriteria } from '../lib/selectionCriteria';
import { extractJobFacts } from '../lib/extractJobFacts';
import { classifyPaste, isSubmittable, pasteHint } from '../lib/seekLink';
import { buildSeekSearchUrl } from '../lib/seekSearchUrl';
import { browseRoleLabel, ROLE_BUDGET } from '../lib/roleLabel';
import { useIsMobile } from '../hooks/useIsMobile';
import { HowToCopyJobAd } from '../components/strategy/HowToCopyJobAd';

/** Detect whether a job description mentions selection criteria. */
// Lives in its own module so the dashboard, the fit check and the stepper all
// read an ad the same way. Re-exported here for existing importers.
export { jdMentionsSelectionCriteria };

// Hidden on the dashboard per founder request (kept wired for easy restore).
const SHOW_DASHBOARD_INSIGHTS = false;

// Warm theme tokens — replaces T.* from ThemeContext. ThemeContext preserved per spec §7.4.
const warmT = {
  text: warm.colors.textPrimary,
  textMuted: warm.colors.textSecondary,
  textFaint: warm.colors.textMuted,
  card: warm.colors.bgSurface,
  cardBorder: warm.colors.borderWhisper,
  cardShadow: warm.shadow.soft,
  inputBg: warm.colors.bgSurface,
  inputBorder: warm.colors.borderDefined,
  inputText: warm.colors.textPrimary,
  accentSecondary: warm.colors.accentPetrol,
  accentSuccess: warm.colors.success,
  btnBg: warm.colors.accentPetrol,
  btnText: warm.colors.textOnDeep,
  btnShadow: '0 1px 2px rgba(26,24,20,0.06), 0 4px 14px rgba(45,90,110,0.18)',
};

// ─── HubHeader ───────────────────────────────────────────────────────────────

interface ProfileLite {
    name?: string;
    targetRole?: string;
    targetCity?: string;
    seniority?: string;
}

function HubHeader({ profile }: { profile?: ProfileLite }) {
    const role = profile?.targetRole?.trim();
    const city = profile?.targetCity?.trim();
    const identityLine = [role, city].filter(Boolean).join(' · ');

    return (
        <header style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {identityLine && (
                        <p
                            style={{
                                margin: '0 0 14px',
                                fontSize: 13,
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: warmT.textMuted,
                            }}
                        >
                            {identityLine}
                        </p>
                    )}
                </div>
            </div>
        </header>
    );
}

// ─── Application goal ──────────────────────────────────────────────────────
//
// There is no user-set goal here any more. A browser-only GoalChip used to sit
// beside DailyProgressBar letting anyone pick their own target, which meant it
// could read "2" while the bar next to it read "5", and it bypassed the program
// floor in server/src/services/tracker/goals.ts entirely. The program sets the
// number; DailyProgressBar reports it from /tracker/goal. One goal, one source.

// ─── AnalysisHeroCard ───────────────────────────────────────────────────────

function AnalysisHeroCard() {
    const navigate = useNavigate();
    const location = useLocation();
    const appliedFeedItemId = (location.state as { appliedFeedItemId?: string } | null)?.appliedFeedItemId ?? null;
    useEffect(() => {
        if (appliedFeedItemId) {
            // clear so a refresh/re-render does not replay the beat
            window.history.replaceState({}, '');
        }
    }, [appliedFeedItemId]);

    const [jd, setJd] = useState('');
    const [analysing, setAnalysing] = useState(false);
    const isMobile = useIsMobile();
    const [pickedFeedItem, setPickedFeedItem] = useState<JobFeedItem | null>(null);
    const [applyingId, setApplyingId] = useState<string | null>(null);
    const [capMessage, setCapMessage] = useState(false);

    const handleStreamApply = async (job: import('../components/jobs/JobCard').JobFeedItem) => {
        if (applyingId) return;
        setApplyingId(job.id);
        // start-apply hydrates the full posting server-side and returns it. Prefer
        // that over the card teaser so the generator's JD panel gets the full text.
        let jobDescription = job.description ?? '';
        try {
            const resp = await api.post(`/job-feed/${job.id}/start-apply`);
            const hydrated = resp?.data?.description;
            if (typeof hydrated === 'string' && hydrated.length > jobDescription.length) {
                jobDescription = hydrated;
            }
        } catch (err: any) {
            setApplyingId(null);
            if (err?.response?.status === 429) { setCapMessage(true); return; }
            toast.error('Could not start that application. Please try again.');
            return;
        }
        // One door. Every application starts with the fit check, feed jobs
        // included, so nobody spends an hour on a job they cannot win.
        navigate('/check', {
            state: {
                jobDescription,
                company: job.company,
                role: job.title,
                location: job.location,
                sourceUrl: job.sourceUrl,
                feedItemId: job.id,
                sourcePlatform: job.sourcePlatform,
            },
        });
    };

    // Preload the freshly-scraped job (stashed by the get-started flow) into the
    // paste box so the user can apply immediately on their first visit.
    const prefilledRef = useRef(false);
    useEffect(() => {
        if (prefilledRef.current || jd.trim().length > 0) return;
        try {
            const raw = localStorage.getItem('jobhub_preload_jd');
            if (!raw) return;
            const job = JSON.parse(raw);
            if (job?.description) {
                prefilledRef.current = true;
                setJd(job.description);
                setPickedFeedItem({
                    id: '', title: job.title, company: job.company, location: job.location,
                    sourceUrl: job.sourceUrl, sourcePlatform: job.sourcePlatform,
                } as JobFeedItem);
            }
            localStorage.removeItem('jobhub_preload_jd');
        } catch { /* ignore malformed cache */ }
    }, [jd]);

    // Where "Browse jobs" points. Their own target role and city if we have
    // them, a bare Seek search if we do not.
    const { data: profileLite } = useQuery<{ targetRole?: string; targetCity?: string }>({
        queryKey: ['profile'],
        queryFn: async () => (await api.get('/profile')).data,
        staleTime: 30_000,
    });
    const seekUrl = buildSeekSearchUrl(profileLite?.targetRole, profileLite?.targetCity);
    // Case, rung and length are all handled in one place now. See lib/roleLabel.
    // The button budget, not the row one: this sits beside a second button and
    // has to hold one line down to 320px.
    const roleLabel = browseRoleLabel(profileLite?.targetRole, ROLE_BUDGET.button);

    const trimmed = jd.trim();
    // A Seek link is ~35 characters, well under the old 50-character floor, so
    // the floor itself is what kept links out of this box. Both shapes are now
    // judged by what they are rather than how long they are.
    const pasted = classifyPaste(trimmed);
    const isLink = pasted.kind === 'seek-url';
    const hint = pasteHint(trimmed);
    const canSubmit = isSubmittable(trimmed) && !analysing;

    /**
     * The role title and employer for this application.
     *
     * The feed already knows both for certain, so it never asks. A pasted ad
     * goes to the model, which reads it the way a person does. These two strings
     * name the tracker row, get stamped on exported filenames, and are written
     * into the follow-up and outreach emails that reach the employer, so they
     * are worth one short call to get right.
     *
     * The local extractor stays as the fallback. If the call fails or is slow to
     * the point of being useless, the application still starts: never block
     * someone from applying over a subject line.
     */
    const resolveJobFacts = async (jd: string): Promise<{ company?: string; role?: string; agency?: string }> => {
        if (pickedFeedItem) return { company: pickedFeedItem.company, role: pickedFeedItem.title };

        const local = extractJobFacts(jd);
        try {
            const { data } = await api.post('/analyze/job-facts', { jobDescription: jd });
            return {
                role: data?.title ?? local.role,
                company: data?.company ?? local.company,
                // Named when the ad hides the employer behind a recruiter. That
                // recruiter is the person to follow up with, so it is kept.
                agency: data?.agency ?? undefined,
            };
        } catch {
            return local;
        }
    };

    /**
     * The failsafe.
     *
     * When neither an employer nor an agency can be found, the paste almost
     * always started below the header, where Seek prints the advertiser. Saying
     * nothing is what produced 341 tracker rows with no employer and follow-up
     * emails addressed to nobody.
     *
     * It asks, it never blocks: "Skip" is always right there. Nothing is worth
     * standing between someone and an application.
     */
    const [missingEmployer, setMissingEmployer] = useState<null | {
        role?: string;
        typed: string;
    }>(null);

    const goToApply = (opts: { company?: string; role?: string; agency?: string }) => {
        navigate('/check', {
            state: {
                jobDescription: trimmed,
                sc: jdMentionsSelectionCriteria(trimmed),
                company: opts.company,
                role: opts.role,
                agency: opts.agency,
            },
        });
    };

    const handleAnalyse = async () => {
        if (!canSubmit) return;
        setAnalysing(true);

        // A link is resolved server-side first, because that is the only path
        // that sees the advertiser name: Seek prints it in the page header,
        // outside the block anyone copies. Everything after this point is the
        // same for a link and a paste.
        if (pasted.kind === 'seek-url') {
            try {
                const { data } = await api.post('/extract/from-url', { url: pasted.url });
                const job = data?.job;
                if (!job?.description) throw new Error('no job');
                navigate('/check', {
                    state: {
                        jobDescription: job.description,
                        sc: jdMentionsSelectionCriteria(job.description),
                        company: job.company ?? undefined,
                        role: job.title ?? undefined,
                        location: job.location ?? undefined,
                        sourceUrl: job.sourceUrl,
                        sourcePlatform: 'seek',
                    },
                });
            } catch (err: any) {
                // 422 means the link was understood and is not usable. That
                // message is written for the candidate, so show it as-is.
                const msg = err?.response?.status === 422
                    ? err.response.data?.error
                    : 'Could not read that link. Try again, or paste the job description instead.';
                toast.error(msg);
            } finally {
                setAnalysing(false);
            }
            return;
        }

        const { company, role, agency } = await resolveJobFacts(trimmed);

        // Neither an employer nor an agency: ask before this becomes another
        // untraceable row. The ad is kept exactly as pasted either way.
        if (!company && !agency) {
            setMissingEmployer({ role, typed: '' });
            setAnalysing(false);
            return;
        }

        try {
            // Into the check, not straight into generation. The report is where
            // the decision gets made, and where the resume button now lives.
            navigate('/check', {
                state: {
                    jobDescription: trimmed,
                    sc: jdMentionsSelectionCriteria(trimmed),
                    company,
                    role,
                    agency,
                    feedItemId: pickedFeedItem?.id,
                    sourceUrl: pickedFeedItem?.sourceUrl,
                    sourcePlatform: pickedFeedItem?.sourcePlatform,
                },
            });
        } catch (err: any) {
            toast.error('Could not start application. Please try again.');
        } finally {
            setAnalysing(false);
        }
    };

    return (
        <div
            style={{
                background: warmT.card,
                border: `1px solid ${warmT.cardBorder}`,
                borderRadius: 20,
                padding: 32,
                boxShadow: warmT.cardShadow,
            }}
        >
            {capMessage && (
                <div style={{
                    border: `1px solid ${warm.colors.borderDefined}`, borderRadius: 12,
                    background: warm.colors.bgAlt, padding: '14px 16px', marginBottom: 14,
                }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary }}>
                        That is 25 applications today. Serious effort.
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: warm.colors.textSecondary }}>
                        Come back tomorrow for a fresh batch. Your trial keeps running, and the more you apply, the sooner the callbacks start.
                    </p>
                </div>
            )}

            <JobStream onApply={handleStreamApply} applyingId={applyingId} appliedId={appliedFeedItemId} />

            {/* The lesson goes ABOVE the box, because it is only useful before
                the paste. Underneath it was an explanation of a mistake someone
                had already made. Only worth showing to someone typing a
                description — a link already carries the employer. */}
            <div style={{ marginBottom: 14 }}>
                {!isLink && <HowToCopyJobAd />}
            </div>

            {pickedFeedItem && (
                <div style={{
                    marginBottom: 10,
                    padding: '8px 12px',
                    background: 'rgba(125,166,125,0.08)',
                    border: '1px solid rgba(125,166,125,0.25)',
                    borderRadius: 10,
                    fontSize: 12,
                    color: warmT.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                }}>
                    <span>
                        <strong>{pickedFeedItem.title}</strong> · {pickedFeedItem.company}
                    </span>
                    <button
                        onClick={() => { setPickedFeedItem(null); setJd(''); }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: warmT.textMuted,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0,
                        }}
                    >
                        Clear
                    </button>
                </div>
            )}

            <textarea
                data-process-step="paste"
                value={jd}
                onChange={(e) => {
                    const next = e.target.value;
                    if (jd.length === 0 && next.length > 0) {
                        window.dispatchEvent(new CustomEvent('process:pasted'));
                    }
                    setJd(next);
                }}
                placeholder="Paste the job description here, or a Seek link…"
                rows={6}
                style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    color: warmT.inputText,
                    background: warmT.inputBg,
                    border: `1px solid ${warmT.inputBorder}`,
                    borderRadius: 12,
                    outline: 'none',
                    resize: 'vertical',
                    transition: 'border-color 200ms',
                    boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = warmT.accentSecondary)}
                onBlur={(e) => (e.currentTarget.style.borderColor = warmT.inputBorder)}
            />

            {hint && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: warmT.textFaint, lineHeight: 1.5 }}>
                    {hint}
                </p>
            )}

            {isLink && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: warmT.textFaint, lineHeight: 1.5 }}>
                    We will open that ad and read the employer, title and full description off the page.
                </p>
            )}

            {missingEmployer && (
                <div
                    style={{
                        marginTop: 14, padding: '14px 16px', borderRadius: 12,
                        background: warm.colors.bgAlt,
                        border: `1px solid ${warm.colors.accentGold}`,
                    }}
                >
                    <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: warmT.text }}>
                        Who is the employer?
                    </p>
                    <p style={{ margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.55, color: warmT.textMuted }}>
                        We could not find a company name in that ad. It is usually because the copy started below
                        the heading. Type it in, or re-copy starting at the job title.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                            autoFocus
                            value={missingEmployer.typed}
                            onChange={(e) => setMissingEmployer({ ...missingEmployer, typed: e.target.value })}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && missingEmployer.typed.trim()) {
                                    goToApply({ company: missingEmployer.typed.trim(), role: missingEmployer.role });
                                }
                            }}
                            placeholder="Company name"
                            style={{
                                flex: '1 1 200px', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit',
                                color: warmT.inputText, background: warmT.inputBg,
                                border: `1px solid ${warmT.inputBorder}`, borderRadius: 9, outline: 'none',
                            }}
                        />
                        <button
                            onClick={() => goToApply({
                                company: missingEmployer.typed.trim() || undefined,
                                role: missingEmployer.role,
                            })}
                            disabled={!missingEmployer.typed.trim()}
                            style={{
                                padding: '9px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                                color: warmT.btnText, background: warmT.btnBg, border: 'none', borderRadius: 9,
                                cursor: missingEmployer.typed.trim() ? 'pointer' : 'not-allowed',
                                opacity: missingEmployer.typed.trim() ? 1 : 0.5,
                            }}
                        >
                            Continue
                        </button>
                        <button
                            onClick={() => goToApply({ role: missingEmployer.role })}
                            style={{
                                padding: '9px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                                color: warmT.textMuted, background: 'none',
                                border: `1px solid ${warmT.inputBorder}`, borderRadius: 9, cursor: 'pointer',
                            }}
                        >
                            Skip
                        </button>
                    </div>
                </div>
            )}

            {/* Two ways forward: go find an ad, or check the one already in
                the box. The check is not "apply" — applying is what happens
                after it comes back good — so the label names what the button
                actually does.

                Side by side on a desktop. Stacked and full width on a phone,
                because two buttons wrapping into a ragged pair is what the
                pair looked like at 390px, and the browse label is a variable
                length string so the wrap point moved per account. */}
            <div
                style={{
                    marginTop: 20,
                    display: 'flex',
                    flexDirection: isMobile ? 'column-reverse' : 'row',
                    alignItems: 'stretch',
                    justifyContent: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
                <a
                    href={seekUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '12px 22px',
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                        color: warmT.text,
                        background: warm.colors.bgSurface,
                        border: `1px solid ${warm.colors.borderDefined}`,
                        borderRadius: 12,
                        textDecoration: 'none',
                        /* A resting ring rather than a flat outline. Somebody
                           with an empty box has nothing to check yet, so this
                           is the button they need, and next to a solid petrol
                           primary a bare outline reads as the disabled one. */
                        boxShadow: `0 0 0 3px ${warm.colors.accentPetrol}14`,
                        /* Two lines is an ugly button. Off the side of the card
                           is a broken one, which is what white-space:nowrap
                           turned a slightly-too-long label into. The budget in
                           ROLE_BUDGET.button is what normally keeps this to one
                           line; wrapping is the floor under it when something
                           gets through, and minWidth lets the flex item shrink
                           to its container instead of pushing past it. */
                        minWidth: 0,
                        textAlign: 'center',
                        transition: 'border-color 200ms, background 200ms, box-shadow 200ms',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = warm.colors.accentPetrol;
                        e.currentTarget.style.background = warm.colors.bgAlt;
                        e.currentTarget.style.boxShadow = `0 0 0 4px ${warm.colors.accentPetrol}22`;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = warm.colors.borderDefined;
                        e.currentTarget.style.background = warm.colors.bgSurface;
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${warm.colors.accentPetrol}14`;
                    }}
                >
                    Browse {roleLabel} jobs
                    <ExternalLink size={14} style={{ color: warmT.textFaint, flexShrink: 0 }} />
                </a>

                <button
                    data-process-step="analyse"
                    onClick={handleAnalyse}
                    disabled={!canSubmit}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 0,
                        gap: 6,
                        padding: '12px 22px',
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        color: warmT.btnText,
                        background: canSubmit ? warmT.btnBg : `${warm.colors.accentPetrol}80`,
                        border: 'none',
                        borderRadius: 12,
                        cursor: canSubmit ? 'pointer' : analysing ? 'wait' : 'not-allowed',
                        opacity: canSubmit ? 1 : 0.6,
                        boxShadow: canSubmit ? warmT.btnShadow : 'none',
                        transition: 'opacity 200ms, background 200ms',
                    }}
                >
                    {analysing ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Reading the ad…
                        </>
                    ) : (
                        <>
                            Check eligibility
                            <ChevronRight size={16} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

// ─── StrategicInsightsPanel ─────────────────────────────────────────────────

function StrategicInsightsPanel() {
    const insights = useMemo(() => pickInsights(3), []);

    if (!insights.length) return null;

    return (
        <section>
            <p
                style={{
                    margin: '0 0 16px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: warmT.textMuted,
                }}
            >
                Insights for Australian job hunts
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {insights.map((insight) => (
                    <div
                        key={insight.id}
                        style={{
                            padding: '14px 18px',
                            background: warmT.card,
                            border: `1px solid ${warmT.cardBorder}`,
                            borderRadius: 12,
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: warmT.textMuted,
                        }}
                    >
                        {insight.text}
                    </div>
                ))}
            </div>
        </section>
    );
}

// ─── PipelineGlance ─────────────────────────────────────────────────────────

interface JobLite {
    status: string;
}

function PipelineGlance({ jobs }: { jobs: JobLite[] }) {
    if (!jobs?.length) {
        return (
            <NavLink
                to="/tracker"
                style={{ textDecoration: 'none' }}
            >
                <p style={{ margin: 0, fontSize: 13, color: warmT.textFaint }}>
                    No applications yet. Analyse a role to begin.
                </p>
            </NavLink>
        );
    }

    const counts = {
        saved: jobs.filter((j) => j.status === 'SAVED').length,
        applied: jobs.filter((j) => j.status === 'APPLIED').length,
        interview: jobs.filter((j) => j.status === 'INTERVIEW').length,
        offer: jobs.filter((j) => j.status === 'OFFER').length,
        rejected: jobs.filter((j) => j.status === 'REJECTED').length,
    };

    const parts = [
        `${counts.saved} Saved`,
        `${counts.applied} Applied`,
        `${counts.interview} Interview`,
        `${counts.offer} Offer`,
        ...(counts.rejected > 0 ? [`${counts.rejected} Rejected`] : []),
    ];

    return (
        <NavLink
            to="/tracker"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                /* The whole pipeline summary is one link to the tracker, and at
                   21px tall it was a line of text you were expected to tap.
                   Padding gives it a row to be tapped in; the negative margin
                   keeps it sitting where it did. */
                padding: '9px 0',
                margin: 0,
                minHeight: 40,
                fontSize: 13,
                color: warmT.textMuted,
                textDecoration: 'none',
                transition: 'color 200ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = warmT.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = warmT.textMuted)}
        >
            {parts.join(' · ')} →
        </NavLink>
    );
}

// ─── StrategyHub ────────────────────────────────────────────────────────────

export function StrategyHub() {
    const { data: profile } = useQuery<ProfileLite>({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data } = await api.get('/profile');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const { data: jobs } = useQuery<JobLite[]>({
        queryKey: ['jobs'],
        queryFn: async () => {
            const { data } = await api.get('/jobs');
            return data;
        },
        staleTime: 5 * 60 * 1000,
    });

    // Suggested jobs are OFF on the dashboard (removed 2026-07-29, per repeated
    // request). The app runs on pasted jobs only. Deliberately no /job-feed/feed
    // query here: fetching it is what resurrected the suggestion card, because
    // the endpoint served stale ingested rows and re-triggered a scrape. Do not
    // reintroduce this query or the FocusedApplyView / FeedStateNotice renders.

    return (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* Fires once when sent-count crosses 0 -> >=1. Self-managed via localStorage. */}
            <FirstApplicationCelebration />
            {/* Fires once per account, off the profile's eligibilityIntroSeenAt
                column. Self-managed: it reads the same ['profile'] query. */}
            <EligibilityIntroModal />
            <DimRegion>
                <HubHeader profile={profile} />

                {/*
                    One centred status line: how today is going, the goal, and
                    the week behind it. The bar used to run the full width of the
                    column, which made a five-application target look like a
                    progress meter on a file download. Short and centred, with
                    the week beside it, it reads as a scoreboard instead.
                */}
                <DimPeer style={{ marginBottom: 32 }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 20, flexWrap: 'wrap',
                    }}>
                        <div style={{ flex: '0 1 240px', minWidth: 180 }}>
                            <DailyProgressBar />
                        </div>
                        {/* The count, next to the squares. WeekStrip says which
                            days you worked; this says how much, against target. */}
                        <WeekGlance />
                        <WeekStrip />
                    </div>
                </DimPeer>

                {/* Paste/Apply section — the only way a job enters the flow */}
                <DimTarget style={{ marginBottom: 40 }}>
                    <AnalysisHeroCard />
                </DimTarget>

                {/* CoherenceCard (story health) removed per user request 2026-06-08 */}
                {SHOW_DASHBOARD_INSIGHTS && (
                    <DimPeer style={{ marginBottom: 32 }}>
                        <StrategicInsightsPanel />
                    </DimPeer>
                )}
                <DimPeer style={{ marginBottom: 32 }}>
                    <StaleApplicationsCard />
                </DimPeer>
                {SHOW_DASHBOARD_INSIGHTS && (
                    <DimPeer style={{ marginBottom: 32 }}>
                        <StrategicIntelligenceCard />
                    </DimPeer>
                )}
                <DimPeer>
                    <PipelineGlance jobs={jobs ?? []} />
                </DimPeer>
            </DimRegion>
        </div>
    );
}
