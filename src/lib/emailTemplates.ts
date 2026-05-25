import type { JobApplication } from '../components/tracker/types';

export type EmailTemplateId =
  | 'application-followup'
  | 'interview-thankyou';

export interface UserProfileLite {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface RenderedEmail {
  subject: string;
  body: string;
  /** Full text including "Subject: ..." prefix, for one-click copy. */
  full: string;
}

// ── Raw templates (canonical source) ──────────────────────────────────────

const RAW_TEMPLATES: Record<EmailTemplateId, { subject: string; body: string }> = {
  'application-followup': {
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
  job: JobApplication,
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
