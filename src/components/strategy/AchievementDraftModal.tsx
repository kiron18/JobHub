/**
 * AchievementDraftModal — turn a Bridgeable Gap into a saved achievement.
 *
 * Opens from the Bridgeable Gap card on the analysis result. Calls
 * /api/analyze/draft-achievement to get a first-person draft (title +
 * description + metric placeholder), lets the user edit, then POSTs to
 * /api/achievements on save. The achievement lands in the Profile Bank
 * with isStaged=true so the user can review and refine later.
 *
 * Never auto-saves a fabricated achievement — the user must edit at least
 * the metric placeholder (or accept it as-is) and click Save explicitly.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

interface Props {
    open: boolean;
    onClose: () => void;
    skill: string;
    suggestion: string;
    jobRole: string;
    jobCompany: string;
    onSaved?: (finalDescription: string) => void;
}

interface DraftPayload {
    title: string;
    description: string;
    metricPlaceholder: string;
}

export function AchievementDraftModal({ open, onClose, skill, suggestion, jobRole, jobCompany, onSaved }: Props) {
    const queryClient = useQueryClient();

    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [metricPlaceholder, setMetricPlaceholder] = useState('');

    // Fetch the LLM draft on open
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setGenerating(true);
        setTitle('');
        setDescription('');
        setMetricPlaceholder('');
        api
            .post<DraftPayload>('/analyze/draft-achievement', {
                skill,
                suggestion,
                jobRole,
                jobCompany,
            })
            .then(({ data }) => {
                if (cancelled) return;
                setTitle(data.title ?? skill);
                setDescription(data.description ?? suggestion);
                setMetricPlaceholder(data.metricPlaceholder ?? '');
            })
            .catch(() => {
                if (cancelled) return;
                setTitle(skill);
                setDescription(suggestion);
                toast.error('Could not draft this achievement. You can still edit and save.');
            })
            .finally(() => {
                if (!cancelled) setGenerating(false);
            });
        return () => { cancelled = true; };
    }, [open, skill, suggestion, jobRole, jobCompany]);

    const pendingPlaceholder = (description.match(/\[[^\]]*\]/) || [])[0] ?? null;
    const canSave = title.trim().length > 0 && description.trim().length > 0 && !saving && !generating;

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            await api.post('/achievements', {
                title: (title.trim() || skill),
                description: description.trim(),
                metric: null,
                skills: skill,
            });
            await queryClient.invalidateQueries({ queryKey: ['profile'] });
            await queryClient.invalidateQueries({ queryKey: ['achievements', 'count'] });
            await queryClient.invalidateQueries({ queryKey: ['achievements'] });
            toast.success('Added to your application and profile');
            onSaved?.(description.trim());
            onClose();
        } catch {
            toast.error('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 50,
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 24,
                    }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                        style={{
                            width: '100%',
                            maxWidth: 560,
                            background: warm.colors.bgSurface,
                            border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 18,
                            padding: 26,
                            boxShadow: warm.shadow.soft,
                            maxHeight: '90vh',
                            overflowY: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                            <div>
                                <p style={{
                                    margin: '0 0 4px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: '0.14em',
                                    textTransform: 'uppercase',
                                    color: warm.colors.accentPetrol,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}>
                                    <Sparkles size={12} /> Draft achievement
                                </p>
                                <h2 style={{
                                    margin: 0,
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: warm.colors.textPrimary,
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1.3,
                                }}>
                                    {skill}
                                </h2>
                                <p style={{ margin: '6px 0 0', fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.5 }}>
                                    Edit anything that doesn't sound like you. Add a real number where you can. The draft saves as unverified so you can refine it later.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: warm.colors.textSecondary,
                                    cursor: 'pointer',
                                    padding: 4,
                                    flexShrink: 0,
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Loading state */}
                        {generating ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                padding: '40px 0',
                                color: warm.colors.textSecondary,
                                fontSize: 13,
                            }}>
                                <Loader2 size={16} className="animate-spin" />
                                Drafting from your positioning…
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {/* Single sentence — the artifact we actually use */}
                                <div>
                                    <label style={labelStyle(warm.colors.textSecondary)}>Your achievement (first person)</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        style={{ ...inputStyle(), resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.6 }}
                                        placeholder="I led the rollout of…"
                                    />
                                </div>

                                {/* Red placeholder cue OR positive ready state */}
                                {pendingPlaceholder ? (
                                    <div style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 8,
                                        padding: '8px 12px', borderRadius: 10,
                                        background: warm.colors.dangerSoft,
                                        fontSize: 12, lineHeight: 1.5, color: warm.colors.danger,
                                    }}>
                                        <span>
                                            Replace <span style={{ fontWeight: 800, color: warm.colors.danger }}>{pendingPlaceholder}</span> with a real number — a metric makes this far stronger.
                                        </span>
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: warm.colors.success }}>
                                        Looks strong — ready to add.
                                    </p>
                                )}

                                {metricPlaceholder && (
                                    <p style={{ margin: 0, fontSize: 11, color: warm.colors.textMuted, lineHeight: 1.5 }}>
                                        Suggested measure: {metricPlaceholder}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                            <button
                                onClick={onClose}
                                disabled={saving}
                                style={{
                                    padding: '10px 16px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: warm.colors.textSecondary,
                                    background: 'transparent',
                                    border: `1px solid ${warm.colors.borderWhisper}`,
                                    borderRadius: 10,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    opacity: saving ? 0.5 : 1,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!canSave}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '10px 18px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: warm.colors.bgCanvas,
                                    background: canSave ? warm.colors.accentPetrol : 'rgba(45,90,110,0.4)',
                                    border: 'none',
                                    borderRadius: 10,
                                    cursor: canSave ? 'pointer' : 'not-allowed',
                                    opacity: canSave ? 1 : 0.6,
                                    boxShadow: canSave ? warm.shadow.soft : 'none',
                                }}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" /> Saving…
                                    </>
                                ) : (
                                    'Add to application'
                                )}
                            </button>
                        </div>
                        <p style={{ margin: '10px 0 0', fontSize: 11, color: warm.colors.textMuted, textAlign: 'right' as const }}>
                            Also saved to your profile for future jobs.
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function labelStyle(color: string): React.CSSProperties {
    return {
        display: 'block',
        marginBottom: 6,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color,
    };
}

function inputStyle(): React.CSSProperties {
    return {
        width: '100%',
        padding: '11px 14px',
        fontSize: 13,
        color: warm.colors.textPrimary,
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderDefined}`,
        borderRadius: 10,
        outline: 'none',
        boxSizing: 'border-box',
    };
}
