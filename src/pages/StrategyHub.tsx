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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Loader2, Target, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { useAppTheme } from '../contexts/ThemeContext';
import { DimRegion, DimTarget, DimPeer } from '../components/Dim';
import { pickInsights } from '../data/strategicInsights';
import { AnalysisResult, type DualSignalResult } from '../components/strategy/AnalysisResult';
import { CoherenceCard, type CoherenceSignal } from '../components/strategy/CoherenceCard';

// ─── HubHeader ───────────────────────────────────────────────────────────────

interface ProfileLite {
    name?: string;
    targetRole?: string;
    targetCity?: string;
    seniority?: string;
    coherence?: CoherenceSignal[];
}

function HubHeader({ profile, jobs }: { profile?: ProfileLite; jobs: JobLite[] }) {
    const { T } = useAppTheme();
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
                                color: T.textMuted,
                            }}
                        >
                            {identityLine}
                        </p>
                    )}
                </div>
                <GoalChip jobs={jobs} />
            </div>
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

// ─── GoalChip ───────────────────────────────────────────────────────────────
//
// Appears only after the user has submitted at least one application. First
// time it appears, a celebratory tooltip nudges them to set a goal. Counts
// are derived from /jobs against a rolling daily/weekly window. Forgiving by
// design: shows "X applied this week", never "you broke your streak".

type Cadence = 'daily' | 'weekly';
interface Goal { cadence: Cadence; target: number; setAt: string }

const GOAL_KEY = 'jobhub_goal_v1';
const GOAL_TOOLTIP_KEY = 'jobhub_goal_tooltip_seen';

function loadGoal(): Goal | null {
    try {
        const raw = localStorage.getItem(GOAL_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveGoal(g: Goal) {
    try { localStorage.setItem(GOAL_KEY, JSON.stringify(g)); } catch { /* noop */ }
}

function countInWindow(jobs: JobLite[], cadence: Cadence): number {
    const now = Date.now();
    const windowMs = cadence === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    return jobs.filter((j: any) => {
        if (j.status !== 'APPLIED' || !j.dateApplied) return false;
        const ts = new Date(j.dateApplied).getTime();
        return !Number.isNaN(ts) && now - ts <= windowMs;
    }).length;
}

function GoalChip({ jobs }: { jobs: JobLite[] }) {
    const { T } = useAppTheme();
    const [goal, setGoal] = useState<Goal | null>(() => loadGoal());
    const [editorOpen, setEditorOpen] = useState(false);
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const chipRef = useRef<HTMLButtonElement>(null);

    const applied = jobs.filter((j: any) => j.status === 'APPLIED').length;
    const hasApplied = applied > 0;

    // First-time celebration: show the tooltip when the user has applied at
    // least once AND no goal is set AND we haven't shown the tooltip before.
    useEffect(() => {
        if (!hasApplied || goal) return;
        let seen = '0';
        try { seen = localStorage.getItem(GOAL_TOOLTIP_KEY) ?? '0'; } catch { /* noop */ }
        if (seen !== '1') {
            const t = setTimeout(() => setTooltipOpen(true), 500);
            return () => clearTimeout(t);
        }
    }, [hasApplied, goal]);

    const dismissTooltip = () => {
        setTooltipOpen(false);
        try { localStorage.setItem(GOAL_TOOLTIP_KEY, '1'); } catch { /* noop */ }
    };

    const handleSave = (cadence: Cadence, target: number) => {
        const g: Goal = { cadence, target, setAt: new Date().toISOString() };
        saveGoal(g);
        setGoal(g);
        setEditorOpen(false);
        dismissTooltip();
    };

    if (!hasApplied) return null;

    const progress = goal ? countInWindow(jobs, goal.cadence) : 0;

    return (
        <div style={{ position: 'relative', flexShrink: 0 }}>
            <motion.button
                ref={chipRef}
                onClick={() => { setEditorOpen((v) => !v); dismissTooltip(); }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    background: goal ? 'rgba(125,166,125,0.10)' : 'rgba(197,160,89,0.14)',
                    border: `1px solid ${goal ? 'rgba(125,166,125,0.32)' : 'rgba(197,160,89,0.45)'}`,
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: goal ? T.text : T.accentSuccess,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                }}
            >
                <Target size={13} />
                {goal
                    ? `${progress} / ${goal.target} · ${goal.cadence === 'daily' ? 'Today' : 'This week'}`
                    : 'Set a goal'}
            </motion.button>

            {/* First-time celebration tooltip */}
            <AnimatePresence>
                {tooltipOpen && !editorOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 10px)',
                            right: 0,
                            width: 280,
                            background: T.card,
                            border: `1px solid ${T.cardBorder}`,
                            borderRadius: 12,
                            padding: '14px 16px 12px',
                            boxShadow: T.cardShadow,
                            zIndex: 20,
                        }}
                    >
                        <button
                            onClick={dismissTooltip}
                            aria-label="Dismiss"
                            style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', padding: 2 }}
                        >
                            <X size={13} />
                        </button>
                        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: T.accentSuccess, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            Nice. First application in.
                        </p>
                        <p style={{ margin: '0 0 10px', fontSize: 13, color: T.text, lineHeight: 1.55 }}>
                            Set a small daily or weekly goal. Steady beats burnout. We track it gently, no streaks to break.
                        </p>
                        <button
                            onClick={() => { setEditorOpen(true); dismissTooltip(); }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '7px 12px',
                                fontSize: 12,
                                fontWeight: 700,
                                color: T.btnText,
                                background: T.btnBg,
                                border: 'none',
                                borderRadius: 8,
                                cursor: 'pointer',
                            }}
                        >
                            Set my goal
                            <ChevronRight size={12} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Editor popover */}
            <AnimatePresence>
                {editorOpen && (
                    <GoalEditor
                        initial={goal ?? { cadence: 'weekly', target: 5, setAt: new Date().toISOString() }}
                        onSave={handleSave}
                        onCancel={() => setEditorOpen(false)}
                        onClear={() => {
                            try { localStorage.removeItem(GOAL_KEY); } catch { /* noop */ }
                            setGoal(null);
                            setEditorOpen(false);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function GoalEditor({
    initial,
    onSave,
    onCancel,
    onClear,
}: {
    initial: Goal;
    onSave: (cadence: Cadence, target: number) => void;
    onCancel: () => void;
    onClear: () => void;
}) {
    const { T } = useAppTheme();
    const [cadence, setCadence] = useState<Cadence>(initial.cadence);
    const [target, setTarget] = useState<number>(initial.target);

    return (
        <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: 280,
                background: T.card,
                border: `1px solid ${T.cardBorder}`,
                borderRadius: 12,
                padding: 16,
                boxShadow: T.cardShadow,
                zIndex: 20,
            }}
        >
            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.textMuted }}>
                Application goal
            </p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {(['daily', 'weekly'] as const).map((c) => (
                    <button
                        key={c}
                        onClick={() => setCadence(c)}
                        style={{
                            flex: 1,
                            padding: '7px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            color: cadence === c ? T.btnText : T.textMuted,
                            background: cadence === c ? T.btnBg : 'transparent',
                            border: `1px solid ${cadence === c ? T.btnBg : T.cardBorder}`,
                            borderRadius: 8,
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                        }}
                    >
                        {c}
                    </button>
                ))}
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.textMuted }}>
                Target ({cadence === 'daily' ? 'per day' : 'per week'})
            </label>
            <input
                type="number"
                min={1}
                max={100}
                value={target}
                onChange={(e) => setTarget(Math.max(1, parseInt(e.target.value || '1', 10)))}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 13,
                    color: T.inputText,
                    background: T.inputBg,
                    border: `1px solid ${T.inputBorder}`,
                    borderRadius: 8,
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: 12,
                }}
            />
            <p style={{ margin: '0 0 14px', fontSize: 11, color: T.textFaint, lineHeight: 1.55 }}>
                We count APPLIED roles in a rolling window. No streak shaming, no notifications. Edit or clear anytime.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <button
                    onClick={onClear}
                    style={{ fontSize: 11, fontWeight: 600, color: T.textFaint, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                    Clear
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={onCancel}
                        style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, color: T.textMuted, background: 'transparent', border: `1px solid ${T.cardBorder}`, borderRadius: 8, cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(cadence, target)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', fontSize: 12, fontWeight: 700, color: T.btnText, background: T.btnBg, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                    >
                        <Check size={12} />
                        Save
                    </button>
                </div>
            </div>
        </motion.div>
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
        navigate('/apply', {
            state: {
                jobDescription: trimmed,
                sc: scToggle,
                company: result?.extractedMetadata?.company,
                role: result?.extractedMetadata?.role,
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
                <HubHeader profile={profile} jobs={jobs ?? []} />
                <DimTarget style={{ marginBottom: 40 }}>
                    <AnalysisHeroCard />
                </DimTarget>
                {profile?.coherence && profile.coherence.length > 0 && (
                    <DimPeer style={{ marginBottom: 32 }}>
                        <CoherenceCard signals={profile.coherence} />
                    </DimPeer>
                )}
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
