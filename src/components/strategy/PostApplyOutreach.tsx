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
import { ChevronDown, ChevronUp, Linkedin, Mail, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { warm } from '../../lib/theme/warmTokens';
import { buildOutreachMessages } from '../../lib/outreachFill';
import { resolveContact, isGenericAddress } from '../../lib/contactSlots';
import { useIsMobile } from '../../hooks/useIsMobile';
import { clientForAddress, composeUrl, fitBody } from '../../lib/composeHandoff';
import { CONTACT_DISCLAIMER } from './OutreachSendCard';

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
    const { data: contact } = useQuery({
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
            /*
              The domain is kept even when no person is found, because it is the
              difference between the two failures. Resolving bcec.com.au and
              then finding nobody in HR or marketing is a very different thing
              to never working out who the employer is, and only the first can
              tell the candidate that the address they want almost certainly
              ends in @bcec.com.au.
            */
            return { contact: resolveContact(data), domain: (data?.domain as string | null) ?? null };
        },
    });

    // A name with no address cannot fill a compose window, so the card only
    // replaces the manual instructions when it can actually do better.
    const found = contact?.contact ?? null;
    const domain = contact?.domain ?? null;
    const sendable = found && found.addresses.length > 0 ? found : null;

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
    /*
      Which of the two goes first is decided by which one is FINISHED.

      With an address, mailing is one tap and done. Without one it opens a
      window with an empty To line, which is a job rather than an action, and
      the LinkedIn note is then the only thing on the card that works straight
      away. So the order follows the work remaining, not a fixed opinion about
      which channel is better.
    */
    const sendTo = sendable?.addresses[0]?.address ?? null;
    const primaryIsEmail = Boolean(sendTo);
    const client = clientForAddress(userEmail);
    const clientName = client === 'gmail' ? 'Gmail' : client === 'outlook' ? 'Outlook' : null;
    const mailLabel = sendTo
        ? `Send the follow-up${clientName ? ` in ${clientName}` : ''}`
        : 'Draft the email anyway';

    function openMail() {
        // An empty `to` is deliberate and valid on all three targets: compose
        // opens with the cursor in the address line and everything else
        // written. A placeholder would be worse — anything in that field is a
        // real recipient, so it either delivers to a stranger or bounces.
        const url = composeUrl({ to: sendTo ?? '', subject: t.subject, body: t.email }, client);
        window.open(url, '_blank', 'noopener');
        if (fitBody(t.email).truncated) {
            toast('The last paragraphs were too long for a compose link. Paste the rest before you send.');
        } else if (t.emailNeedsPitch) {
            toast('Fill in the [bracketed] line before you send it.');
        }
    }

    async function copyNote() {
        try {
            await navigator.clipboard.writeText(t.linkedIn);
            /*
              The clipboard is invisible, which is the whole problem with
              collapsing a draft behind a copy button: an untouched
              "[One line on why this role fits you.]" goes to a recruiter and
              nobody saw it happen. The email path does not need this because
              the compose window shows the body.
            */
            toast.success(t.linkedInNeedsPitch
                ? 'Copied. Fill in the [bracketed] line, then paste it into your connection request.'
                : 'Copied. Paste it into your LinkedIn connection request.');
        } catch {
            toast.error('Could not copy. Long-press the note to select it instead.');
        }
    }

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
            Two buttons and two links, and nothing else.

            This was three cards holding an address field, a subject field, a
            nine-row textarea and three copy buttons, all of it on screen at
            once at the end of a flow whose whole job was already done. Nobody
            edits a draft they did not ask to see. What they do is act on it, so
            the drafts live inside the actions now and the card is four things
            instead of forty lines.

            The two channels are not symmetrical and the buttons are not either.
            Email has a compose deep link, so its button OPENS a filled window.
            LinkedIn has no URL that pre-fills a connection note, so its button
            can only put the text on the clipboard and say where to paste it.
            That asymmetry is the platform's, not a design choice.
        */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {primaryIsEmail ? (
                <>
                    <ActionButton
                        tone="primary"
                        icon={<Mail size={16} />}
                        label={mailLabel}
                        onClick={openMail}
                        note={sendTo
                            ? `Opens ${clientName ?? 'your email'} to ${sendTo}. It sends from your address.`
                            : undefined}
                    />
                    <ActionButton
                        tone="secondary"
                        icon={<Linkedin size={16} />}
                        label="Copy the LinkedIn note"
                        onClick={copyNote}
                    />
                </>
            ) : (
                <>
                    <ActionButton
                        tone="primary"
                        icon={<Linkedin size={16} />}
                        label="Copy the LinkedIn note"
                        onClick={copyNote}
                        note="Paste it into a connection request. No address needed, and it is the one that gets answered more often."
                    />
                    <ActionButton
                        tone="secondary"
                        icon={<Mail size={16} />}
                        label="Draft the email anyway"
                        onClick={openMail}
                        note="Opens with everything written and the To line empty, for once you have found an address."
                    />
                </>
            )}

            {/* Quieter, because finding a person is the step BEFORE the two
                above rather than a third thing to choose between. */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                marginTop: 2, paddingLeft: 2,
            }}>
                {company && (
                    <FindLink
                        href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company)}`}
                        label={`Find someone at ${company}`}
                    />
                )}
                {!sendTo && domain && (
                    <FindLink
                        href={`https://hunter.io/search/${encodeURIComponent(domain)}`}
                        label={`Look up ${domain} on Hunter`}
                    />
                )}
            </div>

            <p style={{ margin: '2px 0 0', fontSize: 11.5, lineHeight: 1.5, color: warm.colors.textMuted }}>
                {sendTo
                    ? CONTACT_DISCLAIMER
                    : 'Neither message asks for anything. That is deliberate: the first one with no request in it is the one that gets answered.'}
            </p>
        </div>
        </div>
    );
}

export default PostApplyOutreach;

/* -- The two shapes the card is made of ----------------------------------- */

/**
 * One action, its label, and one line saying what happens when it is pressed.
 *
 * The note is not decoration. These buttons open somebody's mail client or
 * write to their clipboard, and a button whose effect you only discover after
 * pressing it is the reason people do not press buttons.
 */
function ActionButton({ tone, icon, label, note, onClick }: {
    tone: 'primary' | 'secondary';
    icon: React.ReactNode;
    label: string;
    note?: string;
    onClick: () => void;
}) {
    const primary = tone === 'primary';
    return (
        <div>
            <button
                type="button"
                onClick={onClick}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    width: '100%', minHeight: 48, padding: '13px 18px',
                    fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: primary ? warm.colors.textOnDeep : warm.colors.textPrimary,
                    background: primary ? warm.colors.accentPetrol : warm.colors.bgSurface,
                    border: primary ? 'none' : `1px solid ${warm.colors.borderDefined}`,
                    borderRadius: 12, cursor: 'pointer',
                    boxShadow: primary ? '0 1px 2px rgba(16,24,40,0.06), 0 6px 18px rgba(18,87,196,0.20)' : 'none',
                }}
            >
                {icon}{label}
            </button>
            {note && (
                <p style={{
                    margin: '6px 2px 0', fontSize: 12, lineHeight: 1.5,
                    color: warm.colors.textMuted,
                }}>
                    {note}
                </p>
            )}
        </div>
    );
}

/** Where to go when the card cannot hand over a person. Deliberately quiet. */
function FindLink({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                minHeight: 44, fontSize: 13.5, fontWeight: 600,
                color: warm.colors.accentPetrol, textDecoration: 'none',
            }}
        >
            <Search size={14} /> {label}
        </a>
    );
}
