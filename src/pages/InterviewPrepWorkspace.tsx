import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import type { JobApplication } from '../components/tracker/types';
import { InterviewPrepView } from '../components/InterviewPrepView';
import { PrepSetup, STAGES } from '../components/interview/PrepSetup';
import type { PrepDetails, StageId } from '../components/interview/PrepSetup';
import { warm } from '../lib/theme/warmTokens';

const LOADING_LINES = [
    'Building your prep from your real experience…',
    'Mapping your stories to the questions they will ask…',
    'Almost there — your guide is nearly ready.',
];

const EMPTY_DETAILS: PrepDetails = {
    visaStatus: '', visaExpiry: '', salaryExpectation: '', availability: '',
};

export function InterviewPrepWorkspace() {
    const { jobId } = useParams<{ jobId: string }>();
    const queryClient = useQueryClient();
    const [generating, setGenerating] = useState(false);
    const [loadingLine, setLoadingLine] = useState(0);
    const [changingRound, setChangingRound] = useState(false);

    // One application, bodies included. This used to pull the client's entire
    // job list — every description and every generated document — to find one row.
    const { data: job, isLoading } = useQuery<JobApplication>({
        queryKey: ['job', jobId],
        queryFn: async () => (await api.get(`/jobs/${jobId}`)).data,
        enabled: Boolean(jobId),
    });

    // The logistics live on the profile, so a client answers them on their first
    // interview and never again.
    const { data: profile } = useQuery<any>({
        queryKey: ['profile'],
        queryFn: async () => (await api.get('/profile')).data,
    });

    const prepDoc = useMemo(() => job?.documents.find(d => d.type === 'INTERVIEW_PREP') ?? null, [job]);
    const stage = job?.interviewStage as StageId | null | undefined;
    const stageLabel = stage ? STAGES.find(s => s.id === stage)?.label ?? null : null;

    const details: PrepDetails = useMemo(() => ({
        visaStatus: profile?.visaStatus ?? '',
        visaExpiry: profile?.visaExpiry ?? '',
        salaryExpectation: profile?.salaryExpectation ?? '',
        availability: profile?.availability ?? '',
    }), [profile]);

    // Rotate the calm loading copy while generating.
    useEffect(() => {
        if (!generating) return;
        const t = setInterval(() => setLoadingLine(i => (i + 1) % LOADING_LINES.length), 2600);
        return () => clearInterval(t);
    }, [generating]);

    const generate = async (chosenStage: StageId, chosenDetails: PrepDetails) => {
        if (!job || generating) return;
        setGenerating(true);
        setChangingRound(false);
        try {
            // Save the details first, so a generation that fails still leaves the
            // client's answers on file rather than making them type them twice.
            const changed = (Object.keys(chosenDetails) as (keyof PrepDetails)[])
                .filter(k => chosenDetails[k].trim() !== (details[k] ?? '').trim());
            if (changed.length > 0) {
                const payload = Object.fromEntries(
                    changed.map(k => [k, chosenDetails[k].trim() || null]),
                );
                await api.patch('/profile', payload);
                await queryClient.invalidateQueries({ queryKey: ['profile'] });
            }

            await api.post('/generate/interview-prep', {
                jobDescription: job.description || `${job.title} at ${job.company}`,
                selectedAchievementIds: [],
                jobApplicationId: job.id,
                interviewStage: chosenStage,
                analysisContext: { tone: 'Professional, polished, direct.', competencies: [] },
            });
            await queryClient.invalidateQueries({ queryKey: ['job', jobId] });
            // The tracker list shows a badge per document, so it is stale too.
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

    const setup = (submitLabel: string) => (
        <PrepSetup
            initialStage={stage ?? null}
            initialDetails={details ?? EMPTY_DETAILS}
            busy={generating}
            submitLabel={submitLabel}
            onSubmit={generate}
        />
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
            ) : generating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: warm.colors.accentGold }} />
                    <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary, fontWeight: 500 }}>{LOADING_LINES[loadingLine]}</p>
                </div>
            ) : prepDoc?.content ? (
                <>
                    <InterviewPrepView doc={prepDoc.content ?? ''} company={job.company} role={job.title} stageLabel={stageLabel} />

                    {/* Changing the round rebuilds the prep, so it lives with the
                        regenerate control rather than pretending to be a filter. */}
                    <div style={{
                        borderTop: `1px solid ${warm.colors.borderWhisper}`, paddingTop: 20, marginTop: 8,
                    }}>
                        {changingRound ? (
                            <>
                                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                                    Rebuild this prep
                                </p>
                                {setup('Rebuild my prep')}
                                <button
                                    onClick={() => setChangingRound(false)}
                                    style={{
                                        marginTop: 12, padding: '7px 12px', background: 'transparent',
                                        color: warm.colors.textMuted, fontSize: 11, fontWeight: 700,
                                        borderRadius: 9, border: `1px solid ${warm.colors.borderWhisper}`,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted }}>
                                    {stageLabel
                                        ? `Written for a ${stageLabel.toLowerCase()}.`
                                        : 'Written for a first conversation with the employer.'}
                                </p>
                                <button
                                    onClick={() => setChangingRound(true)}
                                    style={{
                                        padding: '8px 14px', background: 'transparent',
                                        color: warm.colors.textSecondary, fontSize: 11, fontWeight: 700,
                                        borderRadius: 10, border: `1px solid ${warm.colors.borderWhisper}`,
                                        cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                                    }}
                                >
                                    Different round, or rebuild
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 8 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: warm.colors.textPrimary }}>
                            {job.title}{job.company ? ` · ${job.company}` : ''}
                        </h1>
                        <p style={{ margin: '8px 0 0', fontSize: 14, color: warm.colors.textMuted, lineHeight: 1.6, maxWidth: 520 }}>
                            A cheat sheet you keep open during the call: what to say, the questions they will ask,
                            and the things you cannot fumble. Built from your real experience.
                        </p>
                    </div>
                    {setup('Build my interview prep')}
                </div>
            )}
        </div>
    );
}
