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
    ShieldCheck,
} from 'lucide-react';
import { DraftCritiquePanel, type CritiqueResult } from '../components/strategy/DraftCritiquePanel';
import { ApplyDeepLinkButton } from '../components/strategy/ApplyDeepLinkButton';
import ReactMarkdown from 'react-markdown';
import React from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import api from '../lib/api';
import { warm } from '../lib/theme/warmTokens';
import { GenerationProgress } from '../components/shared/GenerationProgress';

// ── Placeholder marker rendering ────────────────────────────────────────────
//
// The generator emits placeholder tokens (`[VERIFY: ...]`, `[ADD: ...]`,
// `[TBD]`, etc.) wherever it lacks confidence. Showing the literal bracket
// syntax inline is ugly; this helper rewrites them to a small gold chip with
// a rich hover/click popover explaining what the chip means and how the
// user prevents it next time (by adding the missing detail to their
// candidate profile). Raw markers stay in the stored content; on .docx /
// .pdf export they are stripped entirely by the shared sanitizer.

const VERIFY_MARKER_RE = /\[(?:VERIFY|Verify|verify|ADD|Add|INSERT|Insert|TBD|PLACEHOLDER)(?:[:\s]\s*([^\]]*))?\]/g;

/** Strip common AI-generation artifacts before rendering or storage. */
function sanitizeContent(raw: string): string {
    return raw
        // "NFP?" hallucination — the LLM sometimes leaks the sector abbreviation
        // before contact lines (e.g. "NFP?\n📞 +61...").
        .replace(/^NFP\?\s*/gm, '')
        .replace(/\bNFP\?\s*/g, '')
        .trim();
}

function VerifyMarker({ note }: { note: string }) {
    const [open, setOpen] = React.useState(false);
    const wrapperRef = React.useRef<HTMLSpanElement>(null);
    const [tipPos, setTipPos] = React.useState<{ top: number; left: number; arrowX: number } | null>(null);

    // Recalculate tooltip position whenever it opens or the window resizes/scrolls.
    React.useEffect(() => {
        if (!open || !wrapperRef.current) { setTipPos(null); return; }

        const TIP_WIDTH = 280;
        const MARGIN = 12;

        const recompute = () => {
            const el = wrapperRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            // Default: centred horizontally over the marker.
            const idealLeft = r.left + r.width / 2 - TIP_WIDTH / 2;
            // Clamp to viewport so we never get clipped by an overflow:hidden ancestor.
            const left = Math.max(MARGIN, Math.min(idealLeft, window.innerWidth - TIP_WIDTH - MARGIN));
            const top = r.top - 10; // tooltip sits above the marker; tooltip is anchored bottom-up via translateY(-100%)
            // Arrow follows the marker no matter where the tooltip clamped to.
            const arrowX = Math.max(12, Math.min(r.left + r.width / 2 - left, TIP_WIDTH - 12));
            setTipPos({ top, left, arrowX });
        };

        recompute();
        window.addEventListener('scroll', recompute, true);
        window.addEventListener('resize', recompute);
        return () => {
            window.removeEventListener('scroll', recompute, true);
            window.removeEventListener('resize', recompute);
        };
    }, [open]);

    return (
        <span
            ref={wrapperRef}
            style={{
                position: 'relative',
                display: 'inline-block',
                verticalAlign: 'baseline',
                marginInline: 2,
                lineHeight: 0,
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpen((v) => !v);
                    } else if (e.key === 'Escape') {
                        setOpen(false);
                    }
                }}
                aria-label={note ? `Placeholder: ${note}` : 'Placeholder'}
                aria-expanded={open}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    background: 'rgba(197,160,89,0.18)',
                    color: '#C5A059',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'help',
                    userSelect: 'none',
                    border: '1px solid rgba(197,160,89,0.32)',
                    lineHeight: 1,
                    verticalAlign: 'baseline',
                }}
            >
                !
            </span>

            {open && tipPos && createPortal(
                <span
                    role="tooltip"
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        top: tipPos.top,
                        left: tipPos.left,
                        transform: 'translateY(-100%)',
                        width: 280,
                        background: warm.colors.bgSurface,
                        border: `1px solid ${warm.colors.borderWhisper}`,
                        borderRadius: 12,
                        padding: '12px 14px 14px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
                        zIndex: 1000,
                        textAlign: 'left',
                        cursor: 'auto',
                        lineHeight: 1.55,
                        whiteSpace: 'normal',
                        display: 'block',
                    }}
                >
                    <span style={{
                        display: 'block',
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#C5A059',
                        marginBottom: 6,
                    }}>
                        Placeholder, needs filling in
                    </span>
                    {note && (
                        <span style={{
                            display: 'block',
                            fontSize: 12,
                            color: warm.colors.textPrimary,
                            fontStyle: 'italic',
                            marginBottom: 10,
                            background: 'rgba(197,160,89,0.06)',
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid rgba(197,160,89,0.18)',
                        }}>
                            "{note}"
                        </span>
                    )}
                    <span style={{ display: 'block', fontSize: 12, color: warm.colors.textMuted, marginBottom: 10 }}>
                        We added this because your profile didn't have the specific detail the role asked for. Adding it to your profile means future drafts use the real value instead of a placeholder.
                    </span>
                    <Link
                        to="/workspace"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#7DA67D',
                            textDecoration: 'underline',
                            textUnderlineOffset: 3,
                        }}
                    >
                        Open profile to add this →
                    </Link>
                    {/* Pointer arrow follows the marker even when the tooltip clamps to viewport edge */}
                    <span style={{
                        position: 'absolute',
                        top: '100%',
                        left: tipPos.arrowX,
                        transform: 'translateX(-50%)',
                        width: 0,
                        height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: `6px solid ${warm.colors.bgSurface}`,
                    }} />
                </span>,
                document.body,
            )}
        </span>
    );
}

function replaceVerifyMarkersInString(text: string): React.ReactNode {
    VERIFY_MARKER_RE.lastIndex = 0;
    const out: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = VERIFY_MARKER_RE.exec(text)) !== null) {
        if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index));
        out.push(<VerifyMarker key={`v-${match.index}`} note={(match[1] || '').trim()} />);
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) out.push(text.slice(lastIndex));
    return out.length > 0 ? <>{out}</> : text;
}

function processMarkers(children: React.ReactNode): React.ReactNode {
    return React.Children.map(children, (child) => {
        if (typeof child === 'string') return replaceVerifyMarkersInString(child);
        return child;
    });
}

const HEADING_COLOR: React.CSSProperties = { color: warm.colors.textPrimary };
const STRONG_COLOR: React.CSSProperties = { color: warm.colors.textPrimary, fontWeight: 700 };

const MARKDOWN_COMPONENTS = {
    p: ({ children }: { children?: React.ReactNode }) => <p>{processMarkers(children)}</p>,
    li: ({ children }: { children?: React.ReactNode }) => <li>{processMarkers(children)}</li>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong style={STRONG_COLOR}>{processMarkers(children)}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em>{processMarkers(children)}</em>,
    td: ({ children }: { children?: React.ReactNode }) => <td>{processMarkers(children)}</td>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1 style={HEADING_COLOR}>{processMarkers(children)}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 style={HEADING_COLOR}>{processMarkers(children)}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 style={HEADING_COLOR}>{processMarkers(children)}</h3>,
    h4: ({ children }: { children?: React.ReactNode }) => <h4 style={HEADING_COLOR}>{processMarkers(children)}</h4>,
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

    const state = (location.state ?? {}) as {
        jobDescription?: string;
        sc?: boolean;
        company?: string;
        role?: string;
        feedItemId?: string;
        sourceUrl?: string;
        sourcePlatform?: string;
    };
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

    const currentStep = steps[currentIndex];
    const isFinalStep = currentStep?.id === 'track';

    // No JD = nothing to do here. Send back to the hub.
    useEffect(() => {
        if (jdEmpty) navigate('/', { replace: true });
    }, [jdEmpty, navigate]);

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
                        onBack={currentIndex > 0 ? () => setCurrentIndex(currentIndex - 1) : null}
                        onContinue={() => setCurrentIndex(currentIndex + 1)}
                        isLast={currentIndex === steps.length - 1}
                    />
                )}
            </div>
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
    onBack,
    onContinue,
    isLast,
}: {
    stepId: GenerateType;
    workspaceKey: string;
    jobDescription: string;
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
    }, [workspaceKey, stepId, isSC, criteriaStorageKey]);

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
            const { data } = await api.post<{ content: string }>(`/generate/${stepId}`, payload);
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

    // Placeholder tokens — inserted by the generator wherever the AI lacks
    // confidence (job title gaps, fabricated metrics, etc.) and needs human
    // review. The regex catches the full set of variants the generator emits
    // across resume / cover letter / SC: VERIFY/Verify/verify, ADD/Add,
    // INSERT/Insert, TBD, PLACEHOLDER. Resume drafts use these interchangeably,
    // which is why the previous narrow `[VERIFY:` check missed them.
    // We warn on continue rather than block — calm-ally, not gatekeeper.
    const hasVerifyTokens = useMemo(
        () => /\[(?:VERIFY|Verify|verify|ADD|Add|INSERT|Insert|TBD|PLACEHOLDER)(?:[:\s][^\]]*)?\]/.test(content),
        [content],
    );

    const handleContinueWithVerifyCheck = () => {
        if (hasVerifyTokens) {
            const ok = confirm(
                'This draft still contains [VERIFY: ...] notes — spots where the AI flagged details for you to confirm or fill in before sending. Continue anyway?'
            );
            if (!ok) return;
        }
        onContinue();
    };

    const handleEditToggle = () => {
        if (editing) {
            // Save edits
            const trimmed = editBuffer.trim();
            if (trimmed.length > 0 && trimmed !== content) {
                setContent(trimmed);
                saveDraft(workspaceKey, stepId, {
                    content: trimmed,
                    generatedAt: new Date().toISOString(),
                    edited: true,
                });
                toast.success('Edits saved');
            }
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
                            <DownloadSplit
                                format={downloadFormat}
                                open={formatMenuOpen}
                                onToggleMenu={() => setFormatMenuOpen((v) => !v)}
                                onCloseMenu={() => setFormatMenuOpen(false)}
                                onDownload={() => handleDownload()}
                                onChoose={(f) => handleDownload(f)}
                            />
                        </>
                    )}
                </div>
            </header>

            {/* Cover letter educational note */}
            {stepId === 'cover-letter' && (
                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.6, fontStyle: 'italic' }}>
                    {coverLetterNote}
                </p>
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

                {generating ? (
                    <GenerationProgress docType={stepId === 'cover-letter' ? 'cover-letter' : stepId === 'selection-criteria' ? 'selection-criteria' : 'resume'} />
                ) : editing ? (
                    <textarea
                        value={editBuffer}
                        onChange={(e) => setEditBuffer(e.target.value)}
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
                                : 'Click Generate to draft this from your profile and the job description.'}
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

            {/* CTAs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {onBack && (
                        <button
                            onClick={onBack}
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
                    {!hasDraft && (
                        <button
                            onClick={() => generate(false)}
                            disabled={generating || (isSC && !hasCriteria)}
                            style={primaryButtonStyle(generating || (isSC && !hasCriteria))}
                            title={isSC && !hasCriteria ? 'Paste the selection criteria first' : undefined}
                        >
                            {generating ? (<><Loader2 size={14} className="animate-spin" /> Generating…</>) : (<>Generate<ArrowRight size={14} /></>)}
                        </button>
                    )}
                    {hasDraft && (
                        <button
                            onClick={handleContinueWithVerifyCheck}
                            disabled={generating}
                            style={primaryButtonStyle(generating)}
                            title={hasVerifyTokens ? 'This draft has unverified placeholders' : undefined}
                        >
                            {isLast ? 'Finish' : 'Save & continue'}
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
}: {
    format: 'docx' | 'pdf';
    open: boolean;
    onToggleMenu: () => void;
    onCloseMenu: () => void;
    onDownload: () => void;
    onChoose: (next: 'docx' | 'pdf') => void;
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
                {`.${format}`}
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
