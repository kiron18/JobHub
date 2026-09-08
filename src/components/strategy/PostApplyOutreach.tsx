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
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp, Copy, Linkedin, Mail, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { LINKEDIN_NOTE_LIMIT, buildOutreachMessages } from '../../lib/outreachFill';
import { resolveContact, isGenericAddress } from '../../lib/contactSlots';
import { useIsMobile } from '../../hooks/useIsMobile';
import OutreachSendCard from './OutreachSendCard';

/**
 * Placeholders are written in [brackets] so they survive a copy to plain text.
 * Two regexes on purpose: a global one to split on, and a non-global one to
 * test with. Calling .test() repeatedly on a global regex walks its lastIndex
 * and returns alternating answers, which would highlight every second blank.
 */
const PLACEHOLDER_SPLIT = /(\[[^\]]+\])/g;
const IS_PLACEHOLDER = /^\[[^\]]+\]$/;

/**
 * Who to message, best odds first.
 *
 * One line each. This card is read by somebody who has just finished an
 * application and is deciding whether to spend two more minutes, and the
 * version of it that explained the reasoning behind all three targets was
 * longer than the messages it was introducing. The reasoning was correct and
 * nobody read it.
 */
const TARGETS = [
    {
        title: 'A recruiter or talent partner',
        detail: 'Answering people is their job. Filter the company’s LinkedIn people tab for "Talent" or "Recruiter".',
    },
    {
        title: 'Someone already on the team',
        detail: 'Almost nobody tries this one. Look for a shared university, home country or past employer.',
    },
    {
        title: 'The hiring manager',
        detail: 'Hardest to reach, best to reach. Search the company plus the team, and look for "Manager" or "Lead".',
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
    const isMobile = useIsMobile();
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
            /* 16 a side plus the card this sits in plus the page gutter is three
               insets deep, which is what left the message about 28 characters a
               line on a phone. See warm.measure. */
            padding: isMobile ? '12px 12px 12px' : 16,
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10, gap: 10, flexWrap: 'wrap',
            }}>
                <span style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: warm.colors.accentPetrol,
                    whiteSpace: 'nowrap',
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
                /* Vertical inset only on a phone: the panel it sits in already
                   supplies the side one, and stacking both is what narrowed the
                   message to three words a line. */
                padding: isMobile ? '10px 0' : 12,
                paddingLeft: isMobile ? 0 : 12,
                fontSize: isMobile ? 14.5 : 13,
                lineHeight: 1.65,
                color: warm.colors.textPrimary,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
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
    userEmail,
}: {
    jobTitle?: string;
    company?: string;
    /** The cover letter generated on the previous step, if they got that far. */
    coverLetter?: string;
    jobDescription?: string;
    candidateName?: string;
    /** ISO date the application was logged to the tracker. */
    dateApplied?: string;
    /** The address they signed up with. Decides which compose window opens. */
    userEmail?: string;
}) {
    /*
      Closed, because the drafts are no longer inside it.

      The card used to be one collapsible holding both the ARGUMENT for
      following up and the MESSAGES themselves, which forced a choice between
      two bad options: closed, and the drafts nobody knows exist; open, and
      three paragraphs of statistics standing between somebody and the thing
      they are meant to act on.

      They are two different objects now. The argument is reference material and
      folds away. The messages are the task and always sit on the page under it.
    */
    const [open, setOpen] = useState(false);
    /*
      Who to message is reference material, not the task.

      It is three lines of advice about finding a person, and the card below it
      has usually already found one. Open by default it pushed the draft, which
      is the thing to act on, below the fold.
    */
    const [whoOpen, setWhoOpen] = useState(false);
    const isMobile = useIsMobile();

    /*
      Who to write to.

      Never blocking and never retried. Contact discovery costs a search and a
      Hunter credit, it succeeds on roughly a third of employers, and the
      messages below are useful with or without it. So a failure here degrades
      to exactly what this card was before: the drafts, and instructions for
      finding an address by hand.
    */
    const { data: contact, isLoading: contactLoading, isError: contactFailed } = useQuery({
        queryKey: ['outreach-contact', company, jobTitle],
        // Not gated on the banner any more: the drafts are always on screen,
        // so the address they are addressed to has to be looked up regardless.
        enabled: !!company,
        staleTime: Infinity,
        retry: false,
        queryFn: async () => {
            const { data } = await api.post('/research/company', {
                company,
                role: jobTitle,
                jdText: jobDescription ? jobDescription.slice(0, 8000) : undefined,
            });
            return resolveContact(data);
        },
    });

    // A name with no address cannot fill a compose window, so the card only
    // replaces the manual instructions when it can actually do better.
    const sendable = contact && contact.addresses.length > 0 ? contact : null;

    /*
      Greet the person whose mailbox we are about to fill.

      "Dear Hiring Manager" above an address we know belongs to David Kim reads
      as a mail merge, and it is the one thing a note like this cannot afford to
      look like.

      The exception is the shared inbox. `info@`, `careers@`, `hr@` and the rest
      reach a function rather than a person, and the directory sometimes files
      one of them under a real name anyway, so the address decides and not the
      record. Nobody is called Info.
    */
    const primaryAddress = sendable?.addresses[0]?.address ?? null;
    const greetByName =
        sendable && primaryAddress && !isGenericAddress(primaryAddress)
            ? sendable.name
            : null;

    // Built after the lookup, because the lookup is what supplies the name.
    const t = buildOutreachMessages({
        role: jobTitle || '',
        company: company || '',
        coverLetter,
        jobDescription,
        candidateName,
        dateApplied,
        discoveredContactName: greetByName,
    });
    const hasBlanks = t.linkedInNeedsPitch || t.emailNeedsPitch;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
            border: `1px solid ${warm.colors.borderDefined}`,
            background: 'transparent',
            borderRadius: 12,
            overflow: 'hidden',
        }}>
            <button
                onClick={() => setOpen((v) => !v)}
                style={{
                    width: '100%',
                    display: 'flex',
                    /* Stacked on a phone. Side by side, a three-line heading and
                       a "Why" toggle share a row, and the toggle ends up level
                       with the middle of the heading looking like it belongs to
                       the wrong line. */
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    justifyContent: 'space-between',
                    gap: isMobile ? 8 : 12,
                    padding: isMobile ? '14px 14px' : '14px 18px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <span>
                    <span style={{
                        display: 'block', ...warm.text.micro,
                        color: warm.colors.accentPetrol, marginBottom: 3,
                    }}>
                        Last step
                    </span>
                    <span style={{ display: 'block', ...warm.text.h3, color: warm.colors.textPrimary }}>
                        Tell someone at {company || 'the company'} you have applied
                    </span>
                    <span style={{ display: 'block', ...warm.text.small, color: warm.colors.textSecondary, marginTop: 2 }}>
                        Two minutes, and it is the one part of this you still control.{' '}
                        Why it works, and who to write to.
                    </span>
                </span>
                <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 700, color: warm.colors.accentPetrol,
                    whiteSpace: 'nowrap',
                }}>
                    {open ? 'Hide' : 'Why'}
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>

            {open && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    padding: isMobile ? '4px 14px 16px' : '4px 18px 18px',
                }}>
                    {/*
                      The argument, in three lines rather than one paragraph.

                      Split deliberately: it is two statistics and the
                      conclusion they force, and run together as prose the
                      conclusion is the part that gets skimmed past. On its own
                      line it is the sentence that makes someone act.
                    */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                            <strong style={{ color: warm.colors.textPrimary }}>The majority (70%) of Australian
                            employers</strong> see someone following up as a positive gesture, SEEK data shows.
                        </p>
                        <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                            Yet <strong style={{ color: warm.colors.textPrimary }}>41% of Australian
                            candidates</strong> confess to not following up on their applications.
                        </p>
                        <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textPrimary, lineHeight: 1.6, fontWeight: 600 }}>
                            So the one action that can really set your application apart and get you noticed is
                            the one hardly any of the competition is doing.
                        </p>
                    </div>

                    <div>
                        <button
                            onClick={() => setWhoOpen((v) => !v)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                width: '100%', padding: 0, background: 'transparent', border: 'none',
                                cursor: 'pointer', textAlign: 'left',
                                fontSize: 12, fontWeight: 700, color: warm.colors.textPrimary,
                            }}
                        >
                            {whoOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            Who to message, best odds first
                        </button>
                        {whoOpen && (
                            <ol style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {TARGETS.map((target) => (
                                    <li key={target.title} style={{ fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                                        <span style={{ fontWeight: 700, color: warm.colors.textPrimary }}>{target.title}.</span>{' '}
                                        {target.detail}
                                    </li>
                                ))}
                            </ol>
                        )}
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
                            <strong style={{ color: warm.colors.textPrimary }}>LinkedIn first.</strong> Free, no
                            email needed, and the note below fits in a connection request.
                        </p>
                        <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                            <strong style={{ color: warm.colors.textPrimary }}>Email second.</strong>{' '}
                            {sendable
                                ? <>We found an address for {sendable.name}. It is filled in below.</>
                                : <>Find the company's address pattern on Hunter.io, usually
                                    firstname.lastname@company.com, then apply it to the name from LinkedIn.</>}
                        </p>
                    </div>

                </div>
            )}
        </div>

        {/*
            The messages, on the page rather than behind the banner.

            This is the task. Everything above it is the reason for the task,
            and a reason that hides the task is not doing its job.
        */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
                background: 'rgba(197, 160, 89, 0.12)',
                border: '1px solid rgba(197, 160, 89, 0.35)',
                borderRadius: 8,
                padding: '10px 14px',
            }}>
                <p style={{ margin: 0, fontSize: 13, color: warm.colors.textPrimary, lineHeight: 1.6 }}>
                    {hasBlanks ? (
                        <>
                            Fill every highlighted blank before you send. A recruiter spots an
                            untouched template instantly.
                        </>
                    ) : (
                        <>
                            Filled in from your cover letter and ready to send. Read it once, and
                            change the evidence if it is not what you would have led with.
                        </>
                    )}
                </p>
            </div>

            {/*
                With an address we can hand them a filled compose window, which
                is the whole point. Without one the three copy-out cards are
                still the best available, so nothing regresses on the two
                employers in three where discovery finds nobody.
            */}
            {sendable ? (
                <OutreachSendCard
                    personName={sendable.name}
                    personTitle={sendable.title}
                    company={company ?? null}
                    addresses={sendable.addresses}
                    draft={{ subject: t.subject, body: t.email }}
                    userEmail={userEmail ?? null}
                    linkedInNote={t.linkedIn}
                />
            ) : (
                <>
                    <TemplateCard
                        label="LinkedIn note"
                        icon={<Linkedin size={12} />}
                        text={t.linkedIn}
                        charLimit={LINKEDIN_NOTE_LIMIT}
                        needsEdit={t.linkedInNeedsPitch}
                    />

                    {/*
                        Where the address would have been.

                        Without this the two outcomes render identically: an
                        address we found sits above the subject line inside the
                        send card, and an address we did NOT find is simply
                        absent, so the screen goes straight from the LinkedIn
                        note to "Email subject" and the reader is left deciding
                        whether the lookup failed or they missed it. It did fail,
                        for about two employers in three, and that is a fact
                        about the employer rather than an error — so it says so
                        plainly and hands over the way to finish the job by hand.
                    */}
                    <div style={{
                        background: warm.colors.bgSurface,
                        border: `1px dashed ${warm.colors.borderDefined}`,
                        borderRadius: 12,
                        padding: isMobile ? 12 : 16,
                    }}>
                        <p style={{
                            margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                            letterSpacing: '0.1em', color: warm.colors.textMuted,
                        }}>
                            <Mail size={12} /> Email address
                        </p>
                        <p style={{
                            margin: 0, fontSize: isMobile ? 14 : 13, lineHeight: 1.6,
                            color: warm.colors.textSecondary,
                        }}>
                            {contactLoading ? (
                                <>Looking for someone to send this to&hellip;</>
                            ) : (
                                <>
                                    {contactFailed
                                        ? 'The lookup did not complete, so there is no address here.'
                                        : <>We could not find an address for {company || 'this employer'}.</>}
                                    {' '}Send the LinkedIn note above instead, or find the address
                                    yourself: the pattern is usually firstname.lastname@ their domain,
                                    and the name is on the company&rsquo;s LinkedIn people tab.
                                </>
                            )}
                        </p>
                    </div>

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
                </>
            )}

            <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, lineHeight: 1.6 }}>
                Neither message asks for anything. That is deliberate: the first one with no
                request in it is the one that gets answered.
            </p>
        </div>
        </div>
    );
}

export default PostApplyOutreach;
