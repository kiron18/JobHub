/**
 * Post-apply outreach — shown on the final step of the apply workspace, once
 * the application has been saved to the tracker.
 *
 * The step used to end here, which is the moment the application becomes one of
 * several hundred in a queue. Reaching a person at the company is the only lever
 * the candidate still controls, and almost none of them know how to do it.
 *
 * Deliberately prominent but never blocking: the "Apply for another role" button
 * sits below and stays live throughout. Volume of applications is the thing that
 * actually moves the needle, so this must never become a toll gate on the way to
 * the next one.
 *
 * The guidance is static — it does not vary by application, and having a model
 * paraphrase it each time would cost money and risk inventing a tool that does
 * not exist. Only the two messages are generated, and only on request.
 */
import { useState } from 'react';
import { Check, Copy, Linkedin, Loader2, Mail, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';

/** LinkedIn rejects a connection note over 300 characters. */
const LINKEDIN_NOTE_LIMIT = 300;

interface OutreachDraft {
    hook: string;
    linkedInNote: string;
    emailSubject: string;
    emailBody: string;
}

const TARGETS = [
    {
        title: 'A recruiter or talent partner at the company',
        detail: 'Reaching out is literally their job, so they reply the most often. Search the company on LinkedIn and filter people by "Talent", "Recruiter" or "People".',
    },
    {
        title: 'Someone already on the team',
        detail: 'The one nobody thinks of, and the second most likely to answer. Look for a shared thread — the same university, the same home country, a previous employer in common. That thread is what turns a cold message into a warm one.',
    },
    {
        title: 'The hiring manager',
        detail: 'Whoever would be your boss. The least likely to reply at a large Australian firm, and by far the most valuable when they do. Search the company plus the team name, and look for a "Manager" or "Lead" title.',
    },
];

function CopyCard({
    label,
    icon,
    value,
    onChange,
    charLimit,
    rows,
}: {
    label: string;
    icon: React.ReactNode;
    value: string;
    onChange: (next: string) => void;
    charLimit?: number;
    rows: number;
}) {
    const [copied, setCopied] = useState(false);
    const overLimit = charLimit ? value.length > charLimit : false;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success('Copied — now go find the person');
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <div style={{
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 12,
            padding: 16,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: warm.colors.accentPetrol,
                }}>
                    {icon}
                    {label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {charLimit && (
                        <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: overLimit ? warm.colors.danger : warm.colors.textMuted,
                        }}>
                            {value.length} / {charLimit}
                        </span>
                    )}
                    <button
                        onClick={handleCopy}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                            border: `1px solid ${copied ? warm.colors.success : warm.colors.borderWhisper}`,
                            background: copied ? 'rgba(42,157,111,0.10)' : 'transparent',
                            color: copied ? warm.colors.success : warm.colors.textSecondary,
                            cursor: 'pointer',
                        }}
                    >
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={rows}
                spellCheck
                style={{
                    width: '100%',
                    background: warm.colors.bgAlt,
                    border: `1px solid ${overLimit ? warm.colors.danger : 'transparent'}`,
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: warm.colors.textPrimary,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                }}
            />
        </div>
    );
}

export function PostApplyOutreach({
    jobTitle,
    company,
    jobDescription,
}: {
    jobTitle?: string;
    company?: string;
    jobDescription?: string;
}) {
    const [draft, setDraft] = useState<OutreachDraft | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    const handleDraft = async () => {
        setLoading(true);
        setFailed(false);
        try {
            const { data } = await api.post('/analyze/application-outreach', {
                jobTitle,
                company,
                jobDescription,
            });
            setDraft(data);
        } catch {
            setFailed(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            border: `1px solid ${warm.colors.borderDefined}`,
            borderRadius: 12,
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
        }}>
            <div>
                <p style={{
                    margin: '0 0 4px', fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: warm.colors.accentGold,
                }}>
                    Optional — two minutes
                </p>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: warm.colors.textPrimary }}>
                    Now go find a human
                </h3>
                <p style={{ margin: '6px 0 0', fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                    Your application is one of a few hundred in a queue. A short message to a real
                    person at {company || 'the company'} is the only part of this you still control.
                    Be straight with yourself about the odds — most of these get no reply. It is worth
                    doing anyway, because the ones that land tend to be the ones that turn into
                    interviews.
                </p>
            </div>

            <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: warm.colors.textPrimary }}>
                    Who to message, best odds first
                </p>
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {TARGETS.map((target) => (
                        <li key={target.title} style={{ fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                            <span style={{ fontWeight: 700, color: warm.colors.textPrimary }}>{target.title}.</span>{' '}
                            {target.detail}
                        </li>
                    ))}
                </ol>
            </div>

            <div>
                <p style={{
                    margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 700, color: warm.colors.textPrimary,
                }}>
                    <Search size={13} />
                    How to reach them
                </p>
                <p style={{ margin: '0 0 6px', fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                    <strong style={{ color: warm.colors.textPrimary }}>LinkedIn first.</strong> It is free,
                    it needs no email address, and the note below fits inside a connection request.
                </p>
                <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                    <strong style={{ color: warm.colors.textPrimary }}>Email second.</strong> Use
                    Hunter.io, RocketReach or Apollo to find the company's address <em>pattern</em> —
                    usually firstname.lastname@company.com — then apply that pattern to the name you
                    found on LinkedIn. Looking up the pattern once costs you nothing and spares you
                    burning a free lookup on every single person.
                </p>
            </div>

            {!draft && (
                <div>
                    <button
                        onClick={handleDraft}
                        disabled={loading}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: warm.colors.accentPetrol,
                            border: 'none', borderRadius: 8,
                            color: '#fff', fontSize: 13, fontWeight: 700,
                            padding: '10px 16px',
                            cursor: loading ? 'default' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        {loading ? 'Writing your messages…' : 'Write my messages'}
                    </button>
                    {failed && (
                        <p style={{ margin: '8px 0 0', fontSize: 12, color: warm.colors.danger }}>
                            That did not come through. Try again — nothing about your application was affected.
                        </p>
                    )}
                </div>
            )}

            {draft && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {draft.hook && (
                        <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                            Both messages lead on this: <em>{draft.hook}</em>. Change it if you would
                            put it differently — you know your own experience better than we do.
                        </p>
                    )}

                    <CopyCard
                        label="LinkedIn connection note"
                        icon={<Linkedin size={12} />}
                        value={draft.linkedInNote}
                        onChange={(linkedInNote) => setDraft({ ...draft, linkedInNote })}
                        charLimit={LINKEDIN_NOTE_LIMIT}
                        rows={4}
                    />

                    <CopyCard
                        label="Email subject"
                        icon={<Mail size={12} />}
                        value={draft.emailSubject}
                        onChange={(emailSubject) => setDraft({ ...draft, emailSubject })}
                        rows={1}
                    />

                    <CopyCard
                        label="Email body"
                        icon={<Mail size={12} />}
                        value={draft.emailBody}
                        onChange={(emailBody) => setDraft({ ...draft, emailBody })}
                        rows={10}
                    />

                    <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                        Replace <strong>[name]</strong> before you send. Neither message asks them for
                        anything — that is deliberate. A first message with no ask in it is the one
                        that gets answered, and it earns you the right to ask later.
                    </p>
                </div>
            )}
        </div>
    );
}

export default PostApplyOutreach;
