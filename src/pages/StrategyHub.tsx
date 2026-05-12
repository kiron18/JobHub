/**
 * Strategy Hub — the calm-ally dashboard.
 *
 * Single-purpose: anchor identity, surface the analysis primary action, give
 * a rotating qualitative insight, and orient the user against their pipeline.
 *
 * Phase 2: clicking Analyse calls /api/analyze/dual and renders an inline
 * Distance-to-Match result (Direct Match / Bridgeable Gap / Hard Gap +
 * insights) below the hero card. No navigation away.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAppTheme } from '../contexts/ThemeContext';
import { DimRegion, DimTarget, DimPeer } from '../components/Dim';
import { pickInsights } from '../data/strategicInsights';
import { AnalysisResult, type DualSignalResult } from '../components/strategy/AnalysisResult';

// ─── HubHeader ───────────────────────────────────────────────────────────────

interface ProfileLite {
    name?: string;
    targetRole?: string;
    targetCity?: string;
    seniority?: string;
}

function HubHeader({ profile }: { profile?: ProfileLite }) {
    const { T } = useAppTheme();
    const role = profile?.targetRole?.trim();
    const city = profile?.targetCity?.trim();
    const identityLine = [role, city].filter(Boolean).join(' · ');

    return (
        <header style={{ marginBottom: 40 }}>
            {identityLine && (
                <p
                    style={{
                        margin: '0 0 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: T.textMuted,
                    }}
                >
                    {identityLine}
                </p>
            )}
            <h1
                style={{
                    margin: '0 0 10px',
                    fontSize: 34,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: T.text,
                    lineHeight: 1.15,
                }}
            >
                Land Your Next Australian Role Faster
            </h1>
            <p
                style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 500,
                    color: T.accentSuccess,
                    letterSpacing: '-0.01em',
                }}
            >
                Paste any job description. Get a tailored resume and cover letter in 3 minutes.
            </p>
        </header>
    );
}

// ─── AnalysisHeroCard ───────────────────────────────────────────────────────

function AnalysisHeroCard() {
    const { T } = useAppTheme();
    const navigate = useNavigate();
    const [jd, setJd] = useState('');
    const [scToggle, setScToggle] = useState(false);
    const [scAutoFlipped, setScAutoFlipped] = useState(false);
    const [scUserOverride, setScUserOverride] = useState(false);
    const [analysing, setAnalysing] = useState(false);
    const [result, setResult] = useState<DualSignalResult | null>(null);

    const trimmed = jd.trim();
    const tooShort = trimmed.length > 0 && trimmed.length < 100;
    const canSubmit = trimmed.length >= 50 && !analysing;

    // When a new analysis arrives, auto-flip SC toggle on (unless the user
    // has manually overridden it). Surface a single dismissible notification.
    useEffect(() => {
        if (!result) return;
        if (result.scDetected && !scToggle && !scUserOverride) {
            setScToggle(true);
            setScAutoFlipped(true);
        }
    }, [result, scToggle, scUserOverride]);

    const handleScToggle = () => {
        setScUserOverride(true);
        setScAutoFlipped(false);
        setScToggle((v) => !v);
    };

    const handleAnalyse = async () => {
        if (!canSubmit) return;
        setAnalysing(true);
        setResult(null);
        try {
            const { data } = await api.post<DualSignalResult>('/analyze/dual', { jobDescription: trimmed });
            setResult(data);
        } catch (err: any) {
            const status = err?.response?.status;
            const message =
                status === 402 ? 'Analysis limit reached. Upgrade to keep analysing roles.'
                : status === 400 ? 'That job description looks too short. Paste the full posting.'
                : status === 404 ? 'Set up your profile first.'
                : status === 503 ? 'Analysis is temporarily unavailable. Please try again in 30 seconds.'
                : 'Analysis failed. Please retry.';
            toast.error(message);
        } finally {
            setAnalysing(false);
        }
    };

    const handleContinue = () => {
        // Pass the JD via navigate state — ApplicationWorkspace reads
        // location.state.jobDescription. Query params would land in an empty
        // workspace (no JD context) and feel like a page refresh.
        navigate('/application-workspace', {
            state: {
                jobDescription: trimmed,
                analysis: null,
                initialTab: 'resume',
            },
        });
    };

    const handleSkip = () => {
        setResult(null);
        setJd('');
        setScToggle(false);
        setScUserOverride(false);
        setScAutoFlipped(false);
    };

    return (
        <div
            style={{
                background: T.card,
                border: `1px solid ${T.cardBorder}`,
                borderRadius: 20,
                padding: 32,
                boxShadow: T.cardShadow,
            }}
        >
            <p
                style={{
                    margin: '0 0 16px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: T.textMuted,
                }}
            >
                Analyse a role
            </p>

            <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="Paste the job description here…"
                rows={6}
                style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    color: T.inputText,
                    background: T.inputBg,
                    border: `1px solid ${T.inputBorder}`,
                    borderRadius: 12,
                    outline: 'none',
                    resize: 'vertical',
                    transition: 'border-color 200ms',
                    boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = T.accentSecondary)}
                onBlur={(e) => (e.currentTarget.style.borderColor = T.inputBorder)}
            />

            {tooShort && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: T.textFaint, lineHeight: 1.5 }}>
                    Paste the full job description. The more text, the sharper the analysis.
                </p>
            )}

            <div
                style={{
                    marginTop: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                }}
            >
                <label
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 13,
                        color: T.textMuted,
                        cursor: 'pointer',
                        userSelect: 'none',
                    }}
                >
                    <span
                        role="switch"
                        aria-checked={scToggle}
                        onClick={handleScToggle}
                        onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                handleScToggle();
                            }
                        }}
                        tabIndex={0}
                        style={{
                            width: 34,
                            height: 20,
                            borderRadius: 999,
                            background: scToggle ? T.accentSecondary : 'rgba(255,255,255,0.08)',
                            position: 'relative',
                            transition: 'background 200ms',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }}
                    >
                        <span
                            style={{
                                position: 'absolute',
                                top: 2,
                                left: scToggle ? 16 : 2,
                                width: 16,
                                height: 16,
                                borderRadius: 999,
                                background: T.text,
                                transition: 'left 200ms',
                            }}
                        />
                    </span>
                    Generate selection criteria responses
                </label>

                <button
                    onClick={handleAnalyse}
                    disabled={!canSubmit}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '12px 22px',
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: '-0.01em',
                        color: T.btnText,
                        background: canSubmit ? T.btnBg : 'rgba(45,90,110,0.4)',
                        border: 'none',
                        borderRadius: 12,
                        cursor: canSubmit ? 'pointer' : analysing ? 'wait' : 'not-allowed',
                        opacity: canSubmit ? 1 : 0.6,
                        boxShadow: canSubmit ? T.btnShadow : 'none',
                        transition: 'opacity 200ms, background 200ms',
                    }}
                >
                    {analysing ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            Analysing…
                        </>
                    ) : (
                        <>
                            Analyse
                            <ChevronRight size={16} />
                        </>
                    )}
                </button>
            </div>

            {/* SC auto-flip notification */}
            {scAutoFlipped && (
                <div style={{
                    marginTop: 14,
                    padding: '10px 14px',
                    background: 'rgba(125,166,125,0.08)',
                    border: '1px solid rgba(125,166,125,0.25)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                }}>
                    <p style={{ margin: 0, fontSize: 12, color: T.text, lineHeight: 1.55 }}>
                        This role lists selection criteria. We'll generate responses as a separate document.
                    </p>
                    <button
                        onClick={() => setScAutoFlipped(false)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: T.textFaint,
                            fontSize: 14,
                            cursor: 'pointer',
                            padding: 0,
                            lineHeight: 1,
                        }}
                        aria-label="Dismiss notification"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Inline result */}
            {result && (
                <AnalysisResult
                    result={result}
                    onContinue={handleContinue}
                    onSkip={handleSkip}
                />
            )}
        </div>
    );
}

// ─── StrategicInsightsPanel ─────────────────────────────────────────────────

function StrategicInsightsPanel() {
    const { T } = useAppTheme();
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
                    color: T.textMuted,
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
                            background: T.card,
                            border: `1px solid ${T.cardBorder}`,
                            borderRadius: 12,
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: T.textMuted,
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
    const { T } = useAppTheme();
    if (!jobs?.length) {
        return (
            <NavLink
                to="/tracker"
                style={{ textDecoration: 'none' }}
            >
                <p style={{ margin: 0, fontSize: 13, color: T.textFaint }}>
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
                fontSize: 13,
                color: T.textMuted,
                textDecoration: 'none',
                transition: 'color 200ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = T.textMuted)}
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

    return (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <DimRegion>
                <HubHeader profile={profile} />
                <DimTarget style={{ marginBottom: 40 }}>
                    <AnalysisHeroCard />
                </DimTarget>
                <DimPeer style={{ marginBottom: 32 }}>
                    <StrategicInsightsPanel />
                </DimPeer>
                <DimPeer>
                    <PipelineGlance jobs={jobs ?? []} />
                </DimPeer>
            </DimRegion>
        </div>
    );
}
