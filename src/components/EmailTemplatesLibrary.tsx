import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, CheckCircle, ChevronDown, ChevronUp, Mail } from 'lucide-react';
import { toast } from 'sonner';

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
        subject: 'Following Up — [Job Title] Application',
        body: `Hi [Hiring Manager Name],

I wanted to follow up on my application for the [Job Title] role at [Company], submitted on [date].

I remain very interested in the position, particularly because of [specific reason — e.g., "your team's work on [project/product] aligns closely with my background in [area]"].

Please let me know if you need any additional information to support my application. I'm happy to provide references, work samples, or answer any questions at your convenience.

Thank you for your consideration.

Kind regards,
[Your Name]
[Phone] | [Email]`,
    },
    {
        id: 'interview-thankyou',
        title: 'Thank-You After Interview',
        category: 'Interview',
        subject: 'Thank You — [Job Title] Interview',
        body: `Hi [Interviewer Name],

Thank you for taking the time to meet with me today about the [Job Title] role at [Company].

I enjoyed learning more about [specific topic discussed — e.g., "the team's approach to [challenge]"] and found it reinforced my enthusiasm for the position. Our conversation about [specific detail] particularly resonated with me — it aligns with my experience [brief relevant example].

I'm confident I could contribute meaningfully to [team/project goal], and I'm excited about the prospect of joining [Company].

Please don't hesitate to reach out if you have any further questions.

Best regards,
[Your Name]
[Phone]`,
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
];

const CATEGORIES = ['All', ...Array.from(new Set(TEMPLATES.map(t => t.category)))];

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

    const categoryColors: Record<string, string> = {
        Outreach: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        'Follow-Up': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        Interview: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        Networking: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        Offer: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
    };

    return (
        <div className="glass-card overflow-hidden">
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <Mail size={14} className="text-slate-500 shrink-0" />
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${categoryColors[template.category] || 'text-slate-500 bg-slate-800 border-slate-700'}`}>
                                {template.category}
                            </span>
                        </div>
                        <p className="text-sm font-semibold text-slate-200 truncate">{template.title}</p>
                        <p className="text-xs text-slate-500 truncate">{template.subject}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={e => { e.stopPropagation(); copy('all'); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-600 transition-colors"
                    >
                        {copied === 'all' ? <CheckCircle size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        Copy
                    </button>
                    {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden border-t border-slate-800"
                    >
                        <div className="p-4 space-y-3">
                            {/* Subject line */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">Subject</p>
                                    <p className="text-xs font-medium text-slate-300">{template.subject}</p>
                                </div>
                                <button
                                    onClick={() => copy('subject')}
                                    className="text-slate-600 hover:text-slate-300 transition-colors shrink-0 mt-3"
                                >
                                    {copied === 'subject' ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                </button>
                            </div>

                            {/* Body */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Body</p>
                                    <button
                                        onClick={() => copy('body')}
                                        className="text-slate-600 hover:text-slate-300 transition-colors"
                                    >
                                        {copied === 'body' ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                    </button>
                                </div>
                                <pre className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap font-sans p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                                    {template.body}
                                </pre>
                            </div>

                            <p className="text-[9px] text-slate-600 italic">
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
        <div className="space-y-8 animate-in fade-in duration-700">
            <header className="space-y-2">
                <h2 className="text-4xl font-extrabold tracking-tight text-white">Email Templates</h2>
                <p className="text-xl text-slate-400 font-medium">
                    {TEMPLATES.length} professional email templates for every stage of your job search.
                </p>
            </header>

            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                            category === cat
                                ? 'bg-brand-600/10 border-brand-600/30 text-brand-400'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-400'
                        }`}
                    >
                        {cat}
                        <span className="ml-1.5 opacity-50">
                            {cat === 'All' ? TEMPLATES.length : TEMPLATES.filter(t => t.category === cat).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Template cards */}
            <div className="space-y-3">
                {filtered.map(template => (
                    <TemplateCard key={template.id} template={template} />
                ))}
            </div>
        </div>
    );
};
