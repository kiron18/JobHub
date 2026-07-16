import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { JobApplication } from '../components/tracker/types';
import { InterviewPrepView } from '../components/InterviewPrepView';
import { warm } from '../lib/theme/warmTokens';

const LOADING_LINES = [
    'Building your prep from your real experience…',
    'Mapping your stories to the questions they will ask…',
    'Almost there — your guide is nearly ready.',
];

export function InterviewPrepWorkspace() {
    const { jobId } = useParams<{ jobId: string }>();
    const queryClient = useQueryClient();
    const [generating, setGenerating] = useState(false);
    const [loadingLine, setLoadingLine] = useState(0);

    const { data: jobs = [], isLoading } = useQuery<JobApplication[]>({
        queryKey: ['jobs'],
        queryFn: async () => {
            const { data } = await api.get('/jobs');
            return data;
        },
    });

    const job = useMemo(() => jobs.find(j => j.id === jobId), [jobs, jobId]);
    const prepDoc = useMemo(() => job?.documents.find(d => d.type === 'INTERVIEW_PREP') ?? null, [job]);

    // Rotate the calm loading copy while generating.
    useEffect(() => {
        if (!generating) return;
        const t = setInterval(() => setLoadingLine(i => (i + 1) % LOADING_LINES.length), 2600);
        return () => clearInterval(t);
    }, [generating]);

    const generate = async () => {
        if (!job || generating) return;
        setGenerating(true);
        try {
            await api.post('/generate/interview-prep', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                jobApplicationId: job.id,
                analysisContext: { tone: 'Professional, polished, direct.', competencies: [] },
            });
            await queryClient.invalidateQueries({ queryKey: ['jobs'] });
        } catch (err: any) {
            const status = err?.response?.status;
            toast.error(status === 402 ? 'Generation limit reached.' : 'Could not build your prep. Please retry.');
        } finally {
            setGenerating(false);
        }
    };

    const backLink = (
        <Link
            to="/tracker"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: warm.colors.textMuted, textDecoration: 'none' }}
        >
            <ArrowLeft size={14} /> Back to Applications
        </Link>
    );

    return (
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px 80px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {backLink}

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: warm.colors.accentPetrol }} />
                </div>
            ) : !job ? (
                <div style={{ padding: '64px 0', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: warm.colors.textSecondary }}>Application not found</p>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: warm.colors.textMuted }}>It may have been removed. Head back to your tracker.</p>
                </div>
            ) : prepDoc ? (
                <InterviewPrepView doc={prepDoc.content} company={job.company} role={job.title} />
            ) : generating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: warm.colors.accentGold }} />
                    <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary, fontWeight: 500 }}>{LOADING_LINES[loadingLine]}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '48px 0', textAlign: 'center', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: warm.colors.textPrimary }}>
                            {job.title}{job.company ? ` · ${job.company}` : ''}
                        </h1>
                        <p style={{ margin: '8px 0 0', fontSize: 14, color: warm.colors.textMuted, lineHeight: 1.6, maxWidth: 480 }}>
                            A calm, complete guide for this interview — your stories, the questions they will ask, and how to walk in steady. Built from your real profile.
                        </p>
                    </div>
                    <button
                        onClick={generate}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px',
                            background: warm.colors.accentPetrol, color: '#FFFFFF',
                            fontSize: 13, fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer',
                        }}
                    >
                        <Sparkles size={15} /> Build my interview prep
                    </button>
                </div>
            )}

            {/* Regenerate affordance — only when a doc already exists */}
            {prepDoc && !generating && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                    <button
                        onClick={generate}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            background: 'transparent', color: warm.colors.textMuted,
                            fontSize: 11, fontWeight: 700, borderRadius: 10,
                            border: `1px solid ${warm.colors.borderWhisper}`, cursor: 'pointer',
                            textTransform: 'uppercase', letterSpacing: '0.06em',
                        }}
                    >
                        <Sparkles size={11} /> Regenerate
                    </button>
                </div>
            )}
        </div>
    );
}
