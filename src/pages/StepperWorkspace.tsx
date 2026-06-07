/**
 * StepperWorkspace — Phase 3 sequential application flow.
 *
 * Resume → Cover Letter → [Selection Criteria] → Track
 *
 * Hard rules:
 *   - Back never regenerates. Reads the persisted artifact from localStorage.
 *   - Each step persists per (workspaceKey, stepType). workspaceKey is the
 *     SHA-ish hash of the JD; new JD = new workspace.
 *   - SC step only renders when sc=1 came in from the analysis flow.
 *   - Interview prep is intentionally NOT a step here. It triggers from the
 *     tracker when an application moves to INTERVIEW (retention roadmap #1).
 *
 * Reuses the existing /api/generate endpoints. Document content is rendered
 * as markdown via ReactMarkdown. Inline editing is out of scope for this
 * commit; users copy or download for now.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    ChevronDown,
    ChevronRight,
    Copy,
    Download,
    FileText,
    Loader2,
    Mail,
    PenLine,
    RefreshCw,
    ListChecks,
    Briefcase,
    Building2,
    ShieldCheck,
} from 'lucide-react';
import { DraftCritiquePanel, type CritiqueResult } from '../components/strategy/DraftCritiquePanel';
import { ApplyDeepLinkButton } from '../components/strategy/ApplyDeepLinkButton';
import ReactMarkdown from 'react-markdown';
import React from 'react';
import { toast } from 'sonner';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { GenerationProgress } from '../components/shared/GenerationProgress';
import { CoverLetterPersonalisationPanel } from '../components/CoverLetterPersonalisationPanel';
import { GapConfirmModal } from '../components/GapConfirmModal';
import { applyWorkspaceCopy } from './applyWorkspaceCopy';
import { capabilityStatement, type BridgedGap } from '../lib/bridgedGaps';

// Perplexity company intel, pre-fetched on apply-flow entry and fed into the
// structured cover-letter route. Shape mirrors the server's CompanyIntelResult.
interface CompanyIntel {
    summary: string;
    suggestedContact: { title: string; reason: string };
    citations?: string[];
    fetchedAt?: string;
}

// VERIFY marker UI removed — prompts no longer emit placeholder tokens.

/** Strip common AI-generation artifacts before rendering or storage. */
function sanitizeContent(raw: string): string {
    return raw
        // "NFP?" hallucination — the LLM sometimes leaks the sector abbreviation
        // before contact lines (e.g. "NFP?\n📞 +61...").
        .replace(/^NFP\?\s*/gm, '')
        .replace(/\bNFP\?\s*/g, '')
        // Strip any stray bracketed placeholder the generator should no longer
        // emit (belt-and-suspenders so nothing bracketed can ever render).
        .replace(/\s*\[(?:VERIFY|ADD|INSERT|TBD|PLACEHOLDER)\b[^\]]*\]/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

const HEADING_COLOR: React.CSSProperties = { color: warm.colors.textPrimary };
const STRONG_COLOR: React.CSSProperties = { color: warm.colors.textPrimary, fontWeight: 700 };

const MARKDOWN_COMPONENTS = {
    strong: ({ children }: { children?: React.ReactNode }) => <strong style={STRONG_COLOR}>{children}</strong>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 style={HEADING_COLOR}>{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 style={HEADING_COLOR}>{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 style={HEADING_COLOR}>{children}</h3>,
    h4: ({ children }: { children?: React.ReactNode }) => <h4 style={HEADING_COLOR}>{children}</h4>,
};

type StepId = 'resume' | 'cover-letter' | 'selection-criteria' | 'track';
type GenerateType = 'resume' | 'cover-letter' | 'selection-criteria';

interface StepDef {
    id: StepId;
    label: string;
    icon: React.ReactNode;
    optional?: boolean;
}

interface PersistedDraft {
    content: string;
    generatedAt: string;
    edited: boolean;
}

// ── Workspace key ───────────────────────────────────────────────────────────

function workspaceKeyFor(jd: string): string {
    // Stable, non-cryptographic hash so the key is short and deterministic.
    let h = 5381;
    for (let i = 0; i < jd.length; i++) {
        h = ((h << 5) + h + jd.charCodeAt(i)) & 0xffffffff;
    }
    return `ws_${(h >>> 0).toString(36)}`;
}

function draftStorageKey(workspaceKey: string, step: StepId): string {
    return `jobhub_stepper_${workspaceKey}_${step}`;
}

function loadDraft(workspaceKey: string, step: StepId): PersistedDraft | null {
    try {
        const raw = localStorage.getItem(draftStorageKey(workspaceKey, step));
        if (!raw) return null;
        const draft: PersistedDraft = JSON.parse(raw);
        draft.content = sanitizeContent(draft.content);
        return draft;
    } catch {
        return null;
    }
}

function saveDraft(workspaceKey: string, step: StepId, draft: PersistedDraft): void {
    try {
        localStorage.setItem(draftStorageKey(workspaceKey, step), JSON.stringify(draft));
    } catch {
        /* localStorage might be unavailable */
    }
}

// ── Page ────────────────────────────────────────────────────────────────────

export function StepperWorkspace() {
    const navigate = useNavigate();
    const location = useLocation();

    type ApplyState = {
        jobDescription?: string;
        sc?: boolean;
        company?: string;
        role?: string;
        feedItemId?: string;
        sourceUrl?: string;
        sourcePlatform?: string;
        bridgedGaps?: import('../lib/bridgedGaps').BridgedGap[];
    };
    const APPLY_CTX_KEY = 'apply:context';
    const state = useMemo<ApplyState>(() => {
        const incoming = (location.state ?? null) as ApplyState | null;
        if (incoming && Object.keys(incoming).length > 0) {
            try { sessionStorage.setItem(APPLY_CTX_KEY, JSON.stringify(incoming)); } catch { /* noop */ }
            return incoming;
        }
        try {
            const cached = sessionStorage.getItem(APPLY_CTX_KEY);
            if (cached) return JSON.parse(cached) as ApplyState;
        } catch { /* noop */ }
        return {};
    }, [location.state]);
    const jobDescription = state.jobDescription ?? '';
    const wantsSC = state.sc === true;
    const jdEmpty = jobDescription.trim().length === 0;

    const workspaceKey = useMemo(() => workspaceKeyFor(jobDescription), [jobDescription]);

    const steps: StepDef[] = useMemo(() => {
        const base: StepDef[] = [
            { id: 'resume',        label: 'Resume',          icon: <FileText size={14} /> },
            { id: 'cover-letter',  label: 'Cover Letter',    icon: <Mail size={14} /> },
        ];
        if (wantsSC) {
            base.push({ id: 'selection-criteria', label: 'Selection Criteria', icon: <ListChecks size={14} />, optional: true });
        }
        base.push({ id: 'track', label: 'Track', icon: <Briefcase size={14} /> });
        return base;
    }, [wantsSC]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [jdExpanded, setJdExpanded] = useState(false);
    const [companyIntel, setCompanyIntel] = useState<CompanyIntel | null>(null);

    // ── De-frictioned generation orchestration ───────────────────────────────
    // Live path: on entry we derive bridgeable gaps from /analyze/dual (the
    // perceived "already working"), confirm 2–3 strengths in a modal, then
    // generate resume + cover letter in parallel. Legacy path (gaps passed in
    // from the old analysis screen) skips straight to generation.
    const legacyGaps = state.bridgedGaps;
    const [gaps, setGaps] = useState<BridgedGap[]>(legacyGaps ?? []);
    const [gapPhase, setGapPhase] = useState<'deriving' | 'confirming' | 'ready'>(
        legacyGaps !== undefined ? 'ready' : 'deriving',
    );
    const [intelSettled, setIntelSettled] = useState(false);
    const [genStatus, setGenStatus] = useState<Record<'resume' | 'cover-letter', 'idle' | 'generating' | 'done' | 'error'>>({
        resume: 'idle',
        'cover-letter': 'idle',
    });

    const currentStep = steps[currentIndex];
    const isFinalStep = currentStep?.id === 'track';

    // No JD = nothing to do here. Send back to the hub.
    useEffect(() => {
        if (jdEmpty) navigate('/', { replace: true });
    }, [jdEmpty, navigate]);

    // Pre-warm Perplexity company intel in the background on entry, so it's woven
    // into the cover letter. `intelSettled` flips true once intel resolves, errors,
    // or there's no company to fetch — cover-letter generation waits on it. Fully
    // non-fatal — the letter still generates without intel.
    useEffect(() => {
        const company = state.company?.trim();
        if (jdEmpty) return;
        if (!company || company === 'Unknown Company') { setIntelSettled(true); return; }
        let cancelled = false;
        api.post('/research/company-intel', { company, title: state.role ?? '', jobDescription })
            .then(({ data }) => { if (!cancelled) setCompanyIntel(data); })
            .catch((err) => { console.warn('[company-intel] prewarm failed (non-fatal):', err?.response?.status, err?.message); })
            .finally(() => { if (!cancelled) setIntelSettled(true); });
        return () => { cancelled = true; };
    }, [state.company, state.role, jobDescription, jdEmpty]);

    // Derive bridgeable gaps on entry (live path only). This is the instant-on
    // "already working" — generation waits until the user confirms.
    useEffect(() => {
        if (jdEmpty || legacyGaps !== undefined) return;
        let cancelled = false;
        setGapPhase('deriving');
        api.post('/analyze/dual', { jobDescription })
            .then(({ data }) => {
                if (cancelled) return;
                const items: Array<{ skill?: string; suggestion?: string }> = data?.fitBands?.bridgeableGap?.items ?? [];
                const derived: BridgedGap[] = items
                    .slice(0, 3)
                    .map((it) => ({ skill: (it?.skill ?? '').trim(), statement: capabilityStatement(it?.suggestion ?? '') }))
                    .filter((g) => g.skill.length > 0 && g.statement.length > 0);
                if (derived.length > 0) { setGaps(derived); setGapPhase('confirming'); }
                else { setGaps([]); setGapPhase('ready'); }
            })
            .catch(() => { if (!cancelled) { setGaps([]); setGapPhase('ready'); } });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobDescription, jdEmpty]);

    // Once gaps are confirmed (or skipped), generate resume + cover letter in
    // parallel, writing each draft to localStorage as it lands. Never regenerates
    // a step that already has a draft (Back-never-regenerates / revisit).
    useEffect(() => {
        if (gapPhase !== 'ready' || jdEmpty) return;

        const kickOff = (step: 'resume' | 'cover-letter') => {
            if (loadDraft(workspaceKey, step) || genStatus[step] !== 'idle') return;
            setGenStatus((s) => ({ ...s, [step]: 'generating' }));
            const payload: Record<string, unknown> = { jobDescription };
            let endpoint: string;
            if (step === 'resume') {
                endpoint = '/generate/resume-structured';
                payload.bridgedGaps = gaps;
            } else {
                endpoint = '/generate/cover-letter-structured';
                payload.analysisContext = { tone: 'Professional, polished, direct.', company: state.company ?? '', title: state.role ?? '' };
                payload.companyIntel = companyIntel ?? null;
                payload.bridgedGaps = gaps;
            }
            api.post<{ content: string }>(endpoint, payload)
                .then(({ data }) => {
                    const text = typeof data?.content === 'string' ? sanitizeContent(data.content) : '';
                    saveDraft(workspaceKey, step, { content: text, generatedAt: new Date().toISOString(), edited: false });
                    setGenStatus((s) => ({ ...s, [step]: 'done' }));
                })
                .catch(() => { setGenStatus((s) => ({ ...s, [step]: 'error' })); });
        };

        kickOff('resume');
        if (intelSettled) kickOff('cover-letter');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gapPhase, intelSettled, jdEmpty, workspaceKey]);

    if (jdEmpty) return null;

    return (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', minHeight: 'calc(100vh - 120px)' }}>
            {/* Collapsible JD strip */}
            <aside
                onMouseEnter={() => setJdExpanded(true)}
                onMouseLeave={() => setJdExpanded(false)}
                style={{
                    flexShrink: 0,
                    width: jdExpanded ? 360 : 36,
                    transition: 'width 220ms ease',
                    background: warm.colors.bgSurface,
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    borderRadius: 14,
                    padding: jdExpanded ? '18px 20px' : '18px 8px',
                    maxHeight: 'calc(100vh - 140px)',
                    overflow: 'hidden',
                    position: 'sticky',
                    top: 8,
                }}
            >
                {jdExpanded ? (
                    <>
                        <p style={{
                            margin: '0 0 12px',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: warm.colors.textMuted,
                        }}>
                            Job description
                        </p>
                        <div style={{
                            fontSize: 12,
                            lineHeight: 1.65,
                            color: warm.colors.textMuted,
                            whiteSpace: 'pre-wrap',
                            maxHeight: 'calc(100vh - 200px)',
                            overflowY: 'auto',
                        }}>
                            {jobDescription}
                        </div>
                    </>
                ) : (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 160,
                    }}>
                        <span style={{
                            writingMode: 'vertical-rl',
                            textOrientation: 'mixed',
                            transform: 'rotate(180deg)',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: warm.colors.textMuted,
                            whiteSpace: 'nowrap',
                        }}>
                            Job description
                        </span>
                    </div>
                )}
            </aside>

            {/* Main column */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Stepper
                    steps={steps}
                    currentIndex={currentIndex}
                    onSelect={(i) => {
                        // Allow jumping to any step that has a draft, or the next un-drafted step.
                        if (i <= currentIndex) {
                            setCurrentIndex(i);
                        } else {
                            const drafted = loadDraft(workspaceKey, steps[currentIndex].id) != null;
                            if (drafted) setCurrentIndex(i);
                        }
                    }}
                />

                {isFinalStep ? (
                    <TrackStep
                        jobDescription={jobDescription}
                        wantsSC={wantsSC}
                        company={state.company}
                        role={state.role}
                        companyIntel={companyIntel}
                        workspaceKey={workspaceKey}
                        onBack={() => setCurrentIndex(currentIndex - 1)}
                        feedItemId={state.feedItemId}
                        sourceUrl={state.sourceUrl}
                        sourcePlatform={state.sourcePlatform}
                    />
                ) : (
                    <DocumentStep
                        key={currentStep.id}
                        stepId={currentStep.id as GenerateType}
                        workspaceKey={workspaceKey}
                        jobDescription={jobDescription}
                        company={state.company}
                        role={state.role}
                        companyIntel={companyIntel}
                        bridgedGaps={gaps}
                        sourceUrl={state.sourceUrl}
                        feedItemId={state.feedItemId}
                        generationStatus={
                            currentStep.id === 'resume' || currentStep.id === 'cover-letter'
                                ? genStatus[currentStep.id]
                                : 'idle'
                        }
                        onBack={currentIndex > 0 ? () => setCurrentIndex(currentIndex - 1) : null}
                        onContinue={() => setCurrentIndex(currentIndex + 1)}
                        isLast={currentIndex === steps.length - 1}
                    />
                )}
            </div>

            {gapPhase === 'confirming' && (
                <GapConfirmModal
                    gaps={gaps}
                    onConfirm={(confirmed) => { setGaps(confirmed); setGapPhase('ready'); }}
                />
            )}
        </div>
    );
}

// ── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({
    steps,
    currentIndex,
    onSelect,
}: {
    steps: StepDef[];
    currentIndex: number;
    onSelect: (i: number) => void;
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 18px',
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 12,
        }}>
            {steps.map((step, i) => {
                const isActive = i === currentIndex;
                const isDone = i < currentIndex;
                const color = isActive ? warm.colors.accentGold : isDone ? warm.colors.accentPetrol : warm.colors.textMuted;
                return (
                    <button
                        key={step.id}
                        onClick={() => onSelect(i)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            color,
                            background: isActive ? 'rgba(197,160,89,0.12)' : 'transparent',
                            border: `1px solid ${isActive ? 'rgba(197,160,89,0.30)' : 'transparent'}`,
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'background 200ms, color 200ms',
                        }}
                    >
                        {isDone ? <Check size={13} /> : step.icon}
                        {step.label}
                        {i < steps.length - 1 && (
                            <ChevronRight size={12} style={{ color: warm.colors.textMuted, marginLeft: 4 }} />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ── DocumentStep ────────────────────────────────────────────────────────────

function DocumentStep({
    stepId,
    workspaceKey,
    jobDescription,
    company,
    role,
    companyIntel,
    bridgedGaps,
    sourceUrl,
    feedItemId,
    generationStatus,
    onBack,
    onContinue,
    isLast,
}: {
    stepId: GenerateType;
    workspaceKey: string;
    jobDescription: string;
    company?: string;
    role?: string;
    companyIntel?: CompanyIntel | null;
    bridgedGaps?: import('../lib/bridgedGaps').BridgedGap[];
    sourceUrl?: string;
    feedItemId?: string;
    generationStatus: 'idle' | 'generating' | 'done' | 'error';
    onBack: (() => void) | null;
    onContinue: () => void;
    isLast: boolean;
}) {
    const [content, setContent] = useState<string>('');
    const [generating, setGenerating] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editBuffer, setEditBuffer] = useState('');
    const [downloadFormat, setDownloadFormat] = useState<'docx' | 'pdf'>(() => {
        try {
            const stored = localStorage.getItem('jobhub_download_format');
            return stored === 'pdf' ? 'pdf' : 'docx';
        } catch {
            return 'docx';
        }
    });
    const [formatMenuOpen, setFormatMenuOpen] = useState(false);

    const navigate = useNavigate();
    const isCoverLetter = stepId === 'cover-letter';

    // ── Finish application: marks applied on the backend and returns to workspace.
    const handleFinishApplication = async () => {
        commitEdit();
        try {
            if (feedItemId) {
                await api.post(`/job-feed/${feedItemId}/mark-applied`);
            }
        } catch (err) {
            console.warn('[apply] mark-applied failed (non-fatal):', err);
        }
        navigate('/', { state: { appliedFeedItemId: feedItemId ?? null } });
    };

    // ── Selection-criteria-only state ────────────────────────────────────
    const criteriaStorageKey = `jobhub_stepper_${workspaceKey}_criteria_text`;
    const [criteriaText, setCriteriaText] = useState<string>(() => {
        try { return localStorage.getItem(criteriaStorageKey) ?? ''; } catch { return ''; }
    });
    const [criteriaPanelOpen, setCriteriaPanelOpen] = useState<boolean>(false);
    const isSC = stepId === 'selection-criteria';
    const hasCriteria = isSC && criteriaText.trim().length >= 40;

    // Draft critique — button-driven, never auto-run (LLM cost control).
    const [critiqueOpen, setCritiqueOpen] = useState(false);
    const [critiqueLoading, setCritiqueLoading] = useState(false);
    const [critiqueResult, setCritiqueResult] = useState<CritiqueResult | null>(null);

    const handleReviewDraft = async () => {
        if (!content || critiqueLoading) return;
        setCritiqueOpen(true);
        setCritiqueLoading(true);
        try {
            const { data } = await api.post<CritiqueResult>('/analyze/critique', {
                docType: stepId,
                content,
                jobDescription,
            });
            setCritiqueResult(data);
        } catch (err: any) {
            const status = err?.response?.status;
            const msg = status === 503 ? 'Review is temporarily unavailable. Please try again.' :
                        status === 400 ? 'Draft needs to be a bit longer before we can review it.' :
                        'Could not review this draft. Please retry.';
            toast.error(msg);
            setCritiqueOpen(false);
        } finally {
            setCritiqueLoading(false);
        }
    };

    // Reset critique whenever the step changes or the content is regenerated.
    useEffect(() => {
        setCritiqueOpen(false);
        setCritiqueResult(null);
    }, [workspaceKey, stepId]);

    // Load the persisted draft + criteria on step entry. Never regenerates on navigation.
    useEffect(() => {
        const draft = loadDraft(workspaceKey, stepId);
        if (draft) {
            setContent(draft.content);
            setHasDraft(true);
        } else {
            setContent('');
            setHasDraft(false);
        }
        setEditing(false);
        if (isSC) {
            try {
                const stored = localStorage.getItem(criteriaStorageKey) ?? '';
                setCriteriaText(stored);
                // Open the panel automatically if no criteria yet AND no draft.
                setCriteriaPanelOpen(stored.trim().length === 0 && !draft);
            } catch { /* noop */ }
        }
    }, [workspaceKey, stepId, isSC, criteriaStorageKey, generationStatus]);

    const handleSaveCriteria = (next: string) => {
        setCriteriaText(next);
        try { localStorage.setItem(criteriaStorageKey, next); } catch { /* noop */ }
    };

    const generate = async (regenerate = false) => {
        if (generating) return;
        if (isSC && !hasCriteria) {
            toast.error('Paste the selection criteria first.');
            setCriteriaPanelOpen(true);
            return;
        }
        if (regenerate && hasDraft && !confirm('Regenerate this document? The current draft will be replaced.')) return;

        setGenerating(true);
        try {
            const payload: Record<string, unknown> = { jobDescription };
            if (isSC) payload.selectionCriteriaText = criteriaText.trim();

            // Canonical structured routes: resume + cover letter render from
            // Zod-validated JSON templates. SC stays on the legacy markdown route.
            let endpoint = `/generate/${stepId}`;
            if (stepId === 'resume') {
                endpoint = '/generate/resume-structured';
                payload.bridgedGaps = bridgedGaps ?? [];
            } else if (stepId === 'cover-letter') {
                endpoint = '/generate/cover-letter-structured';
                payload.analysisContext = {
                    tone: 'Professional, polished, direct.',
                    company: company ?? '',
                    title: role ?? '',
                };
                payload.companyIntel = companyIntel ?? null;
                payload.bridgedGaps = bridgedGaps ?? [];
            }

            const { data } = await api.post<{ content: string }>(endpoint, payload);
            const text = typeof data?.content === 'string' ? sanitizeContent(data.content) : '';
            setContent(text);
            saveDraft(workspaceKey, stepId, {
                content: text,
                generatedAt: new Date().toISOString(),
                edited: false,
            });
            setHasDraft(true);
        } catch (err: any) {
            const status = err?.response?.status;
            const msg = status === 402 ? 'Generation limit reached.' :
                        status === 404 ? 'Profile not found.' :
                        'Generation failed. Please retry.';
            toast.error(msg);
        } finally {
            setGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!content) return;
        navigator.clipboard.writeText(content);
        toast.success('Copied');
    };

    // Commit any in-progress inline edit to content + localStorage. Idempotent:
    // a no-op when not editing or nothing changed, and it never toggles
    // `editing` itself (callers own that). That makes it safe to fire from the
    // textarea's onBlur without fighting the button click that follows. Returns
    // the effective post-commit content so callers can act on the fresh value
    // without waiting for the async setContent.
    const commitEdit = (): string => {
        if (!editing) return content;
        const trimmed = editBuffer.trim();
        if (trimmed.length > 0 && trimmed !== content) {
            setContent(trimmed);
            saveDraft(workspaceKey, stepId, {
                content: trimmed,
                generatedAt: new Date().toISOString(),
                edited: true,
            });
            toast.success('Edits saved');
            return trimmed;
        }
        return content;
    };

    const handleContinue = () => {
        // Flush any pending inline edit FIRST — the "Save & continue" button must
        // honour its label even when the user never clicked "Done".
        commitEdit();
        setEditing(false);
        onContinue();
    };

    const handleEditToggle = () => {
        if (editing) {
            commitEdit();
            setEditing(false);
        } else {
            setEditBuffer(content);
            setEditing(true);
        }
    };

    const exportType = stepId === 'cover-letter' ? 'cover-letter' : stepId === 'selection-criteria' ? 'selection-criteria' : 'resume';

    const setFormatPref = (next: 'docx' | 'pdf') => {
        setDownloadFormat(next);
        try { localStorage.setItem('jobhub_download_format', next); } catch { /* noop */ }
    };

    const handleDownload = async (formatOverride?: 'docx' | 'pdf') => {
        if (!content) return;
        const fmt = formatOverride ?? downloadFormat;
        if (formatOverride) setFormatPref(formatOverride);
        setFormatMenuOpen(false);
        try {
            if (fmt === 'pdf') {
                const { exportPdf } = await import('../lib/exportPdf');
                await exportPdf(content, exportType as any, '', '');
            } else {
                const { exportDocx } = await import('../lib/exportDocx');
                await exportDocx(content, exportType as any, '');
            }
            toast.success(`Downloaded as .${fmt}`);
        } catch {
            toast.error('Download failed. Copy the content instead.');
        }
    };

    const stepLabel = stepId === 'resume' ? 'Tailored Resume' : stepId === 'cover-letter' ? 'Cover Letter' : 'Selection Criteria';
    const coverLetterNote = 'Most candidates skip the cover letter. Australian recruiters use it to filter genuine interest from automated applications, a tailored cover letter measurably increases callback rates.';

    return (
        <div style={{
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 14,
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 420,
        }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: warm.colors.textMuted }}>
                    {stepLabel}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {hasDraft && !editing && (
                        <>
                            <ToolbarButton
                                icon={critiqueLoading ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                                label="Review"
                                onClick={handleReviewDraft}
                            />
                            <ToolbarButton icon={<Copy size={13} />} label="Copy" onClick={handleCopy} />
                            {/* Per-step download label (spec §8.7) */}
                            <DownloadSplit
                                format={downloadFormat}
                                open={formatMenuOpen}
                                onToggleMenu={() => setFormatMenuOpen((v) => !v)}
                                onCloseMenu={() => setFormatMenuOpen(false)}
                                onDownload={() => handleDownload()}
                                onChoose={(f) => handleDownload(f)}
                                label={isCoverLetter ? 'Download cover letter' : 'Download resume'}
                            />
                            {/* Download both — cover-letter step only */}
                            {isCoverLetter && (
                                <ToolbarButton
                                    icon={<Download size={13} />}
                                    label="Download both"
                                    onClick={async () => {
                                        try {
                                            const fmt = downloadFormat;
                                            const resumeDraft = loadDraft(workspaceKey, 'resume');
                                            if (resumeDraft?.content) {
                                                if (fmt === 'pdf') {
                                                    const { exportPdf } = await import('../lib/exportPdf');
                                                    await exportPdf(resumeDraft.content, 'resume', '', '');
                                                } else {
                                                    const { exportDocx } = await import('../lib/exportDocx');
                                                    await exportDocx(resumeDraft.content, 'resume', '');
                                                }
                                            }
                                            await handleDownload();
                                            toast.success('Downloaded both documents');
                                        } catch {
                                            toast.error('Download failed. Copy the content instead.');
                                        }
                                    }}
                                />
                            )}
                        </>
                    )}
                </div>
            </header>

            {/* Review framing — the documents are already done; read & trim. */}
            {hasDraft && !generating && generationStatus !== 'generating' && (stepId === 'resume' || stepId === 'cover-letter') && (
                <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                    {stepId === 'resume' ? applyWorkspaceCopy.reviewFraming.resume : applyWorkspaceCopy.reviewFraming.coverLetter}
                </p>
            )}

            {/* Cover letter educational note */}
            {stepId === 'cover-letter' && (
                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.6, fontStyle: 'italic' }}>
                    {coverLetterNote}
                </p>
            )}

            {/* Company insight — read-only view of the Perplexity intel woven into the letter */}
            {isCoverLetter && companyIntel && (
                <div style={{
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    background: warm.colors.bgAlt,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Building2 size={13} style={{ color: warm.colors.accentGold }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Company Insight
                        </span>
                        <span style={{ fontSize: 9, color: warm.colors.textMuted, opacity: 0.7 }}>· via Perplexity</span>
                    </div>

                    {companyIntel.summary && (
                        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: warm.colors.textPrimary }}>
                            {companyIntel.summary}
                        </p>
                    )}

                    {companyIntel.suggestedContact?.title && (
                        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: warm.colors.textMuted }}>
                            <span style={{ fontWeight: 700, color: warm.colors.textPrimary }}>Suggested contact: </span>
                            {companyIntel.suggestedContact.title}
                            {companyIntel.suggestedContact.reason ? ` — ${companyIntel.suggestedContact.reason}` : ''}
                        </div>
                    )}

                    {companyIntel.citations && companyIntel.citations.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Sources
                            </span>
                            {companyIntel.citations.map((url, i) => (
                                <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: 11, color: warm.colors.accentGold, textDecoration: 'underline', textUnderlineOffset: 3 }}
                                >
                                    {i + 1}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Selection-criteria paste panel — only on SC step */}
            {isSC && (
                <CriteriaPanel
                    open={criteriaPanelOpen}
                    onOpen={() => setCriteriaPanelOpen(true)}
                    onClose={() => setCriteriaPanelOpen(false)}
                    criteriaText={criteriaText}
                    onSave={handleSaveCriteria}
                    hasCriteria={hasCriteria}
                />
            )}

            {/* Body */}
            <div style={{
                position: 'relative',
                flex: 1,
                background: warm.colors.bgAlt,
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 10,
                padding: '20px 24px',
                minHeight: 280,
                overflow: 'auto',
            }}>
                {/* Edit toggle — top-right underline */}
                {hasDraft && !generating && (
                    <button
                        onClick={handleEditToggle}
                        style={{
                            position: 'absolute',
                            top: 12,
                            right: 16,
                            background: 'transparent',
                            border: 'none',
                            color: editing ? warm.colors.accentGold : warm.colors.textMuted,
                            fontSize: 12,
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            textDecoration: 'underline',
                            textUnderlineOffset: 4,
                            cursor: 'pointer',
                            padding: 0,
                            zIndex: 1,
                        }}
                        title={editing ? 'Save edits' : 'Edit inline'}
                    >
                        {editing ? 'Done' : 'Edit'}
                    </button>
                )}

                {generating || (generationStatus === 'generating' && !content) ? (
                    <GenerationProgress docType={stepId === 'cover-letter' ? 'cover-letter' : stepId === 'selection-criteria' ? 'selection-criteria' : 'resume'} />
                ) : editing ? (
                    <textarea
                        value={editBuffer}
                        onChange={(e) => setEditBuffer(e.target.value)}
                        onBlur={() => commitEdit()}
                        spellCheck
                        style={{
                            width: '100%',
                            minHeight: 360,
                            padding: 0,
                            paddingRight: 56,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: warm.colors.textPrimary,
                            fontSize: 13.5,
                            lineHeight: 1.7,
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                        }}
                    />
                ) : content ? (
                    <div className="prose prose-invert max-w-none" style={{ color: warm.colors.textPrimary, fontSize: 13.5, lineHeight: 1.7 }}>
                        <ReactMarkdown components={MARKDOWN_COMPONENTS as any}>{content}</ReactMarkdown>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '40px 0', color: warm.colors.textMuted, textAlign: 'center' }}>
                        <PenLine size={28} />
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, maxWidth: 380 }}>
                            {isSC
                                ? 'Paste the selection criteria above, then Generate. We will write a STAR response per criterion, drawing on your achievement bank.'
                                : generationStatus === 'error'
                                    ? 'That draft didn\'t come through. Use Regenerate to try again.'
                                    : 'Preparing this document…'}
                        </p>
                    </div>
                )}
            </div>

            {/* Draft critique panel — mounts below the preview when triggered */}
            <AnimatePresence>
                {critiqueOpen && (
                    <DraftCritiquePanel
                        open={critiqueOpen}
                        onClose={() => setCritiqueOpen(false)}
                        loading={critiqueLoading}
                        result={critiqueResult}
                    />
                )}
            </AnimatePresence>

            {/* Cover-letter personalisation score — mounts once a draft exists */}
            {isCoverLetter && content && !generating && !editing && (
                <div style={{ border: `1px solid ${warm.colors.borderWhisper}`, borderRadius: 12, padding: '14px 16px' }}>
                    <CoverLetterPersonalisationPanel
                        document={content}
                        jobDescription={jobDescription}
                        company={company}
                    />
                </div>
            )}

            {/* Seek submission banner — cover-letter step only (spec §8.3) */}
            {isCoverLetter && content && sourceUrl && (
                <div style={{
                    border: `1px solid ${warm.colors.accentPetrol}`, borderRadius: 12,
                    background: warm.colors.bgAlt, padding: '16px 18px',
                    display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>Last step: submit on Seek</p>
                    <p style={{ margin: 0, fontSize: 13, color: warm.colors.textSecondary }}>
                        Download your resume and cover letter, then submit them on the live listing. We open it for you in a new tab.
                    </p>
                    <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            alignSelf: 'flex-start', marginTop: 4, fontSize: 13.5, fontWeight: 700,
                            padding: '9px 18px', borderRadius: 10, textDecoration: 'none',
                            background: warm.colors.accentPetrol, color: warm.colors.textOnDeep,
                        }}
                    >
                        Submit on Seek
                    </a>
                </div>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {onBack && (
                        <button
                            onClick={() => { commitEdit(); setEditing(false); onBack(); }}
                            disabled={generating}
                            style={ghostButtonStyle(generating)}
                        >
                            <ArrowLeft size={14} />
                            Back
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {hasDraft && (
                        <button
                            onClick={() => generate(true)}
                            disabled={generating}
                            style={ghostButtonStyle(generating)}
                            title="Regenerate this document"
                        >
                            <RefreshCw size={13} />
                            Regenerate
                        </button>
                    )}
                    {!hasDraft && isSC && (
                        <button
                            onClick={() => generate(false)}
                            disabled={generating || !hasCriteria}
                            style={primaryButtonStyle(generating || !hasCriteria)}
                            title={!hasCriteria ? 'Paste the selection criteria first' : undefined}
                        >
                            {generating ? (<><Loader2 size={14} className="animate-spin" /> Generating…</>) : (<>Generate<ArrowRight size={14} /></>)}
                        </button>
                    )}
                    {!hasDraft && !isSC && generationStatus === 'error' && (
                        <button
                            onClick={() => generate(false)}
                            disabled={generating}
                            style={primaryButtonStyle(generating)}
                            title="Regenerate this document"
                        >
                            {generating ? (<><Loader2 size={14} className="animate-spin" /> Generating…</>) : (<><RefreshCw size={13} /> Regenerate</>)}
                        </button>
                    )}
                    {hasDraft && (
                        <button
                            onClick={isLast && feedItemId ? handleFinishApplication : handleContinue}
                            disabled={generating}
                            style={primaryButtonStyle(generating)}
                        >
                            {isLast && feedItemId ? 'Back to my jobs' : isLast ? 'Finish' : 'Save & continue'}
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── TrackStep ───────────────────────────────────────────────────────────────

function TrackStep({
    jobDescription,
    wantsSC,
    company,
    role,
    companyIntel,
    workspaceKey,
    onBack,
    feedItemId,
    sourceUrl,
    sourcePlatform,
}: {
    jobDescription: string;
    wantsSC: boolean;
    company?: string;
    role?: string;
    companyIntel?: CompanyIntel | null;
    workspaceKey: string;
    onBack: () => void;
    feedItemId?: string;
    sourceUrl?: string;
    sourcePlatform?: string;
}) {
    const navigate = useNavigate();
    const [autoSaveError, setAutoSaveError] = useState(false);

    const resumeDraft = loadDraft(workspaceKey, 'resume');
    const coverDraft = loadDraft(workspaceKey, 'cover-letter');
    const drafted = {
        resume: resumeDraft !== null,
        cover: coverDraft !== null,
        sc: loadDraft(workspaceKey, 'selection-criteria') !== null,
    };

    // Candidate name needed for the export filename. Falls back to a generic
    // label so the apply button is never blocked on profile fetch failing.
    const { data: profile } = useQuery({
        queryKey: ['profile', 'lite-for-apply'],
        queryFn: async () => (await api.get('/profile')).data,
        staleTime: 10 * 60 * 1000,
    });
    const candidateName = (profile?.name && String(profile.name).trim()) || 'Application';

    // Auto-save the application on mount. One-shot per workspaceKey using a
    // local flag so revisiting the step doesn't duplicate the row.
    useEffect(() => {
        const flag = `jobhub_tracker_saved_${workspaceKey}`;
        if (localStorage.getItem(flag) === '1') return;
        let cancelled = false;
        (async () => {
            try {
                await api.post('/jobs', {
                    title: role ?? 'Untitled role',
                    company: company ?? 'Unknown company',
                    description: jobDescription,
                    status: 'APPLIED',
                    dateApplied: new Date().toISOString(),
                    companyIntel: companyIntel ?? undefined,
                });
                if (!cancelled) {
                    localStorage.setItem(flag, '1');
                    // Notify dashboard to show goal-counter onboarding if first ever
                    localStorage.setItem('jobhub_last_apply_at', new Date().toISOString());
                }
            } catch {
                if (!cancelled) setAutoSaveError(true);
            }
        })();
        return () => { cancelled = true; };
    }, [workspaceKey, jobDescription, role, company]);

    return (
        <div style={{
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 14,
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
        }}>
            <div>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: warm.colors.accentGold }}>
                    {autoSaveError ? 'Almost there' : 'Saved to your tracker'}
                </p>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: warm.colors.textPrimary, letterSpacing: '-0.01em' }}>
                    {autoSaveError ? 'Your application is ready, but the tracker save failed.' : 'Nice work. This one is in your tracker.'}
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                    {autoSaveError
                        ? 'We could not save automatically. Retry below, or come back from the dashboard.'
                        : `${role ?? 'This role'}${company ? ` at ${company}` : ''} is now under Applications, with today's date set.`}
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <DraftRow label="Resume" ready={drafted.resume} />
                <DraftRow label="Cover letter" ready={drafted.cover} />
                {wantsSC && <DraftRow label="Selection criteria" ready={drafted.sc} />}
            </div>

            {/* Compact tracker chip with hover tooltip. The full explanation
                lives in the tooltip, not the layout, so the Track screen reads
                less crowded. */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }} className="group">
                <Briefcase size={12} style={{ color: warm.colors.textMuted, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, fontWeight: 500 }}>
                    Find this anytime under{' '}
                    <Link
                        to="/tracker"
                        style={{
                            color: warm.colors.textPrimary,
                            fontWeight: 600,
                            textDecoration: 'underline',
                            textUnderlineOffset: 3,
                            textDecorationColor: warm.colors.borderDefined,
                        }}
                    >
                        Applications
                    </Link>
                    <span
                        tabIndex={0}
                        aria-label="What does the tracker do?"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: warm.colors.bgAlt,
                            color: warm.colors.textMuted,
                            fontSize: 9,
                            fontWeight: 800,
                            marginLeft: 6,
                            cursor: 'help',
                            verticalAlign: 'middle',
                        }}
                        className="peer"
                    >
                        i
                    </span>
                </p>
                <div
                    role="tooltip"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        zIndex: 30,
                        width: 'min(360px, calc(100vw - 80px))',
                        padding: '12px 14px',
                        background: warm.colors.bgDeep,
                        border: `1px solid ${warm.colors.borderDefined}`,
                        borderRadius: 10,
                        boxShadow: warm.shadow.lifted,
                        fontSize: 12,
                        lineHeight: 1.55,
                        color: warm.colors.textOnDeep,
                        opacity: 0,
                        pointerEvents: 'none',
                        transform: 'translateY(-4px)',
                        transition: 'opacity 0.15s, transform 0.15s',
                    }}
                    className="group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto peer-focus:opacity-100 peer-focus:translate-y-0 peer-focus:pointer-events-auto"
                >
                    The tracker quietly nudges you to follow up after a week of silence and unlocks
                    the Interview Prep generator the moment you mark a role as Interview. Nothing
                    extra to do here — it picks up from this point.
                </div>
            </div>

            {/* Apply on platform — only when both docs exist. Downloads PDFs,
                copies cover letter to clipboard, opens the listing (if we have
                its URL), and transitions the application to APPLIED. */}
            {drafted.resume && drafted.cover && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 14,
                    padding: '14px 18px',
                    background: 'rgba(125,166,125,0.08)',
                    border: '1px solid rgba(125,166,125,0.30)',
                    borderRadius: 12,
                }}>
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                            {sourceUrl ? 'Ready to send' : 'Your docs are ready'}
                        </p>
                        <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textMuted, lineHeight: 1.55 }}>
                            {sourceUrl
                                ? 'One click downloads your resume and cover letter as PDFs, copies the cover letter to your clipboard, and opens the listing.'
                                : 'One click downloads your resume and cover letter as PDFs and copies the cover letter to your clipboard. Send this one off, then queue up the next.'
                            }
                        </p>
                    </div>
                    <ApplyDeepLinkButton
                        resumeMarkdown={resumeDraft?.content ?? ''}
                        coverLetterMarkdown={coverDraft?.content ?? ''}
                        candidateName={candidateName}
                        jobTitle={role}
                        company={company}
                        sourceUrl={sourceUrl}
                        sourcePlatform={sourcePlatform}
                        feedItemId={feedItemId}
                    />
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
                <button onClick={onBack} style={ghostButtonStyle(false)}>
                    <ArrowLeft size={14} />
                    Back
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => navigate('/tracker')} style={ghostButtonStyle(false)}>
                        Open tracker
                    </button>
                    <button
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('process:saved'));
                            navigate('/');
                        }}
                        style={primaryButtonStyle(false)}
                    >
                        Apply for another role
                        <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── CriteriaPanel (SC step only) ────────────────────────────────────────────

const CRITERIA_PLACEHOLDER = `Paste the selection criteria here.

Australian roles, especially government and university positions, often list a
numbered set of capabilities you must address as a separate document. They look
like:

  1. Demonstrated experience in stakeholder engagement across diverse audiences.
  2. Proven ability to manage competing priorities in a fast-paced environment.
  3. Excellent written and verbal communication skills.

You usually find them in the role's Position Description (PD), Information Pack,
or a section on the job page titled "Key Selection Criteria" or "Selection
Criteria". They are NOT the same as the JD bullet list.

We will write one STAR response per criterion (Situation, Task, Action, Result).
Typical length: 250 to 350 words per criterion.`;

function CriteriaPanel({
    open,
    onOpen,
    onClose,
    criteriaText,
    onSave,
    hasCriteria,
}: {
    open: boolean;
    onOpen: () => void;
    onClose: () => void;
    criteriaText: string;
    onSave: (next: string) => void;
    hasCriteria: boolean;
}) {
    const [buffer, setBuffer] = useState(criteriaText);

    useEffect(() => { setBuffer(criteriaText); }, [criteriaText]);

    const handleSave = () => {
        onSave(buffer.trim());
        onClose();
    };

    return (
        <div>
            <AnimatePresence mode="wait" initial={false}>
                {!open ? (
                    <motion.button
                        key="pill"
                        onClick={onOpen}
                        initial={{ opacity: 0 }}
                        animate={{
                            opacity: 1,
                            // Subtle vibration only when no criteria are saved yet
                            ...(hasCriteria ? {} : { y: [0, -1.5, 0, 1.5, 0] }),
                        }}
                        exit={{ opacity: 0 }}
                        transition={hasCriteria ? { duration: 0.2 } : { y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 16px',
                            background: hasCriteria ? 'rgba(125,166,125,0.10)' : 'rgba(197,160,89,0.14)',
                            border: `1px solid ${hasCriteria ? 'rgba(125,166,125,0.32)' : 'rgba(197,160,89,0.45)'}`,
                            borderRadius: 999,
                            fontSize: 12.5,
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                            color: hasCriteria ? warm.colors.accentPetrol : warm.colors.accentGold,
                            cursor: 'pointer',
                            boxShadow: hasCriteria ? 'none' : '0 0 0 3px rgba(197,160,89,0.10)',
                        }}
                    >
                        <ListChecks size={14} />
                        {hasCriteria ? 'Criteria saved · edit' : 'Paste selection criteria here'}
                        <ChevronRight size={12} />
                    </motion.button>
                ) : (
                    <motion.div
                        key="panel"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22 }}
                        style={{
                            overflow: 'hidden',
                            border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 12,
                            background: warm.colors.bgAlt,
                        }}
                    >
                        <div style={{ padding: '14px 16px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: warm.colors.accentGold }}>
                                    Selection criteria
                                </p>
                                <button
                                    onClick={onClose}
                                    style={{ background: 'transparent', border: 'none', color: warm.colors.textMuted, fontSize: 12, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}
                                >
                                    Hide
                                </button>
                            </div>
                            <textarea
                                value={buffer}
                                onChange={(e) => setBuffer(e.target.value)}
                                placeholder={CRITERIA_PLACEHOLDER}
                                rows={10}
                                spellCheck
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    fontSize: 13,
                                    lineHeight: 1.65,
                                    color: warm.colors.textPrimary,
                                    background: warm.colors.bgCanvas,
                                    border: `1px solid ${warm.colors.borderWhisper}`,
                                    borderRadius: 10,
                                    outline: 'none',
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                    boxSizing: 'border-box',
                                }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 12 }}>
                                <p style={{ margin: 0, fontSize: 11, color: warm.colors.textMuted, lineHeight: 1.5 }}>
                                    {buffer.trim().length} characters · we recommend pasting all numbered criteria together.
                                </p>
                                <button
                                    onClick={handleSave}
                                    disabled={buffer.trim().length < 40}
                                    style={{
                                        padding: '7px 14px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: warm.colors.textOnDeep,
                                        background: buffer.trim().length < 40 ? 'rgba(45,90,110,0.4)' : warm.colors.accentPetrol,
                                        border: 'none',
                                        borderRadius: 8,
                                        cursor: buffer.trim().length < 40 ? 'not-allowed' : 'pointer',
                                        opacity: buffer.trim().length < 40 ? 0.6 : 1,
                                    }}
                                >
                                    Use these criteria
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── DownloadSplit (format dropdown) ─────────────────────────────────────────

function DownloadSplit({
    format,
    open,
    onToggleMenu,
    onCloseMenu,
    onDownload,
    onChoose,
    label,
}: {
    format: 'docx' | 'pdf';
    open: boolean;
    onToggleMenu: () => void;
    onCloseMenu: () => void;
    onDownload: () => void;
    onChoose: (next: 'docx' | 'pdf') => void;
    label?: string;
}) {
    return (
        <div style={{ position: 'relative', display: 'inline-flex' }} onMouseLeave={onCloseMenu}>
            <button
                onClick={onDownload}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    color: warm.colors.textMuted,
                    background: 'transparent',
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    borderRight: 'none',
                    borderTopLeftRadius: 8,
                    borderBottomLeftRadius: 8,
                    cursor: 'pointer',
                }}
            >
                <Download size={13} />
                {label ?? `.${format}`}
            </button>
            <button
                onClick={onToggleMenu}
                aria-label="Choose download format"
                style={{
                    padding: '6px 8px',
                    background: 'transparent',
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    borderTopRightRadius: 8,
                    borderBottomRightRadius: 8,
                    color: warm.colors.textMuted,
                    cursor: 'pointer',
                }}
            >
                <ChevronDown size={13} />
            </button>
            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    minWidth: 140,
                    background: warm.colors.bgSurface,
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    borderRadius: 10,
                    boxShadow: warm.shadow.soft,
                    padding: 6,
                    zIndex: 10,
                }}>
                    {(['docx', 'pdf'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => onChoose(f)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                padding: '8px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                color: warm.colors.textPrimary,
                                background: f === format ? 'rgba(125,166,125,0.08)' : 'transparent',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                        >
                            <span>.{f}</span>
                            {f === format && <Check size={12} style={{ color: warm.colors.accentPetrol }} />}
                        </button>
                    ))}
                    <p style={{ margin: '6px 8px 4px', fontSize: 10, color: warm.colors.textMuted, lineHeight: 1.5 }}>
                        Choice persists for next time.
                    </p>
                </div>
            )}
        </div>
    );
}

function DraftRow({ label, ready }: { label: string; ready: boolean }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: ready ? 'rgba(125,166,125,0.08)' : warm.colors.bgAlt,
            border: `1px solid ${ready ? 'rgba(125,166,125,0.25)' : warm.colors.borderWhisper}`,
            borderRadius: 10,
            fontSize: 13,
        }}>
            <span style={{ color: warm.colors.textPrimary, fontWeight: 600 }}>{label}</span>
            <span style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: ready ? warm.colors.accentPetrol : warm.colors.textMuted,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
            }}>
                {ready ? (<><Check size={12} /> Draft saved</>) : 'Not generated'}
            </span>
        </div>
    );
}

// ── Button helpers ──────────────────────────────────────────────────────────

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: warm.colors.textMuted,
                background: 'transparent',
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 8,
                cursor: 'pointer',
            }}
        >
            {icon}
            {label}
        </button>
    );
}

function primaryButtonStyle(busy: boolean): React.CSSProperties {
    return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 18px',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color: warm.colors.textOnDeep,
        background: warm.colors.accentPetrol,
        border: 'none',
        borderRadius: 10,
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.7 : 1,
        boxShadow: warm.shadow.soft,
    };
}

function ghostButtonStyle(disabled: boolean): React.CSSProperties {
    return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 14px',
        fontSize: 12,
        fontWeight: 600,
        color: warm.colors.textMuted,
        background: 'transparent',
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
    };
}
