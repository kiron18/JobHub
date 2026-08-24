import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

/**
 * What we have to ask before a prep can be any good.
 *
 * Two kinds of question, and the difference is the whole design:
 *   - The ROUND belongs to this application. A screening call and a final panel
 *     want different documents, so it is asked every time and never remembered
 *     as a default.
 *   - The DETAILS belong to the person. Work rights, salary and notice are the
 *     same on Tuesday as they were on Monday, so they are asked once, saved to
 *     the profile, and pre-filled from then on.
 *
 * All three details are optional on purpose. A blank field is honest and the
 * generator handles it by telling the candidate to have the fact ready. A
 * required field here would only teach people to type something to get past it,
 * and an invented visa answer is worse than no visa answer.
 */

const c = warm.colors;

export const STAGES = [
    { id: 'recruiter_screen', label: 'Recruiter screen', hint: 'A phone screen with a recruiter or talent partner' },
    { id: 'hiring_manager', label: 'Hiring manager', hint: 'With the person who would manage you' },
    { id: 'panel', label: 'Panel', hint: 'Several interviewers, often scored against criteria' },
    { id: 'technical', label: 'Technical or task', hint: 'A technical, case or task-based round' },
    { id: 'final', label: 'Final round', hint: 'A senior leader, often the last conversation' },
] as const;

export type StageId = typeof STAGES[number]['id'];

export interface PrepDetails {
    visaStatus: string;
    visaExpiry: string;
    salaryExpectation: string;
    availability: string;
}

const FIELDS: { key: keyof PrepDetails; label: string; placeholder: string }[] = [
    { key: 'visaStatus', label: 'Work rights', placeholder: 'e.g. Australian citizen, or 485 graduate visa' },
    { key: 'visaExpiry', label: 'Visa expiry', placeholder: 'e.g. March 2027, or leave blank if not applicable' },
    { key: 'salaryExpectation', label: 'Salary expectation', placeholder: 'e.g. $85,000 to $95,000 plus super' },
    { key: 'availability', label: 'Availability and notice', placeholder: 'e.g. Available now, or 4 weeks notice' },
];

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: warm.radius.input,
    border: `1px solid ${c.borderDefined}`, background: c.bgSurface,
    fontSize: 15, color: c.textPrimary, fontFamily: 'inherit', outline: 'none',
};

export function PrepSetup({ initialStage, initialDetails, busy, submitLabel, onSubmit }: {
    initialStage: StageId | null;
    initialDetails: PrepDetails;
    busy: boolean;
    submitLabel: string;
    onSubmit: (stage: StageId, details: PrepDetails) => void;
}) {
    const [stage, setStage] = useState<StageId | null>(initialStage);
    const [details, setDetails] = useState<PrepDetails>(initialDetails);
    // Somebody coming back for their third interview has these filled already,
    // so the block starts closed and says so rather than asking again.
    const prefilled = Object.values(initialDetails).some(v => v.trim());
    const [openDetails, setOpenDetails] = useState(!prefilled);

    const set = (key: keyof PrepDetails) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setDetails(d => ({ ...d, [key]: e.target.value }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* ── Round ────────────────────────────────────────────────── */}
            <div>
                <h2 style={{
                    margin: '0 0 4px', fontSize: 19, fontWeight: 700, color: c.textPrimary, lineHeight: 1.3,
                }}>Which round is this?</h2>
                <p style={{ margin: '0 0 14px', fontSize: 15, color: c.textSecondary, lineHeight: 1.6 }}>
                    A screening call and a final panel are different conversations, so they get different preps.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {STAGES.map(s => {
                        const on = stage === s.id;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setStage(s.id)}
                                title={s.hint}
                                style={{
                                    padding: '10px 16px', borderRadius: 999, cursor: 'pointer',
                                    fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
                                    color: on ? '#FFFFFF' : c.textSecondary,
                                    background: on ? c.accentPetrol : c.bgSurface,
                                    border: `1px solid ${on ? c.accentPetrol : c.borderWhisper}`,
                                    transition: 'background 0.15s, color 0.15s',
                                }}
                            >
                                {s.label}
                            </button>
                        );
                    })}
                </div>
                {stage && (
                    <p style={{ margin: '12px 0 0', fontSize: 14, color: c.textMuted }}>
                        {STAGES.find(s => s.id === stage)!.hint}.
                    </p>
                )}
            </div>

            {/* ── Details ──────────────────────────────────────────────── */}
            <div style={{
                borderRadius: 14, border: `1px solid ${c.borderWhisper}`,
                background: c.bgSurface, overflow: 'hidden',
            }}>
                <button
                    type="button"
                    onClick={() => setOpenDetails(o => !o)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, padding: '13px 16px', background: 'transparent', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                    }}
                >
                    <div>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: c.textPrimary }}>
                            Your details
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 14, color: c.textMuted, lineHeight: 1.55 }}>
                            {prefilled && !openDetails
                                ? 'Saved from last time. Tap to check them.'
                                : 'Asked once, then reused for every interview. All optional.'}
                        </p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: c.accentPetrol, flexShrink: 0 }}>
                        {openDetails ? 'Hide' : 'Edit'}
                    </span>
                </button>

                {openDetails && (
                    <div style={{
                        padding: '4px 16px 16px', display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12,
                    }}>
                        {FIELDS.map(f => (
                            <label key={f.key} style={{ display: 'block' }}>
                                <span style={{
                                    display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600,
                                    color: c.textPrimary,
                                }}>{f.label}</span>
                                <input
                                    value={details[f.key]}
                                    onChange={set(f.key)}
                                    placeholder={f.placeholder}
                                    style={inputStyle}
                                />
                            </label>
                        ))}
                        <p style={{
                            gridColumn: '1 / -1', margin: 0, fontSize: 14, color: c.textMuted, lineHeight: 1.6,
                        }}>
                            Leave anything blank you are not sure of. Your prep will tell you to have it ready
                            rather than guessing an answer for you.
                        </p>
                    </div>
                )}
            </div>

            <div>
                <button
                    type="button"
                    disabled={!stage || busy}
                    onClick={() => stage && onSubmit(stage, details)}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '13px 24px', borderRadius: 12, border: 'none',
                        fontSize: 15, fontWeight: 600, fontFamily: 'inherit', color: '#FFFFFF',
                        background: stage ? c.accentPetrol : c.borderDefined,
                        cursor: stage && !busy ? 'pointer' : 'not-allowed',
                        opacity: busy ? 0.7 : 1,
                    }}
                >
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {submitLabel}
                </button>
                {!stage && (
                    <p style={{ margin: '10px 0 0', fontSize: 14, color: c.textMuted }}>
                        Pick the round first.
                    </p>
                )}
            </div>
        </div>
    );
}
