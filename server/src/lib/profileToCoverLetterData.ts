import type { CoverLetterData } from './coverLetterData';

export interface ProfileForCoverLetter {
  name?: string | null;
  targetRole?: string | null;
  professionalSummary?: string | null;
  location?: string | null;
}

export interface JobForCoverLetter {
  title?: string;
  company?: string;
  companyIntel?: {
    summary?: string | null;
    suggestedContact?: { title?: string | null } | null;
  } | null;
}

export function profileToCoverLetterData(
  profile: ProfileForCoverLetter,
  job: JobForCoverLetter
): CoverLetterData {
  const contactTitle = job.companyIntel?.suggestedContact?.title;
  const salutation = contactTitle
    ? `Dear ${contactTitle},`
    : 'Dear Hiring Manager,';

  const signoff = contactTitle
    ? 'Yours sincerely,'
    : 'Yours faithfully,';

  const companyRef = job.companyIntel?.summary
    ? ` I am particularly drawn to ${job.company} because ${job.companyIntel.summary}`
    : '';

  return {
    salutation,
    p1: `I am writing to express my interest in the ${job.title || 'available'} role at ${job.company || 'your organisation'}.${companyRef} With my background and skills, I believe I would be a strong contributor to your team.`,
    p2: `Throughout my career, I have developed a track record of delivering results. My professional experience has equipped me with the skills and expertise needed to excel in this role and make an immediate impact.`,
    p3: `I am particularly confident that my combination of skills, experience, and work ethic makes me an excellent fit for this position. I am eager to bring my abilities to ${job.company || 'your organisation'} and contribute to your continued success.`,
    p4: `I would welcome the opportunity to discuss how my experience aligns with the needs of your team. Thank you for considering my application — I look forward to hearing from you.`,
    signoff: `${signoff}\n${profile.name || 'Applicant'}`,
  };
}
