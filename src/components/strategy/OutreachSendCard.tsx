/**
 * The last screen before an email leaves: the address, the subject, the draft,
 * and a send button, in that order and with nothing in front of them.
 *
 * The card is deliberately flat. An earlier version led with the picker's
 * reasoning, which read as a case being argued before the candidate had seen
 * what they were sending. The reasoning still matters, because contact
 * discovery picks the right person about a third of the time, so it lives
 * behind the (i) on the address line: available in one click, never in the way.
 *
 * Every field is editable. A read-only address is useless at the exact moment
 * it is wrong, which is the moment the evidence popover exists to reveal.
 *
 * Nothing here sends. The button opens their own compose window with the draft
 * in it, so the message goes from their address, lands in their Sent folder,
 * and any reply comes back to them rather than to us.
 */
import { useState } from 'react';
import { Check, Copy, ExternalLink, Info, Linkedin, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { warm } from '../../lib/theme/warmTokens';
import { LINKEDIN_NOTE_LIMIT } from '../../lib/outreachFill';
import {
    clientForAddress, composeUrl, fitBody, rankAddresses, confidenceNote,
    type AddressOption, type ComposeDraft,
} from '../../lib/composeHandoff';

/**
 * The standing disclaimer. Deliberately quiet: it has to be present and
 * legible without competing with the draft, the way a model's own "check
 * important info" line sits under a reply rather than on top of it.
 */
export const CONTACT_DISCLAIMER =
    'Contact details are drawn from the job ad and public sources, so please double-check them before you send.';

export interface OutreachSendCardProps {
    personName: string;
    personTitle: string | null;
    company: string | null;
    /** Every address we can offer, in any order. Ranked here. */
    addresses: AddressOption[];
    draft: { subject: string; body: string };
    /** The address they signed up with, which decides the compose window. */
    userEmail: string | null;
    /** The LinkedIn connection note, when there is one. */
    linkedInNote?: string | null;
    /** Fires when the compose window opens, so the tracker can ask about it. */
    onOpened?: (address: string) => void;
}

const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 13px',
    fontSize: 13.5,
    fontFamily: 'inherit',
    color: warm.colors.textPrimary,
    background: warm.colors.bgSurface,
    border: `1px solid ${warm.colors.borderWhisper}`,
    borderRadius: 9,
    outline: 'none',
    boxSizing: 'border-box',
};

export default function OutreachSendCard({
    personName, personTitle, company, addresses, draft,
    userEmail, linkedInNote, onOpened,
}: OutreachSendCardProps) {
    const ranked = rankAddresses(addresses);
    const [address, setAddress] = useState(ranked[0]?.address ?? '');
    const [subject, setSubject] = useState(draft.subject);
    const [body, setBody] = useState(draft.body);
    const [showWhy, setShowWhy] = useState(false);
    const [opened, setOpened] = useState(false);
    const [copied, setCopied] = useState(false);

    // Which option the address currently in the box corresponds to, so the
    // popover keeps telling the truth after the candidate edits it by hand.
    const matched = ranked.find(a => a.address === address) ?? null;
    const { truncated } = fitBody(body);

    const handleSend = () => {
        if (!address.trim()) {
            toast.error('Add an email address first');
            return;
        }
        const payload: ComposeDraft = { to: address.trim(), subject, body };
        window.open(composeUrl(payload, clientForAddress(userEmail)), '_blank', 'noopener');
        setOpened(true);
        onOpened?.(address.trim());
    };

    const copyNote = async () => {
        if (!linkedInNote) return;
        try {
            await navigator.clipboard.writeText(linkedInNote);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            toast.error('Could not copy. Select the text and copy it manually.');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
                border: `1px solid ${warm.colors.borderWhisper}`,
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}>
                {/* Address, with the picker's reasoning behind the icon. */}
                <div style={{ position: 'relative' }}>
                    <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Email address"
                        aria-label="Email address"
                        style={{ ...fieldStyle, paddingRight: 42 }}
                    />
                    <button
                        onClick={() => setShowWhy(v => !v)}
                        aria-label="Where this contact came from"
                        title="Where this contact came from"
                        style={{
                            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30, borderRadius: '50%',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: showWhy ? warm.colors.accentPetrol : warm.colors.textMuted,
                        }}
                    >
                        <Info size={16} />
                    </button>

                    {showWhy && (
                        <div style={{
                            position: 'absolute', zIndex: 20, top: 'calc(100% + 6px)', right: 0, width: 'min(340px, 100%)',
                            background: warm.colors.bgSurface,
                            border: `1px solid ${warm.colors.borderWhisper}`,
                            borderRadius: 10, padding: 12,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                        }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: warm.colors.textPrimary }}>
                                {personName}
                            </p>
                            <p style={{ margin: '1px 0 8px', fontSize: 12, color: warm.colors.textSecondary }}>
                                {personTitle || 'Title unknown'}{company ? ` at ${company}` : ''}
                            </p>
                            {matched && (
                                <p style={{ margin: '0 0 8px', fontSize: 12, color: warm.colors.textSecondary, lineHeight: 1.5 }}>
                                    {confidenceNote(matched.confidence)}
                                </p>
                            )}
                            {matched && matched.why.length > 0 && (
                                <ul style={{ margin: 0, paddingLeft: 15, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {matched.why.map((w, i) => (
                                        <li key={i} style={{ fontSize: 12, color: warm.colors.textSecondary, lineHeight: 1.5 }}>{w}</li>
                                    ))}
                                </ul>
                            )}
                            {ranked.length > 1 && (
                                <div style={{ marginTop: 10, borderTop: `1px solid ${warm.colors.borderWhisper}`, paddingTop: 8 }}>
                                    <p style={{ margin: '0 0 5px', fontSize: 11, color: warm.colors.textMuted }}>Other addresses</p>
                                    {ranked.filter(o => o.address !== address).map(o => (
                                        <button
                                            key={o.address}
                                            onClick={() => { setAddress(o.address); setShowWhy(false); }}
                                            style={{
                                                display: 'block', width: '100%', textAlign: 'left',
                                                padding: '5px 0', fontSize: 12, color: warm.colors.accentPetrol,
                                                background: 'none', border: 'none', cursor: 'pointer', wordBreak: 'break-all',
                                            }}
                                        >
                                            {o.address}{o.label ? ` — ${o.label}` : ''}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line"
                    aria-label="Subject line"
                    style={fieldStyle}
                />

                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Your email"
                    aria-label="Email body"
                    rows={9}
                    style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }}
                />

                {truncated && (
                    <p style={{ margin: 0, fontSize: 11.5, color: '#B45309', lineHeight: 1.5 }}>
                        This draft is longer than a compose link carries, so the last
                        paragraphs will not be filled in. Paste the rest before sending.
                    </p>
                )}

                {/* The one obvious action, directly under what it sends. */}
                <button
                    onClick={handleSend}
                    style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        width: '100%', padding: '12px 18px',
                        fontSize: 14, fontWeight: 700,
                        color: warm.colors.textOnDeep, background: warm.colors.accentPetrol,
                        border: 'none', borderRadius: 10, cursor: 'pointer',
                    }}
                >
                    {opened ? <Check size={15} /> : <Mail size={15} />}
                    {opened ? 'Opened in your email' : 'Send email'}
                    <ExternalLink size={13} />
                </button>
            </div>

            <p style={{
                margin: '0 2px', fontSize: 11, lineHeight: 1.5,
                color: warm.colors.textMuted, opacity: 0.75,
            }}>
                {CONTACT_DISCLAIMER}
            </p>

            {linkedInNote && (
                <div style={{
                    background: warm.colors.bgAlt,
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    borderRadius: 12, padding: 14,
                    display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: warm.colors.accentPetrol,
                        }}>
                            <Linkedin size={13} /> LinkedIn connection note
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                fontSize: 11,
                                color: linkedInNote.length > LINKEDIN_NOTE_LIMIT ? '#B45309' : warm.colors.textMuted,
                            }}>
                                {linkedInNote.length} / {LINKEDIN_NOTE_LIMIT}
                            </span>
                            <button
                                onClick={copyNote}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    padding: '5px 10px', fontSize: 11.5, fontWeight: 600,
                                    color: warm.colors.textPrimary, background: warm.colors.bgSurface,
                                    border: `1px solid ${warm.colors.borderWhisper}`,
                                    borderRadius: 7, cursor: 'pointer',
                                }}
                            >
                                {copied ? <Check size={12} /> : <Copy size={12} />}
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12.5, color: warm.colors.textSecondary, lineHeight: 1.6 }}>
                        {linkedInNote}
                    </p>
                </div>
            )}
        </div>
    );
}
