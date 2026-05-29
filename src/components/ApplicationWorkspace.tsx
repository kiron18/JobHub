import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    FileText,
    Download,
    Database,
    Mail,
    List,
    RefreshCcw,
    PlusCircle,
    AlertCircle,
    BookOpen,
    FlaskConical,
    Loader2,
    Copy,
    CheckCircle,
    ExternalLink,
    ShieldAlert,
    X,
    Pencil,
    Sparkles,
    Briefcase,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Toaster, toast } from 'sonner';
import { AchievementSelector } from './AchievementSelector';
import { MissingFlag } from './MissingFlag';
import { AIRewriteBadge } from './AIRewriteBadge';
import { StrategistDebrief } from './StrategistDebrief';
import { CompanyResearchPanel } from './CompanyResearchPanel';
import type { CompanyResearch } from './CompanyResearchPanel';
import { CriteriaInputPanel } from './CriteriaInputPanel';
import { InterviewPrepView } from './InterviewPrepView';
import { JDSummaryBar } from './JDSummaryBar';
import { ToneRewritePanel } from './ToneRewritePanel';
import { CoverLetterPersonalisationPanel } from './CoverLetterPersonalisationPanel';
import { exportDocx } from '../lib/exportDocx';
import type { DocType } from '../lib/exportDocx';
import { trackDocumentGenerated, trackDocumentCopied } from '../lib/analytics';
import { exportPdf } from '../lib/exportPdf';
import { profileToMarkdown } from '../lib/profileToMarkdown';
import { profileToResumeData, type ProfileWithRelations } from '../lib/profileToResumeData';
import { ApplyContextBanner, type ApplyContext } from './ApplyContextBanner';
import { getPlatformConfig, getApplyInstructions } from '../lib/platforms';
import { DimensionsIsland } from './DimensionsIsland';
import type { DimensionScores, AustralianFlags } from './DimensionsIsland';
import { warm } from '../lib/theme/warmTokens';

interface WorkspaceState {
    jobDescription: string;
    rankedAchievements: any[];
    selectedAchievementIds: string[];
    isDrawerOpen: boolean;
    activeTab: 'resume' | 'cover-letter' | 'selection-criteria' | 'interview-prep';
    documents: {
        resume: string;
        'cover-letter': string;
        'selection-criteria': string;
        'interview-prep': string;
    };
    documentIds: {
        resume: string | null;
        'cover-letter': string | null;
        'selection-criteria': string | null;
        'interview-prep': string | null;
    };
    keywords?: string[];
    saveStatus: 'unsaved' | 'saving' | 'saved';
    isGenerating: boolean;
    hasFailed: {
        resume: boolean;
        'cover-letter': boolean;
        'selection-criteria': boolean;
        'interview-prep': boolean;
    };
    metadata?: {
        company: string;
        role: string;
    };
    analysisTone?: string;
    coreCompetencies?: string[];
    jobApplicationId?: string;
    requiresSelectionCriteria?: boolean;
    matchScore?: number;
    overallGrade?: string | null;
    dimensions?: Record<string, { score: number; grade: string; note: string }> | null;
    matchedIdentityCard?: string | null;
    australianFlags?: {
        apsLevel: string | null;
        requiresCitizenship: boolean;
        securityClearanceRequired: 'none' | 'baseline' | 'nv1' | 'nv2' | 'pv';
        salaryType: 'base' | 'trp' | 'unknown';
    } | null;
    blueprint?: any | null;
    profileViolations?: string[];
}

import { ProfileCompletion } from './ProfileCompletion';

/** Renders job description text with keyword terms highlighted */
const HighlightedJD: React.FC<{ text: string; keywords: string[] }> = ({ text, keywords }) => {
    if (!keywords.length) return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;

    const escaped = [...keywords]
        .sort((a, b) => b.length - a.length)
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

    const parts = text.split(pattern);
    return (
        <span style={{ whiteSpace: 'pre-wrap' }}>
            {parts.map((part, i) =>
                keywords.some(k => k.toLowerCase() === part.toLowerCase())
                    ? <mark key={i} style={{ background: 'rgba(45,90,110,0.20)', color: warm.colors.accentPetrol, borderRadius: 2, padding: '0 2px' }}>{part}</mark>
                    : part
            )}
        </span>
    );
};


export const ApplicationWorkspace: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const initialState = location.state as {
        jobDescription: string;
        analysis: any;
        initialTab?: string;
    };

    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const res = await api.get('/profile');
            return res.data;
        }
    });

    const [state, setState] = useState<WorkspaceState>(() => {
        const savedJD = localStorage.getItem('jobhub_current_jd');
        const savedAnalysisStr = localStorage.getItem('jobhub_current_analysis');
        const savedAnalysis = savedAnalysisStr ? JSON.parse(savedAnalysisStr) : null;
        const savedActiveTab = localStorage.getItem('jobhub_current_tab') as any;
        const savedDocsStr = localStorage.getItem('jobhub_current_docs');
        const savedDocs = savedDocsStr ? JSON.parse(savedDocsStr) : { resume: '', 'cover-letter': '', 'selection-criteria': '', 'interview-prep': '' };
        const savedDocIdsStr = localStorage.getItem('jobhub_current_docids');
        const savedDocIds = savedDocIdsStr ? JSON.parse(savedDocIdsStr) : { resume: null, 'cover-letter': null, 'selection-criteria': null, 'interview-prep': null };

        const currentJD = initialState?.jobDescription || savedJD || '';
        const currentAnalysis = initialState?.analysis || savedAnalysis || {};
        const currentTab = initialState?.initialTab || savedActiveTab || 'resume';

        const useStoredDocs = !initialState?.analysis;

        return {
            jobDescription: currentJD,
            rankedAchievements: currentAnalysis.rankedAchievements || [],
            selectedAchievementIds: (currentAnalysis.rankedAchievements || [])
                .filter((a: any) => a.tier === 'STRONG')
                .map((a: any) => a.id),
            isDrawerOpen: false,
            activeTab: currentTab,
            documents: useStoredDocs ? savedDocs : { resume: '', 'cover-letter': '', 'selection-criteria': '', 'interview-prep': '' },
            documentIds: useStoredDocs ? savedDocIds : { resume: null, 'cover-letter': null, 'selection-criteria': null, 'interview-prep': null },
            saveStatus: 'saved',
            isGenerating: false,
            hasFailed: { resume: false, 'cover-letter': false, 'selection-criteria': false, 'interview-prep': false },
            metadata: currentAnalysis.extractedMetadata,
            analysisTone: currentAnalysis.analysisTone,
            coreCompetencies: currentAnalysis.coreCompetencies,
            jobApplicationId: currentAnalysis.jobApplicationId,
            requiresSelectionCriteria: currentAnalysis.requiresSelectionCriteria,
            matchScore: currentAnalysis.matchScore,
            overallGrade: currentAnalysis.overallGrade ?? null,
            dimensions: currentAnalysis.dimensions ?? null,
            matchedIdentityCard: currentAnalysis.matchedIdentityCard ?? null,
            australianFlags: currentAnalysis.australianFlags ?? null,
            keywords: currentAnalysis.keywords || [],
            blueprint: null
        } as any;
    });

    // Sync state to localStorage for persistence across refreshes
    useEffect(() => {
        localStorage.setItem('jobhub_current_jd', state.jobDescription);
        localStorage.setItem('jobhub_current_tab', state.activeTab);
        localStorage.setItem('jobhub_current_docs', JSON.stringify(state.documents));
        localStorage.setItem('jobhub_current_docids', JSON.stringify(state.documentIds));

        const currentAnalysis = {
            rankedAchievements: state.rankedAchievements,
            extractedMetadata: state.metadata,
            analysisTone: state.analysisTone,
            coreCompetencies: state.coreCompetencies,
            jobApplicationId: state.jobApplicationId,
            matchScore: state.matchScore,
            keywords: state.keywords
        };
        localStorage.setItem('jobhub_current_analysis', JSON.stringify(currentAnalysis));
    }, [state.jobDescription, state.activeTab, state.documents, state.documentIds, state.metadata, state.jobApplicationId]);


    const [isEditing, setIsEditing] = useState(false);
    const [isConfirmingRegen, setIsConfirmingRegen] = useState(false);
    const [violationsBannerDismissed, setViolationsBannerDismissed] = useState(false);
    const [violationsExpanded, setViolationsExpanded] = useState(false);
    const [coachingExpanded, setCoachingExpanded] = useState(false);
    const [scBannerDismissed, setScBannerDismissed] = useState(false);
    const [regenerateFeedback, setRegenerateFeedback] = useState('');
    const [rateLimitError, setRateLimitError] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [showDownloadReminder, setShowDownloadReminder] = useState(false);
    const [pendingDownloadFn, setPendingDownloadFn] = useState<(() => void) | null>(null);
    const [companyResearch, setCompanyResearch] = useState<CompanyResearch | null>(null);
    const [selectionCriteriaText, setSelectionCriteriaText] = useState('');
    const [extractedCriteria, setExtractedCriteria] = useState<string[]>([]);
    const [employerFramework, setEmployerFramework] = useState<string | null>(null);

    const [applyContext, setApplyContext] = useState<ApplyContext | null>(() => {
        try {
            const raw = localStorage.getItem('jobhub_apply_context');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });
    const [markingApplied, setMarkingApplied] = useState(false);

    const handleDismissApplyContext = () => {
        localStorage.removeItem('jobhub_apply_context');
        setApplyContext(null);
    };

    const handleMarkApplied = async () => {
        if (!applyContext || markingApplied) return;
        setMarkingApplied(true);
        try {
            await api.post(`/job-feed/${applyContext.jobId}/mark-applied`);
            localStorage.removeItem('jobhub_apply_context');
            setApplyContext(null);
            toast.success('Marked as Applied in your tracker');
        } catch {
            toast.error('Could not update tracker, please mark it manually');
        } finally {
            setMarkingApplied(false);
        }
    };

    const [academicDocs, setAcademicDocs] = useState<{ 'teaching-philosophy': string; 'research-statement': string }>({
        'teaching-philosophy': '',
        'research-statement': '',
    });
    const [generatingAcademic, setGeneratingAcademic] = useState<'teaching-philosophy' | 'research-statement' | null>(null);
    const [academicViewerType, setAcademicViewerType] = useState<'teaching-philosophy' | 'research-statement' | null>(null);

    const [trackerAdded, setTrackerAdded] = useState(false);
    const [trackerAdding, setTrackerAdding] = useState(false);

    const handleNewApplication = () => {
        ['jobhub_current_jd', 'jobhub_current_analysis', 'jobhub_current_docs', 'jobhub_current_docids', 'jobhub_current_tab'].forEach(k => localStorage.removeItem(k));
        setTrackerAdded(false);
        setTrackerAdding(false);
        navigate('/');
    };

    const handleAddToTracker = async () => {
        if (trackerAdding || trackerAdded) return;
        const title = state.metadata?.role ?? 'Job Application';
        const company = state.metadata?.company ?? 'Unknown';
        setTrackerAdding(true);
        try {
            await api.post('/jobs', {
                title,
                company,
                status: 'APPLIED',
                dateApplied: new Date().toISOString().split('T')[0],
            });
            setTrackerAdded(true);
        } catch {
            // silent, not critical
        } finally {
            setTrackerAdding(false);
        }
    };

    const [coverLetterTone, setCoverLetterTone] = useState<'professional' | 'warm' | 'concise'>('professional');

    const [emailVersion, setEmailVersion] = useState<{ emailSubject: string; emailBody: string } | null>(null);
    const [generatingEmail, setGeneratingEmail] = useState(false);
    const [copiedEmailField, setCopiedEmailField] = useState<'subject' | 'body' | null>(null);

    useEffect(() => {
        if (state.activeTab !== 'selection-criteria') return;
        if (employerFramework) return;
        if (!state.metadata?.company && !state.jobDescription) return;

        const detect = async () => {
            try {
                const { data } = await api.post('/research/employer-framework', {
                    company: state.metadata?.company || '',
                    jobDescription: state.jobDescription.slice(0, 800),
                });
                if (data.framework) setEmployerFramework(data.framework);
            } catch {
                // Silent
            }
        };
        detect();
    }, [state.activeTab, state.metadata?.company]);

    useEffect(() => {
        const currentDoc = state.documents[state.activeTab];
        const currentDocId = state.documentIds[state.activeTab];

        if (state.jobApplicationId && !currentDoc && !currentDocId && !state.isGenerating && !isFetchingDocs) {
            setIsFetchingDocs(true);
            const fetchDocs = async () => {
                try {
                    const { data: jobs } = await api.get('/jobs');
                    const currentJob = jobs.find((j: any) => j.id === state.jobApplicationId);
                    if (currentJob && currentJob.documents) {
                        const docsMatch: any = {};
                        const idsMatch: any = {};

                        currentJob.documents.forEach((d: any) => {
                            let type: 'resume' | 'cover-letter' | 'selection-criteria' = 'resume';
                            if (d.type === 'COVER_LETTER') type = 'cover-letter';
                            if (d.type === 'STAR_RESPONSE') type = 'selection-criteria';

                            docsMatch[type] = d.content;
                            idsMatch[type] = d.id;
                        });

                        setState(prev => ({
                            ...prev,
                            documents: { ...prev.documents, ...docsMatch },
                            documentIds: { ...prev.documentIds, ...idsMatch }
                        }));
                    }
                } catch (e) {
                    console.error('Failed to fetch existing documents:', e);
                } finally {
                    setIsFetchingDocs(false);
                }
            };
            fetchDocs();
        }
    }, [state.jobApplicationId, state.activeTab, state.documents, state.documentIds, state.isGenerating]);


    useEffect(() => {
        if (!state.jobDescription) {
            navigate('/');
        }
    }, [state.jobDescription, navigate]);

    const handleUpdateContent = (content: string) => {
        setState(prev => ({
            ...prev,
            documents: {
                ...prev.documents,
                [prev.activeTab]: content
            },
            saveStatus: 'unsaved'
        }));
    };

    const handleRemoveFlag = (flagText: string) => {
        const currentContent = state.documents[state.activeTab];
        const label = flagText.replace('[MISSING:', '').replace(']', '').trim();
        const newContent = currentContent.replace(flagText, label);
        handleUpdateContent(newContent);
    };

    const handleAddToProfile = async (label: string) => {
        try {
            console.log('Adding to profile:', label);
            await api.post('/achievements', {
                description: label,
                title: 'Discovered Achievement'
            });
        } catch (error) {
            console.error('Failed to add to profile:', error);
        }
    };

    const executeDownload = async (content: string) => {
        const candidateName = profile?.name || '';
        const jobTitle = state.metadata?.role || '';
        const company = state.metadata?.company || '';

        try {
            await exportDocx(content, state.activeTab as DocType, candidateName, jobTitle, company);
            toast.success('Downloaded as Word document (.docx)');
        } catch (docxError) {
            console.warn('[Download] DOCX export failed, falling back to print:', docxError);
            const companyName = state.metadata?.company?.replace(/\s+/g, '_') || 'document';
            const filename = `${state.activeTab}-${companyName}`;
            const articleEl = document.getElementById('resume-preview-content');
            if (articleEl) {
                const printWindow = window.open('', '_blank', 'width=900,height=1100');
                if (printWindow) {
                    printWindow.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${filename}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 32px 40px; font-size: 10.5pt; line-height: 1.45; color: #111; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 18pt; font-weight: 700; margin-bottom: 2px; }
    h2 { font-size: 10pt; font-weight: 700; border-bottom: 1px solid #333; padding-bottom: 2px; margin: 12px 0 4px; text-transform: uppercase; letter-spacing: 0.06em; }
    h3 { font-size: 10.5pt; font-weight: 700; margin: 6px 0 1px; }
    p { margin: 2px 0; display: block; }
    ul { padding-left: 16px; margin: 2px 0 4px; list-style-type: disc; }
    li { margin: 1px 0; line-height: 1.4; display: list-item; }
    strong { font-weight: 700; }
    em { font-style: italic; color: inherit; }
    hr { border: none; border-top: 1px solid #ccc; margin: 6px 0; }
    [data-missing-flag] { background: #fef3c7; padding: 1px 5px; border-radius: 3px; font-size: 9pt; font-weight: 700; }
    @media print { @page { margin: 12mm 15mm; } body { padding: 0; } }
  </style>
</head><body>${articleEl.innerHTML}</body></html>`);
                    printWindow.document.close();
                    setTimeout(() => { printWindow.focus(); printWindow.print(); }, 300);
                }
            }
        }
    };

    const executePdfDownload = async () => {
        const content = resolvedContent;
        if (!content) return;
        setExportingPdf(true);
        try {
            const candidateName = profile?.name || '';
            const jobTitle = state.metadata?.role || '';
            const company = state.metadata?.company || '';
            await exportPdf(content, state.activeTab as DocType, candidateName, jobTitle, company);
            toast.success('Downloaded as PDF');
        } catch (err) {
            console.error('[PDF Export] failed:', err);
            toast.error('PDF export failed - try .docx instead');
        } finally {
            setExportingPdf(false);
        }
    };

    const handleDownloadPdf = () => {
        const content = resolvedContent;
        if (!content) return;
        triggerDownloadWithReminder(() => executePdfDownload());
    };

    const triggerDownloadWithReminder = (downloadFn: () => void) => {
        if (localStorage.getItem('jobhub_skip_download_reminder') === '1') {
            downloadFn();
        } else {
            setPendingDownloadFn(() => downloadFn);
            setShowDownloadReminder(true);
        }
    };

    const handleDownload = async () => {
        const content = resolvedContent;
        if (!content) return;

        if (content.includes('[MISSING:')) {
            const count = (content.match(/\[MISSING:/g) || []).length;
            toast.info(`${count} gap${count > 1 ? 's' : ''} still to fill`, {
                description: "Click the amber tags in your document to add the missing information.",
                action: {
                    label: "Show me",
                    onClick: () => {
                        const firstFlag = document.querySelector('[data-missing-flag="true"]');
                        if (firstFlag) firstFlag.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                },
                duration: 5000
            });
        }

        triggerDownloadWithReminder(() => executeDownload(content));
    };

    // Fire process:saved once both core docs (resume + cover letter) exist in
    // the library. Per the process-strip flow: "Save" represents the user
    // having both tailored documents ready — no manual save click required.
    useEffect(() => {
        const resume = state.documents['resume'];
        const coverLetter = state.documents['cover-letter'];
        if (resume && coverLetter) {
            window.dispatchEvent(new CustomEvent('process:saved'));
        }
    }, [state.documents]);

    // Auto-save logic — process:saved is dispatched on successful auto-save above.
    // The download (.docx) button below serves as the "save" action for the strip.
    useEffect(() => {
        const documentId = state.documentIds[state.activeTab];
        const content = state.documents[state.activeTab];

        if (!documentId || !content || state.saveStatus !== 'unsaved') return;

        const timer = setTimeout(async () => {
            setState(prev => ({ ...prev, saveStatus: 'saving' }));
            try {
                await api.patch(`/documents/${documentId}`, {
                    content
                });
                setState(prev => ({ ...prev, saveStatus: 'saved' }));
                window.dispatchEvent(new CustomEvent('process:saved'));
            } catch (error) {
                console.error('Auto-save failed:', error);
                setState(prev => ({ ...prev, saveStatus: 'unsaved' }));
                toast.error("Auto-save failed");
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [state.documents, state.activeTab, state.documentIds, state.saveStatus]);

    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [isFetchingDocs, setIsFetchingDocs] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    const handleGenerate = async (type: WorkspaceState['activeTab'], regenerate = false) => {
        if (state.hasFailed[type] && !regenerate) return;
        if (type === 'selection-criteria' && selectionCriteriaText.trim().length < 20) return;

        const controller = new AbortController();
        setAbortController(controller);
        setRateLimitError(false);

        setViolationsBannerDismissed(false);
        setState(prev => ({ ...prev, isGenerating: true }));
        try {
            const { data } = await api.post(type === 'cover-letter' ? '/generate/cover-letter-structured' : `/generate/${type}`, {
                jobDescription: state.jobDescription,
                selectedAchievementIds: state.selectedAchievementIds,
                regenerate,
                jobApplicationId: state.jobApplicationId,
                analysisContext: {
                    tone: type === 'cover-letter'
                        ? (coverLetterTone === 'warm'
                            ? 'Warm, genuine, values-driven. Conversational but professional.'
                            : coverLetterTone === 'concise'
                            ? 'Extremely concise and direct. Minimal words, maximum impact. Results-focused.'
                            : state.analysisTone || 'Professional, polished, direct.')
                        : state.analysisTone,
                    competencies: state.coreCompetencies,
                    regenerateFeedback: regenerate && regenerateFeedback.trim() ? regenerateFeedback.trim() : undefined,
                },
                companyResearch: type === 'cover-letter' ? companyResearch : null,
                selectionCriteriaText: type === 'selection-criteria'
                    ? (extractedCriteria.length > 0
                        ? extractedCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
                        : selectionCriteriaText)
                    : null,
                employerFramework: type === 'selection-criteria' ? employerFramework : null,
            }, { signal: controller.signal });
            trackDocumentGenerated(type, regenerate);
            setState(prev => ({
                ...prev,
                documents: {
                    ...prev.documents,
                    [type]: data.content
                },
                documentIds: {
                    ...prev.documentIds,
                    [type]: data.id
                },
                hasFailed: {
                    ...prev.hasFailed,
                    [type]: false
                },
                saveStatus: 'saved',
                isGenerating: false,
                blueprint: data.blueprint ?? prev.blueprint,
                profileViolations: data.profileViolations ?? []
            }));
            setIsConfirmingRegen(false);
            setIsEditing(false);
            setRegenerateFeedback('');
            window.dispatchEvent(new CustomEvent('process:tailored'));
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') {
                return;
            }
            if (err?.response?.status === 429) {
                setRateLimitError(true);
                setState(prev => ({ ...prev, isGenerating: false }));
                return;
            }
            if (err?.response?.status === 402) {
                setState(prev => ({ ...prev, isGenerating: false, hasFailed: { ...prev.hasFailed, [type]: true } }));
                setShowUpgradeModal(true);
                return;
            }
            console.error('Generation failed:', err);
            toast.error(`Failed to generate ${type}`);
            setState(prev => ({
                ...prev,
                hasFailed: {
                    ...prev.hasFailed,
                    [type]: true
                }
            }));
        } finally {
            setState(prev => ({ ...prev, isGenerating: false }));
            setAbortController(null);
        }
    };

    const handleStopGeneration = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setState(prev => ({ ...prev, isGenerating: false }));
            toast.info("Generation stopped");
        }
    };

    useEffect(() => {
        const hasDoc = !!state.documents[state.activeTab];
        const hasDocId = !!state.documentIds[state.activeTab];

        if (state.activeTab === 'selection-criteria') return;

        if (state.jobDescription && !hasDoc && !hasDocId && !state.isGenerating && !isFetchingDocs && !state.hasFailed[state.activeTab]) {
            handleGenerate(state.activeTab);
        }
    }, [state.activeTab, state.jobDescription, state.documents, state.documentIds, state.isGenerating, state.hasFailed, isFetchingDocs]);


    const handleGenerateAcademic = async (docType: 'teaching-philosophy' | 'research-statement') => {
        if (generatingAcademic) return;
        setGeneratingAcademic(docType);
        setAcademicViewerType(docType);
        try {
            const { data } = await api.post(`/generate/${docType}`, {
                jobDescription: state.jobDescription,
                selectedAchievementIds: state.selectedAchievementIds,
                jobApplicationId: state.jobApplicationId,
                analysisContext: { tone: state.analysisTone, competencies: state.coreCompetencies },
                employerFramework,
            });
            setAcademicDocs(prev => ({ ...prev, [docType]: data.content }));
            toast.success(`${docType === 'teaching-philosophy' ? 'Teaching Philosophy' : 'Research Statement'} generated`);
        } catch {
            toast.error('Generation failed, try again.');
        } finally {
            setGeneratingAcademic(null);
        }
    };

    const handleGetEmailVersion = async () => {
        const coverLetterContent = state.documents['cover-letter'];
        if (!coverLetterContent || generatingEmail) return;
        setGeneratingEmail(true);
        try {
            const { data } = await api.post('/analyze/email-cover-letter', {
                coverLetterContent,
                role: state.metadata?.role,
                company: state.metadata?.company,
                candidateName: profile?.name,
            });
            setEmailVersion(data);
        } catch {
            toast.error('Could not generate email version, try again.');
        } finally {
            setGeneratingEmail(false);
        }
    };

    const copyEmailField = async (field: 'subject' | 'body') => {
        if (!emailVersion) return;
        await navigator.clipboard.writeText(field === 'subject' ? emailVersion.emailSubject : emailVersion.emailBody);
        trackDocumentCopied(`email-cover-letter-${field}`);
        setCopiedEmailField(field);
        setTimeout(() => setCopiedEmailField(null), 1800);
    };

    const handleBack = () => navigate('/');

    const backLabel = (() => {
        const raw = state.metadata?.role;
        if (!raw) return 'Back to Dashboard';
        return raw.length > 20 ? raw.slice(0, 20).trimEnd() + '…' : raw;
    })();

    const resolvedContent = useMemo(() => {
        if (state.activeTab !== 'resume') return state.documents[state.activeTab] || '';
        return state.documents['resume']
            || (profile ? profileToMarkdown(profileToResumeData(profile as ProfileWithRelations)) : '');
    }, [state.activeTab, state.documents, profile]);

    const parseVerifyTokens = useCallback((markdown: string): { pills: string[]; stripped: string } => {
        const pills: string[] = [];
        const stripped = markdown.replace(/\[VERIFY:\s*([^\]]+)\]/g, (_match, text) => {
            pills.push(text.trim());
            return '';
        });
        return { pills, stripped };
    }, []);

    const getCoachingMessage = (text: string): string => {
        const lower = text.toLowerCase();
        if (lower.includes('job title') || lower.includes('title')) {
            return 'Exact job titles help ATS systems match your application, a wrong title can cost you the filter.';
        }
        if (lower.includes('number') || lower.includes('team size') || lower.includes('people') || /\d/.test(lower)) {
            return 'Specific numbers make achievements credible. Hiring managers mentally assign you scope based on team size.';
        }
        if (lower.includes('company') || lower.includes('company name') || lower.includes('organisation')) {
            return 'Company-specific details show you\'ve done your homework and aren\'t copy-pasting applications.';
        }
        return 'Verifying this detail makes your application more credible and harder to dismiss.';
    };

    const scrollToVerify = (text: string) => {
        if (!previewRef.current) return;
        const walker = document.createTreeWalker(previewRef.current, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
            if (node.textContent && node.textContent.toLowerCase().includes(text.toLowerCase().slice(0, 15))) {
                (node.parentElement as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }
    };

    const normaliseMarkdown = (md: string): string => {
        let out = md;
        out = out.replace(
            /([^\n])\n(\*\*(Technical Skills|Industry Knowledge|Soft Skills):\*\*)/g,
            '$1\n\n$2'
        );
        if (state.activeTab === 'cover-letter') {
            out = out.replace(/\n{3,}/g, '\n\n');
            out = out.replace(/([^\n])\n([^\n])/g, '$1\n\n$2');
        }
        return out;
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            background: warm.colors.bgCanvas,
            color: warm.colors.textPrimary,
        }}>
            <Toaster position="top-center" richColors />

            {/* Download reminder modal */}
            <AnimatePresence>
                {showDownloadReminder && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowDownloadReminder(false)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 200,
                            background: 'rgba(26, 24, 20, 0.36)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.94, opacity: 0, y: 12 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.94, opacity: 0, y: 12 }}
                            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: 448,
                                background: warm.colors.bgSurface,
                                border: `1px solid ${warm.colors.borderDefined}`,
                                borderRadius: 16, boxShadow: warm.shadow.lifted, padding: 28,
                            }}
                        >
                            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: warm.colors.textPrimary, letterSpacing: '-0.01em' }}>Before you send this</h3>
                            <p style={{ margin: '0 0 4px', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                                Read through your document carefully before submitting. AI-generated content can contain errors, wrong dates, or details that don't reflect your actual experience.
                            </p>
                            <p style={{ margin: '0 0 24px', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                                A 2-minute review can be the difference between an interview and a rejection.
                            </p>
                            <button
                                onClick={() => {
                                    setShowDownloadReminder(false);
                                    pendingDownloadFn?.();
                                    setPendingDownloadFn(null);
                                }}
                                style={{
                                    width: '100%', padding: '12px 0', borderRadius: 12,
                                    fontWeight: 800, fontSize: 13, color: '#FFFFFF',
                                    background: warm.colors.accentPetrol, border: 'none',
                                    cursor: 'pointer', marginBottom: 12,
                                }}
                            >
                                I'll review it, download
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.setItem('jobhub_skip_download_reminder', '1');
                                    setShowDownloadReminder(false);
                                    pendingDownloadFn?.();
                                    setPendingDownloadFn(null);
                                }}
                                style={{
                                    width: '100%', padding: '8px 0', fontSize: 12, fontWeight: 700,
                                    color: warm.colors.textMuted, background: 'transparent',
                                    border: 'none', cursor: 'pointer',
                                }}
                            >
                                Don't remind me again
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <header style={{
                height: 64, borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                background: warm.colors.bgSurface,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 24px', flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={handleBack}
                        aria-label={`Back to ${backLabel}`}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: warm.colors.textMuted, borderRadius: 8,
                        }}
                    >
                        <ChevronLeft size={16} className="shrink-0" />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'none' }} className="sm:block">
                            {backLabel}
                        </span>
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                            {state.metadata?.role || 'New Application'}
                        </h1>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {state.metadata?.company || 'Drafting Workspace'}
                        </p>
                    </div>
                </div>

                <div style={{
                    display: 'flex', background: warm.colors.bgAlt, padding: 4,
                    borderRadius: 12, border: `1px solid ${warm.colors.borderWhisper}`,
                }}>
                    {(['resume', 'cover-letter', 'selection-criteria', 'interview-prep'] as const)
                        .map(tab => {
                        const active = state.activeTab === tab;
                        return (
                        <button
                            key={tab}
                            onClick={() => setState(prev => ({ ...prev, activeTab: tab }))}
                            style={{
                                padding: '5px 16px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: 8,
                                transition: 'all 0.15s',
                                color: active ? '#FFFFFF' : warm.colors.textMuted,
                                background: active ? warm.colors.accentPetrol : 'transparent',
                                border: 'none', cursor: 'pointer',
                                boxShadow: active ? '0 1px 3px rgba(45,90,110,0.20)' : 'none',
                            }}
                        >
                            {tab === 'resume' && <FileText size={14} />}
                            {tab === 'cover-letter' && <Mail size={14} />}
                            {tab === 'selection-criteria' && <List size={14} />}
                            {tab === 'interview-prep' && <ChevronRight size={14} />}
                            <span>{tab === 'interview-prep' ? 'Interview Prep' : tab === 'selection-criteria' ? 'Selection Criteria' : tab === 'cover-letter' ? 'Cover Letter' : 'Resume'}</span>
                            {tab === 'selection-criteria' && state.requiresSelectionCriteria && (
                                <span style={{
                                    display: 'inline-flex', width: 6, height: 6, borderRadius: '50%',
                                    background: warm.colors.accentGold,
                                }} title="This job requires selection criteria" />
                            )}
                        </button>
                    )})}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    {profile?.completion && (
                        <ProfileCompletion
                            completion={profile.completion}
                            variant="compact"
                            size="sm"
                        />
                    )}

                    <button
                        onClick={() => setState(prev => ({ ...prev, isDrawerOpen: true }))}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px',
                            background: warm.colors.bgAlt, color: warm.colors.textSecondary,
                            fontSize: 11, fontWeight: 700, borderRadius: 8,
                            border: `1px solid ${warm.colors.borderWhisper}`, cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        <Database size={14} />
                        Choose Achievements
                    </button>
                    <button
                        data-process-step="save"
                        onClick={handleDownload}
                        disabled={state.isGenerating || !state.documents[state.activeTab as keyof typeof state.documents]}
                        aria-label="Export document as Word"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                            background: warm.colors.success, color: '#FFFFFF',
                            fontSize: 11, fontWeight: 700, borderRadius: 8,
                            border: 'none', cursor: state.isGenerating ? 'not-allowed' : 'pointer',
                            opacity: state.isGenerating ? 0.5 : 1,
                            boxShadow: '0 1px 3px rgba(42,157,111,0.20)',
                        }}
                    >
                        <Download size={12} />
                        .docx
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        disabled={exportingPdf}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                            background: warm.colors.danger, color: '#FFFFFF',
                            fontSize: 11, fontWeight: 700, borderRadius: 8,
                            border: 'none', cursor: exportingPdf ? 'not-allowed' : 'pointer',
                            opacity: exportingPdf ? 0.5 : 1,
                            boxShadow: '0 1px 3px rgba(184,92,92,0.20)',
                        }}
                    >
                        {exportingPdf ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                        .pdf
                    </button>
                </div>
            </header>

            {profile?.completion && !profile.completion.isReady && (
                <div style={{
                    background: 'rgba(197,160,89,0.10)',
                    borderBottom: '1px solid rgba(197,160,89,0.20)',
                    padding: '6px 24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: warm.colors.accentGold, fontSize: 12, fontWeight: 500 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: warm.colors.accentGold }} />
                        <span>Profile Incomplete: Generated content may require heavy manual editing.</span>
                    </div>
                    <button
                        onClick={() => navigate('/workspace')}
                        style={{
                            fontSize: 10, fontWeight: 700, color: warm.colors.accentGold,
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}
                    >
                        Fix Profile →
                    </button>
                </div>
            )}

            <ApplyContextBanner context={applyContext} onDismiss={handleDismissApplyContext} />

            <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <aside style={{
                    width: '33.333%', borderRight: `1px solid ${warm.colors.borderWhisper}`,
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                    {/* Cover letter: tone selector + research panel */}
                    {state.activeTab === 'cover-letter' && (
                        <div style={{
                            padding: 16, borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                            flexShrink: 0, overflowY: 'auto', maxHeight: '55%',
                        }} className="custom-scrollbar">
                            {/* Tone selector */}
                            <div style={{
                                borderRadius: 12, border: `1px solid ${warm.colors.borderWhisper}`,
                                overflow: 'hidden', marginBottom: 16,
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '10px 16px', borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                                }}>
                                    <Mail size={13} style={{ color: warm.colors.accentPetrol }} />
                                    <span style={{ fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tone</span>
                                </div>
                                <div style={{ display: 'flex', padding: 6, gap: 4 }}>
                                    {(['professional', 'warm', 'concise'] as const).map(t => {
                                        const active = coverLetterTone === t;
                                        return (
                                            <button
                                                key={t}
                                                onClick={() => setCoverLetterTone(t)}
                                                style={{
                                                    flex: 1, padding: '5px 0', borderRadius: 8, fontSize: 10, fontWeight: 800,
                                                    textTransform: 'uppercase', letterSpacing: '0.06em',
                                                    transition: 'all 0.15s', cursor: 'pointer',
                                                    background: active ? warm.colors.accentPetrol : 'transparent',
                                                    color: active ? '#FFFFFF' : warm.colors.textMuted,
                                                    border: active ? 'none' : `1px solid ${warm.colors.borderWhisper}`,
                                                    boxShadow: active ? '0 1px 3px rgba(45,90,110,0.20)' : 'none',
                                                }}
                                            >
                                                {t}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {state.metadata?.company && (
                                <CompanyResearchPanel
                                    company={state.metadata.company}
                                    role={state.metadata.role || ''}
                                    jdText={state.jobDescription}
                                    research={companyResearch}
                                    onResearchUpdate={setCompanyResearch}
                                />
                            )}
                        </div>
                    )}

                    {/* SC tab: criteria input panel */}
                    {state.activeTab === 'selection-criteria' && (
                        <div style={{
                            padding: 16, borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                            flexShrink: 0, overflowY: 'auto', maxHeight: '55%',
                        }} className="custom-scrollbar">
                            {state.requiresSelectionCriteria && !selectionCriteriaText.trim() && (
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                    background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.20)',
                                    borderRadius: 12, padding: '10px 14px', marginBottom: 12,
                                }}>
                                    <AlertCircle size={13} style={{ color: warm.colors.accentGold, marginTop: 2, flexShrink: 0 }} />
                                    <p style={{ margin: 0, fontSize: 12, color: warm.colors.accentGold, lineHeight: 1.5 }}>
                                        This job requires selection criteria responses. Paste the criteria below to generate targeted STAR responses for each criterion.
                                    </p>
                                </div>
                            )}
                            <CriteriaInputPanel
                                criteriaText={selectionCriteriaText}
                                onChange={text => { setSelectionCriteriaText(text); setExtractedCriteria([]); }}
                                onExtracted={setExtractedCriteria}
                                company={state.metadata?.company}
                                employerFramework={employerFramework}
                            />
                            <button
                                disabled={selectionCriteriaText.trim().length < 20 || state.isGenerating}
                                onClick={() => {
                                    setState(s => ({
                                        ...s,
                                        documents: { ...s.documents, 'selection-criteria': '' },
                                        documentIds: { ...s.documentIds, 'selection-criteria': null },
                                        hasFailed: { ...s.hasFailed, 'selection-criteria': false },
                                    }));
                                    handleGenerate('selection-criteria');
                                }}
                                style={{
                                    width: '100%', marginTop: 8, padding: '10px 0',
                                    background: selectionCriteriaText.trim().length < 20 || state.isGenerating ? 'rgba(124,108,181,0.4)' : '#7C6CB5',
                                    color: '#FFFFFF', fontSize: 12, fontWeight: 700,
                                    borderRadius: 12, border: 'none', cursor: selectionCriteriaText.trim().length < 20 || state.isGenerating ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    opacity: selectionCriteriaText.trim().length < 20 || state.isGenerating ? 0.4 : 1,
                                }}
                            >
                                <List size={14} />
                                Generate SC Responses
                            </button>
                        </div>
                    )}


                    {/* Academic Toolkit, shown for university framework */}
                    {(employerFramework === 'university_academic' || employerFramework === 'university_professional') && (
                        <div style={{ padding: 16, borderBottom: `1px solid ${warm.colors.borderWhisper}`, flexShrink: 0 }}>
                            <div style={{
                                borderRadius: 12, border: '1px solid rgba(197,160,89,0.20)',
                                background: 'rgba(197,160,89,0.05)', overflow: 'hidden',
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '10px 16px', borderBottom: '1px solid rgba(197,160,89,0.15)',
                                }}>
                                    <BookOpen size={13} style={{ color: warm.colors.accentGold }} />
                                    <span style={{ fontSize: 10, fontWeight: 800, color: warm.colors.accentGold, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Academic Toolkit</span>
                                </div>
                                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <p style={{ margin: 0, fontSize: 10, color: warm.colors.textSecondary, lineHeight: 1.5 }}>
                                        University positions typically require academic-specific documents beyond the standard application set.
                                    </p>
                                    <button
                                        onClick={() => handleGenerateAcademic('teaching-philosophy')}
                                        disabled={!!generatingAcademic}
                                        style={{
                                            width: '100%', padding: '8px 0',
                                            background: 'rgba(197,160,89,0.20)', color: warm.colors.accentGold,
                                            fontSize: 11, fontWeight: 700, borderRadius: 8,
                                            border: '1px solid rgba(197,160,89,0.30)',
                                            cursor: generatingAcademic ? 'not-allowed' : 'pointer',
                                            opacity: generatingAcademic ? 0.5 : 1,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        }}
                                    >
                                        {generatingAcademic === 'teaching-philosophy' ? (
                                            <RefreshCcw size={11} className="animate-spin" />
                                        ) : <BookOpen size={11} />}
                                        {academicDocs['teaching-philosophy'] ? 'Regenerate' : 'Generate'} Teaching Philosophy
                                    </button>
                                    <button
                                        onClick={() => handleGenerateAcademic('research-statement')}
                                        disabled={!!generatingAcademic}
                                        style={{
                                            width: '100%', padding: '8px 0',
                                            background: 'rgba(197,160,89,0.20)', color: warm.colors.accentGold,
                                            fontSize: 11, fontWeight: 700, borderRadius: 8,
                                            border: '1px solid rgba(197,160,89,0.30)',
                                            cursor: generatingAcademic ? 'not-allowed' : 'pointer',
                                            opacity: generatingAcademic ? 0.5 : 1,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        }}
                                    >
                                        {generatingAcademic === 'research-statement' ? (
                                            <RefreshCcw size={11} className="animate-spin" />
                                        ) : <FlaskConical size={11} />}
                                        {academicDocs['research-statement'] ? 'Regenerate' : 'Generate'} Research Statement
                                    </button>
                                    {(academicDocs['teaching-philosophy'] || academicDocs['research-statement']) && (
                                        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                                            {academicDocs['teaching-philosophy'] && (
                                                <button
                                                    onClick={() => setAcademicViewerType('teaching-philosophy')}
                                                    style={{
                                                        flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 700,
                                                        color: warm.colors.textSecondary, background: warm.colors.bgAlt,
                                                        borderRadius: 8, border: `1px solid ${warm.colors.borderWhisper}`,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    View Teaching Phil.
                                                </button>
                                            )}
                                            {academicDocs['research-statement'] && (
                                                <button
                                                    onClick={() => setAcademicViewerType('research-statement')}
                                                    style={{
                                                        flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 700,
                                                        color: warm.colors.textSecondary, background: warm.colors.bgAlt,
                                                        borderRadius: 8, border: `1px solid ${warm.colors.borderWhisper}`,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    View Research Stmt.
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cover Letter Personalisation */}
                    {state.documents['cover-letter'] && !state.isGenerating && state.activeTab !== 'interview-prep' && (
                        <div style={{ padding: 16, borderBottom: `1px solid ${warm.colors.borderWhisper}` }}>
                            <CoverLetterPersonalisationPanel
                                document={state.documents['cover-letter']}
                                jobDescription={state.jobDescription}
                                company={state.metadata?.company}
                            />
                        </div>
                    )}

                    {/* Tone Rewrite Panel */}
                    {Object.values(state.documents).some(Boolean) && !state.isGenerating && state.activeTab !== 'interview-prep' && (
                        <div style={{ padding: 16, borderBottom: `1px solid ${warm.colors.borderWhisper}` }}>
                            <ToneRewritePanel
                                document={state.documents[state.activeTab as keyof typeof state.documents] || ''}
                                docType={state.activeTab}
                            />
                        </div>
                    )}

                    <div style={{
                        flexShrink: 0, padding: '16px 16px 12px',
                        borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Job Description</span>
                            {state.keywords && state.keywords.length > 0 && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: warm.colors.accentPetrol, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{state.keywords.length} keywords</span>
                            )}
                        </div>
                        {state.jobDescription && (
                            <JDSummaryBar jobDescription={state.jobDescription} />
                        )}
                    </div>
                    <div style={{
                        flex: 1, overflowY: 'auto', padding: 24,
                        fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.7,
                    }} className="custom-scrollbar">
                        <HighlightedJD text={state.jobDescription} keywords={state.keywords || []} />
                    </div>

                    {/* Academic document viewer modal */}
                    <AnimatePresence>
                        {academicViewerType && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{
                                    position: 'absolute', inset: 0,
                                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                }}
                            >
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px 20px', borderBottom: `1px solid ${warm.colors.borderWhisper}`, flexShrink: 0,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {academicViewerType === 'teaching-philosophy' ? <BookOpen size={14} style={{ color: warm.colors.accentGold }} /> : <FlaskConical size={14} style={{ color: warm.colors.accentGold }} />}
                                        <span style={{ fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                                            {academicViewerType === 'teaching-philosophy' ? 'Teaching Philosophy Statement' : 'Research Statement'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button
                                            onClick={async () => {
                                                const content = academicDocs[academicViewerType];
                                                if (content) {
                                                    await exportDocx(content, academicViewerType as DocType, profile?.name || '', state.metadata?.role);
                                                    toast.success('Downloaded as .docx');
                                                }
                                            }}
                                            style={{
                                                fontSize: 10, fontWeight: 800, color: warm.colors.success,
                                                border: `1px solid rgba(42,157,111,0.40)`, padding: '5px 12px',
                                                borderRadius: 8, background: 'transparent', cursor: 'pointer',
                                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                            }}
                                        >
                                            Export .docx
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const content = academicDocs[academicViewerType];
                                                if (content) {
                                                    setExportingPdf(true);
                                                    try {
                                                        await exportPdf(content, academicViewerType as DocType, profile?.name || '', state.metadata?.role);
                                                        toast.success('Downloaded as PDF');
                                                    } catch {
                                                        toast.error('PDF export failed');
                                                    } finally {
                                                        setExportingPdf(false);
                                                    }
                                                }
                                            }}
                                            style={{
                                                fontSize: 10, fontWeight: 800, color: warm.colors.danger,
                                                border: `1px solid ${warm.colors.danger}40`, padding: '5px 12px',
                                                borderRadius: 8, background: 'transparent', cursor: 'pointer',
                                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                            }}
                                        >
                                            Export .pdf
                                        </button>
                                        <button
                                            onClick={() => setAcademicViewerType(null)}
                                            style={{
                                                padding: '5px 6px', borderRadius: 8, background: 'transparent',
                                                border: 'none', cursor: 'pointer', color: warm.colors.textMuted,
                                            }}
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="custom-scrollbar">
                                    <div style={{
                                        maxWidth: 672, margin: '0 auto',
                                        background: '#FFFFFF', color: '#111827',
                                        borderRadius: 2, padding: 40, boxShadow: warm.shadow.lifted,
                                    }}>
                                        <article className="prose prose-slate max-w-none">
                                            <ReactMarkdown>{academicDocs[academicViewerType] || ''}</ReactMarkdown>
                                        </article>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </aside>

                <section style={{
                    flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
                }}
                data-process-step="tailor"
                >
                    <div style={{
                        padding: '12px 16px', borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                    }}>
                        <div style={{
                            display: 'flex', background: warm.colors.bgAlt, padding: 4,
                            borderRadius: 8, border: `1px solid ${warm.colors.borderWhisper}`,
                        }}>
                            <button
                                onClick={() => setIsEditing(false)}
                                style={{
                                    padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                    transition: 'all 0.15s', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                                    color: !isEditing ? '#FFFFFF' : warm.colors.textMuted,
                                    background: !isEditing ? warm.colors.accentPetrol : 'transparent',
                                    border: 'none',
                                    boxShadow: !isEditing ? '0 1px 3px rgba(45,90,110,0.20)' : 'none',
                                }}
                            >
                                Preview
                            </button>
                            <button
                                onClick={() => setIsEditing(true)}
                                style={{
                                    padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                    transition: 'all 0.15s', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                                    color: isEditing ? '#FFFFFF' : warm.colors.textMuted,
                                    background: isEditing ? warm.colors.accentPetrol : 'transparent',
                                    border: 'none',
                                    boxShadow: isEditing ? '0 1px 3px rgba(45,90,110,0.20)' : 'none',
                                }}
                            >
                                Edit Inline
                            </button>
                        </div>

                        {/* Word count + ATS coverage indicator */}
                        {state.documents[state.activeTab] && (() => {
                            const content = state.documents[state.activeTab];
                            const wordCount = content.trim().split(/\s+/).length;
                            const isOverLimit = state.activeTab === 'selection-criteria' && wordCount > 2500;

                            let atsLabel: string | null = null;
                            let atsColor: string = warm.colors.textMuted;
                            if (state.activeTab === 'resume' && state.keywords && state.keywords.length > 0) {
                                const contentLower = content.toLowerCase();
                                const found = state.keywords.filter(k => contentLower.includes(k.toLowerCase())).length;
                                const pct = Math.round((found / state.keywords.length) * 100);
                                if (pct >= 80) {
                                    atsLabel = `${pct}% ATS COVERAGE`;
                                    atsColor = warm.colors.success;
                                } else {
                                    atsLabel = 'JD MATCHED';
                                    atsColor = '#818cf8';
                                }
                            }

                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{
                                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                        color: isOverLimit ? warm.colors.accentGold : warm.colors.textMuted,
                                    }}>
                                        {wordCount.toLocaleString()} words
                                        {isOverLimit && ' · check limit'}
                                    </span>
                                    {atsLabel && (
                                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: atsColor }}>
                                            {atsLabel}
                                        </span>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Email version button, only for cover letter */}
                        {state.activeTab === 'cover-letter' && state.documents['cover-letter'] && (
                            <button
                                onClick={handleGetEmailVersion}
                                disabled={generatingEmail}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px',
                                    background: 'rgba(45,90,110,0.10)', color: warm.colors.accentPetrol,
                                    fontSize: 11, fontWeight: 700, borderRadius: 6,
                                    border: '1px solid rgba(45,90,110,0.20)',
                                    cursor: generatingEmail ? 'not-allowed' : 'pointer', opacity: generatingEmail ? 0.5 : 1,
                                }}
                            >
                                {generatingEmail ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                                Email Version
                            </button>
                        )}

                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setIsConfirmingRegen(!isConfirmingRegen)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px',
                                    background: 'rgba(45,90,110,0.10)', color: warm.colors.accentPetrol,
                                    fontSize: 11, fontWeight: 700, borderRadius: 6,
                                    border: '1px solid rgba(45,90,110,0.20)', cursor: 'pointer',
                                }}
                            >
                                <RefreshCcw size={12} className={state.isGenerating ? 'animate-spin' : ''} />
                                Re-generate
                            </button>

                            <AnimatePresence>
                                {isConfirmingRegen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        style={{
                                            position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                                            width: 256,
                                            background: warm.colors.bgSurface,
                                            border: `1px solid ${warm.colors.borderDefined}`,
                                            borderRadius: 14, padding: 12,
                                            boxShadow: warm.shadow.lifted, zIndex: 20,
                                        }}
                                    >
                                        <p style={{ margin: '0 0 8px', fontSize: 10, color: warm.colors.textSecondary, fontWeight: 700 }}>What should change? (optional)</p>
                                        <textarea
                                            value={regenerateFeedback}
                                            onChange={e => setRegenerateFeedback(e.target.value)}
                                            placeholder="e.g. Make it more concise · Emphasise leadership · Warmer tone"
                                            rows={2}
                                            style={{
                                                width: '100%', fontSize: 11, padding: '6px 8px',
                                                background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
                                                borderRadius: 8, color: warm.colors.textPrimary,
                                                resize: 'none', outline: 'none', fontFamily: 'inherit',
                                                boxSizing: 'border-box', marginBottom: 10,
                                            }}
                                            onFocus={e => { e.currentTarget.style.borderColor = warm.colors.accentPetrol; }}
                                            onBlur={e => { e.currentTarget.style.borderColor = warm.colors.borderWhisper; }}
                                        />
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => {
                                                    handleGenerate(state.activeTab, true);
                                                    setIsConfirmingRegen(false);
                                                }}
                                                style={{
                                                    flex: 1, padding: '4px 0', background: warm.colors.accentPetrol,
                                                    color: '#FFFFFF', fontSize: 10, fontWeight: 700, borderRadius: 8,
                                                    border: 'none', cursor: 'pointer',
                                                }}
                                            >
                                                Regenerate
                                            </button>
                                            <button
                                                onClick={() => { setIsConfirmingRegen(false); setRegenerateFeedback(''); }}
                                                style={{
                                                    flex: 1, padding: '4px 0', background: warm.colors.bgAlt,
                                                    color: warm.colors.textSecondary, fontSize: 10, fontWeight: 700, borderRadius: 8,
                                                    border: 'none', cursor: 'pointer',
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div style={{
                        flex: 1, overflowY: 'auto', padding: 24,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                    }} className="custom-scrollbar">
                        {state.dimensions && state.overallGrade && (
                            <div style={{ width: '100%', maxWidth: 768 }}>
                                <DimensionsIsland
                                    dimensions={state.dimensions as unknown as DimensionScores}
                                    overallGrade={state.overallGrade}
                                    matchScore={state.matchScore ?? 0}
                                    matchedIdentityCard={state.matchedIdentityCard ?? null}
                                    australianFlags={(state.australianFlags ?? {
                                        apsLevel: null,
                                        requiresCitizenship: false,
                                        securityClearanceRequired: 'none',
                                        salaryType: 'unknown',
                                    }) as AustralianFlags}
                                />
                            </div>
                        )}
                        {state.activeTab === 'resume' && !state.isGenerating && (profile?.certifications?.length === 0 || profile?.volunteering?.length === 0) && (
                            <div style={{ width: '100%', maxWidth: 768, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {profile?.certifications?.length === 0 && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px',
                                        background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.20)',
                                        borderRadius: 999, fontSize: 10, fontWeight: 700, color: warm.colors.accentGold,
                                    }}>
                                        <PlusCircle size={10} />
                                        Add certifications to your profile to include this section
                                    </div>
                                )}
                                {profile?.volunteering?.length === 0 && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px',
                                        background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.20)',
                                        borderRadius: 999, fontSize: 10, fontWeight: 700, color: warm.colors.accentGold,
                                    }}>
                                        <PlusCircle size={10} />
                                        Add volunteering to your profile. Valued by Australian employers.
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Selection criteria alert */}
                        {!scBannerDismissed && (state.requiresSelectionCriteria || ['selection criteria', 'key selection criteria', 'duty statement', 'address the criteria'].some(kw => state.jobDescription?.toLowerCase().includes(kw))) && !!state.dimensions && !state.isGenerating && (
                            <div style={{
                                width: '100%', maxWidth: 768, marginBottom: 12,
                                borderRadius: 12, border: '1px solid rgba(124,108,181,0.30)',
                                overflow: 'hidden',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px' }}>
                                    <span style={{ color: '#7C6CB5', flexShrink: 0, marginTop: 1, fontSize: 16, fontWeight: 800 }}>!</span>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 800, color: '#7C6CB5', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Selection Criteria Required</p>
                                        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'rgba(124,108,181,0.7)', lineHeight: 1.5 }}>
                                            This role requires a separate Selection Criteria response, most applicants don't know to submit one, and most get screened out for skipping it. Find the <strong>Position Description</strong> or <strong>Job Information Pack</strong> download on the job listing. The criteria questions are inside.
                                        </p>
                                        <button
                                            onClick={() => setState(s => ({ ...s, activeTab: 'selection-criteria' }))}
                                            style={{
                                                fontSize: 11, fontWeight: 700, color: '#7C6CB5',
                                                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                                            }}
                                        >
                                            Write my SC responses →
                                        </button>
                                    </div>
                                    <button onClick={() => setScBannerDismissed(true)} style={{ color: 'rgba(124,108,181,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 4, flexShrink: 0 }} aria-label="Dismiss">
                                        <span style={{ fontSize: 14 }}>×</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <AnimatePresence>
                            {!violationsBannerDismissed && (state.profileViolations?.length ?? 0) > 0 && !state.isGenerating && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, x: 0 }}
                                    animate={{ opacity: 1, y: 0, x: [0, -4, 4, -4, 4, -2, 2, 0] }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{
                                        opacity: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
                                        y: { duration: 0.2, ease: [0.25, 1, 0.5, 1] },
                                        x: { duration: 0.4, delay: 0.5 },
                                    }}
                                    style={{
                                        width: '100%', maxWidth: 768, marginBottom: 12,
                                        borderRadius: 12, border: '1px solid rgba(197,160,89,0.30)',
                                        overflow: 'hidden',
                                    }}
                                >
                                    <button
                                        onClick={() => setViolationsExpanded(v => !v)}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '10px 16px', background: 'transparent', border: 'none',
                                            cursor: 'pointer', textAlign: 'left', color: 'inherit', fontFamily: 'inherit',
                                        }}
                                    >
                                        <ShieldAlert size={13} style={{ color: warm.colors.accentGold, flexShrink: 0 }} />
                                        <span style={{ fontSize: 10, fontWeight: 800, color: warm.colors.accentGold, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>Review Before Sending</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(197,160,89,0.6)', marginRight: 4 }}>
                                            {state.profileViolations!.length} flag{state.profileViolations!.length !== 1 ? 's' : ''}
                                        </span>
                                        <motion.span animate={{ rotate: violationsExpanded ? 180 : 0 }} transition={{ duration: 0.15 }} style={{ display: 'inline-flex' }}>
                                            <ChevronDown size={12} style={{ color: 'rgba(197,160,89,0.5)' }} />
                                        </motion.span>
                                        <span
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); setViolationsBannerDismissed(true); }}
                                            style={{ marginLeft: 4, color: 'rgba(197,160,89,0.4)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, display: 'flex' }}
                                            aria-label="Dismiss"
                                        >
                                            <X size={12} />
                                        </span>
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {violationsExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                                                style={{ overflow: 'hidden' }}
                                            >
                                                <div style={{
                                                    padding: '0 16px 12px',
                                                    borderTop: '1px solid rgba(197,160,89,0.20)',
                                                }}>
                                                    <p style={{ margin: '8px 0 8px', fontSize: 11, color: 'rgba(197,160,89,0.6)', lineHeight: 1.5 }}>The AI accuracy check flagged these claims, confirm each one matches your actual experience.</p>
                                                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        {state.profileViolations!.map((v, i) => (
                                                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: 'rgba(197,160,89,0.8)' }}>
                                                                <span style={{ color: 'rgba(197,160,89,0.5)', marginTop: 1, flexShrink: 0 }}>·</span>
                                                                {v}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {/* Coaching notes bar */}
                        {(() => {
                            const raw = state.documents[state.activeTab] || '';
                            const { pills } = parseVerifyTokens(raw);
                            if (!pills.length || state.isGenerating) return null;
                            return (
                                <AnimatePresence>
                                    <motion.div
                                        key="coaching-bar"
                                        initial={{ opacity: 0, y: -6, x: 0 }}
                                        animate={{ opacity: 1, y: 0, x: [0, -4, 4, -4, 4, -2, 2, 0] }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{
                                            opacity: { duration: 0.22, ease: [0.25, 1, 0.5, 1] },
                                            y: { duration: 0.22, ease: [0.25, 1, 0.5, 1] },
                                            x: { duration: 0.4, delay: 0.7 },
                                        }}
                                        style={{
                                            width: '100%', maxWidth: 768, marginBottom: 12,
                                            borderRadius: 12, border: '1px solid rgba(197,160,89,0.20)',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <button
                                            onClick={() => setCoachingExpanded(v => !v)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '10px 14px', background: 'transparent', border: 'none',
                                                cursor: 'pointer', textAlign: 'left', color: 'inherit', fontFamily: 'inherit',
                                            }}
                                        >
                                            <Pencil size={10} style={{ color: warm.colors.accentGold, flexShrink: 0 }} />
                                            <span style={{ fontSize: 9, fontWeight: 800, color: warm.colors.accentGold, textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>Coaching Notes</span>
                                            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(197,160,89,0.6)', marginRight: 4 }}>{pills.length} item{pills.length !== 1 ? 's' : ''}</span>
                                            <motion.span animate={{ rotate: coachingExpanded ? 180 : 0 }} transition={{ duration: 0.15 }} style={{ display: 'inline-flex' }}>
                                                <ChevronDown size={11} style={{ color: 'rgba(197,160,89,0.4)' }} />
                                            </motion.span>
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {coachingExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <div style={{
                                                        padding: '0 14px 12px',
                                                        borderTop: '1px solid rgba(197,160,89,0.15)',
                                                        display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4,
                                                    }}>
                                                        {pills.map((text, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => scrollToVerify(text)}
                                                                title={getCoachingMessage(text)}
                                                                aria-label={`Coaching note: ${text}`}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                                    borderRadius: 999, padding: '4px 10px', fontSize: 10, fontWeight: 500,
                                                                    background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.30)',
                                                                    color: warm.colors.accentGold, cursor: 'pointer',
                                                                }}
                                                            >
                                                                <Pencil size={9} />
                                                                <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                </AnimatePresence>
                            );
                        })()}

                        {/* Interview prep, empty state */}
                        {state.activeTab === 'interview-prep' && !state.isGenerating && !state.documents['interview-prep'] && (
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                padding: '128px 0', gap: 24, maxWidth: 384, margin: '0 auto', textAlign: 'center',
                            }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 16,
                                    background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.20)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <ChevronRight size={22} style={{ color: warm.colors.accentGold }} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <p style={{ margin: 0, color: warm.colors.textPrimary, fontWeight: 700, fontSize: 16 }}>Interview Prep</p>
                                    <p style={{ margin: 0, color: warm.colors.textMuted, fontSize: 13, lineHeight: 1.6 }}>
                                        Builds your story bank and question coaching from your achievement profile.{state.metadata?.company ? ` Tailored for ${state.metadata.company}.` : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleGenerate('interview-prep')}
                                    style={{
                                        padding: '10px 24px', background: warm.colors.accentGold,
                                        color: '#FFFFFF', fontSize: 12, fontWeight: 700,
                                        borderRadius: 12, border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                    }}
                                >
                                    <ChevronRight size={14} />
                                    Generate Interview Prep
                                </button>
                            </div>
                        )}

                        {/* Interview prep, generating spinner */}
                        {state.activeTab === 'interview-prep' && state.isGenerating && (
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                padding: '160px 0', gap: 24,
                            }}>
                                <div style={{ position: 'relative' }}>
                                    <div className="animate-spin" style={{ color: warm.colors.accentGold }}><RefreshCcw size={48} /></div>
                                    <div style={{
                                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <div style={{ width: 8, height: 8, background: warm.colors.accentGold, borderRadius: '50%' }} />
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <p style={{ margin: 0, color: warm.colors.textSecondary, fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>Building your interview prep...</p>
                                    <div style={{
                                        width: 192, height: 4, background: warm.colors.borderWhisper,
                                        borderRadius: 999, overflow: 'hidden', margin: '0 auto',
                                    }}>
                                        <motion.div style={{ height: '100%', background: warm.colors.accentGold }} initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 20, ease: 'linear' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Interview prep, new structured view */}
                        {state.activeTab === 'interview-prep' && !state.isGenerating && state.documents['interview-prep'] && (
                            <InterviewPrepView
                                doc={state.documents['interview-prep']}
                                company={state.metadata?.company || ''}
                                role={state.metadata?.role || ''}
                            />
                        )}

                        {/* Standard document renderer (resume, cover letter, SC) */}
                        {(state.activeTab !== 'interview-prep') && (
                        <div style={{
                            width: '100%', maxWidth: 768,
                            background: '#FFFFFF', color: '#111827',
                            boxShadow: warm.shadow.lifted, borderRadius: 2,
                            fontFamily: 'Calibri, Arial, "Helvetica Neue", sans-serif',
                        }}>
                            <div style={{ padding: 48 }}>
                                {rateLimitError ? (
                                    <div style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        padding: '160px 0', gap: 16,
                                    }}>
                                        <div style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 12,
                                            maxWidth: 448, width: '100%',
                                            background: '#FEF3C7', border: '1px solid #FDE68A',
                                            borderRadius: 12, padding: 20,
                                        }}>
                                            <AlertCircle size={18} style={{ color: '#D97706', marginTop: 2, flexShrink: 0 }} />
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <p style={{ margin: 0, color: '#92400E', fontWeight: 700, fontSize: 13 }}>
                                                    You've used all 10 of your free generations today.
                                                </p>
                                                <p style={{ margin: 0, color: '#B45309', fontSize: 13, lineHeight: 1.5 }}>
                                                    Come back tomorrow. Your documents and achievements are all saved.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : state.isGenerating ? (
                                    <div style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        padding: '160px 0', gap: 24,
                                    }}>
                                        <div style={{ position: 'relative' }}>
                                            <div className="animate-spin" style={{ color: warm.colors.accentPetrol }}>
                                                <RefreshCcw size={48} />
                                            </div>
                                            <div style={{
                                                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <div style={{
                                                    width: 8, height: 8, background: warm.colors.accentPetrol,
                                                    borderRadius: '50%',
                                                }} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <p style={{ margin: 0, color: warm.colors.textMuted, fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
                                                {"Drafting your " + state.activeTab.replace('-', ' ') + "..."}
                                            </p>
                                            <div style={{
                                                width: 192, height: 4, background: warm.colors.borderWhisper,
                                                borderRadius: 999, overflow: 'hidden', margin: '0 auto',
                                            }}>
                                                <motion.div
                                                    style={{ height: '100%', background: warm.colors.accentPetrol, borderRadius: 999, width: '38%' }}
                                                    animate={{ x: ['-120%', '320%'] }}
                                                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleStopGeneration}
                                            style={{
                                                marginTop: 32, padding: '8px 24px',
                                                background: warm.colors.bgAlt, color: warm.colors.textMuted,
                                                border: `1px solid ${warm.colors.borderWhisper}`,
                                                borderRadius: 999, fontSize: 10, fontWeight: 800,
                                                textTransform: 'uppercase', letterSpacing: '0.2em', cursor: 'pointer',
                                            }}
                                        >
                                            Stop Generation
                                        </button>
                                    </div>
                                ) : isEditing ? (
                                    <textarea
                                        style={{
                                            width: '100%', minHeight: 800,
                                            border: 'none', outline: 'none',
                                            color: '#1F2937', fontFamily: 'monospace',
                                            fontSize: 13, lineHeight: 1.7, padding: 0, resize: 'none',
                                        }}
                                        value={state.documents[state.activeTab]}
                                        onChange={(e) => handleUpdateContent(e.target.value)}
                                        placeholder={`Start typing your ${state.activeTab}...`}
                                    />
                                ) : (
                                    <article
                                        id="resume-preview-content"
                                        ref={previewRef}
                                        style={{
                                            fontFamily: 'Calibri, Arial, "Helvetica Neue", sans-serif',
                                            fontSize: '10.5pt', lineHeight: 1.45, color: '#1F2937',
                                        }}
                                        className={`prose prose-slate max-w-none ${state.activeTab === 'cover-letter' ? '' : '[&_ul]:my-1 [&_li]:my-0.5 [&_li]:leading-snug [&_h1]:text-[18pt] [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-1 [&_h1]:tracking-tight [&_h2]:text-[10.5pt] [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:border-b [&_h2]:border-slate-300 [&_h2]:pb-0.5 [&_h3]:text-[10.5pt] [&_h3]:font-bold [&_h3]:mt-2.5 [&_h3]:mb-0.5 [&_strong]:font-semibold text-[10.5pt] leading-[1.45]'}`}
                                    >
                                        <ReactMarkdown
                                            children={normaliseMarkdown(parseVerifyTokens(resolvedContent).stripped)}
                                            components={{
                                                text: ({ children }) => {
                                                    if (typeof children !== 'string') return <>{children}</>;
                                                    let aiPrefix: React.ReactNode = null;
                                                    let rest = children;
                                                    if (rest.startsWith('[AI] ')) {
                                                        aiPrefix = <AIRewriteBadge key="ai" />;
                                                        rest = rest.slice(5);
                                                    } else if (rest.startsWith('[AI]')) {
                                                        aiPrefix = <AIRewriteBadge key="ai" />;
                                                        rest = rest.slice(4);
                                                    }
                                                    if (!rest.includes('[MISSING:')) {
                                                        return <>{aiPrefix}{rest}</>;
                                                    }
                                                    const parts = rest.split(/(\[MISSING:[^\]]+\])/g);
                                                    return (
                                                        <>
                                                            {aiPrefix}
                                                            {parts.map((part, i) => {
                                                                if (part.startsWith('[MISSING:')) {
                                                                    return (
                                                                        <MissingFlag
                                                                            key={i}
                                                                            text={part}
                                                                            onEditInline={() => setIsEditing(true)}
                                                                            onAddToProfile={handleAddToProfile}
                                                                            onRemove={handleRemoveFlag}
                                                                        />
                                                                    );
                                                                }
                                                                return part;
                                                            })}
                                                        </>
                                                    );
                                                }
                                            }}
                                        />
                                    </article>
                                )}
                            </div>
                        </div>
                        )}
                        {/* Cover letter prompt, shown after resume is generated, before cover letter is */}
                        {state.activeTab === 'resume' && !state.isGenerating && !!state.documents['resume'] && !state.documents['cover-letter'] && (
                            <div style={{
                                width: '100%', maxWidth: 768, marginTop: 12,
                                borderRadius: 12, border: '1px solid rgba(99,102,241,0.20)',
                                padding: '12px 16px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                            }}>
                                <p style={{ margin: 0, fontSize: 12, color: 'rgba(99,102,241,0.8)', lineHeight: 1.5 }}>
                                    Resume ready. <strong style={{ color: 'rgba(99,102,241,0.9)' }}>Applications with both a resume and cover letter get read first.</strong>
                                </p>
                                <button
                                    onClick={() => setState(s => ({ ...s, activeTab: 'cover-letter' }))}
                                    style={{
                                        flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'rgba(99,102,241,0.8)',
                                        border: '1px solid rgba(99,102,241,0.30)', borderRadius: 8,
                                        padding: '5px 12px', background: 'transparent', cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    Generate cover letter →
                                </button>
                            </div>
                        )}

                        {/* Tracker + next application nudge */}
                        {!state.isGenerating && !applyContext && (() => {
                            const hasDoc = Object.values(state.documents).some(Boolean);

                            if (hasDoc && !trackerAdded) {
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25 }}
                                        style={{
                                            width: '100%', maxWidth: 768, marginTop: 16,
                                            borderRadius: 12, border: '1px solid rgba(45,90,110,0.20)',
                                            padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                                        }}
                                    >
                                        <div>
                                            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: warm.colors.accentPetrol }}>Track this application.</p>
                                            <p style={{ margin: 0, fontSize: 12, color: warm.colors.textSecondary, lineHeight: 1.5 }}>
                                                We'll remind you when to follow up, with a template, to keep you top of mind.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleAddToTracker}
                                            disabled={trackerAdding}
                                            style={{
                                                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
                                                padding: '8px 16px', borderRadius: 8,
                                                fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                                color: warm.colors.accentPetrol, background: 'transparent',
                                                border: '1px solid rgba(45,90,110,0.30)',
                                                cursor: trackerAdding ? 'not-allowed' : 'pointer', opacity: trackerAdding ? 0.5 : 1,
                                            }}
                                        >
                                            {trackerAdding ? <Loader2 size={11} className="animate-spin" /> : <Briefcase size={11} />}
                                            {trackerAdding ? 'Adding…' : 'Track it →'}
                                        </button>
                                    </motion.div>
                                );
                            }

                            if (trackerAdded) {
                                return (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.97 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.25 }}
                                        style={{
                                            width: '100%', maxWidth: 768, marginTop: 16,
                                            borderRadius: 12, border: '1px solid rgba(99,102,241,0.20)',
                                            padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <CheckCircle size={16} style={{ color: warm.colors.success, flexShrink: 0 }} />
                                            <div>
                                                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>Added to your tracker.</p>
                                                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textSecondary }}>
                                                    We'll remind you to follow up in 7 days.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleNewApplication}
                                            style={{
                                                flexShrink: 0, fontSize: 11, fontWeight: 700, color: 'rgba(99,102,241,0.8)',
                                                border: '1px solid rgba(99,102,241,0.30)', borderRadius: 8,
                                                padding: '5px 12px', background: 'transparent', cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Start a new application →
                                        </button>
                                    </motion.div>
                                );
                            }

                            if (hasDoc) {
                                return (
                                    <div style={{ width: '100%', maxWidth: 768, marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                                        <button
                                            onClick={handleNewApplication}
                                            style={{
                                                fontSize: 11, fontWeight: 600, color: warm.colors.textMuted,
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                padding: '8px 16px',
                                            }}
                                        >
                                            Done with this one? Start a new application →
                                        </button>
                                    </div>
                                );
                            }

                            return null;
                        })()}

                        {applyContext && !state.isGenerating && state.documents[state.activeTab] && (
                            <div style={{
                                width: '100%', maxWidth: 768, marginTop: 16,
                                borderRadius: 12, border: '1px solid rgba(45,90,110,0.20)',
                                padding: 20,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <CheckCircle size={14} style={{ color: warm.colors.accentPetrol }} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: warm.colors.accentPetrol }}>Documents ready - time to apply</span>
                                </div>
                                <a
                                    href={applyContext.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                        color: '#FFFFFF', textDecoration: 'none', marginBottom: 20,
                                        background: getPlatformConfig(applyContext.sourcePlatform).color,
                                    }}
                                >
                                    <ExternalLink size={11} />
                                    Apply on {getPlatformConfig(applyContext.sourcePlatform).label}
                                </a>
                                <ol style={{ margin: '0 0 20px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {getApplyInstructions(applyContext.sourcePlatform).map((step, i) => (
                                        <li key={i} style={{ fontSize: 12, color: warm.colors.textSecondary, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <span style={{ color: warm.colors.accentPetrol, fontWeight: 800, flexShrink: 0, width: 16, textAlign: 'right' }}>{i + 1}.</span>
                                            {step}
                                        </li>
                                    ))}
                                </ol>
                                <button
                                    onClick={handleMarkApplied}
                                    disabled={markingApplied}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                        color: warm.colors.accentPetrol, background: 'transparent',
                                        border: '1px solid rgba(45,90,110,0.30)',
                                        cursor: markingApplied ? 'not-allowed' : 'pointer', opacity: markingApplied ? 0.5 : 1,
                                    }}
                                >
                                    {markingApplied
                                        ? <Loader2 size={11} className="animate-spin" />
                                        : <CheckCircle size={11} />
                                    }
                                    {markingApplied ? 'Updating tracker…' : "I've Applied"}
                                </button>
                            </div>
                        )}

                    </div>

                    {/* Strategist's Notes */}
                    {state.blueprint && !state.isGenerating && (
                        <div style={{ flexShrink: 0, borderTop: `1px solid ${warm.colors.borderWhisper}` }}>
                            <StrategistDebrief
                                blueprint={state.blueprint}
                                rankedAchievements={state.rankedAchievements}
                                companyName={state.metadata?.company}
                            />
                        </div>
                    )}

                    {/* Email Version Modal */}
                    <AnimatePresence>
                        {emailVersion && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{
                                    position: 'absolute', inset: 0, zIndex: 30,
                                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                                }}
                            >
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '12px 20px', borderBottom: `1px solid ${warm.colors.borderWhisper}`, flexShrink: 0,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Mail size={14} style={{ color: warm.colors.accentPetrol }} />
                                        <span style={{ fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>Email Application Version</span>
                                    </div>
                                    <button onClick={() => setEmailVersion(null)} style={{
                                        padding: '5px 6px', borderRadius: 8, background: 'transparent',
                                        border: 'none', cursor: 'pointer', color: warm.colors.textMuted, display: 'flex',
                                    }}>
                                        <ChevronLeft size={16} />
                                    </button>
                                </div>
                                <div style={{
                                    flex: 1, overflowY: 'auto', padding: 24,
                                    display: 'flex', flexDirection: 'column', gap: 20,
                                }} className="custom-scrollbar">
                                    {/* Subject line */}
                                    <div style={{
                                        borderRadius: 12, border: `1px solid ${warm.colors.borderWhisper}`,
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '8px 16px', borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                                        }}>
                                            <span style={{ fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject Line</span>
                                            <button
                                                onClick={() => copyEmailField('subject')}
                                                style={{
                                                    fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                                                    border: `1px solid ${copiedEmailField === 'subject' ? 'rgba(42,157,111,0.40)' : warm.colors.borderWhisper}`,
                                                    background: copiedEmailField === 'subject' ? 'rgba(42,157,111,0.10)' : 'transparent',
                                                    color: copiedEmailField === 'subject' ? warm.colors.success : warm.colors.textMuted,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                                }}
                                            >
                                                {copiedEmailField === 'subject' ? <CheckCircle size={10} /> : <Copy size={10} />}
                                                {copiedEmailField === 'subject' ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        <p style={{ margin: 0, padding: '10px 16px', fontSize: 13, color: warm.colors.textPrimary, fontWeight: 500, userSelect: 'all' }}>{emailVersion.emailSubject}</p>
                                    </div>
                                    {/* Email body */}
                                    <div style={{
                                        borderRadius: 12, border: `1px solid ${warm.colors.borderWhisper}`,
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '8px 16px', borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                                        }}>
                                            <span style={{ fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email Body</span>
                                            <button
                                                onClick={() => copyEmailField('body')}
                                                style={{
                                                    fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
                                                    border: `1px solid ${copiedEmailField === 'body' ? 'rgba(42,157,111,0.40)' : warm.colors.borderWhisper}`,
                                                    background: copiedEmailField === 'body' ? 'rgba(42,157,111,0.10)' : 'transparent',
                                                    color: copiedEmailField === 'body' ? warm.colors.success : warm.colors.textMuted,
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                                }}
                                            >
                                                {copiedEmailField === 'body' ? <CheckCircle size={10} /> : <Copy size={10} />}
                                                {copiedEmailField === 'body' ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        <p style={{ margin: 0, padding: '14px 16px', fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap', userSelect: 'all' }}>{emailVersion.emailBody}</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </main>

            <AchievementSelector
                isOpen={state.isDrawerOpen}
                onClose={() => setState(prev => ({ ...prev, isDrawerOpen: false }))}
                achievements={state.rankedAchievements}
                selectedIds={state.selectedAchievementIds}
                onUpdate={(ids: string[]) => setState(prev => ({ ...prev, selectedAchievementIds: ids }))}
                onConfirm={() => {
                    setState(prev => ({ ...prev, isDrawerOpen: false }));
                    handleGenerate(state.activeTab, true);
                }}
            />

            {/* Upgrade Modal, 402 response */}
            <AnimatePresence>
                {showUpgradeModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={(e) => { if (e.target === e.currentTarget) setShowUpgradeModal(false); }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 100,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(26, 24, 20, 0.36)',
                            backdropFilter: 'blur(4px)',
                            padding: '0 16px',
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 16 }}
                            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: 448,
                                background: warm.colors.bgSurface,
                                border: '1px solid rgba(99,102,241,0.30)',
                                borderRadius: 16, boxShadow: warm.shadow.lifted,
                                overflow: 'hidden',
                            }}
                        >
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '20px 24px', borderBottom: `1px solid ${warm.colors.borderWhisper}`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Sparkles size={16} style={{ color: '#818cf8' }} />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>Start your 7-day free trial</span>
                                </div>
                                <button
                                    onClick={() => setShowUpgradeModal(false)}
                                    aria-label="Close"
                                    style={{
                                        padding: '5px 6px', borderRadius: 8, background: 'transparent',
                                        border: 'none', cursor: 'pointer', color: warm.colors.textMuted, display: 'flex',
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <p style={{ margin: 0, fontSize: 13, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                                    You've used your free generations, but the work is just getting started.
                                </p>
                                <p style={{ margin: 0, fontSize: 13, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                                    Try JobHub free for 7 days: unlimited document generation, full workspace access, and every premium feature. You'll need to enter your card details to start, you won't be charged until the trial ends, and you can cancel any time.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button
                                        onClick={() => { setShowUpgradeModal(false); navigate('/pricing'); }}
                                        style={{
                                            width: '100%', padding: '12px 0', borderRadius: 12,
                                            background: '#6366F1', color: '#FFFFFF',
                                            fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                                        }}
                                    >
                                        Start free trial →
                                    </button>
                                    <button
                                        onClick={() => setShowUpgradeModal(false)}
                                        style={{
                                            width: '100%', padding: '10px 0', borderRadius: 12,
                                            color: warm.colors.textMuted, fontSize: 13, fontWeight: 500,
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                        }}
                                    >
                                        Maybe later
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
