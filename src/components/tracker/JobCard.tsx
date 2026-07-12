import React, { useState } from 'react';
import {
    FileText,
    Clock,
    X,
    Trophy,
    Calendar,
    Copy,
    ChevronDown,
    ChevronUp,
    Bell,
    Trash2,
    Mail,
    Loader2,
    Sparkles,
    HelpCircle,
    ExternalLink,
    MessageSquare,
} from 'lucide-react';
import { InterviewQuestionsPanel } from '../InterviewQuestionsPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { renderTemplate } from '../../lib/emailTemplates';
import { exportDocx } from '../../lib/exportDocx';
import { exportPdf } from '../../lib/exportPdf';
import type { JobApplication, TrackerDocument, ApplicationStatus, JobPriority } from './types';
import { PRIORITY_CONFIG, STATUS_FLOW } from './types';
import { STATUS_CONFIG } from './constants';
import { warm } from '../../lib/theme/warmTokens';

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysSinceApplied(dateApplied: string | null): number | null {
    if (!dateApplied) return null;
    const diff = Date.now() - new Date(dateApplied).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const BADGE_COLORS: Record<TrackerDocument['type'], { label: string; color: string }> = {
    RESUME: { label: 'Resume', color: '#7DA67D' },
    COVER_LETTER: { label: 'Cover Letter', color: '#C5A059' },
    STAR_RESPONSE: { label: 'Selection Criteria', color: '#2D5A6E' },
};

// ─── DocumentBadge ──────────────────────────────────────────────────────────

const DocumentBadge: React.FC<{ type: TrackerDocument['type'] }> = ({ type }) => {
    const cfg = BADGE_COLORS[type];
    return (
        <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '1px 6px', borderRadius: 4, border: `1px solid ${cfg.color}40`,
            color: cfg.color, background: `${cfg.color}14`,
        }}>
            {cfg.label}
        </span>
    );
};

// ─── DocumentViewerModal ────────────────────────────────────────────────────

const DocumentViewerModal: React.FC<{
    doc: TrackerDocument;
    jobTitle: string;
    company: string;
    onClose: () => void;
}> = ({ doc, jobTitle, company, onClose }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(doc.content);
        toast.success('Copied to clipboard');
    };

    const handleDownload = async () => {
        const docTypeMap: Record<TrackerDocument['type'], 'resume' | 'cover-letter' | 'selection-criteria'> = {
            RESUME: 'resume',
            COVER_LETTER: 'cover-letter',
            STAR_RESPONSE: 'selection-criteria',
        };
        try {
            await exportDocx(doc.content, docTypeMap[doc.type], company, jobTitle);
            toast.success('Downloaded as .docx');
        } catch {
            toast.error('Download failed, copy the content instead.');
        }
    };

    const handleDownloadPdf = async () => {
        const docTypeMap: Record<TrackerDocument['type'], 'resume' | 'cover-letter' | 'selection-criteria'> = {
            RESUME: 'resume',
            COVER_LETTER: 'cover-letter',
            STAR_RESPONSE: 'selection-criteria',
        };
        try {
            await exportPdf(doc.content, docTypeMap[doc.type], company, jobTitle, '');
            toast.success('Downloaded as PDF');
        } catch {
            toast.error('PDF download failed, try .docx instead.');
        }
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    const [dlHovered, setDlHovered] = useState(false);
    const [pdfHovered, setPdfHovered] = useState(false);
    const [copyHovered, setCopyHovered] = useState(false);

    return (
        <div
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label={`Document viewer: ${doc.title ?? doc.type}`}
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'rgba(26, 24, 20, 0.36)',
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                padding: 0,
            }}
            className="sm:items-center sm:p-6"
        >
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 768,
                    background: warm.colors.bgSurface,
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    borderRadius: '16px 16px 0 0',
                    display: 'flex', flexDirection: 'column',
                    height: '100%', maxHeight: '85vh',
                    overflow: 'hidden',
                }}
                className="sm:rounded-2xl"
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                    padding: '16px 20px', borderBottom: `1px solid ${warm.colors.borderWhisper}`, flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <DocumentBadge type={doc.type} />
                        <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{jobTitle}</p>
                            <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                            onClick={handleDownload}
                            aria-label="Download as Word document"
                            onMouseEnter={() => setDlHovered(true)}
                            onMouseLeave={() => setDlHovered(false)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                                borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                letterSpacing: '0.04em', cursor: 'pointer',
                                color: warm.colors.success, border: `1px solid rgba(42,157,111,${dlHovered ? 0.50 : 0.35})`,
                                background: dlHovered ? 'rgba(42,157,111,0.10)' : 'transparent',
                            }}
                        >
                            <FileText size={11} />
                            .docx
                        </button>
                        <button
                            onClick={handleDownloadPdf}
                            aria-label="Download as PDF"
                            onMouseEnter={() => setPdfHovered(true)}
                            onMouseLeave={() => setPdfHovered(false)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                                borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                letterSpacing: '0.04em', cursor: 'pointer',
                                color: warm.colors.danger, border: `1px solid ${warm.colors.danger}${pdfHovered ? '60' : '40'}`,
                                background: pdfHovered ? `${warm.colors.danger}10` : 'transparent',
                            }}
                        >
                            <FileText size={11} />
                            .pdf
                        </button>
                        <button
                            onClick={handleCopy}
                            aria-label="Copy document content to clipboard"
                            onMouseEnter={() => setCopyHovered(true)}
                            onMouseLeave={() => setCopyHovered(false)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                                borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                letterSpacing: '0.04em', cursor: 'pointer',
                                color: copyHovered ? warm.colors.textSecondary : warm.colors.textMuted,
                                border: `1px solid ${copyHovered ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
                                background: 'transparent',
                            }}
                        >
                            <Copy size={11} />
                            Copy
                        </button>
                        <button
                            onClick={onClose}
                            aria-label="Close document viewer"
                            style={{
                                padding: '5px 6px', borderRadius: 8, background: 'transparent', border: 'none',
                                cursor: 'pointer', color: warm.colors.textMuted, display: 'flex',
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                    <div className="prose prose-slate max-w-none">
                        <ReactMarkdown>{doc.content}</ReactMarkdown>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

// ─── FollowUpNudge ───────────────────────────────────────────────────────────

const EmailFinderTutorial: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [hunterHovered, setHunterHovered] = useState(false);
    const [rocketHovered, setRocketHovered] = useState(false);
    const [linkedinHovered, setLinkedinHovered] = useState(false);
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'rgba(26, 24, 20, 0.36)',
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 448,
                    background: warm.colors.bgSurface,
                    border: `1px solid ${warm.colors.borderDefined}`,
                    borderRadius: 16, padding: 24,
                    display: 'flex', flexDirection: 'column', gap: 16,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: warm.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>How to find the right email</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: warm.colors.textMuted, padding: 2, display: 'flex' }}><X size={16} /></button>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                    Before sending, find the recruiter or hiring manager's email using one of these free tools:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Hunter.io */}
                    <div style={{
                        background: warm.colors.bgAlt, borderRadius: 12, padding: 16,
                        border: `1px solid ${hunterHovered ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
                        transition: 'border-color 0.15s',
                    }}
                        onMouseEnter={() => setHunterHovered(true)}
                        onMouseLeave={() => setHunterHovered(false)}
                    >
                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: warm.colors.accentPetrol }}>Hunter.io, fastest option</p>
                        <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: warm.colors.textSecondary, display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'decimal' }}>
                            <li>Go to <strong>hunter.io</strong></li>
                            <li>Enter the company's website domain (e.g. <strong>accenture.com</strong>)</li>
                            <li>Browse the list of emails or search by name</li>
                            <li>25 free searches per month</li>
                        </ol>
                    </div>
                    {/* RocketReach */}
                    <div style={{
                        background: warm.colors.bgAlt, borderRadius: 12, padding: 16,
                        border: `1px solid ${rocketHovered ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
                        transition: 'border-color 0.15s',
                    }}
                        onMouseEnter={() => setRocketHovered(true)}
                        onMouseLeave={() => setRocketHovered(false)}
                    >
                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#7C6CB5' }}>RocketReach, by name + company</p>
                        <ol style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: warm.colors.textSecondary, display: 'flex', flexDirection: 'column', gap: 2, listStyle: 'decimal' }}>
                            <li>Go to <strong>rocketreach.co</strong></li>
                            <li>Search for the person's name + company</li>
                            <li>Free plan includes limited lookups</li>
                        </ol>
                    </div>
                    {/* LinkedIn */}
                    <div style={{
                        background: warm.colors.bgAlt, borderRadius: 12, padding: 16,
                        border: `1px solid ${linkedinHovered ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
                        transition: 'border-color 0.15s',
                    }}
                        onMouseEnter={() => setLinkedinHovered(true)}
                        onMouseLeave={() => setLinkedinHovered(false)}
                    >
                        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: warm.colors.accentGold }}>LinkedIn, if you can't find an email</p>
                        <p style={{ margin: 0, fontSize: 11, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                            Send a connection request with a short note, "Hi [Name], I recently applied for [Role] at [Company] and wanted to connect." Many recruiters respond to direct LinkedIn messages.
                        </p>
                    </div>
                </div>
                <p style={{ margin: 0, fontSize: 10, color: warm.colors.textMuted }}>If the hiring manager's name is unknown, address it to "Hiring Team" or the relevant department head.</p>
            </div>
        </div>
    );
};

type UrgencyCounts = { red: number; amber: number; green: number };

const TrafficLightCounter: React.FC<{ counts: UrgencyCounts }> = ({ counts }) => {
    const items = [
        { key: 'red', value: counts.red, color: warm.colors.danger },
        { key: 'amber', value: counts.amber, color: warm.colors.accentGold },
        { key: 'green', value: counts.green, color: warm.colors.success },
    ].filter(i => i.value > 0);
    if (items.length === 0) return null;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {items.map(i => (
                <span key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: i.color, fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: i.color, display: 'inline-block' }} />
                    {i.value}
                </span>
            ))}
        </div>
    );
};

export const FollowUpNudge: React.FC<{ jobs: JobApplication[] }> = ({ jobs }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);
    const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

    const { data: profile } = useQuery({
        queryKey: ['profile', 'lite-for-followup'],
        queryFn: async () => (await api.get('/profile')).data,
        staleTime: 10 * 60 * 1000,
    });

    const dueJobs = jobs.filter(j => {
        const days = daysSinceApplied(j.dateApplied);
        return j.status === 'APPLIED' && days !== null && days >= 7;
    });

    if (dueJobs.length === 0) return null;

    const urgencyCounts = dueJobs.reduce<UrgencyCounts>((acc, job) => {
        const days = daysSinceApplied(job.dateApplied) ?? 0;
        if (days >= 18) acc.red++;
        else if (days >= 11) acc.amber++;
        else acc.green++;
        return acc;
    }, { red: 0, amber: 0, green: 0 });

    const handleCopy = (_job: JobApplication, template: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(template);
        toast.success('Copied to clipboard');
    };

    const toggleExpand = (id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    return (
        <>
            {showTutorial && <EmailFinderTutorial onClose={() => setShowTutorial(false)} />}
            <div style={{
                background: 'rgba(197,160,89,0.05)',
                border: '1px solid rgba(197,160,89,0.30)',
                borderRadius: 16, overflow: 'hidden',
            }}>
                <button
                    onClick={() => setIsOpen(o => !o)}
                    aria-expanded={isOpen}
                    aria-label="Toggle follow-up reminders"
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 20px', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left', color: 'inherit', fontFamily: 'inherit',
                    }}
                >
                    <Bell size={16} style={{ color: warm.colors.accentGold, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: warm.colors.accentGold, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Follow-up Reminder
                    </span>
                    <TrafficLightCounter counts={urgencyCounts} />
                    {isOpen ? (
                        <ChevronUp size={16} style={{ color: 'rgba(197,160,89,0.6)', flexShrink: 0 }} />
                    ) : (
                        <ChevronDown size={16} style={{ color: 'rgba(197,160,89,0.6)', flexShrink: 0 }} />
                    )}
                </button>

                <AnimatePresence initial={false}>
                    {isOpen && (
                        <motion.div
                            key="followup-body"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            style={{ overflow: 'hidden', borderTop: '1px solid rgba(197,160,89,0.20)' }}
                        >
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 12,
                                padding: '12px 20px',
                            }}>
                                <p style={{ margin: 0, fontSize: 11, color: warm.colors.accentGold, opacity: 0.7, fontWeight: 500, flex: 1 }}>
                                    These applications are 7+ days old. Time to reach out, click to view your template.
                                </p>
                                <button
                                    onClick={() => setShowTutorial(true)}
                                    title="How to find the right email address"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 3,
                                        fontSize: 10, color: 'rgba(197,160,89,0.6)', background: 'transparent',
                                        border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: 2,
                                    }}
                                >
                                    <HelpCircle size={13} />
                                    <span>Find email</span>
                                </button>
                            </div>

                            <div style={{ borderTop: 'none' }}>
                                {dueJobs.map(job => {
                                    const days = daysSinceApplied(job.dateApplied) as number;
                                    const isRowOpen = expandedId === job.id;
                                    const rendered = renderTemplate('application-followup', job, profile);

                                    return (
                                        <div key={job.id} style={{
                                            borderTop: '1px solid rgba(197,160,89,0.10)',
                                        }}>
                                            <button
                                                onClick={() => toggleExpand(job.id)}
                                                aria-expanded={isRowOpen}
                                                aria-label={`Toggle follow-up template for ${job.title} at ${job.company}`}
                                                onMouseEnter={() => setHoveredRowId(job.id)}
                                                onMouseLeave={() => setHoveredRowId(null)}
                                                style={{
                                                    width: '100%', padding: '12px 20px',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    gap: 16, textAlign: 'left', background: hoveredRowId === job.id ? 'rgba(197,160,89,0.10)' : 'transparent',
                                                    border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
                                                    transition: 'background 0.15s',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {job.title} at {job.company}
                                                        </p>
                                                    </div>
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 800, color: 'rgba(197,160,89,0.8)',
                                                        background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.20)',
                                                        padding: '1px 6px', borderRadius: 4, flexShrink: 0,
                                                    }}>
                                                        {days}d ago
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                    <button
                                                        onClick={(e) => handleCopy(job, rendered.full, e)}
                                                        aria-label={`Copy follow-up email for ${job.title}`}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                                            borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                                            letterSpacing: '0.04em', color: warm.colors.accentGold,
                                                            border: '1px solid rgba(197,160,89,0.30)',
                                                            background: 'transparent', cursor: 'pointer',
                                                        }}
                                                    >
                                                        <Copy size={10} />
                                                        Copy
                                                    </button>
                                                    {isRowOpen ? (
                                                        <ChevronUp size={14} style={{ color: 'rgba(197,160,89,0.6)' }} />
                                                    ) : (
                                                        <ChevronDown size={14} style={{ color: 'rgba(197,160,89,0.6)' }} />
                                                    )}
                                                </div>
                                            </button>

                                            <AnimatePresence initial={false}>
                                                {isRowOpen && (
                                                    <motion.div
                                                        key="template"
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                        style={{ overflow: 'hidden' }}
                                                    >
                                                        <div style={{ padding: '0 20px 16px' }}>
                                                            <pre style={{
                                                                margin: 0, fontSize: 12, color: warm.colors.textSecondary,
                                                                whiteSpace: 'pre-wrap', fontFamily: "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
                                                                lineHeight: 1.65,
                                                                padding: 16, background: warm.colors.bgAlt,
                                                                borderRadius: 12, border: `1px solid ${warm.colors.borderWhisper}`,
                                                            }}>
                                                                {rendered.full}
                                                            </pre>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};

// ─── ThankYouNudge ──────────────────────────────────────────────────────────

export const ThankYouNudge: React.FC<{ jobs: JobApplication[] }> = ({ jobs }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

    const { data: profile } = useQuery({
        queryKey: ['profile', 'lite-for-thankyou'],
        queryFn: async () => (await api.get('/profile')).data,
        staleTime: 10 * 60 * 1000,
    });

    const interviewJobs = jobs.filter(j => j.status === 'INTERVIEW');

    if (interviewJobs.length === 0) return null;

    const urgencyCounts = interviewJobs.reduce<UrgencyCounts>((acc, job) => {
        const days = daysSinceApplied(job.dateApplied) ?? 0;
        if (days >= 14) acc.red++;
        else if (days >= 7) acc.amber++;
        else acc.green++;
        return acc;
    }, { red: 0, amber: 0, green: 0 });

    const toggleExpand = (id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    return (
        <div style={{
            background: 'rgba(197,160,89,0.05)',
            border: '1px solid rgba(197,160,89,0.30)',
            borderRadius: 16, overflow: 'hidden',
        }}>
            <button
                onClick={() => setIsOpen(o => !o)}
                aria-expanded={isOpen}
                aria-label="Toggle thank-you reminders"
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left', color: 'inherit', fontFamily: 'inherit',
                }}
            >
                <Bell size={16} style={{ color: warm.colors.accentGold, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: warm.colors.accentGold, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Thank-You Due
                </span>
                <TrafficLightCounter counts={urgencyCounts} />
                {isOpen ? (
                    <ChevronUp size={16} style={{ color: 'rgba(197,160,89,0.6)', flexShrink: 0 }} />
                ) : (
                    <ChevronDown size={16} style={{ color: 'rgba(197,160,89,0.6)', flexShrink: 0 }} />
                )}
            </button>

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        key="thankyou-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden', borderTop: '1px solid rgba(197,160,89,0.20)' }}
                    >
                        <p style={{ margin: 0, fontSize: 11, color: warm.colors.accentGold, opacity: 0.7, fontWeight: 500, padding: '12px 20px' }}>
                            Interview scheduled or just had one? Australian recruiters expect a thank-you note within 24 hours. Click any job to copy your template.
                        </p>

                        <div style={{ borderTop: 'none' }}>
                            {interviewJobs.map(job => {
                                const isRowOpen = expandedId === job.id;
                                const rendered = renderTemplate('interview-thankyou', job, profile);

                                return (
                                    <div key={job.id} style={{
                                        borderTop: '1px solid rgba(197,160,89,0.10)',
                                    }}>
                                        <button
                                            onClick={() => toggleExpand(job.id)}
                                            aria-expanded={isRowOpen}
                                            aria-label={`Toggle thank-you template for ${job.title} at ${job.company}`}
                                            onMouseEnter={() => setHoveredRowId(job.id)}
                                            onMouseLeave={() => setHoveredRowId(null)}
                                            style={{
                                                width: '100%', padding: '12px 20px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                gap: 16, textAlign: 'left', background: hoveredRowId === job.id ? 'rgba(197,160,89,0.10)' : 'transparent',
                                                border: 'none', cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
                                                transition: 'background 0.15s',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {job.title} at {job.company}
                                                    </p>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(rendered.full);
                                                        toast.success('Copied to clipboard');
                                                    }}
                                                    aria-label={`Copy thank-you email for ${job.title}`}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                                        borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                                        letterSpacing: '0.04em', color: warm.colors.accentGold,
                                                        border: '1px solid rgba(197,160,89,0.30)',
                                                        background: 'transparent', cursor: 'pointer',
                                                    }}
                                                >
                                                    <Copy size={10} />
                                                    Copy
                                                </button>
                                                {isRowOpen ? (
                                                    <ChevronUp size={14} style={{ color: 'rgba(197,160,89,0.6)' }} />
                                                ) : (
                                                    <ChevronDown size={14} style={{ color: 'rgba(197,160,89,0.6)' }} />
                                                )}
                                            </div>
                                        </button>

                                        <AnimatePresence initial={false}>
                                            {isRowOpen && (
                                                <motion.div
                                                    key="template"
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                        {/* Cultural context note */}
                                                        <p style={{
                                                            margin: 0, fontSize: 12, fontStyle: 'italic',
                                                            color: warm.colors.textMuted, lineHeight: 1.5,
                                                        }}>
                                                            <strong>Why this matters:</strong> In Australia, sending a thank-you email within 24 hours of an interview is the standard. Recruiters notice when it's missing, it's one of the lowest-effort moves with the highest signal. Most people from outside Australia don't know it's expected.
                                                        </p>

                                                        <pre style={{
                                                            margin: 0, fontSize: 12, color: warm.colors.textSecondary,
                                                            whiteSpace: 'pre-wrap', fontFamily: "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
                                                            lineHeight: 1.65,
                                                            padding: 16, background: warm.colors.bgAlt,
                                                            borderRadius: 12, border: `1px solid ${warm.colors.borderWhisper}`,
                                                        }}>
                                                            {rendered.full}
                                                        </pre>

                                                        <p style={{ margin: 0, fontSize: 9, color: 'rgba(197,160,89,0.5)', fontStyle: 'italic' }}>
                                                            Replace all [bracketed placeholders] before sending.
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── JobCard ────────────────────────────────────────────────────────────────

interface JobCardProps {
    job: JobApplication;
    isFirst?: boolean;
    onStatusChange: (id: string, status: ApplicationStatus, dateApplied?: string) => void;
    onDelete: (id: string) => void;
    onNotesChange: (id: string, notes: string) => void;
    onPriorityChange: (id: string, priority: JobPriority) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, isFirst, onStatusChange, onDelete, onNotesChange, onPriorityChange }) => {
    const [expanded, setExpanded] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<TrackerDocument | null>(null);
    const [thankYouOpen, setThankYouOpen] = useState(false);
    const [interviewPrepOpen, setInterviewPrepOpen] = useState(false);
    const [notesValue, setNotesValue] = useState(job.notes || '');
    const [notesSaving, setNotesSaving] = useState(false);
    const [negotiationGuide, setNegotiationGuide] = useState<string | null>(null);
    const [generatingNegotiation, setGeneratingNegotiation] = useState(false);
    const [negotiationOpen, setNegotiationOpen] = useState(false);
    const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
    const [coldOutreach, setColdOutreach] = useState<string | null>(null);
    const [generatingOutreach, setGeneratingOutreach] = useState(false);
    const [outreachOpen, setOutreachOpen] = useState(false);
    const [rejectionResponse, setRejectionResponse] = useState<string | null>(null);
    const [generatingRejection, setGeneratingRejection] = useState(false);
    const [rejectionOpen, setRejectionOpen] = useState(false);
    const [actionItems, setActionItems] = useState<Array<{ text: string; type: string; urgency: string }>>([]);
    const [extractingActions, setExtractingActions] = useState(false);
    const [cardHovered, setCardHovered] = useState(false);

    const { data: profile } = useQuery({
        queryKey: ['profile', 'lite-for-followup'],
        queryFn: async () => (await api.get('/profile')).data,
        staleTime: 10 * 60 * 1000,
    });

    const days = daysSinceApplied(job.dateApplied);
    const showFollowUpAlert = job.status === 'APPLIED' && days !== null && days >= 7;

    const config = STATUS_CONFIG[job.status];
    const StatusIcon = config.icon;

    const handleStatusSelect = (status: ApplicationStatus) => {
        const dateApplied = status === 'APPLIED' && !job.dateApplied ? new Date().toISOString() : undefined;
        onStatusChange(job.id, status, dateApplied);
    };

    const handleNotesSave = async () => {
        if (notesValue === (job.notes || '')) return;
        setNotesSaving(true);
        try {
            await onNotesChange(job.id, notesValue);
        } finally {
            setNotesSaving(false);
        }
    };

    const handleExtractActions = async () => {
        if (extractingActions || notesValue.trim().length < 20) return;
        setExtractingActions(true);
        try {
            const { data } = await api.post('/analyze/notes-actions', {
                notes: notesValue,
                jobTitle: job.title,
                company: job.company,
                status: job.status,
            });
            setActionItems(data.actions || []);
        } catch {
            // silent
        } finally {
            setExtractingActions(false);
        }
    };

    const handleGenerateColdOutreach = async () => {
        if (coldOutreach) { setOutreachOpen(true); return; }
        setGeneratingOutreach(true);
        setOutreachOpen(true);
        try {
            const { data } = await api.post('/generate/cold-outreach', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                analysisContext: { tone: 'professional', competencies: [] },
            });
            setColdOutreach(data.content);
        } catch {
            toast.error('Could not generate outreach, try again.');
            setOutreachOpen(false);
        } finally {
            setGeneratingOutreach(false);
        }
    };

    const handleGenerateRejectionResponse = async () => {
        if (rejectionResponse) { setRejectionOpen(true); return; }
        setGeneratingRejection(true);
        setRejectionOpen(true);
        try {
            const { data } = await api.post('/generate/rejection-response', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                analysisContext: { tone: 'professional', competencies: [] },
            });
            setRejectionResponse(data.content);
        } catch {
            toast.error('Could not generate response, try again.');
            setRejectionOpen(false);
        } finally {
            setGeneratingRejection(false);
        }
    };

    const handleGenerateNegotiation = async () => {
        if (generatingNegotiation || negotiationGuide) { setNegotiationOpen(true); return; }
        setGeneratingNegotiation(true);
        setNegotiationOpen(true);
        try {
            const { data } = await api.post('/generate/offer-negotiation', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                analysisContext: { tone: 'professional', competencies: [] },
            });
            setNegotiationGuide(data.content);
        } catch {
            toast.error('Could not generate negotiation guide.');
            setNegotiationOpen(false);
        } finally {
            setGeneratingNegotiation(false);
        }
    };

    return (
        <>
            <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onMouseEnter={() => setCardHovered(true)}
                onMouseLeave={() => setCardHovered(false)}
                style={{
                    background: warm.colors.bgSurface,
                    border: `1px solid ${showFollowUpAlert ? 'rgba(197,160,89,0.40)' : cardHovered ? warm.colors.borderDefined : warm.colors.borderWhisper}`,
                    borderRadius: 18,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                }}
            >
                {showFollowUpAlert && (
                    <div style={{
                        padding: '6px 20px', background: 'rgba(197,160,89,0.10)',
                        borderBottom: '1px solid rgba(197,160,89,0.20)',
                        display: 'flex', alignItems: 'center', gap: 8,
                        color: warm.colors.accentGold, fontSize: 11, fontWeight: 700,
                    }}>
                        <Clock size={12} />
                        {days} days since you applied. Time to follow up.
                    </div>
                )}

                <div style={{ padding: 20, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span
                                    {...(isFirst ? { 'data-process-step': 'track' } : {})}
                                    style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                    borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                    letterSpacing: '0.06em', ...config.style,
                                }}>
                                    <StatusIcon size={10} />
                                    {config.label}
                                </span>
                                {/* Priority badge, click to cycle */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setPriorityMenuOpen(o => !o); }}
                                        style={job.priority ? {
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '1px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            background: PRIORITY_CONFIG[job.priority].bg,
                                            border: `1px solid ${PRIORITY_CONFIG[job.priority].border}`,
                                            color: PRIORITY_CONFIG[job.priority].text,
                                        } : {
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            padding: '1px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            background: warm.colors.bgAlt,
                                            border: `1px dashed ${warm.colors.borderWhisper}`,
                                            color: warm.colors.textMuted,
                                        }}
                                    >
                                        {job.priority ? (
                                            <><span style={{ width: 5, height: 5, borderRadius: '50%', background: PRIORITY_CONFIG[job.priority].dot, display: 'inline-block' }} />{PRIORITY_CONFIG[job.priority].label}</>
                                        ) : <span>Set priority</span>}
                                    </button>
                                    <AnimatePresence>
                                        {priorityMenuOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 4 }}
                                                transition={{ duration: 0.12 }}
                                                style={{
                                                    position: 'absolute', left: 0, top: 'calc(100% + 4px)', zIndex: 20,
                                                    background: warm.colors.bgSurface,
                                                    border: `1px solid ${warm.colors.borderWhisper}`,
                                                    borderRadius: 14, overflow: 'hidden',
                                                    boxShadow: warm.shadow.lifted, minWidth: 110,
                                                }}
                                            >
                                                {(['DREAM', 'TARGET', 'BACKUP'] as const).map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => { onPriorityChange(job.id, p); setPriorityMenuOpen(false); }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            width: '100%', padding: '8px 12px', fontSize: 11, fontWeight: 700,
                                                            border: 'none', background: 'transparent', cursor: 'pointer',
                                                            color: PRIORITY_CONFIG[p].text, textAlign: 'left',
                                                            transition: 'background 0.12s',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = warm.colors.bgAlt}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_CONFIG[p].dot, display: 'inline-block', flexShrink: 0 }} />
                                                        {PRIORITY_CONFIG[p].label}
                                                    </button>
                                                ))}
                                                {job.priority && (
                                                    <button
                                                        onClick={() => { onPriorityChange(job.id, null); setPriorityMenuOpen(false); }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            width: '100%', padding: '8px 12px', fontSize: 11, fontWeight: 700,
                                                            border: 'none', background: 'transparent', cursor: 'pointer',
                                                            color: warm.colors.textMuted, textAlign: 'left',
                                                            transition: 'background 0.12s',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = warm.colors.bgAlt}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                {/* Match score, gold accent */}
                                {job.matchScore != null && (
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '1px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                                        color: warm.colors.accentGold,
                                        background: 'rgba(197,160,89,0.10)',
                                        border: '1px solid rgba(197,160,89,0.25)',
                                    }}>
                                        {job.matchScore}%
                                    </span>
                                )}
                                {days !== null && job.status !== 'REJECTED' && (
                                    <span style={{ fontSize: 10, color: warm.colors.textMuted, fontWeight: 700 }}>
                                        {days}d ago
                                    </span>
                                )}
                                {job.closingDate && job.status === 'SAVED' && (() => {
                                    const dLeft = Math.ceil((new Date(job.closingDate).getTime() - Date.now()) / 86_400_000);
                                    if (dLeft > 14) return null;
                                    const badgeStyle: React.CSSProperties = dLeft <= 2
                                        ? { color: warm.colors.danger, background: warm.colors.dangerSoft, border: '1px solid rgba(184,92,92,0.20)' }
                                        : dLeft <= 7
                                        ? { color: warm.colors.accentGold, background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.20)' }
                                        : { color: warm.colors.textMuted, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}` };
                                    return (
                                        <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4, ...badgeStyle }}>
                                            {dLeft <= 0 ? 'Closed' : dLeft === 1 ? 'Due tomorrow' : `${dLeft}d left`}
                                        </span>
                                    );
                                })()}
                            </div>
                            <h3 style={{ margin: 0, fontWeight: 700, color: warm.colors.textPrimary, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</h3>
                            <p style={{ margin: 0, fontSize: 13, color: warm.colors.textSecondary, fontWeight: 500 }}>{job.company}</p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            {job.documents.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: warm.colors.textMuted }}>
                                    <FileText size={12} />
                                    <span style={{ fontSize: 10, fontWeight: 700 }}>{job.documents.length}</span>
                                </div>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                                aria-expanded={expanded}
                                aria-label={expanded ? 'Collapse job details' : 'Expand job details'}
                                style={{
                                    padding: '5px 6px', borderRadius: 8, background: 'transparent', border: 'none',
                                    cursor: 'pointer', color: warm.colors.textMuted, display: 'flex',
                                }}
                            >
                                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{ overflow: 'hidden', borderTop: `1px solid ${warm.colors.borderWhisper}` }}
                        >
                            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Status pipeline */}
                                <div>
                                    <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Update Status</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {STATUS_FLOW.map(status => {
                                            const sc = STATUS_CONFIG[status];
                                            const SI = sc.icon;
                                            const isActive = job.status === status;
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => handleStatusSelect(status)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 4,
                                                        padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 800,
                                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                                        cursor: 'pointer', transition: 'all 0.15s',
                                                        ...(isActive ? sc.style : {
                                                            color: warm.colors.textMuted,
                                                            background: warm.colors.bgAlt,
                                                            border: `1px solid ${warm.colors.borderWhisper}`,
                                                        }),
                                                    }}
                                                >
                                                    <SI size={10} />
                                                    {sc.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Date applied */}
                                {job.status !== 'SAVED' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Calendar size={12} style={{ color: warm.colors.textMuted }} />
                                        <span style={{ fontSize: 12, color: warm.colors.textSecondary }}>
                                            {job.dateApplied
                                                ? `Applied ${new Date(job.dateApplied).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`
                                                : 'Application date not set'}
                                        </span>
                                    </div>
                                )}

                                {/* Closing date */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Clock size={12} style={{ color: warm.colors.textMuted, flexShrink: 0 }} />
                                    <span style={{ fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Deadline:</span>
                                    <input
                                        type="date"
                                        defaultValue={job.closingDate ? new Date(job.closingDate).toISOString().slice(0, 10) : ''}
                                        onBlur={async e => {
                                            const val = e.target.value || null;
                                            await api.patch(`/jobs/${job.id}`, { closingDate: val });
                                        }}
                                        style={{
                                            flex: 1, background: 'transparent', border: 'none',
                                            fontSize: 12, color: warm.colors.textSecondary,
                                            outline: 'none', cursor: 'pointer',
                                        }}
                                    />
                                    {job.closingDate && (() => {
                                        const daysLeft = Math.ceil((new Date(job.closingDate).getTime() - Date.now()) / 86_400_000);
                                        const badgeS: React.CSSProperties = daysLeft <= 2
                                            ? { color: warm.colors.danger, background: warm.colors.dangerSoft, border: '1px solid rgba(184,92,92,0.20)' }
                                            : daysLeft <= 7
                                            ? { color: warm.colors.accentGold, background: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.20)' }
                                            : { color: warm.colors.textMuted, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}` };
                                        return daysLeft >= 0 ? (
                                            <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4, ...badgeS }}>
                                                {daysLeft === 0 ? 'Today!' : `${daysLeft}d left`}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4, color: warm.colors.textMuted, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}` }}>Closed</span>
                                        );
                                    })()}
                                </div>

                                {/* Documents */}
                                {job.documents.length > 0 && (
                                    <div>
                                        <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Documents</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {job.documents.map(doc => (
                                                <button
                                                    key={doc.id}
                                                    onClick={() => setSelectedDoc(doc)}
                                                    aria-label={`View ${doc.title ?? doc.type} document`}
                                                    style={{
                                                        cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                                                    }}
                                                >
                                                    <DocumentBadge type={doc.type} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {job.sourceUrl && (
                                    <a
                                        href={job.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                                            letterSpacing: '0.06em', color: warm.colors.textMuted,
                                            border: `1px solid ${warm.colors.borderWhisper}`,
                                            borderRadius: 8, padding: '5px 12px', textDecoration: 'none',
                                            width: 'fit-content',
                                        }}
                                    >
                                        <ExternalLink size={10} />
                                        View listing →
                                    </a>
                                )}

                                {/* Post-interview thank-you email */}
                                {/* Interview prep — likely questions with CAR talking points */}
                                {job.description && job.description.length >= 50 && (
                                    <div style={{
                                        border: '1px solid rgba(99,102,241,0.30)',
                                        borderRadius: 12, overflow: 'hidden',
                                        background: 'rgba(99,102,241,0.05)',
                                    }}>
                                        <button
                                            onClick={() => setInterviewPrepOpen(o => !o)}
                                            style={{
                                                width: '100%', padding: '12px 16px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                color: 'inherit', fontFamily: 'inherit',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <MessageSquare size={13} style={{ color: '#818cf8' }} />
                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8' }}>Interview prep</span>
                                            </div>
                                            {interviewPrepOpen ? <ChevronUp size={12} style={{ color: 'rgba(99,102,241,0.6)' }} /> : <ChevronDown size={12} style={{ color: 'rgba(99,102,241,0.6)' }} />}
                                        </button>
                                        <AnimatePresence>
                                            {interviewPrepOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    style={{ overflow: 'hidden', borderTop: '1px solid rgba(99,102,241,0.15)' }}
                                                >
                                                    <div style={{ padding: 16 }}>
                                                        <InterviewQuestionsPanel jobDescription={job.description} />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {job.status === 'INTERVIEW' && (
                                    <div style={{
                                        border: '1px solid rgba(197,160,89,0.30)',
                                        borderRadius: 12, overflow: 'hidden',
                                        background: 'rgba(197,160,89,0.05)',
                                    }}>
                                        <button
                                            onClick={() => setThankYouOpen(o => !o)}
                                            style={{
                                                width: '100%', padding: '12px 16px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                color: 'inherit', fontFamily: 'inherit',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Mail size={13} style={{ color: warm.colors.accentGold }} />
                                                <span style={{ fontSize: 12, fontWeight: 700, color: warm.colors.accentGold }}>Thank-you email</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {thankYouOpen ? <ChevronUp size={12} style={{ color: 'rgba(197,160,89,0.6)' }} /> : <ChevronDown size={12} style={{ color: 'rgba(197,160,89,0.6)' }} />}
                                            </div>
                                        </button>
                                        <AnimatePresence>
                                            {thankYouOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    style={{ overflow: 'hidden', borderTop: '1px solid rgba(197,160,89,0.15)' }}
                                                >
                                                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                        {/* Cultural context note */}
                                                        <p style={{
                                                            margin: 0, fontSize: 12, fontStyle: 'italic',
                                                            color: warm.colors.textMuted, lineHeight: 1.5,
                                                        }}>
                                                            <strong>Why this matters:</strong> In Australia, sending a thank-you email within 24 hours of an interview is the standard. Recruiters notice when it's missing — it's one of the lowest-effort moves with the highest signal. Most people from outside Australia don't know it's expected.
                                                        </p>

                                                        {/* Template */}
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                                <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(197,160,89,0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Template</span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const rendered = renderTemplate('interview-thankyou', job, profile);
                                                                        navigator.clipboard.writeText(rendered.full);
                                                                        toast.success('Copied to clipboard');
                                                                    }}
                                                                    style={{
                                                                        fontSize: 9, fontWeight: 700, color: warm.colors.accentGold,
                                                                        border: '1px solid rgba(197,160,89,0.30)', padding: '1px 8px',
                                                                        borderRadius: 4, background: 'transparent', cursor: 'pointer',
                                                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                                                    }}
                                                                >
                                                                    Copy
                                                                </button>
                                                            </div>
                                                            <pre style={{
                                                                margin: 0, fontSize: 12, color: warm.colors.textSecondary,
                                                                whiteSpace: 'pre-wrap', fontFamily: "'Geist', -apple-system, 'Segoe UI', system-ui, sans-serif",
                                                                lineHeight: 1.65,
                                                                padding: 16, background: warm.colors.bgAlt,
                                                                borderRadius: 12, border: `1px solid ${warm.colors.borderWhisper}`,
                                                            }}>
                                                                {renderTemplate('interview-thankyou', job, profile).full}
                                                            </pre>
                                                        </div>

                                                        <p style={{ margin: 0, fontSize: 9, color: 'rgba(197,160,89,0.5)', fontStyle: 'italic' }}>
                                                            Replace all [bracketed placeholders] before sending.
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Offer negotiation guide */}
                                {job.status === 'OFFER' && (
                                    <div style={{
                                        border: '1px solid rgba(42,157,111,0.20)',
                                        borderRadius: 12, overflow: 'hidden',
                                        background: 'rgba(42,157,111,0.05)',
                                    }}>
                                        <button
                                            onClick={handleGenerateNegotiation}
                                            style={{
                                                width: '100%', padding: '12px 16px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                color: 'inherit', fontFamily: 'inherit',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Trophy size={13} style={{ color: warm.colors.success }} />
                                                <span style={{ fontSize: 12, fontWeight: 700, color: warm.colors.success }}>Negotiation Guide</span>
                                                {!negotiationGuide && !generatingNegotiation && (
                                                    <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(42,157,111,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                        <Sparkles size={9} /> AI-personalised
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {generatingNegotiation && <Loader2 size={12} className="animate-spin" style={{ color: warm.colors.success }} />}
                                                {negotiationGuide && !generatingNegotiation && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(negotiationGuide); toast.success('Copied'); }}
                                                        style={{
                                                            fontSize: 9, fontWeight: 700, color: warm.colors.success,
                                                            border: '1px solid rgba(42,157,111,0.30)', padding: '1px 8px',
                                                            borderRadius: 4, background: 'transparent', cursor: 'pointer',
                                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                                        }}
                                                    >
                                                        Copy
                                                    </button>
                                                )}
                                                {negotiationOpen ? <ChevronUp size={12} style={{ color: 'rgba(42,157,111,0.6)' }} /> : <ChevronDown size={12} style={{ color: 'rgba(42,157,111,0.6)' }} />}
                                            </div>
                                        </button>
                                        <AnimatePresence>
                                            {negotiationOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    style={{ overflow: 'hidden', borderTop: '1px solid rgba(42,157,111,0.15)' }}
                                                >
                                                    <div style={{ padding: 16 }}>
                                                        {generatingNegotiation ? (
                                                            <p style={{ margin: 0, fontSize: 12, color: 'rgba(42,157,111,0.6)', textAlign: 'center', padding: '8px 0' }}>Generating personalised negotiation guide…</p>
                                                        ) : negotiationGuide ? (
                                                            <div className="prose prose-slate max-w-none" style={{ color: warm.colors.textSecondary, fontSize: 12 }}>
                                                                <ReactMarkdown>{negotiationGuide}</ReactMarkdown>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Rejection response, REJECTED jobs only */}
                                {job.status === 'REJECTED' && (
                                    <div style={{
                                        border: `1px solid ${warm.colors.borderWhisper}`,
                                        borderRadius: 12, overflow: 'hidden',
                                        background: warm.colors.bgAlt,
                                    }}>
                                        <button
                                            onClick={handleGenerateRejectionResponse}
                                            style={{
                                                width: '100%', padding: '12px 16px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                color: 'inherit', fontFamily: 'inherit',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Mail size={13} style={{ color: warm.colors.textMuted }} />
                                                <span style={{ fontSize: 12, fontWeight: 700, color: warm.colors.textSecondary }}>Rejection Response</span>
                                                {!rejectionResponse && !generatingRejection && (
                                                    <span style={{ fontSize: 9, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                        <Sparkles size={9} /> Keep door open
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {generatingRejection && <Loader2 size={12} className="animate-spin" style={{ color: warm.colors.textMuted }} />}
                                                {rejectionResponse && !generatingRejection && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(rejectionResponse); toast.success('Copied'); }}
                                                        style={{
                                                            fontSize: 9, fontWeight: 700, color: warm.colors.textMuted,
                                                            border: `1px solid ${warm.colors.borderWhisper}`, padding: '1px 8px',
                                                            borderRadius: 4, background: 'transparent', cursor: 'pointer',
                                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                                        }}
                                                    >
                                                        Copy
                                                    </button>
                                                )}
                                                {rejectionOpen ? <ChevronUp size={12} style={{ color: warm.colors.textMuted }} /> : <ChevronDown size={12} style={{ color: warm.colors.textMuted }} />}
                                            </div>
                                        </button>
                                        <AnimatePresence>
                                            {rejectionOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    style={{ overflow: 'hidden', borderTop: `1px solid ${warm.colors.borderWhisper}` }}
                                                >
                                                    <div style={{ padding: 16 }}>
                                                        {generatingRejection ? (
                                                            <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, textAlign: 'center', padding: '8px 0' }}>Generating graceful response…</p>
                                                        ) : rejectionResponse ? (
                                                            <div className="prose prose-slate max-w-none" style={{ color: warm.colors.textSecondary, fontSize: 12 }}>
                                                                <ReactMarkdown>{rejectionResponse}</ReactMarkdown>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Cold outreach generator, SAVED jobs only */}
                                {job.status === 'SAVED' && (
                                    <div style={{
                                        border: '1px solid rgba(45,90,110,0.20)',
                                        borderRadius: 12, overflow: 'hidden',
                                        background: 'rgba(45,90,110,0.05)',
                                    }}>
                                        <button
                                            onClick={handleGenerateColdOutreach}
                                            style={{
                                                width: '100%', padding: '12px 16px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                color: 'inherit', fontFamily: 'inherit',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Mail size={13} style={{ color: warm.colors.accentPetrol }} />
                                                <span style={{ fontSize: 12, fontWeight: 700, color: warm.colors.accentPetrol }}>Cold Outreach Message</span>
                                                {!coldOutreach && !generatingOutreach && (
                                                    <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(45,90,110,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                        <Sparkles size={9} /> LinkedIn DM + Email
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {generatingOutreach && <Loader2 size={12} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />}
                                                {coldOutreach && !generatingOutreach && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(coldOutreach); toast.success('Copied'); }}
                                                        style={{
                                                            fontSize: 9, fontWeight: 700, color: warm.colors.accentPetrol,
                                                            border: '1px solid rgba(45,90,110,0.30)', padding: '1px 8px',
                                                            borderRadius: 4, background: 'transparent', cursor: 'pointer',
                                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                                        }}
                                                    >
                                                        Copy
                                                    </button>
                                                )}
                                                {outreachOpen ? <ChevronUp size={12} style={{ color: 'rgba(45,90,110,0.6)' }} /> : <ChevronDown size={12} style={{ color: 'rgba(45,90,110,0.6)' }} />}
                                            </div>
                                        </button>
                                        <AnimatePresence>
                                            {outreachOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    style={{ overflow: 'hidden', borderTop: '1px solid rgba(45,90,110,0.15)' }}
                                                >
                                                    <div style={{ padding: 16 }}>
                                                        {generatingOutreach ? (
                                                            <p style={{ margin: 0, fontSize: 12, color: 'rgba(45,90,110,0.6)', textAlign: 'center', padding: '8px 0' }}>Generating outreach messages…</p>
                                                        ) : coldOutreach ? (
                                                            <div className="prose prose-slate max-w-none" style={{ color: warm.colors.textSecondary, fontSize: 12 }}>
                                                                <ReactMarkdown>{coldOutreach}</ReactMarkdown>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Notes */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {notesSaving && <span style={{ fontSize: 9, color: warm.colors.textMuted, fontWeight: 700 }}>Saving…</span>}
                                            {notesValue.trim().length >= 20 && (
                                                <button
                                                    onClick={handleExtractActions}
                                                    disabled={extractingActions}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 3,
                                                        fontSize: 9, fontWeight: 700, color: warm.colors.accentPetrol,
                                                        background: 'transparent', border: 'none', cursor: extractingActions ? 'not-allowed' : 'pointer',
                                                        opacity: extractingActions ? 0.5 : 1,
                                                    }}
                                                >
                                                    {extractingActions ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />}
                                                    Extract Actions
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <textarea
                                        value={notesValue}
                                        onChange={e => setNotesValue(e.target.value)}
                                        placeholder="Interview details, contact names, talking points, salary discussed…"
                                        rows={3}
                                        style={{
                                            width: '100%', background: warm.colors.bgAlt,
                                            border: `1px solid ${warm.colors.borderWhisper}`,
                                            borderRadius: 12, padding: '10px 12px', fontSize: 12,
                                            color: warm.colors.textPrimary, outline: 'none',
                                            transition: 'border-color 0.15s', resize: 'none',
                                            lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box',
                                        }}
                                        onFocus={e => { e.currentTarget.style.borderColor = warm.colors.accentPetrol; }}
                                        onBlur={e => { e.currentTarget.style.borderColor = warm.colors.borderWhisper; handleNotesSave(); }}
                                    />
                                    {/* Action items extracted from notes */}
                                    <AnimatePresence>
                                        {actionItems.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                style={{ overflow: 'hidden', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}
                                            >
                                                <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: warm.colors.accentPetrol, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action Items</p>
                                                {actionItems.map((item, i) => {
                                                    const ac: React.CSSProperties = item.urgency === 'high'
                                                        ? { color: warm.colors.danger, border: '1px solid rgba(184,92,92,0.20)', background: warm.colors.dangerSoft }
                                                        : item.urgency === 'medium'
                                                        ? { color: warm.colors.accentGold, border: '1px solid rgba(197,160,89,0.20)', background: 'rgba(197,160,89,0.05)' }
                                                        : { color: warm.colors.textMuted, border: `1px solid ${warm.colors.borderWhisper}`, background: warm.colors.bgAlt };
                                                    return (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 12, ...ac }}>
                                                            <span style={{ fontWeight: 800, fontSize: 10, marginTop: 1, flexShrink: 0 }}>{i + 1}</span>
                                                            <span style={{ lineHeight: 1.5 }}>{item.text}</span>
                                                        </div>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Delete */}
                                <div style={{ paddingTop: 12, borderTop: `1px solid ${warm.colors.borderWhisper}` }}>
                                    <button
                                        onClick={() => onDelete(job.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            fontSize: 10, fontWeight: 700, color: warm.colors.textMuted,
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                        }}
                                    >
                                        <Trash2 size={12} />
                                        Remove application
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <AnimatePresence>
                {selectedDoc && (
                    <DocumentViewerModal
                        key={selectedDoc.id}
                        doc={selectedDoc}
                        jobTitle={job.title}
                        company={job.company}
                        onClose={() => setSelectedDoc(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
};
