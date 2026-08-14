/**
 * Post-apply outreach — shown on the final step of the apply workspace, once
 * the application has been saved to the tracker.
 *
 * The step used to end here, which is the moment the application joins a queue
 * of several hundred. Reaching a person at the company is the only lever the
 * candidate still controls, and almost none of them know how to pull it.
 *
 * Collapsed by default and never blocking: the "Apply for another role" button
 * sits below and stays live throughout. Volume of applications is what actually
 * moves the needle, so this must not become a toll gate on the way to the next
 * one.
 *
 * The messages are assembled here rather than generated: a model call cannot
 * fail or stall the way this cannot, and it costs nothing. What fills them is
 * work already done. The cover letter on the previous step was written against
 * this exact ad from this exact resume, so the argument the outreach needs has
 * already been made and only has to be carried across.
 *
 * This card used to leave those lines blank on the reasoning that the sentence
 * a candidate writes themselves is what separates them from everyone sending a
 * template. That held when the alternative was generic filler. It does not now:
 * the line we carry over is the candidate's own evidence, quantified, and the
 * fields stay editable so anyone who wants to rewrite it still can. What we
 * will not do is invent a name for the person being greeted. See outreachFill.
 */
import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Linkedin, Mail, Search } from 'lucide-react';
import { toast } from 'sonner';
import { warm } from '../../lib/theme/warmTokens';
import { LINKEDIN_NOTE_LIMIT, buildOutreachMessages } from '../../lib/outreachFill';

/**
 * Placeholders are written in [brackets] so they survive a copy to plain text.
 * Two regexes on purpose: a global one to split on, and a non-global one to
 * test with. Calling .test() repeatedly on a global regex walks its lastIndex
 * and returns alternating answers, which would highlight every second blank.
 */
const PLACEHOLDER_SPLIT = /(\[[^\]]+\])/g;
const IS_PLACEHOLDER = /^\[[^\]]+\]$/;

const TARGETS = [
    {
        title: 'A recruiter or talent partner',
        detail: 'Replying to people is their job, so they answer the most often. Search the company on LinkedIn and filter the people tab for "Talent", "Recruiter" or "People".',
    },
    {
        title: 'Someone already on the team',
        detail: 'The one almost nobody thinks of, and the second most likely to answer. Look for something you genuinely share: the same university, the same home country, a previous employer in common. That is what turns a cold message into a warm one.',
    },
    {
        title: 'The hiring manager',
        detail: 'Whoever would be your manager. The least likely to reply at a large Australian firm, and easily the most valuable when they do. Search the company name plus the team, and look for a "Manager" or "Lead" title.',
    },
];

/** Render a template with any remaining blanks visibly marked. */
function TemplateBody({ text }: { text: string }) {
    return (
        <>
            {text.split(PLACEHOLDER_SPLIT).map((part, i) =>
                IS_PLACEHOLDER.test(part) ? (
                    <strong
                        key={i}
                        style={{
                            background: 'rgba(197, 160, 89, 0.22)',
                            color: warm.colors.textPrimary,
                            borderRadius: 3,
                            padding: '1px 3px',
                            fontWeight: 700,
                        }}
                    >
                        {part}
                    </strong>
                ) : (
                    <span key={i}>{part}</span>
                ),
            )}
        </>
    );
}

function TemplateCard({
    label,
    icon,
    text,
    charLimit,
    needsEdit,
}: {
    label: string;
    icon: React.ReactNode;
    text: string;
    charLimit?: number;
    /** True while the message still has a blank the candidate has to fill. */
    needsEdit?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const overLimit = charLimit ? text.length > charLimit : false;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(needsEdit
            ? 'Copied. Fill in the highlighted bits before you send'
            : 'Copied. Give it a read before you send');
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <div style={{
            background: warm.colors.bgSurface,
            border: `1px solid ${warm.colors.borderWhisper}`,
            borderRadius: 12,
            padding: 16,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
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
                            {text.length} / {charLimit}
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
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </div>
            <p style={{
                margin: 0,
                background: warm.colors.bgAlt,
                borderRadius: 8,
                padding: 12,
                fontSize: 13,
                lineHeight: 1.7,
                color: warm.colors.textPrimary,
                whiteSpace: 'pre-wrap',
            }}>
                <TemplateBody text={text} />
            </p>
        </div>
    );
}

export function PostApplyOutreach({
    jobTitle,
    company,
    coverLetter,
    jobDescription,
    candidateName,
    dateApplied,
}: {
    jobTitle?: string;
    company?: string;
    /** The cover letter generated on the previous step, if they got that far. */
    coverLetter?: string;
    jobDescription?: string;
    candidateName?: string;
    /** ISO date the application was logged to the tracker. */
    dateApplied?: string;
}) {
    const [open, setOpen] = useState(false);
    const t = buildOutreachMessages({
        role: jobTitle || '',
        company: company || '',
        coverLetter,
        jobDescription,
        candidateName,
        dateApplied,
    });
    const hasBlanks = t.linkedInNeedsPitch || t.emailNeedsPitch;

    return (
        <div style={{
            border: `1px solid ${open ? warm.colors.borderDefined : 'rgba(197, 160, 89, 0.45)'}`,
            background: open ? 'transparent' : 'rgba(197, 160, 89, 0.07)',
            borderRadius: 12,
            overflow: 'hidden',
        }}>
            <button
                onClick={() => setOpen((v) => !v)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 18px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <span>
                    <span style={{
                        display: 'block', fontSize: 11, fontWeight: 700,
                        letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: warm.colors.accentGold, marginBottom: 3,
                    }}>
                        Optional, two minutes
                    </span>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: warm.colors.textPrimary }}>
                        Message someone at {company || 'the company'}
                    </span>
                    <span style={{ display: 'block', fontSize: 12.5, color: warm.colors.textSecondary, marginTop: 2 }}>
                        A short note to a real person is the one part of this you still control.{' '}
                        {hasBlanks
                            ? 'Templates ready inside.'
                            : 'Written for you already, ready to copy.'}
                    </span>
                </span>
                <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 700, color: warm.colors.accentPetrol,
                    whiteSpace: 'nowrap',
                }}>
                    {open ? 'Hide' : 'Show me how'}
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>

            {open && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    padding: '4px 18px 18px',
                }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                        Be realistic about the odds. Most of these get no reply, and it is still worth the
                        two minutes, because the ones that do land are the ones that tend to turn into
                        interviews.
                    </p>

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
                            Hunter.io, RocketReach or Apollo to find the company's address{' '}
                            <em>pattern</em>, usually firstname.lastname@company.com, then apply that
                            pattern to the name you found on LinkedIn. Looking the pattern up once spares
                            you burning a free lookup on every person you contact.
                        </p>
                    </div>

                    <div style={{
                        background: 'rgba(197, 160, 89, 0.12)',
                        border: '1px solid rgba(197, 160, 89, 0.35)',
                        borderRadius: 8,
                        padding: '10px 14px',
                    }}>
                        <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textPrimary, lineHeight: 1.6 }}>
                            {hasBlanks ? (
                                <>
                                    Replace every highlighted blank before you send. The one that matters
                                    most is the couple of sentences in your own words: a recruiter can spot
                                    an untouched template instantly, and writing that bit yourself is
                                    exactly what separates you from everyone else who sent one.
                                </>
                            ) : (
                                <>
                                    These are filled in from your cover letter, so they are ready to send
                                    as they are. Read them once first. If the evidence we carried across
                                    is not the part you would have led with for this person, change it.
                                </>
                            )}
                        </p>
                    </div>

                    <TemplateCard
                        label="LinkedIn connection note"
                        icon={<Linkedin size={12} />}
                        text={t.linkedIn}
                        charLimit={LINKEDIN_NOTE_LIMIT}
                        needsEdit={t.linkedInNeedsPitch}
                    />

                    <TemplateCard
                        label="Email subject"
                        icon={<Mail size={12} />}
                        text={t.subject}
                    />

                    <TemplateCard
                        label="Email body"
                        icon={<Mail size={12} />}
                        text={t.email}
                        needsEdit={t.emailNeedsPitch}
                    />

                    <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                        Neither message asks them for anything, which is deliberate. A first message with
                        no request in it is the one that gets answered, and it earns you the right to ask
                        later.
                    </p>
                </div>
            )}
        </div>
    );
}

export default PostApplyOutreach;
