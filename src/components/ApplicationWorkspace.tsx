import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Toaster, toast } from 'sonner';
import { AchievementSelector } from './AchievementSelector';
import { MissingFlag } from './MissingFlag';
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
import { ApplyContextBanner, type ApplyContext } from './ApplyContextBanner';
import { getPlatformConfig, getApplyInstructions } from '../lib/platforms';
import { DimensionsIsland } from './DimensionsIsland';
import type { DimensionScores, AustralianFlags } from './DimensionsIsland';

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
    if (!keywords.length) return <span className="whitespace-pre-wrap">{text}</span>;

    // Build a regex from keywords, sorted longest-first to avoid partial-match issues
    const escaped = [...keywords]
        .sort((a, b) => b.length - a.length)
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

    const parts = text.split(pattern);
    return (
        <span className="whitespace-pre-wrap">
            {parts.map((part, i) =>
                keywords.some(k => k.toLowerCase() === part.toLowerCase())
                    ? <mark key={i} className="bg-brand-600/20 text-brand-300 rounded px-0.5">{part}</mark>
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

        // Priority 1: Location State (Navigation from MatchEngine)
        // Priority 2: LocalStorage (Page Refresh)
        const currentJD = initialState?.jobDescription || savedJD || '';
        const currentAnalysis = initialState?.analysis || savedAnalysis || {};
        const currentTab = initialState?.initialTab || savedActiveTab || 'resume';

        // If we got new data from location state, we should probably clear old docs/ids
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
        
        // We also want to keep the analysis in sync if it changes (e.g. metadata)
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
    const [regenerateFeedback, setRegenerateFeedback] = useState('');
    const [rateLimitError, setRateLimitError] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
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
            toast.error('Could not update tracker — please mark it manually');
        } finally {
            setMarkingApplied(false);
        }
    };

    // Academic documents — generated on demand, stored separately (not in main documents map)
    const [academicDocs, setAcademicDocs] = useState<{ 'teaching-philosophy': string; 'research-statement': string }>({
        'teaching-philosophy': '',
        'research-statement': '',
    });
    const [generatingAcademic, setGeneratingAcademic] = useState<'teaching-philosophy' | 'research-statement' | null>(null);
    const [academicViewerType, setAcademicViewerType] = useState<'teaching-philosophy' | 'research-statement' | null>(null);

    // Cover letter tone preference
    const [coverLetterTone, setCoverLetterTone] = useState<'professional' | 'warm' | 'concise'>('professional');

    // Email cover letter modal
    const [emailVersion, setEmailVersion] = useState<{ emailSubject: string; emailBody: string } | null>(null);
    const [generatingEmail, setGeneratingEmail] = useState(false);
    const [copiedEmailField, setCopiedEmailField] = useState<'subject' | 'body' | null>(null);

    // Auto-detect employer framework when SC tab is first activated
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
                // Silent — framework label is optional UI decoration
            }
        };
        detect();
    }, [state.activeTab, state.metadata?.company]);

    useEffect(() => {
        // Fetch existing documents if we have a jobApplicationId but NO document contents for the current tab
        const currentDoc = state.documents[state.activeTab];
        const currentDocId = state.documentIds[state.activeTab];

        if (state.jobApplicationId && !currentDoc && !currentDocId && !state.isGenerating && !isFetchingDocs) {
            console.log('Fetching existing documents for Job Application:', state.jobApplicationId);
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
            // Fallback: print-to-PDF
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

    const handleDownloadPdf = async () => {
        const content = state.documents[state.activeTab];
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

    const handleDownload = async () => {
        const content = state.documents[state.activeTab];
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

        await executeDownload(content);
    };

    // Auto-save logic
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
            } catch (error) {
                console.error('Auto-save failed:', error);
                setState(prev => ({ ...prev, saveStatus: 'unsaved' }));
                toast.error("Auto-save failed");
            }
        }, 1500); // 1.5s debounce

        return () => clearTimeout(timer);
    }, [state.documents, state.activeTab, state.documentIds, state.saveStatus]);

    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [isFetchingDocs, setIsFetchingDocs] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    const handleGenerate = async (type: WorkspaceState['activeTab'], regenerate = false) => {
        if (state.hasFailed[type] && !regenerate) return;
        // SC must never generate without criteria — hard guard regardless of how this was called
        if (type === 'selection-criteria' && selectionCriteriaText.trim().length < 20) return;

        const controller = new AbortController();
        setAbortController(controller);
        setRateLimitError(false);

        setViolationsBannerDismissed(false);
        setState(prev => ({ ...prev, isGenerating: true }));
        try {
            const { data } = await api.post(`/generate/${type}`, {
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
                // Company research context for cover letters (hiring manager, highlights)
                companyResearch: type === 'cover-letter' ? companyResearch : null,
                // For SC: use extracted (cleaned) criteria if available, fall back to raw text
                selectionCriteriaText: type === 'selection-criteria'
                    ? (extractedCriteria.length > 0
                        ? extractedCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
                        : selectionCriteriaText)
                    : null,
                // Employer framework hint for SC (APS ILS, QLD LC4Q, etc.)
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
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') {
                console.log('Generation cancelled by user');
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
        // ONLY generate if we DON'T have a doc and DON'T have a doc ID (meaning it doesn't exist on server)
        const hasDoc = !!state.documents[state.activeTab];
        const hasDocId = !!state.documentIds[state.activeTab];

        // SC never auto-generates — user must click the button explicitly
        if (state.activeTab === 'selection-criteria') return;

        // Don't auto-generate while we're still fetching existing docs from the server (prevents race condition)
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
            toast.error('Generation failed — try again.');
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
            toast.error('Could not generate email version — try again.');
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

    /** Derive a short back-label from job title */
    const backLabel = (() => {
        const raw = state.metadata?.role;
        if (!raw) return 'Back to Dashboard';
        return raw.length > 20 ? raw.slice(0, 20).trimEnd() + '…' : raw;
    })();

    /** Parse VERIFY tokens from markdown, return { pills, stripped } */
    const parseVerifyTokens = useCallback((markdown: string): { pills: string[]; stripped: string } => {
        const pills: string[] = [];
        const stripped = markdown.replace(/\[VERIFY:\s*([^\]]+)\]/g, (_match, text) => {
            pills.push(text.trim());
            return '';
        });
        return { pills, stripped };
    }, []);

    /** Map a verify text to a coaching message */
    const getCoachingMessage = (text: string): string => {
        const lower = text.toLowerCase();
        if (lower.includes('job title') || lower.includes('title')) {
            return 'Exact job titles help ATS systems match your application — a wrong title can cost you the filter.';
        }
        if (lower.includes('number') || lower.includes('team size') || lower.includes('people') || /\d/.test(lower)) {
            return 'Specific numbers make achievements credible. Hiring managers mentally assign you scope based on team size.';
        }
        if (lower.includes('company') || lower.includes('company name') || lower.includes('organisation')) {
            return 'Company-specific details show you\'ve done your homework and aren\'t copy-pasting applications.';
        }
        return 'Verifying this detail makes your application more credible and harder to dismiss.';
    };

    /** Scroll to first occurrence of verify text in the document preview */
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

    // CommonMark collapses consecutive lines into one <p> unless separated by a blank line.
    // Enforce double line-breaks between skill categories and between cover letter paragraphs.
    const normaliseMarkdown = (md: string): string => {
        let out = md;
        // Skill category lines
        out = out.replace(
            /([^\n])\n(\*\*(Technical Skills|Industry Knowledge|Soft Skills):\*\*)/g,
            '$1\n\n$2'
        );
        // Cover letter: collapse 3+ newlines to 2, then ensure any single \n between
        // non-empty lines becomes \n\n so ReactMarkdown renders them as separate <p> tags.
        if (state.activeTab === 'cover-letter') {
            out = out.replace(/\n{3,}/g, '\n\n');
            out = out.replace(/([^\n])\n([^\n])/g, '$1\n\n$2');
        }
        return out;
    };

    return (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col overflow-hidden text-slate-200">
            <Toaster position="top-center" richColors />
            <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBack}
                        aria-label={`Back to ${backLabel}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors group"
                    >
                        <ChevronLeft size={16} className="shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest max-w-[120px] truncate hidden sm:block">
                            {backLabel}
                        </span>
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-slate-200">
                            {state.metadata?.role || 'New Application'}
                        </h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {state.metadata?.company || 'Drafting Workspace'}
                        </p>
                    </div>
                    {state.matchScore !== undefined && state.matchScore > 0 && (
                        <div className="flex items-center gap-1.5 ml-2">
                            <div className={`relative w-8 h-8 flex items-center justify-center rounded-full border-2 text-[9px] font-black ${
                                state.matchScore >= 70 ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                                : state.matchScore >= 50 ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                                : 'border-red-500 text-red-400 bg-red-500/10'
                            }`}>
                                {state.matchScore}
                            </div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">match{state.overallGrade ? ` — ${state.overallGrade}` : ''}</span>
                        </div>
                    )}
                </div>

                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                    {(['resume', 'cover-letter', 'selection-criteria', 'interview-prep'] as const)
                        .map(tab => (
                        <button
                            key={tab}
                            onClick={() => setState(prev => ({ ...prev, activeTab: tab }))}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                                state.activeTab === tab
                                    ? 'bg-brand-600 text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {tab === 'resume' && <FileText size={14} />}
                            {tab === 'cover-letter' && <Mail size={14} />}
                            {tab === 'selection-criteria' && <List size={14} />}
                            {tab === 'interview-prep' && <ChevronRight size={14} />}
                            <span>{tab === 'interview-prep' ? 'Interview Prep' : tab === 'selection-criteria' ? 'Selection Criteria' : tab === 'cover-letter' ? 'Cover Letter' : 'Resume'}</span>
                            {tab === 'selection-criteria' && state.requiresSelectionCriteria && (
                                <span className="inline-flex items-center justify-center w-1.5 h-1.5 rounded-full bg-amber-400" title="This job requires selection criteria" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-6">
                    {profile?.completion && (
                        <ProfileCompletion 
                            completion={profile.completion}
                            variant="compact"
                            size="sm"
                        />
                    )}

                    <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/50 rounded-lg border border-slate-800">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                            state.saveStatus === 'saved' ? 'bg-emerald-500' :
                            state.saveStatus === 'saving' ? 'bg-amber-500 animate-pulse' :
                            'bg-slate-500'
                        }`} />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            {state.saveStatus === 'saved' ? 'Changes Saved' :
                             state.saveStatus === 'saving' ? 'Saving...' :
                             'Unsaved Changes'}
                        </span>
                    </div>

                    <button 
                        onClick={() => setState(prev => ({ ...prev, isDrawerOpen: true }))}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-all"
                    >
                        <Database size={14} />
                        Edit Selections
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={state.isGenerating || !state.documents[state.activeTab as keyof typeof state.documents]}
                        aria-label="Export document as Word"
                        className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-600/20"
                    >
                        <Download size={14} />
                        Export .docx
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        disabled={exportingPdf}
                        className="flex items-center gap-2 px-4 py-1.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-rose-700/20"
                    >
                        {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                        Export .pdf
                    </button>
                </div>
            </header>

            {profile?.completion && !profile.completion.isReady && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-amber-400 text-xs font-medium">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>Profile Incomplete: Generated content may require heavy manual editing.</span>
                    </div>
                    <button 
                        onClick={() => navigate('/workspace')}
                        className="text-[10px] font-bold text-amber-500 uppercase tracking-widest hover:text-amber-400 transition-colors"
                    >
                        Fix Profile →
                    </button>
                </div>
            )}

            <ApplyContextBanner context={applyContext} onDismiss={handleDismissApplyContext} />

            <main className="flex-1 flex overflow-hidden">
                <aside className="w-1/3 border-r border-slate-800 bg-slate-900/20 flex flex-col overflow-hidden">
                    {/* Cover letter: tone selector + research panel */}
                    {state.activeTab === 'cover-letter' && (
                        <div className="p-4 border-b border-slate-800 shrink-0 overflow-y-auto max-h-[55%] custom-scrollbar">
                            {/* Tone selector */}
                            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden mb-4">
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/40">
                                    <Mail size={13} className="text-brand-400" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tone</span>
                                </div>
                                <div className="flex p-2 gap-1.5">
                                    {(['professional', 'warm', 'concise'] as const).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setCoverLetterTone(t)}
                                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                                                coverLetterTone === t
                                                    ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-600/20'
                                                    : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {state.metadata?.company && (
                                <CompanyResearchPanel
                                    company={state.metadata.company}
                                    role={state.metadata.role || ''}
                                    research={companyResearch}
                                    onResearchUpdate={setCompanyResearch}
                                />
                            )}
                        </div>
                    )}

                    {/* SC tab: criteria input panel */}
                    {state.activeTab === 'selection-criteria' && (
                        <div className="p-4 border-b border-slate-800 shrink-0 overflow-y-auto max-h-[55%] custom-scrollbar">
                            {state.requiresSelectionCriteria && !selectionCriteriaText.trim() && (
                                <div className="mb-3 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3.5 py-2.5">
                                    <AlertCircle size={13} className="text-amber-400 mt-0.5 shrink-0" />
                                    <p className="text-xs text-amber-300 leading-relaxed">
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
                                className="w-full mt-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <List size={14} />
                                Generate SC Responses
                            </button>
                        </div>
                    )}


                    {/* Academic Toolkit — shown for university framework */}
                    {(employerFramework === 'university_academic' || employerFramework === 'university_professional') && (
                        <div className="p-4 border-b border-slate-800 shrink-0">
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-500/15 bg-amber-500/5">
                                    <BookOpen size={13} className="text-amber-400" />
                                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Academic Toolkit</span>
                                </div>
                                <div className="p-4 space-y-2">
                                    <p className="text-[10px] text-slate-400 leading-relaxed">
                                        University positions typically require academic-specific documents beyond the standard application set.
                                    </p>
                                    <button
                                        onClick={() => handleGenerateAcademic('teaching-philosophy')}
                                        disabled={!!generatingAcademic}
                                        className="w-full py-2 bg-amber-600/20 hover:bg-amber-600/30 disabled:opacity-50 text-amber-300 text-[11px] font-bold rounded-lg border border-amber-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        {generatingAcademic === 'teaching-philosophy' ? (
                                            <RefreshCcw size={11} className="animate-spin" />
                                        ) : <BookOpen size={11} />}
                                        {academicDocs['teaching-philosophy'] ? 'Regenerate' : 'Generate'} Teaching Philosophy
                                    </button>
                                    <button
                                        onClick={() => handleGenerateAcademic('research-statement')}
                                        disabled={!!generatingAcademic}
                                        className="w-full py-2 bg-amber-600/20 hover:bg-amber-600/30 disabled:opacity-50 text-amber-300 text-[11px] font-bold rounded-lg border border-amber-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        {generatingAcademic === 'research-statement' ? (
                                            <RefreshCcw size={11} className="animate-spin" />
                                        ) : <FlaskConical size={11} />}
                                        {academicDocs['research-statement'] ? 'Regenerate' : 'Generate'} Research Statement
                                    </button>
                                    {(academicDocs['teaching-philosophy'] || academicDocs['research-statement']) && (
                                        <div className="flex gap-2 pt-1">
                                            {academicDocs['teaching-philosophy'] && (
                                                <button
                                                    onClick={() => setAcademicViewerType('teaching-philosophy')}
                                                    className="flex-1 py-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                                                >
                                                    View Teaching Phil.
                                                </button>
                                            )}
                                            {academicDocs['research-statement'] && (
                                                <button
                                                    onClick={() => setAcademicViewerType('research-statement')}
                                                    className="flex-1 py-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
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

                    {/* Cover Letter Personalisation — shown when cover letter is generated, not on interview prep */}
                    {state.documents['cover-letter'] && !state.isGenerating && state.activeTab !== 'interview-prep' && (
                        <div className="p-4 border-b border-slate-800">
                            <CoverLetterPersonalisationPanel
                                document={state.documents['cover-letter']}
                                jobDescription={state.jobDescription}
                                company={state.metadata?.company}
                            />
                        </div>
                    )}

                    {/* Tone Rewrite Panel — shown when any document is ready, not on interview prep */}
                    {Object.values(state.documents).some(Boolean) && !state.isGenerating && state.activeTab !== 'interview-prep' && (
                        <div className="p-4 border-b border-slate-800">
                            <ToneRewritePanel
                                document={state.documents[state.activeTab as keyof typeof state.documents] || ''}
                                docType={state.activeTab}
                            />
                        </div>
                    )}

                    <div className="shrink-0 px-4 pt-4 border-b border-slate-800">
                        <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Job Description</span>
                            {state.keywords && state.keywords.length > 0 && (
                                <span className="text-[9px] font-bold text-brand-400/70 uppercase tracking-wider">{state.keywords.length} keywords</span>
                            )}
                        </div>
                        {state.jobDescription && (
                            <JDSummaryBar jobDescription={state.jobDescription} />
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-400 leading-relaxed custom-scrollbar">
                        <HighlightedJD text={state.jobDescription} keywords={state.keywords || []} />
                    </div>

                    {/* Academic document viewer modal */}
                    <AnimatePresence>
                        {academicViewerType && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-950/95 z-20 flex flex-col overflow-hidden"
                            >
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0">
                                    <div className="flex items-center gap-2">
                                        {academicViewerType === 'teaching-philosophy' ? <BookOpen size={14} className="text-amber-400" /> : <FlaskConical size={14} className="text-amber-400" />}
                                        <span className="text-sm font-bold text-slate-200">
                                            {academicViewerType === 'teaching-philosophy' ? 'Teaching Philosophy Statement' : 'Research Statement'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={async () => {
                                                const content = academicDocs[academicViewerType];
                                                if (content) {
                                                    await exportDocx(content, academicViewerType as DocType, profile?.name || '', state.metadata?.role);
                                                    toast.success('Downloaded as .docx');
                                                }
                                            }}
                                            className="text-[10px] font-black text-emerald-400 border border-emerald-700/50 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors uppercase tracking-wider"
                                        >
                                            Export .docx
                                        </button>
                                        <button
                                            onClick={() => setAcademicViewerType(null)}
                                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                    <div className="max-w-2xl mx-auto bg-white text-slate-900 rounded-sm p-10 shadow-2xl">
                                        <article className="prose prose-slate max-w-none">
                                            <ReactMarkdown>{academicDocs[academicViewerType] || ''}</ReactMarkdown>
                                        </article>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </aside>

                <section className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/10 shrink-0">
                        <div className="flex bg-slate-900/60 p-1 rounded-lg border border-slate-800">
                            <button
                                onClick={() => setIsEditing(false)}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-2 ${!isEditing ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Preview
                            </button>
                            <button
                                onClick={() => setIsEditing(true)}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-2 ${isEditing ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Edit Inline
                            </button>
                        </div>

                        {/* Word count + ATS coverage indicator */}
                        {state.documents[state.activeTab] && (() => {
                            const content = state.documents[state.activeTab];
                            const wordCount = content.trim().split(/\s+/).length;
                            const isOverLimit = state.activeTab === 'selection-criteria' && wordCount > 2500;

                            // ATS keyword coverage for resume tab
                            let atsLabel: string | null = null;
                            let atsColor = 'text-slate-500';
                            if (state.activeTab === 'resume' && state.keywords && state.keywords.length > 0) {
                                const contentLower = content.toLowerCase();
                                const found = state.keywords.filter(k => contentLower.includes(k.toLowerCase())).length;
                                const pct = Math.round((found / state.keywords.length) * 100);
                                if (pct >= 80) {
                                    atsLabel = `${pct}% ATS COVERAGE`;
                                    atsColor = 'text-emerald-400';
                                } else {
                                    atsLabel = 'JD MATCHED';
                                    atsColor = 'text-indigo-400';
                                }
                            }

                            return (
                                <div className="flex items-center gap-3">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isOverLimit ? 'text-amber-400' : 'text-slate-600'}`}>
                                        {wordCount.toLocaleString()} words
                                        {isOverLimit && ' · check limit'}
                                    </span>
                                    {atsLabel && (
                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${atsColor}`}>
                                            {atsLabel}
                                        </span>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Email version button — only for cover letter */}
                        {state.activeTab === 'cover-letter' && state.documents['cover-letter'] && (
                            <button
                                onClick={handleGetEmailVersion}
                                disabled={generatingEmail}
                                className="flex items-center gap-2 px-3 py-1 bg-sky-600/10 text-sky-400 text-xs font-bold rounded-md hover:bg-sky-600/20 transition-all border border-sky-600/20 disabled:opacity-50"
                            >
                                {generatingEmail ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                                Email Version
                            </button>
                        )}

                        <div className="relative">
                            <button
                                onClick={() => setIsConfirmingRegen(!isConfirmingRegen)}
                                className="flex items-center gap-2 px-3 py-1 bg-brand-600/10 text-brand-400 text-xs font-bold rounded-md hover:bg-brand-600/20 transition-all border border-brand-600/20"
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
                                        className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-2xl z-20"
                                    >
                                        <p className="text-[10px] text-slate-400 font-bold mb-2">What should change? (optional)</p>
                                        <textarea
                                            value={regenerateFeedback}
                                            onChange={e => setRegenerateFeedback(e.target.value)}
                                            placeholder="e.g. Make it more concise · Emphasise leadership · Warmer tone"
                                            rows={2}
                                            className="w-full text-[11px] px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:border-brand-500 mb-2.5"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    handleGenerate(state.activeTab, true);
                                                    setIsConfirmingRegen(false);
                                                }}
                                                className="flex-1 py-1 bg-brand-600 text-white text-[10px] font-bold rounded hover:bg-brand-500"
                                            >
                                                Regenerate
                                            </button>
                                            <button
                                                onClick={() => { setIsConfirmingRegen(false); setRegenerateFeedback(''); }}
                                                className="flex-1 py-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded hover:bg-slate-700"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center bg-slate-900/10 custom-scrollbar">
                        {state.dimensions && state.overallGrade && (
                            <div className="w-full max-w-3xl">
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
                            <div className="w-full max-w-3xl mb-3 flex gap-2 flex-wrap">
                                {profile?.certifications?.length === 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-bold text-amber-400">
                                        <PlusCircle size={10} />
                                        Add certifications to your profile to include this section
                                    </div>
                                )}
                                {profile?.volunteering?.length === 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-bold text-amber-400">
                                        <PlusCircle size={10} />
                                        Add volunteering to your profile. Valued by Australian employers.
                                    </div>
                                )}
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
                                    className="w-full max-w-3xl mb-3 rounded-xl border border-amber-500/30 bg-amber-500/8 overflow-hidden"
                                >
                                    <button
                                        onClick={() => setViolationsExpanded(v => !v)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-500/5 transition-colors text-left"
                                    >
                                        <ShieldAlert size={13} className="text-amber-400 shrink-0" />
                                        <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex-1">Review Before Sending</span>
                                        <span className="text-[10px] font-bold text-amber-500/60 mr-1">
                                            {state.profileViolations!.length} flag{state.profileViolations!.length !== 1 ? 's' : ''}
                                        </span>
                                        <motion.span animate={{ rotate: violationsExpanded ? 180 : 0 }} transition={{ duration: 0.15 }} className="inline-flex">
                                            <ChevronDown size={12} className="text-amber-500/50" />
                                        </motion.span>
                                        <span
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); setViolationsBannerDismissed(true); }}
                                            className="ml-1 text-amber-500/40 hover:text-amber-400 transition-colors"
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
                                                className="overflow-hidden"
                                            >
                                                <div className="px-4 pb-3.5 pt-0.5 border-t border-amber-500/20">
                                                    <p className="text-[11px] text-amber-200/60 leading-relaxed mb-2 mt-2">The AI accuracy check flagged these claims — confirm each one matches your actual experience.</p>
                                                    <ul className="space-y-1">
                                                        {state.profileViolations!.map((v, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-[11px] text-amber-200/80">
                                                                <span className="text-amber-500 mt-0.5 shrink-0">·</span>
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
                        {/* Coaching notes bar — VERIFY pills extracted from document */}
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
                                        className="w-full max-w-3xl mb-3 rounded-xl border border-amber-400/20 bg-amber-400/5 overflow-hidden"
                                    >
                                        <button
                                            onClick={() => setCoachingExpanded(v => !v)}
                                            className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-amber-400/5 transition-colors text-left"
                                        >
                                            <Pencil size={10} className="text-amber-400 shrink-0" />
                                            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex-1">Coaching Notes</span>
                                            <span className="text-[9px] font-bold text-amber-500/60 mr-1">{pills.length} item{pills.length !== 1 ? 's' : ''}</span>
                                            <motion.span animate={{ rotate: coachingExpanded ? 180 : 0 }} transition={{ duration: 0.15 }} className="inline-flex">
                                                <ChevronDown size={11} className="text-amber-500/40" />
                                            </motion.span>
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {coachingExpanded && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-3.5 pb-3 pt-0.5 border-t border-amber-400/15 flex flex-wrap gap-2 mt-1">
                                                        {pills.map((text, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => scrollToVerify(text)}
                                                                title={getCoachingMessage(text)}
                                                                aria-label={`Coaching note: ${text}`}
                                                                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all hover:opacity-80 active:scale-95 group"
                                                                style={{
                                                                    background: 'rgba(251,191,36,0.10)',
                                                                    border: '1px solid rgba(251,191,36,0.30)',
                                                                    color: '#fbbf24',
                                                                }}
                                                            >
                                                                <Pencil size={9} />
                                                                <span className="max-w-[160px] truncate">{text}</span>
                                                                <span
                                                                    className="ml-1 hidden group-hover:inline text-[9px] opacity-70 max-w-[200px] truncate"
                                                                    style={{ color: '#fbbf24' }}
                                                                >
                                                                    — {getCoachingMessage(text)}
                                                                </span>
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

                        {/* Interview prep — empty state */}
                        {state.activeTab === 'interview-prep' && !state.isGenerating && !state.documents['interview-prep'] && (
                            <div className="flex flex-col items-center justify-center py-32 space-y-6 max-w-sm mx-auto text-center">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                    <ChevronRight size={22} className="text-amber-400" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-slate-200 font-bold text-base">Interview Prep</p>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        Builds your story bank and question coaching from your achievement profile.{state.metadata?.company ? ` Tailored for ${state.metadata.company}.` : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleGenerate('interview-prep')}
                                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"
                                >
                                    <ChevronRight size={14} />
                                    Generate Interview Prep
                                </button>
                            </div>
                        )}

                        {/* Interview prep — generating spinner */}
                        {state.activeTab === 'interview-prep' && state.isGenerating && (
                            <div className="flex flex-col items-center justify-center py-40 space-y-6">
                                <div className="relative">
                                    <div className="animate-spin text-amber-500"><RefreshCcw size={48} /></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                                    </div>
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-slate-500 font-bold text-sm tracking-tight">Building your interview prep...</p>
                                    <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mx-auto">
                                        <motion.div className="h-full bg-amber-500" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 20, ease: 'linear' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Interview prep — new structured view */}
                        {state.activeTab === 'interview-prep' && !state.isGenerating && state.documents['interview-prep'] && (
                            <InterviewPrepView
                                doc={state.documents['interview-prep']}
                                company={state.metadata?.company || ''}
                                role={state.metadata?.role || ''}
                            />
                        )}

                        {/* Standard document renderer (resume, cover letter, SC) */}
                        {(state.activeTab !== 'interview-prep') && (
                        <div className="w-full max-w-3xl bg-white text-slate-900 shadow-2xl rounded-sm" style={{ fontFamily: 'Calibri, Arial, "Helvetica Neue", sans-serif' }}>
                            <div className="p-12">
                                {rateLimitError ? (
                                    <div className="flex flex-col items-center justify-center py-40 space-y-4">
                                        <div className="flex items-start gap-3 max-w-md w-full bg-amber-50 border border-amber-200 rounded-xl p-5">
                                            <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                                            <div className="space-y-1">
                                                <p className="text-amber-900 font-bold text-sm">
                                                    You've used all 10 of your free generations today.
                                                </p>
                                                <p className="text-amber-700 text-sm leading-relaxed">
                                                    Come back tomorrow. Your documents and achievements are all saved.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : state.isGenerating ? (
                                    <div className="flex flex-col items-center justify-center py-40 space-y-6">
                                        <div className="relative">
                                            <div className="animate-spin text-brand-600">
                                                <RefreshCcw size={48} />
                                            </div>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-2 h-2 bg-brand-600 rounded-full animate-ping" />
                                            </div>
                                        </div>
                                        <div className="text-center space-y-2">
                                            <p className="text-slate-500 font-bold text-sm tracking-tight">
                                                {"Drafting your " + state.activeTab.replace('-', ' ') + "..."}
                                            </p>
                                            <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden mx-auto">
                                                <motion.div
                                                    className="h-full bg-brand-600"
                                                    initial={{ width: "0%" }}
                                                    animate={{ width: "100%" }}
                                                    transition={{ duration: 15, ease: "linear" }}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleStopGeneration}
                                            className="mt-8 px-6 py-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                                        >
                                            Stop Generation
                                        </button>
                                    </div>
                                ) : isEditing ? (
                                    <textarea
                                        className="w-full h-full min-h-[800px] border-none outline-none focus:ring-0 text-slate-800 font-mono text-sm leading-relaxed p-0 resize-none"
                                        value={state.documents[state.activeTab]}
                                        onChange={(e) => handleUpdateContent(e.target.value)}
                                        placeholder={`Start typing your ${state.activeTab}...`}
                                    />
                                ) : (
                                    <article
                                        id="resume-preview-content"
                                        ref={previewRef}
                                        className={`prose prose-slate max-w-none [&_ul]:my-1 [&_li]:my-0.5 [&_li]:leading-snug [&_h1]:text-[18pt] [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-1 [&_h1]:tracking-tight [&_h2]:text-[10.5pt] [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:border-b [&_h2]:border-slate-300 [&_h2]:pb-0.5 [&_h3]:text-[10.5pt] [&_h3]:font-bold [&_h3]:mt-2.5 [&_h3]:mb-0.5 [&_strong]:font-semibold text-[10.5pt] leading-[1.45] ${state.activeTab === 'cover-letter' ? '[&_p]:my-4 [&_p]:leading-[1.6]' : '[&_p]:my-0.5'}`}
                                        style={{ fontFamily: 'Calibri, Arial, "Helvetica Neue", sans-serif', fontSize: '10.5pt' }}
                                    >
                                        <ReactMarkdown
                                            children={normaliseMarkdown(parseVerifyTokens(state.documents[state.activeTab] || '').stripped)}
                                            components={{
                                                text: ({ children }) => {
                                                    if (typeof children !== 'string') return <>{children}</>;
                                                    if (!children.includes('[MISSING:')) return <>{children}</>;
                                                    const parts = children.split(/(\[MISSING:[^\]]+\])/g);
                                                    return (
                                                        <>
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
                        {applyContext && !state.isGenerating && state.documents[state.activeTab] && (
                            <div className="w-full max-w-3xl mt-4 rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <CheckCircle size={14} className="text-teal-400" />
                                    <span className="text-sm font-bold text-teal-300">Documents ready - time to apply</span>
                                </div>
                                <a
                                    href={applyContext.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-white mb-5 transition-opacity hover:opacity-80"
                                    style={{ background: getPlatformConfig(applyContext.sourcePlatform).color }}
                                >
                                    <ExternalLink size={11} />
                                    Apply on {getPlatformConfig(applyContext.sourcePlatform).label}
                                </a>
                                <ol className="space-y-2.5 mb-5">
                                    {getApplyInstructions(applyContext.sourcePlatform).map((step, i) => (
                                        <li key={i} className="text-xs text-slate-400 flex items-start gap-3">
                                            <span className="text-teal-500 font-black flex-shrink-0 w-4 text-right">{i + 1}.</span>
                                            {step}
                                        </li>
                                    ))}
                                </ol>
                                <button
                                    onClick={handleMarkApplied}
                                    disabled={markingApplied}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider border border-teal-500/30 text-teal-400 hover:bg-teal-500/10 transition-colors disabled:opacity-50"
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

                    {/* Strategist's Notes — docked below scroll area, never overlaps document */}
                    {state.blueprint && !state.isGenerating && (
                        <div className="shrink-0 border-t border-slate-800/60 bg-slate-950">
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
                                className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col overflow-hidden"
                            >
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Mail size={14} className="text-sky-400" />
                                        <span className="text-sm font-bold text-slate-200">Email Application Version</span>
                                    </div>
                                    <button onClick={() => setEmailVersion(null)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                                        <ChevronLeft size={16} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-5">
                                    {/* Subject line */}
                                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subject Line</span>
                                            <button
                                                onClick={() => copyEmailField('subject')}
                                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${copiedEmailField === 'subject' ? 'text-emerald-400 border-emerald-700/40 bg-emerald-500/10' : 'text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'}`}
                                            >
                                                {copiedEmailField === 'subject' ? <CheckCircle size={10} /> : <Copy size={10} />}
                                                {copiedEmailField === 'subject' ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        <p className="px-4 py-3 text-sm text-slate-200 font-medium select-all">{emailVersion.emailSubject}</p>
                                    </div>
                                    {/* Email body */}
                                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/40">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Body</span>
                                            <button
                                                onClick={() => copyEmailField('body')}
                                                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${copiedEmailField === 'body' ? 'text-emerald-400 border-emerald-700/40 bg-emerald-500/10' : 'text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'}`}
                                            >
                                                {copiedEmailField === 'body' ? <CheckCircle size={10} /> : <Copy size={10} />}
                                                {copiedEmailField === 'body' ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        <p className="px-4 py-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap select-all">{emailVersion.emailBody}</p>
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

            {/* Upgrade Modal — 402 response */}
            <AnimatePresence>
                {showUpgradeModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4"
                        onClick={(e) => { if (e.target === e.currentTarget) setShowUpgradeModal(false); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 16 }}
                            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                            className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <Sparkles size={16} className="text-indigo-400" />
                                    <span className="text-sm font-bold text-slate-200">Start your 7-day free trial</span>
                                </div>
                                <button
                                    onClick={() => setShowUpgradeModal(false)}
                                    aria-label="Close"
                                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="px-6 py-6 space-y-5">
                                <p className="text-sm text-slate-300 leading-relaxed">
                                    You've used your free generations — but the work is just getting started.
                                </p>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Try JobHub free for 7 days: unlimited document generation, full workspace access, and every premium feature. You'll need to enter your card details to start — you won't be charged until the trial ends, and you can cancel any time.
                                </p>
                                <div className="flex flex-col gap-2.5">
                                    <button
                                        onClick={() => { setShowUpgradeModal(false); navigate('/pricing'); }}
                                        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
                                    >
                                        Start free trial →
                                    </button>
                                    <button
                                        onClick={() => setShowUpgradeModal(false)}
                                        className="w-full py-2.5 rounded-xl text-slate-400 text-sm font-medium hover:text-slate-200 hover:bg-slate-800 transition-all"
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
