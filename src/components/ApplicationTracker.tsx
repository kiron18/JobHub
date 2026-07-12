import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Briefcase,
    ChevronRight,
    Clock,
    Trophy,
    Loader2,
    EyeOff,
    ExternalLink,
    RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '../lib/api';
import type { JobApplication, ApplicationStatus, JobPriority } from './tracker/types';
import { STATUS_FLOW } from './tracker/types';
import { STATUS_CONFIG } from './tracker/constants';
import { JobCard, FollowUpNudge, ThankYouNudge } from './tracker/JobCard';
import { PipelineFunnel } from './tracker/PipelineFunnel';
import { SortControls } from './tracker/SortControls';
import type { SortBy } from './tracker/SortControls';
import { SectionIntroBanner } from './processStrip';
import { warm } from '../lib/theme/warmTokens';
import { ActivityHeatmap } from './tracker/ActivityHeatmap';
import { GoalCard } from './tracker/GoalCard';

const PRIORITY_ORDER: Record<string, number> = { DREAM: 0, TARGET: 1, BACKUP: 2 };

function daysSinceApplied(dateApplied: string | null): number | null {
    if (!dateApplied) return null;
    const diff = Date.now() - new Date(dateApplied).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export const ApplicationTracker: React.FC = () => {
    const queryClient = useQueryClient();
    const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'ALL' | 'SKIPPED'>('ALL');
    const [sortBy, setSortBy] = useState<SortBy>('match');
    const [gradeFilter, setGradeFilter] = useState<'ALL' | 'AB' | 'C' | 'DF'>('ALL');
    const [showAddForm, setShowAddForm] = useState(false);
    const [addForm, setAddForm] = useState({ title: '', company: '', status: 'SAVED' as ApplicationStatus, dateApplied: '', notes: '' });

    const { data: jobs = [], isLoading } = useQuery<JobApplication[]>({
        queryKey: ['jobs'],
        queryFn: async () => {
            const { data } = await api.get('/jobs');
            return data;
        },
        refetchOnMount: true
    });

    const { data: skippedJobs = [], isLoading: skippedLoading } = useQuery<any[]>({
        queryKey: ['skipped-jobs'],
        queryFn: async () => {
            const { data } = await api.get('/job-feed/skipped');
            return data.jobs ?? [];
        },
        enabled: filterStatus === 'SKIPPED',
    });

    const restoreSkipMutation = useMutation({
        mutationFn: async (sourceUrl: string) => {
            const { data } = await api.post('/job-feed/skipped/restore', { sourceUrl });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['skipped-jobs'] });
            queryClient.invalidateQueries({ queryKey: ['job-feed'] });
            toast.success('Restored to feed');
        },
        onError: () => {
            toast.error('Failed to restore job');
        },
    });

    const updateJobMutation = useMutation({
        mutationFn: async ({ id, status, dateApplied }: { id: string; status: ApplicationStatus; dateApplied?: string }) => {
            const { data } = await api.patch(`/jobs/${id}`, { status, dateApplied });
            return data;
        },
        onMutate: async ({ id, status, dateApplied }) => {
            await queryClient.cancelQueries({ queryKey: ['jobs'] });
            const previous = queryClient.getQueryData<JobApplication[]>(['jobs']);
            queryClient.setQueryData<JobApplication[]>(['jobs'], old =>
                old?.map(j => j.id === id
                    ? { ...j, status, ...(dateApplied !== undefined ? { dateApplied } : {}) }
                    : j
                ) ?? []
            );
            return { previous };
        },
        onError: (_err, _vars, context: any) => {
            if (context?.previous) queryClient.setQueryData(['jobs'], context.previous);
            toast.error('Failed to update status');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
        },
    });

    const updateNotesMutation = useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            const { data } = await api.patch(`/jobs/${id}`, { notes });
            return data;
        },
        onError: () => {
            toast.error('Failed to save notes');
        }
    });

    const deleteJobMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/jobs/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            toast.success('Application removed');
        },
        onError: () => {
            toast.error('Failed to remove application');
        }
    });

    const handleStatusChange = (id: string, status: ApplicationStatus, dateApplied?: string) => {
        updateJobMutation.mutate({ id, status, dateApplied });
    };

    const handleDelete = (id: string) => {
        deleteJobMutation.mutate(id);
    };

    const handleNotesChange = async (id: string, notes: string) => {
        await updateNotesMutation.mutateAsync({ id, notes });
    };

    const updatePriorityMutation = useMutation({
        mutationFn: async ({ id, priority }: { id: string; priority: JobPriority }) => {
            const { data } = await api.patch(`/jobs/${id}`, { priority });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
        },
        onError: () => {
            toast.error('Failed to update priority');
        }
    });

    const handlePriorityChange = (id: string, priority: JobPriority) => {
        updatePriorityMutation.mutate({ id, priority });
    };

    const createJobMutation = useMutation({
        mutationFn: async (form: typeof addForm) => {
            const { data } = await api.post('/jobs', {
                title: form.title,
                company: form.company,
                description: `${form.title} at ${form.company} — manually added.`,
                status: form.status,
                dateApplied: form.dateApplied || null,
                notes: form.notes || null,
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            setShowAddForm(false);
            setAddForm({ title: '', company: '', status: 'SAVED', dateApplied: '', notes: '' });
            toast.success('Application added');
        },
        onError: () => {
            toast.error('Failed to add application');
        }
    });

    const handleAddJob = () => {
        if (!addForm.title.trim() || !addForm.company.trim()) return;
        createJobMutation.mutate(addForm);
    };

    const statusFiltered = filterStatus === 'ALL' ? jobs : jobs.filter(j => j.status === filterStatus);

    const gradeFiltered = gradeFilter === 'ALL' ? statusFiltered
        : gradeFilter === 'AB' ? statusFiltered.filter(j => j.overallGrade === 'A' || j.overallGrade === 'B')
        : gradeFilter === 'C'  ? statusFiltered.filter(j => j.overallGrade === 'C')
        : statusFiltered.filter(j => j.overallGrade === 'D' || j.overallGrade === 'F');

    const filteredJobs = [...gradeFiltered].sort((a, b) => {
        if (sortBy === 'match') {
            const aScore = a.matchScore ?? -1;
            const bScore = b.matchScore ?? -1;
            return bScore - aScore;
        }
        if (sortBy === 'priority') {
            const pa = a.priority ? (PRIORITY_ORDER[a.priority] ?? 3) : 3;
            const pb = b.priority ? (PRIORITY_ORDER[b.priority] ?? 3) : 3;
            if (pa !== pb) return pa - pb;
        }
        if (sortBy === 'company') {
            return (a.company || '').localeCompare(b.company || '');
        }
        if (sortBy === 'deadline') {
            const da = a.closingDate ? new Date(a.closingDate).getTime() : Infinity;
            const db = b.closingDate ? new Date(b.closingDate).getTime() : Infinity;
            return da - db;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const counts = {
        ALL: jobs.length,
        APPLIED: jobs.filter(j => j.status === 'APPLIED').length,
        INTERVIEW: jobs.filter(j => j.status === 'INTERVIEW').length,
        OFFER: jobs.filter(j => j.status === 'OFFER').length,
        SAVED: jobs.filter(j => j.status === 'SAVED').length,
        REJECTED: jobs.filter(j => j.status === 'REJECTED').length,
    };

    const followUpDue = jobs.filter(j => {
        const days = daysSinceApplied(j.dateApplied);
        return j.status === 'APPLIED' && days !== null && days >= 7;
    }).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <SectionIntroBanner sectionId="applications">
                Every job you've started or applied to lives here. Track status, set follow-up reminders, and surface interview notes in one place.
            </SectionIntroBanner>
            <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.02em', color: warm.colors.textPrimary, margin: 0 }}>Application Tracker</h1>
                <p style={{ margin: 0, fontSize: 16, color: warm.colors.textSecondary, fontWeight: 500 }}>What we measure, we improve. Stay ahead of the game by knowing what volume you're putting out, when to follow up, and how to keep connections strong.</p>
            </header>

            <GoalCard />

            {!isLoading && <FollowUpNudge jobs={jobs} />}
            {!isLoading && <ThankYouNudge jobs={jobs} />}
            {!isLoading && <ActivityHeatmap />}

            {/* Stats bar — compact horizontal strip, fits screen width */}
            <div style={{
                display: 'flex', alignItems: 'stretch',
                background: warm.colors.bgSurface,
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 14, overflow: 'hidden',
            }}>
                {[
                    { label: 'Total', value: counts.ALL, color: warm.colors.textPrimary },
                    { label: 'Applied', value: counts.APPLIED, color: warm.colors.accentPetrol },
                    { label: 'Interviews', value: counts.INTERVIEW, color: warm.colors.accentGold, rate: counts.APPLIED > 0 ? `${Math.round((counts.INTERVIEW / Math.max(counts.APPLIED + counts.INTERVIEW, 1)) * 100)}%` : null },
                    { label: 'Offers', value: counts.OFFER, color: counts.OFFER > 0 ? warm.colors.success : warm.colors.textMuted, icon: Trophy, rate: counts.INTERVIEW > 0 && counts.OFFER > 0 ? `${Math.round((counts.OFFER / counts.INTERVIEW) * 100)}%` : null },
                    { label: 'Follow-up Due', value: followUpDue, color: followUpDue > 0 ? warm.colors.accentGold : warm.colors.textMuted, icon: Clock, highlight: followUpDue > 0 },
                ].map((stat, i) => (
                    <div key={i} style={{
                        flex: 1, minWidth: 0, padding: '8px 6px',
                        borderLeft: i > 0 ? `1px solid ${warm.colors.borderWhisper}` : 'none',
                        background: stat.highlight ? 'rgba(197,160,89,0.06)' : 'transparent',
                        display: 'flex', flexDirection: 'column', gap: 2,
                    }}
                    className="sm:px-3.5 sm:py-2.5"
                    >
                        <p style={{
                            margin: 0, fontSize: 8, fontWeight: 800, textTransform: 'uppercase',
                            letterSpacing: '0.02em', lineHeight: 1.3,
                            color: i === 1 ? warm.colors.accentPetrol : i === 2 ? warm.colors.accentGold : i === 3 ? warm.colors.success : stat.highlight ? warm.colors.accentGold : warm.colors.textMuted,
                            display: 'flex', alignItems: 'center', gap: 3,
                        }}
                        className="sm:text-[10px] sm:tracking-[0.06em]"
                        >
                            {stat.icon && <stat.icon size={9} className="hidden sm:inline-block flex-shrink-0" />}
                            <span style={{ minWidth: 0 }}>{stat.label}</span>
                        </p>
                        <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', fontWeight: 800, color: stat.color as string, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</span>
                            {stat.rate && <span style={{ fontSize: 10, color: warm.colors.textMuted, fontWeight: 700 }}>{stat.rate}</span>}
                        </p>
                    </div>
                ))}
            </div>

            {/* Pipeline Funnel — only shown when there are active applications */}
            {counts.APPLIED + counts.INTERVIEW + counts.OFFER > 0 && (
                <PipelineFunnel counts={counts} />
            )}

            {/* Add Job Manually */}
            <div>
                <button
                    onClick={() => setShowAddForm(s => !s)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                        background: warm.colors.bgSurface, color: warm.colors.textSecondary,
                        fontSize: 12, fontWeight: 700, borderRadius: 12,
                        border: `1px solid ${warm.colors.borderWhisper}`, cursor: 'pointer',
                        transition: 'all 0.15s',
                    }}
                >
                    <Briefcase size={13} />
                    Add Application Manually
                </button>
                <AnimatePresence>
                    {showAddForm && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div style={{
                                marginTop: 12, padding: 20,
                                background: warm.colors.bgSurface,
                                border: `1px solid ${warm.colors.borderWhisper}`,
                                borderRadius: 18,
                                display: 'flex', flexDirection: 'column', gap: 12,
                            }}>
                                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Track an application from outside JobHub</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="sm:grid-cols-2">
                                    <div>
                                        <label style={{ fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Job Title *</label>
                                        <input
                                            value={addForm.title}
                                            onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                                            placeholder="e.g. Senior Product Manager"
                                            style={{
                                                width: '100%', background: warm.colors.bgAlt,
                                                border: `1px solid ${warm.colors.borderWhisper}`,
                                                borderRadius: 10, padding: '8px 12px', fontSize: 12,
                                                color: warm.colors.textPrimary, outline: 'none',
                                                boxSizing: 'border-box', fontFamily: 'inherit',
                                            }}
                                            onFocus={e => { e.currentTarget.style.borderColor = warm.colors.accentPetrol; }}
                                            onBlur={e => { e.currentTarget.style.borderColor = warm.colors.borderWhisper; }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Company *</label>
                                        <input
                                            value={addForm.company}
                                            onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))}
                                            placeholder="e.g. Atlassian"
                                            style={{
                                                width: '100%', background: warm.colors.bgAlt,
                                                border: `1px solid ${warm.colors.borderWhisper}`,
                                                borderRadius: 10, padding: '8px 12px', fontSize: 12,
                                                color: warm.colors.textPrimary, outline: 'none',
                                                boxSizing: 'border-box', fontFamily: 'inherit',
                                            }}
                                            onFocus={e => { e.currentTarget.style.borderColor = warm.colors.accentPetrol; }}
                                            onBlur={e => { e.currentTarget.style.borderColor = warm.colors.borderWhisper; }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Status</label>
                                        <select
                                            value={addForm.status}
                                            onChange={e => setAddForm(f => ({ ...f, status: e.target.value as ApplicationStatus }))}
                                            style={{
                                                width: '100%', background: warm.colors.bgAlt,
                                                border: `1px solid ${warm.colors.borderWhisper}`,
                                                borderRadius: 10, padding: '8px 12px', fontSize: 12,
                                                color: warm.colors.textPrimary, outline: 'none',
                                                boxSizing: 'border-box', fontFamily: 'inherit',
                                            }}
                                            onFocus={e => { e.currentTarget.style.borderColor = warm.colors.accentPetrol; }}
                                            onBlur={e => { e.currentTarget.style.borderColor = warm.colors.borderWhisper; }}
                                        >
                                            {STATUS_FLOW.map(s => (
                                                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Date Applied</label>
                                        <input
                                            type="date"
                                            value={addForm.dateApplied}
                                            onChange={e => setAddForm(f => ({ ...f, dateApplied: e.target.value }))}
                                            style={{
                                                width: '100%', background: warm.colors.bgAlt,
                                                border: `1px solid ${warm.colors.borderWhisper}`,
                                                borderRadius: 10, padding: '8px 12px', fontSize: 12,
                                                color: warm.colors.textPrimary, outline: 'none',
                                                boxSizing: 'border-box', fontFamily: 'inherit',
                                            }}
                                            onFocus={e => { e.currentTarget.style.borderColor = warm.colors.accentPetrol; }}
                                            onBlur={e => { e.currentTarget.style.borderColor = warm.colors.borderWhisper; }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: 10, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
                                    <input
                                        value={addForm.notes}
                                        onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                                        placeholder="Recruiter name, application portal, role details…"
                                        style={{
                                            width: '100%', background: warm.colors.bgAlt,
                                            border: `1px solid ${warm.colors.borderWhisper}`,
                                            borderRadius: 10, padding: '8px 12px', fontSize: 12,
                                            color: warm.colors.textPrimary, outline: 'none',
                                            boxSizing: 'border-box', fontFamily: 'inherit',
                                        }}
                                        onFocus={e => { e.currentTarget.style.borderColor = warm.colors.accentPetrol; }}
                                        onBlur={e => { e.currentTarget.style.borderColor = warm.colors.borderWhisper; }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                                    <button
                                        onClick={handleAddJob}
                                        disabled={!addForm.title.trim() || !addForm.company.trim() || createJobMutation.isPending}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                                            background: warm.colors.accentPetrol, color: '#FFFFFF',
                                            fontSize: 12, fontWeight: 700, borderRadius: 10,
                                            border: 'none', cursor: createJobMutation.isPending ? 'not-allowed' : 'pointer',
                                            opacity: (!addForm.title.trim() || !addForm.company.trim() || createJobMutation.isPending) ? 0.5 : 1,
                                        }}
                                    >
                                        {createJobMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Briefcase size={13} />}
                                        Add Application
                                    </button>
                                    <button
                                        onClick={() => { setShowAddForm(false); setAddForm({ title: '', company: '', status: 'SAVED', dateApplied: '', notes: '' }); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                                            background: warm.colors.bgAlt, color: warm.colors.textMuted,
                                            fontSize: 12, fontWeight: 700, borderRadius: 10,
                                            border: 'none', cursor: 'pointer',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Filters + Sort */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                {(['ALL', 'SKIPPED', ...STATUS_FLOW] as const).map(status => {
                    const isSkipped = status === 'SKIPPED';
                    const config = isSkipped ? null : status === 'ALL' ? null : STATUS_CONFIG[status];
                    const active = filterStatus === status;
                    const count = isSkipped ? skippedJobs.length : counts[status];
                    return (
                        <button
                            key={status as string}
                            onClick={() => setFilterStatus(status)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '5px 12px', borderRadius: 8, fontSize: 10, fontWeight: 800,
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                cursor: 'pointer', transition: 'all 0.15s',
                                ...(active
                                    ? { color: warm.colors.textPrimary, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderDefined}` }
                                    : { color: warm.colors.textMuted, background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}` }),
                            }}
                        >
                            {isSkipped ? <EyeOff size={10} /> : config && <config.icon size={10} />}
                            {isSkipped ? 'Skipped' : status === 'ALL' ? 'All' : STATUS_CONFIG[status].label}
                            <span style={{ marginLeft: 4, opacity: 0.6 }}>{count}</span>
                        </button>
                    );
                })}
                <SortControls sortBy={sortBy} onSortChange={setSortBy} />
            </div>

            {/* Grade filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Grade</span>
                {([
                    { key: 'ALL', label: 'All' },
                    { key: 'AB',  label: 'A – B' },
                    { key: 'C',   label: 'C' },
                    { key: 'DF',  label: 'D – F' },
                ] as const).map(({ key, label }) => {
                    const active = gradeFilter === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setGradeFilter(key)}
                            style={{
                                padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 800,
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                cursor: 'pointer', transition: 'all 0.15s',
                                ...(active
                                    ? { color: warm.colors.textPrimary, background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderDefined}` }
                                    : { color: warm.colors.textMuted, background: warm.colors.bgSurface, border: `1px solid ${warm.colors.borderWhisper}` }),
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Job list */}
            {filterStatus === 'SKIPPED' ? (
                skippedLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
                        <div style={{ width: 32, height: 32, border: `2px solid ${warm.colors.borderWhisper}`, borderTopColor: warm.colors.accentPetrol, borderRadius: '50%', animation: 'dspin 0.8s linear infinite' }} />
                    </div>
                ) : skippedJobs.length === 0 ? (
                    <div style={{
                        background: warm.colors.bgSurface,
                        border: `1px solid ${warm.colors.borderWhisper}`,
                        borderRadius: 18, padding: 64,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center',
                    }}>
                        <EyeOff size={40} style={{ color: warm.colors.borderWhisper }} />
                        <div>
                            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: warm.colors.textSecondary }}>No skipped jobs</p>
                            <p style={{ margin: 0, fontSize: 13, color: warm.colors.textMuted, marginTop: 4 }}>
                                Jobs you skip in the feed will appear here so you can review or restore them.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {skippedJobs.map((job: any) => (
                            <div
                                key={job.id}
                                style={{
                                    background: warm.colors.bgSurface,
                                    border: `1px solid ${warm.colors.borderWhisper}`,
                                    borderRadius: 16, padding: '14px 18px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <a
                                        href={job.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    >
                                        {job.title}
                                        <ExternalLink size={10} className="opacity-40" />
                                    </a>
                                    <p style={{ margin: '2px 0 0', fontSize: 11, color: warm.colors.textMuted }}>
                                        {job.company}{job.location ? ` · ${job.location}` : ''}
                                    </p>
                                    <p style={{ margin: '2px 0 0', fontSize: 10, color: warm.colors.textMuted }}>
                                        Skipped {new Date(job.skippedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => restoreSkipMutation.mutate(job.sourceUrl)}
                                    disabled={restoreSkipMutation.isPending}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', flexShrink: 0,
                                        borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                                        border: `1px solid ${warm.colors.borderDefined}`,
                                        color: warm.colors.textSecondary, background: warm.colors.bgAlt, cursor: restoreSkipMutation.isPending ? 'default' : 'pointer',
                                        opacity: restoreSkipMutation.isPending ? 0.5 : 1,
                                    }}
                                >
                                    {restoreSkipMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                    Undo
                                </button>
                            </div>
                        ))}
                    </div>
                )
            ) : isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
                    <div style={{ width: 32, height: 32, border: `2px solid ${warm.colors.borderWhisper}`, borderTopColor: warm.colors.accentPetrol, borderRadius: '50%', animation: 'dspin 0.8s linear infinite' }} />
                </div>
            ) : filteredJobs.length === 0 ? (
                <div style={{
                    background: warm.colors.bgSurface,
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    borderRadius: 18, padding: 64,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center',
                }}>
                    <Briefcase size={40} style={{ color: warm.colors.borderWhisper }} />
                    <div>
                        <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: warm.colors.textSecondary }}>
                            {filterStatus === 'ALL' ? 'No applications yet' : `No ${STATUS_CONFIG[filterStatus].label} applications`}
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: warm.colors.textMuted, marginTop: 4 }}>
                            {filterStatus === 'ALL'
                                ? 'Run a job analysis from the Dashboard to start tracking applications.'
                                : 'Try a different filter above.'}
                        </p>
                    </div>
                    {filterStatus === 'ALL' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: warm.colors.accentPetrol, fontSize: 12, fontWeight: 700 }}>
                            <ChevronRight size={14} />
                            Go to Dashboard → paste a job description → run analysis
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredJobs.map((job, index) => (
                        <JobCard
                            key={job.id}
                            isFirst={index === 0}
                            job={job}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                            onNotesChange={handleNotesChange}
                            onPriorityChange={handlePriorityChange}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
