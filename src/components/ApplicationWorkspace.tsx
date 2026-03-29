import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
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
    TrendingUp,
    Linkedin,
    Loader2,
    Copy,
    CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Toaster, toast } from 'sonner';
import { AchievementSelector } from './AchievementSelector';
import { MissingFlag } from './MissingFlag';
import { StrategistDebrief } from './StrategistDebrief';
import { CompanyResearchPanel, CompanyResearch } from './CompanyResearchPanel';
import { CriteriaInputPanel } from './CriteriaInputPanel';
import { GapAnalysisPanel } from './GapAnalysisPanel';
import { SalaryInsightPanel } from './SalaryInsightPanel';
import { InterviewQuestionsPanel } from './InterviewQuestionsPanel';
import { JDSummaryBar } from './JDSummaryBar';
import { ATSCoveragePanel } from './ATSCoveragePanel';
import { exportDocx, DocType } from '../lib/exportDocx';

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
    blueprint?: any | null;
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

// Inline amber pill for [VERIFY: ...] tags produced by the LLM.
const VerifyTag: React.FC<{ description: string }> = ({ description }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <span className="inline-block mx-1">
            <span
                role="button"
                tabIndex={0}
                aria-label={`Verify: ${description}`}
                onClick={() => setExpanded(prev => !prev)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(prev => !prev); }}
                className="bg-amber-100 text-amber-800 border border-amber-300 rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer hover:bg-amber-200 transition-colors select-none"
            >
                {expanded ? description : '✓ verify'}
            </span>
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
    const [regenerateFeedback, setRegenerateFeedback] = useState('');
    const [rateLimitError, setRateLimitError] = useState(false);
    const [companyResearch, setCompanyResearch] = useState<CompanyResearch | null>(null);
    const [selectionCriteriaText, setSelectionCriteriaText] = useState('');
    const [employerFramework, setEmployerFramework] = useState<string | null>(null);

    // Academic documents — generated on demand, stored separately (not in main documents map)
    const [academicDocs, setAcademicDocs] = useState<{ 'teaching-philosophy': string; 'research-statement': string }>({
        'teaching-philosophy': '',
        'research-statement': '',
    });
    const [generatingAcademic, setGeneratingAcademic] = useState<'teaching-philosophy' | 'research-statement' | null>(null);
    const [academicViewerType, setAcademicViewerType] = useState<'teaching-philosophy' | 'research-statement' | null>(null);

    // Cover letter tone preference
    const [coverLetterTone, setCoverLetterTone] = useState<'professional' | 'warm' | 'concise'>('professional');

    // LinkedIn Profile Generator — standalone, stored separately
    const [linkedInDoc, setLinkedInDoc] = useState('');
    const [generatingLinkedIn, setGeneratingLinkedIn] = useState(false);
    const [linkedInViewerOpen, setLinkedInViewerOpen] = useState(false);

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

        if (state.jobApplicationId && !currentDoc && !currentDocId && !state.isGenerating) {
            console.log('Fetching existing documents for Job Application:', state.jobApplicationId);
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
                    // Ensure we don't try again if it fails once
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
        const jobTitle = state.metadata?.role || state.metadata?.company || '';

        try {
            await exportDocx(content, state.activeTab as DocType, candidateName, jobTitle);
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

    const handleGenerate = async (type: WorkspaceState['activeTab'], regenerate = false) => {
        if (state.hasFailed[type] && !regenerate) return;

        const controller = new AbortController();
        setAbortController(controller);
        setRateLimitError(false);

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
                // Pasted selection criteria for SC responses
                selectionCriteriaText: type === 'selection-criteria' ? selectionCriteriaText : null,
                // Employer framework hint for SC (APS ILS, QLD LC4Q, etc.)
                employerFramework: type === 'selection-criteria' ? employerFramework : null,
            }, { signal: controller.signal });
            
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
                blueprint: data.blueprint ?? prev.blueprint
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

        // For SC, don't auto-generate until the user has pasted criteria
        // For interview-prep, auto-generate is fine (just needs the JD)
        const scReady = state.activeTab !== 'selection-criteria' || selectionCriteriaText.trim().length > 20;

        if (state.jobDescription && !hasDoc && !hasDocId && !state.isGenerating && !state.hasFailed[state.activeTab] && scReady) {
            console.log('Triggering generation for:', state.activeTab);
            handleGenerate(state.activeTab);
        }
    }, [state.activeTab, state.jobDescription, state.documents, state.documentIds, state.isGenerating, state.hasFailed, selectionCriteriaText]);


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

    const handleGenerateLinkedIn = async () => {
        if (generatingLinkedIn || !state.jobDescription) return;
        setGeneratingLinkedIn(true);
        try {
            const { data } = await api.post('/generate/linkedin-profile', {
                jobDescription: state.jobDescription,
                selectedAchievementIds: state.selectedAchievementIds,
                jobApplicationId: state.jobApplicationId,
                analysisContext: { tone: state.analysisTone, competencies: state.coreCompetencies },
                employerFramework,
            });
            setLinkedInDoc(data.content);
            setLinkedInViewerOpen(true);
            toast.success('LinkedIn profile sections generated');
        } catch {
            toast.error('Generation failed — try again.');
        } finally {
            setGeneratingLinkedIn(false);
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
        setCopiedEmailField(field);
        setTimeout(() => setCopiedEmailField(null), 1800);
    };

    const handleBack = () => navigate('/');

    // CommonMark collapses consecutive lines into one <p> unless separated by a blank line.
    // Enforce double line-breaks between skill categories and between cover letter paragraphs.
    const normaliseMarkdown = (md: string): string => {
        let out = md;
        // Skill category lines
        out = out.replace(
            /([^\n])\n(\*\*(Technical Skills|Industry Knowledge|Soft Skills):\*\*)/g,
            '$1\n\n$2'
        );
        // Cover letter: single newlines between paragraphs of plain text → double newline
        if (state.activeTab === 'cover-letter') {
            out = out.replace(/([.!?])\n([A-Z])/g, '$1\n\n$2');
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
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                    >
                        <ChevronLeft size={20} />
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
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">match</span>
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
                        className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-600/20"
                    >
                        <Download size={14} />
                        Export .docx
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
                            <CriteriaInputPanel
                                criteriaText={selectionCriteriaText}
                                onChange={setSelectionCriteriaText}
                                company={state.metadata?.company}
                                employerFramework={employerFramework}
                            />
                            {selectionCriteriaText.trim().length > 20 && !state.documents['selection-criteria'] && !state.isGenerating && (
                                <button
                                    onClick={() => handleGenerate('selection-criteria')}
                                    className="w-full mt-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <List size={14} />
                                    Generate SC Responses
                                </button>
                            )}
                        </div>
                    )}

                    {/* Interview prep tab: context panel + question extractor */}
                    {state.activeTab === 'interview-prep' && (
                        <div className="p-4 border-b border-slate-800 shrink-0 overflow-y-auto max-h-[65%] custom-scrollbar space-y-4">
                            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/40">
                                    <ChevronRight size={13} className="text-amber-400" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Interview Prep</span>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-start gap-2.5 p-3 bg-amber-500/5 rounded-lg border border-amber-500/15">
                                        <AlertCircle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                                        <p className="text-[10px] text-slate-400 leading-relaxed">
                                            Generates likely interview questions for this role with STAR answer frameworks built from your achievement bank. Use it to prepare, not to script.
                                            {state.metadata?.company && ` Tailored for ${state.metadata.company}.`}
                                        </p>
                                    </div>
                                    {!state.documents['interview-prep'] && !state.isGenerating && (
                                        <button
                                            onClick={() => handleGenerate('interview-prep')}
                                            className="w-full mt-3 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <ChevronRight size={14} />
                                            Generate Interview Prep
                                        </button>
                                    )}
                                </div>
                            </div>
                            {/* Quick question extractor */}
                            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 overflow-hidden p-4">
                                <InterviewQuestionsPanel jobDescription={state.jobDescription} />
                            </div>
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

                    {/* LinkedIn Profile Generator — always available when JD is loaded */}
                    {state.jobDescription && (
                        <div className="p-4 border-b border-slate-800 shrink-0">
                            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-sky-500/10 bg-sky-500/5">
                                    <Linkedin size={13} className="text-sky-400" />
                                    <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">LinkedIn Optimiser</span>
                                </div>
                                <div className="p-4">
                                    <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
                                        Generate a headline, About section, and 10 featured skills tailored to this role.
                                    </p>
                                    <button
                                        onClick={handleGenerateLinkedIn}
                                        disabled={generatingLinkedIn}
                                        className="w-full py-2 bg-sky-600/20 hover:bg-sky-600/30 disabled:opacity-50 text-sky-300 text-[11px] font-bold rounded-lg border border-sky-500/30 transition-all flex items-center justify-center gap-2"
                                    >
                                        {generatingLinkedIn ? (
                                            <Loader2 size={11} className="animate-spin" />
                                        ) : <Linkedin size={11} />}
                                        {linkedInDoc ? 'Regenerate' : 'Generate'} LinkedIn Sections
                                    </button>
                                    {linkedInDoc && (
                                        <button
                                            onClick={() => setLinkedInViewerOpen(true)}
                                            className="w-full mt-1.5 py-1.5 text-[10px] font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                                        >
                                            View / Copy
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Salary Insight Panel */}
                    {state.metadata?.role && (
                        <div className="p-4 border-b border-slate-800 shrink-0">
                            <SalaryInsightPanel
                                role={state.metadata.role}
                                company={state.metadata.company}
                                location="Australia"
                            />
                        </div>
                    )}

                    {/* Gap Analysis Panel — shown after first document generates */}
                    {(state.documents.resume || state.documents['cover-letter'] || state.documents['selection-criteria']) && !state.isGenerating && (
                        <div className="p-4 border-b border-slate-800 shrink-0">
                            <GapAnalysisPanel
                                jobDescription={state.jobDescription}
                                keywords={state.keywords}
                            />
                        </div>
                    )}

                    {/* ATS Coverage Panel — shown when resume or cover-letter is ready */}
                    {(state.documents.resume || state.documents['cover-letter']) && !state.isGenerating && (
                        <div className="p-4 border-b border-slate-800 shrink-0">
                            <ATSCoveragePanel
                                document={state.documents[state.activeTab as 'resume' | 'cover-letter'] || state.documents.resume || state.documents['cover-letter']}
                                jobDescription={state.jobDescription}
                                docType={state.activeTab}
                            />
                        </div>
                    )}

                    <div className="px-4 pt-4 border-b border-slate-800 shrink-0">
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

                    {/* LinkedIn viewer modal */}
                    <AnimatePresence>
                        {linkedInViewerOpen && linkedInDoc && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-950/95 z-20 flex flex-col overflow-hidden"
                            >
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Linkedin size={14} className="text-sky-400" />
                                        <span className="text-sm font-bold text-slate-200">LinkedIn Profile Sections</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(linkedInDoc); toast.success('Copied to clipboard'); }}
                                            className="text-[10px] font-black text-sky-400 border border-sky-700/50 px-3 py-1.5 rounded-lg hover:bg-sky-500/10 transition-colors uppercase tracking-wider"
                                        >
                                            Copy All
                                        </button>
                                        <button
                                            onClick={() => setLinkedInViewerOpen(false)}
                                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                    <div className="max-w-2xl mx-auto bg-white text-slate-900 rounded-sm p-10 shadow-2xl">
                                        <article className="prose prose-slate max-w-none">
                                            <ReactMarkdown>{linkedInDoc}</ReactMarkdown>
                                        </article>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

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
                            const charCount = content.length;
                            const isOverLimit = state.activeTab === 'selection-criteria' && wordCount > 2500;

                            // ATS keyword coverage for resume tab
                            let atsLabel: string | null = null;
                            let atsColor = 'text-slate-500';
                            if (state.activeTab === 'resume' && state.keywords && state.keywords.length > 0) {
                                const contentLower = content.toLowerCase();
                                const found = state.keywords.filter(k => contentLower.includes(k.toLowerCase())).length;
                                const pct = Math.round((found / state.keywords.length) * 100);
                                atsLabel = `${pct}% ATS coverage`;
                                atsColor = pct >= 70 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
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
                        <div className="w-full max-w-3xl bg-white text-slate-900 shadow-2xl rounded-sm flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar-light">
                                {rateLimitError ? (
                                    <div className="flex flex-col items-center justify-center h-full py-40 space-y-4">
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
                                    <div className="flex flex-col items-center justify-center h-full py-40 space-y-6">
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
                                    <article id="resume-preview-content" className="prose prose-slate max-w-none [&_p]:my-0.5 [&_ul]:my-1 [&_li]:my-0 [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:mt-2 [&_h3]:mb-0.5">
                                        <ReactMarkdown
                                            children={normaliseMarkdown(state.documents[state.activeTab] || '')}
                                            components={{
                                                text: ({ children }) => {
                                                    if (typeof children !== 'string') return <>{children}</>;
                                                    const hasMissing = children.includes('[MISSING:');
                                                    const hasVerify = children.includes('[VERIFY:');
                                                    if (!hasMissing && !hasVerify) return <>{children}</>;

                                                    // Split on both tag types in a single pass
                                                    const parts = children.split(/(\[MISSING:[^\]]+\]|\[VERIFY:[^\]]+\])/g);
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
                                                                if (part.startsWith('[VERIFY:')) {
                                                                    const description = part.replace(/^\[VERIFY:\s*/, '').replace(/\]$/, '').trim();
                                                                    return <VerifyTag key={i} description={description} />;
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
                        {state.blueprint && !state.isGenerating && (
                            <StrategistDebrief
                                blueprint={state.blueprint}
                                rankedAchievements={state.rankedAchievements}
                                companyName={state.metadata?.company}
                            />
                        )}
                    </div>

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
        </div>
    );
};
