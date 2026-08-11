export type EmailTemplateId =
  | 'application-followup'
  | 'interview-thankyou';

export interface UserProfileLite {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

/**
 * The minimum a template needs off a job. Kept structural so both the full
 * JobApplication and the lighter shapes used elsewhere satisfy it.
 */
export interface JobContextLite {
  title: string;
  company: string;
  dateApplied: string | null;
}

/**
 * Shown anywhere a template is copied. Templates prefill what we know for
 * certain (name, company, role, date) and deliberately leave the judgement
 * calls as placeholders, so the user must read before sending.
 */
export const PRE_SEND_WARNING =
  'Check before you send. Anything still in [square brackets] needs your input, ' +
  'and the details we filled in for you are worth a glance too.';

export interface RenderedEmail {
  subject: string;
  body: string;
  /** Full text including "Subject: ..." prefix, for one-click copy. */
  full: string;
}

// ── Raw templates (canonical source) ──────────────────────────────────────

const RAW_TEMPLATES: Record<EmailTemplateId, { subject: string; body: string }> = {
  // Kiron's script, module 05 at 5:18, word for word. Two sentences on purpose:
  // the doctrine is that a follow-up confirms the application arrived and does
  // NOT ask for the job. Do not pad this out. Every extra line is a line that can
  // be held against the candidate, and none of them make the email work better.
  'application-followup': {
    subject: 'Application for [Job Title], submitted [date]',
    body: `Hi [Hiring Manager Name],

I submitted an application for [Job Title] at [Company] on [date] and wanted to check if it arrived. I remain very interested, happy to provide any additional information if helpful.

Kind regards,
[Your Name]
[Phone] | [Email]`,
  },
  'interview-thankyou': {
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
};

/** Return the unrendered (placeholders-only) template — used by EmailTemplatesLibrary. */
export function getRawTemplate(id: EmailTemplateId): { subject: string; body: string } {
  const t = RAW_TEMPLATES[id];
  if (!t) throw new Error(`Unknown email template id: ${id}`);
  return { subject: t.subject, body: t.body };
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '[date]';
  try {
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return '[date]';
  }
}

/**
 * Render a canonical email template with job + user context substituted.
 * Placeholders that require human judgment are left intact.
 */
export function renderTemplate(
  id: EmailTemplateId,
  job: JobContextLite,
  profile?: UserProfileLite,
): RenderedEmail {
  const raw = RAW_TEMPLATES[id];
  if (!raw) throw new Error(`Unknown email template id: ${id}`);

  const subs: Record<string, string | undefined> = {
    '[Job Title]': job.title,
    '[Company]': job.company,
    '[date]': fmtDate(job.dateApplied),
    '[Your Name]': profile?.name ?? undefined,
    '[Phone]': profile?.phone ?? undefined,
    '[Email]': profile?.email ?? undefined,
  };

  let subject = raw.subject;
  let body = raw.body;

  for (const [placeholder, value] of Object.entries(subs)) {
    if (value && value.trim().length > 0) {
      subject = subject.replaceAll(placeholder, value);
      body = body.replaceAll(placeholder, value);
    }
  }

  return {
    subject,
    body,
    full: `Subject: ${subject}\n\n${body}`,
  };
}
