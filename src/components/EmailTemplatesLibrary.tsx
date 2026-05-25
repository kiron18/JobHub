import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, CheckCircle, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { warm } from '../lib/theme/warmTokens';
import { SectionIntroBanner } from './processStrip';
import { getRawTemplate } from '../lib/emailTemplates';

interface Template {
    id: string;
    title: string;
    category: string;
    subject: string;
    body: string;
}

const TEMPLATES: Template[] = [
    {
        id: 'recruiter-intro',
        title: 'Cold Outreach to Recruiter',
        category: 'Outreach',
        subject: 'Experienced [Your Role] — Open to Opportunities',
        body: `Hi [Recruiter Name],

I came across your profile on LinkedIn and noticed you place [specialty area] professionals in [industry/location].

I'm a [Your Role] with [X] years of experience in [key strength 1] and [key strength 2]. I'm currently open to [type of role] opportunities in [location/remote].

My most recent role at [Company] involved [brief, specific achievement — e.g., "reducing onboarding time by 40% for a team of 12 engineers"].

Would you be open to a 15-minute call to discuss whether my background might fit any current or upcoming roles you're working on?

Thanks for your time,
[Your Name]
[LinkedIn URL] | [Phone]`,
    },
    {
        id: 'application-followup',
        title: 'Follow-Up After Application',
        category: 'Follow-Up',
        ...getRawTemplate('application-followup'),
    },
    {
        id: 'interview-thankyou',
        title: 'Thank-You After Interview',
        category: 'Interview',
        ...getRawTemplate('interview-thankyou'),
    },
    {
        id: 'informational-interview',
        title: 'Request for Informational Interview',
        category: 'Networking',
        subject: 'Quick Chat? — Learning About [Company/Industry]',
        body: `Hi [Name],

I hope this message finds you well. I came across your profile while researching [Company/Industry] and was impressed by your work on [specific area or project].

I'm currently exploring [career transition/new area] and would love to hear your perspective on [specific question — e.g., "what skills matter most in this space" or "what the culture is like at [Company]"].

Would you be open to a 20-minute virtual coffee chat at your convenience? I'm happy to work around your schedule.

No pressure either way — I appreciate your time regardless.

Thanks,
[Your Name]
[LinkedIn URL]`,
    },
    {
        id: 'offer-acknowledgement',
        title: 'Acknowledge Job Offer (Buying Time)',
        category: 'Offer',
        subject: 'Re: Offer for [Job Title] — Thank You',
        body: `Hi [HR/Hiring Manager Name],

Thank you so much for the offer — I'm genuinely excited about the opportunity to join [Company] as [Job Title].

I would like to take a couple of days to carefully review the offer details before formally accepting. I want to make sure I'm entering this role fully committed and ready to contribute from day one.

Could I please have until [date — typically 2-3 business days from now] to provide my formal response?

Thank you again for this opportunity. I look forward to being in touch shortly.

Kind regards,
[Your Name]`,
    },
    {
        id: 'salary-negotiation',
        title: 'Counter-Offer on Salary',
        category: 'Offer',
        subject: 'Re: Offer for [Job Title]',
        body: `Hi [HR/Hiring Manager Name],

Thank you for the offer for the [Job Title] position at [Company]. I'm very enthusiastic about joining the team and contributing to [specific goal or project].

Having reviewed the offer in full, I'd like to respectfully discuss the base salary. Based on my [X] years of experience in [field], my track record of [brief achievement — e.g., "delivering $X in revenue growth"], and current market rates for this role in [location], I was hoping we could explore a base of [$X].

I'm flexible and open to discussing the overall package, including any performance reviews or benefits that might close the gap.

I remain very excited about this opportunity and confident we can find an arrangement that works for both parties.

Best regards,
[Your Name]`,
    },
    {
        id: 'rejection-followup',
        title: 'Response to Rejection',
        category: 'Follow-Up',
        subject: 'Re: [Job Title] Application — Thank You',
        body: `Hi [Name],

Thank you for letting me know about your decision for the [Job Title] role. While I'm disappointed not to progress, I genuinely appreciated the process and the time your team invested.

I remain a great admirer of [Company] and would welcome the opportunity to be considered for future roles that may be a stronger fit.

If you're able to share any brief feedback on my application or interview, I would find it invaluable for my development.

Thank you again, and I hope our paths cross in the future.

Kind regards,
[Your Name]`,
    },
    {
        id: 'referral-request',
        title: 'Ask for a Referral',
        category: 'Networking',
        subject: 'Would You Be Comfortable Referring Me? — [Company]',
        body: `Hi [Name],

I hope you're going well. I noticed that [Company] is currently hiring for [Job Title], and I'm very interested in applying.

Given your experience there, I wondered whether you'd feel comfortable referring me or sharing your thoughts on whether my background might be a good fit. I've attached my resume for your reference.

Of course, there's absolutely no obligation — I completely understand if this isn't something you're in a position to do.

If you are happy to refer me, [Company]'s referral process typically involves [how referrals work — e.g., "submitting my application through the internal portal"].

Thanks so much for considering this. I really appreciate it.

Best,
[Your Name]`,
    },
    {
        id: 'linkedin-connection-request',
        title: '1. LinkedIn Connection Request',
        category: 'LinkedIn Outreach',
        subject: '(LinkedIn connection request — no subject field)',
        body: `Hi [First Name] — your post on [specific topic / one thing they wrote] has been on my mind. I'm [one-line context — e.g., "an international student finishing a Master's in [field] in Melbourne, learning the [industry] space"].

Would love to follow your work as I navigate this. No agenda — just curious how people I respect think.

[Your first name]

(Tip: LinkedIn connection requests are capped at ~300 characters. Trim if needed. Lead with the specific thing about them — never with a generic "I'd love to connect.")`,
    },
    {
        id: 'linkedin-post-acceptance',
        title: '2. After They Accept (No Ask)',
        category: 'LinkedIn Outreach',
        subject: '(LinkedIn DM — sent same day they accept)',
        body: `Hi [First Name],

Thanks for connecting.

I wanted to come back to your point about [specific thing from their content]. [Your honest reaction in one sentence — what resonated, what you'd want to dig into, what you tested or thought after reading it.]

Not asking for anything — just wanted to say hi properly. Looking forward to learning from your posts as I work through [your situation].

[Your first name]

(Tip: This message exists to PREVENT you from jumping to an ask. Send it the same day they accept, then go quiet for at least 2-3 weeks of public engagement before any further DM.)`,
    },
    {
        id: 'linkedin-engagement-comment',
        title: '3. Engagement Comment (Public)',
        category: 'LinkedIn Outreach',
        subject: '(Comment on their LinkedIn posts — recurring)',
        body: `[Pick ONE specific point they made — not the whole post. Quote or paraphrase it.]

[Your perspective in 1-2 sentences. Add something to the conversation — a related experience, a counter-angle done respectfully, or a real question that goes deeper. Do not just say "great post" or "totally agree". Add value or don't comment.]

[Optional: one specific follow-up question. Not "what do you think about X?" — too vague. Try "When you say [their phrase], do you mean [your interpretation A] or [interpretation B]?"]

(Tip: Comment on 3-5 of their posts over several weeks before any further DM. Recruiters and decision-makers watch their comment sections. Visibility through thoughtful comments builds standing nobody can fake.)`,
    },
    {
        id: 'linkedin-15-minute-ask',
        title: '4. The 15-Minute Ask',
        category: 'LinkedIn Outreach',
        subject: '(LinkedIn DM — only after weeks of engagement)',
        body: `Hi [First Name],

I've been following your posts for a few weeks now, and your point about [specific thing they wrote about] has genuinely shaped how I'm thinking about [your situation].

I know your time is limited. I'd love 15 minutes — virtual is great — to ask you a few specific questions about [ONE narrow topic — e.g., "how you decided which direction to specialise in early in your career", NOT "the industry"].

I'm not asking about jobs or referrals — I just want to learn from someone whose thinking I trust. Happy to fit around any 15-min gap. Coffee, Zoom, walking call — whatever's easiest for you.

[Your first name]

(Tip: Ask for TIME, not a job. Be specific about the topic so they can say yes without preparing. If they say no, thank them and keep engaging publicly — sometimes the answer is "not yet" not "no".)`,
    },
    {
        id: 'linkedin-post-chat-thanks',
        title: '5. Post-Chat Follow-Up',
        category: 'LinkedIn Outreach',
        subject: '(LinkedIn DM or email — same day as the chat)',
        body: `[First Name] — thank you for the time today.

What stuck with me most: [specific thing they said — quote them]. I went home and [what you actually did with their advice — actioned it, researched it, started something. Be concrete, not "I'll think about it"].

I'll keep you posted as [specific thing develops]. And if I can ever return the favour — even just reading drafts of anything you're working on — please ask.

[Your first name]

(Tip: This message turns one chat into an ongoing relationship. Send it the same day. Reference something specific they said — not a generic "thanks for your time". Show you listened.)`,
    },
    {
        id: 'linkedin-soft-ask',
        title: '6. The Soft Ask (After Standing)',
        category: 'LinkedIn Outreach',
        subject: '(LinkedIn DM — only after months of relationship)',
        body: `Hi [First Name],

Quick one — I know we've talked about [topic] over the last few months, and you've watched me work through [thing you've shown them].

I'm now actively [specific situation — e.g., "looking for grad roles in [field] starting [date]"], and I wanted to mention it to you because [specific reason their input matters here — not generic].

I'm not asking for a referral, but if anything crosses your radar that fits, I'd be grateful for the heads-up. Either way, I appreciate your perspective as I navigate this.

[Your first name]

(Tip: This is the ONLY template that asks for anything career-related. By the time you send it, you've built real standing. The "I'm not asking for a referral" framing makes the request easy to honour or politely decline — both feel respectful.)`,
    },
];

const CATEGORIES = ['All', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];

const categoryLabelColor: Record<string, string> = {
    Outreach: warm.colors.accentPetrol,
    'Follow-Up': warm.colors.accentGold,
    Interview: warm.colors.success,
    Networking: '#7C6CB5',
    Offer: warm.colors.accentPetrol,
};

const cardStyle: React.CSSProperties = {
    background: warm.colors.bgSurface,
    border: `1px solid ${warm.colors.borderWhisper}`,
    borderRadius: 18,
    overflow: 'hidden',
};

interface TemplateCardProps {
    template: Template;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template }) => {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState<'subject' | 'body' | 'all' | null>(null);

    const copy = (field: 'subject' | 'body' | 'all') => {
        const text = field === 'subject' ? template.subject
            : field === 'body' ? template.body
            : `Subject: ${template.subject}\n\n${template.body}`;
        navigator.clipboard.writeText(text);
        setCopied(field);
        toast.success(field === 'all' ? 'Full email copied' : `${field === 'subject' ? 'Subject' : 'Body'} copied`);
        setTimeout(() => setCopied(null), 2000);
    };

    const catColor = categoryLabelColor[template.category] || warm.colors.textMuted;

    return (
        <div style={cardStyle}>
            <button
                onClick={() => setExpanded(e => !e)}
                style={{
                    width: '100%', padding: 16, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 16, textAlign: 'left',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'inherit', fontFamily: 'inherit',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <Mail size={14} style={{ color: warm.colors.textMuted, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                            <span style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                                padding: '1px 6px', borderRadius: 4, border: `1px solid ${catColor}40`,
                                color: catColor, background: `${catColor}12`,
                            }}>
                                {template.category}
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: warm.colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.title}</p>
                        <p style={{ margin: 0, fontSize: 12, color: warm.colors.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{template.subject}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button
                        onClick={e => { e.stopPropagation(); copy('all'); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                            borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            color: warm.colors.textSecondary, border: `1px solid ${warm.colors.borderWhisper}`,
                            background: 'transparent',
                        }}
                    >
                        {copied === 'all' ? <CheckCircle size={11} style={{ color: warm.colors.success }} /> : <Copy size={11} />}
                        Copy
                    </button>
                    {expanded ? <ChevronUp size={14} style={{ color: warm.colors.textMuted }} /> : <ChevronDown size={14} style={{ color: warm.colors.textMuted }} />}
                </div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.18 }}
                        style={{ overflow: 'hidden', borderTop: `1px solid ${warm.colors.borderWhisper}` }}
                    >
                        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Subject line */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</p>
                                    <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: warm.colors.textPrimary }}>{template.subject}</p>
                                </div>
                                <button onClick={() => copy('subject')} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: warm.colors.textMuted, display: 'flex', marginTop: 8, flexShrink: 0,
                                }}>
                                    {copied === 'subject' ? <CheckCircle size={13} style={{ color: warm.colors.success }} /> : <Copy size={13} />}
                                </button>
                            </div>

                            {/* Body */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: warm.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Body</p>
                                    <button onClick={() => copy('body')} style={{
                                        background: 'none', border: 'none', cursor: 'pointer', color: warm.colors.textMuted, display: 'flex',
                                    }}>
                                        {copied === 'body' ? <CheckCircle size={13} style={{ color: warm.colors.success }} /> : <Copy size={13} />}
                                    </button>
                                </div>
                                <pre style={{
                                    margin: 0, fontSize: 12, color: warm.colors.textSecondary, lineHeight: 1.65,
                                    whiteSpace: 'pre-wrap', fontFamily: warm.type.fontBody,
                                    padding: 12, background: warm.colors.bgAlt,
                                    borderRadius: 12, border: `1px solid ${warm.colors.borderWhisper}`,
                                }}>
                                    {template.body}
                                </pre>
                            </div>

                            <p style={{ margin: 0, fontSize: 9, color: warm.colors.textMuted, fontStyle: 'italic' }}>
                                Replace all [bracketed placeholders] before sending.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const EmailTemplatesLibrary: React.FC = () => {
    const [category, setCategory] = useState('All');

    const filtered = category === 'All' ? TEMPLATES : TEMPLATES.filter(t => t.category === category);

    return (
        <div>
            <SectionIntroBanner sectionId="emailTemplates">
                Battle-tested email templates for every stage — application follow-ups, post-interview thank-yous, salary negotiation. Copy, personalise, send.
            </SectionIntroBanner>
            <header style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: warm.colors.textPrimary, letterSpacing: '-0.02em', margin: '0 0 6px' }}>Email Templates</h2>
                <p style={{ margin: 0, fontSize: 14, color: warm.colors.textSecondary, fontWeight: 500 }}>
                    {TEMPLATES.length} professional email templates for every stage of your job search.
                </p>
            </header>

            {/* Category filter */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                {CATEGORIES.map(cat => {
                    const active = category === cat;
                    const catColor = categoryLabelColor[cat] || warm.colors.accentPetrol;
                    return (
                        <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            style={{
                                padding: '6px 10px', borderRadius: 10, fontSize: 9, fontWeight: 800,
                                letterSpacing: '0.06em', textTransform: 'uppercase',
                                cursor: 'pointer', border: `1px solid ${warm.colors.borderWhisper}`,
                                background: active ? `${catColor}14` : warm.colors.bgSurface,
                                color: active ? catColor : warm.colors.textMuted,
                            }}
                        >
                            {cat}
                            <span style={{ marginLeft: 4, opacity: 0.5 }}>
                                {cat === 'All' ? TEMPLATES.length : TEMPLATES.filter(t => t.category === cat).length}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Template cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(template => (
                    <TemplateCard key={template.id} template={template} />
                ))}
            </div>
        </div>
    );
};
