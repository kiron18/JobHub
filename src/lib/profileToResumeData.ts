import type { ResumeData } from './resumeRender';

// Minimal shape we need from the Prisma include
export interface ProfileWithRelations {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  location?: string | null;
  targetRole?: string | null;
  professionalSummary?: string | null;
  skills?: string | null;
  showReferees?: boolean | null;
  experience: Array<{
    id: string;
    role: string;
    company: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean;
    description?: string | null;
  }>;
  education: Array<{
    degree: string;
    field?: string | null;
    institution: string;
    location?: string | null;
    year?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  certifications?: Array<{
    name: string;
    issuingBody?: string | null;
    year?: string | null;
  }>;
  volunteering?: Array<{
    role: string;
    organization: string;
    description?: string | null;
  }>;
  languages?: Array<{
    name: string;
    proficiency: string;
  }>;
}

export function profileToResumeData(profile: ProfileWithRelations): ResumeData {
  return {
    name: profile.name || '',
    targetRole: profile.targetRole || undefined,
    email: profile.email || undefined,
    phone: profile.phone || undefined,
    linkedin: profile.linkedin || undefined,
    location: profile.location || undefined,
    professionalSummary: profile.professionalSummary || undefined,
    skills: profile.skills || undefined,
    experience: profile.experience.map(exp => ({
      role: exp.role,
      company: exp.company,
      location: exp.location || undefined,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isCurrent: exp.isCurrent || false,
      description: exp.description || undefined,
    })),
    education: profile.education.map(ed => ({
      degree: ed.degree,
      field: ed.field || undefined,
      institution: ed.institution,
      location: ed.location || undefined,
      year: ed.year || undefined,
      startDate: ed.startDate || undefined,
      endDate: ed.endDate || undefined,
    })),
    certifications: (profile.certifications || []).map(c => ({
      name: c.name,
      issuingBody: c.issuingBody || '',
      year: c.year || undefined,
    })),
    volunteering: (profile.volunteering || []).map(v => ({
      role: v.role,
      organization: v.organization,
      description: v.description || undefined,
    })),
    languages: (profile.languages || []).map(l => ({
      name: l.name,
      proficiency: l.proficiency,
    })),
    showReferees: profile.showReferees ?? true,
  };
}
